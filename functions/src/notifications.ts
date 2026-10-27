import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  classifyPattern,
  decideContractionNotification,
  resolveThresholds,
  shouldRepeatUrgent,
  URGENT_REPEAT_INTERVAL_MS,
  type Contraction,
  type NotificationLevel,
} from "../../packages/shared/src";

if (getApps().length === 0) initializeApp();

const db = getFirestore();
const REGION = "asia-southeast2";

interface CoupleRecord {
  members?: string[];
  roles?: Record<string, "ibu" | "ayah">;
  phones?: { ibu?: string };
  thresholds?: Record<string, number>;
}

interface SessionRecord {
  notifiedLevel?: number;
  status?: "INSUFFICIENT" | "IRREGULAR" | "REGULAR" | "ACTIVE_511";
  urgentRequestedAt?: Timestamp;
  lastUrgentSentAt?: Timestamp;
  ackBy?: string;
  ackAt?: Timestamp;
}

function epoch(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  return typeof value === "number" ? value : null;
}

function getTokensFromUserData(data: FirebaseFirestore.DocumentData | undefined): string[] {
  return Array.isArray(data?.fcmTokens)
    ? data.fcmTokens
        .map((entry: { token?: unknown }) => entry?.token)
        .filter((token: unknown): token is string => typeof token === "string" && token.length > 0)
    : [];
}

async function sendToUsers(
  recipientUids: string[],
  notification: { title: string; body: string },
  data: Record<string, string>,
  urgency: "normal" | "high" = "high"
): Promise<void> {
  const uniqueUids = [...new Set(recipientUids)];
  const userSnapshots = await Promise.all(uniqueUids.map((uid) => db.doc(`users/${uid}`).get()));
  const tokenOwners = userSnapshots.flatMap((snapshot) =>
    getTokensFromUserData(snapshot.data()).map((token) => ({ token, uid: snapshot.id }))
  );
  if (tokenOwners.length === 0) return;

  for (let index = 0; index < tokenOwners.length; index += 500) {
    const batch = tokenOwners.slice(index, index + 500);
    const message: MulticastMessage = {
      tokens: batch.map(({ token }) => token),
      notification,
      data,
      webpush: {
        headers: { Urgency: urgency, TTL: "600" },
        notification: {
          title: notification.title,
          body: notification.body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          requireInteraction: data.level === "3",
          data,
        },
      },
    };
    const result = await getMessaging().sendEachForMulticast(message);
    const invalidByUid = new Map<string, Set<string>>();
    result.responses.forEach((response, responseIndex) => {
      const code = response.error?.code;
      if (code !== "messaging/registration-token-not-registered" && code !== "messaging/invalid-registration-token") return;
      const owner = batch[responseIndex];
      const tokens = invalidByUid.get(owner.uid) ?? new Set<string>();
      tokens.add(owner.token);
      invalidByUid.set(owner.uid, tokens);
    });
    await Promise.all([...invalidByUid].map(async ([uid, invalidTokens]) => {
      const userRef = db.doc(`users/${uid}`);
      const userSnapshot = await userRef.get();
      const entries = Array.isArray(userSnapshot.data()?.fcmTokens) ? userSnapshot.data()?.fcmTokens : [];
      await userRef.update({ fcmTokens: entries.filter((entry: { token?: string }) => !invalidTokens.has(entry.token ?? "")) });
    }));
  }
}

function roleMembers(couple: CoupleRecord, role: "ibu" | "ayah"): string[] {
  return (couple.members ?? []).filter((uid) => couple.roles?.[uid] === role);
}

function safeThresholds(partial?: Record<string, number>) {
  try {
    return resolveThresholds(partial);
  } catch {
    return resolveThresholds();
  }
}

async function evaluateAndNotify(coupleId: string, sessionId: string): Promise<void> {
  const coupleRef = db.doc(`couples/${coupleId}`);
    const sessionRef = coupleRef.collection("contractionSessions").doc(sessionId);
    const [coupleSnapshot, contractionSnapshot] = await Promise.all([
      coupleRef.get(),
      coupleRef.collection("contractions").where("sessionId", "==", sessionId).get(),
    ]);
    if (!coupleSnapshot.exists) return;
    const couple = coupleSnapshot.data() as CoupleRecord;
    const now = Date.now();
    const contractions: Contraction[] = contractionSnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      const startAt = epoch(data.startAt) ?? 0;
      const endAt = epoch(data.endAt);
      return {
        id: snapshot.id,
        sessionId: String(data.sessionId ?? sessionId),
        startAt,
        endAt,
        durationSec: typeof data.durationSec === "number" ? data.durationSec : endAt === null ? null : Math.round((endAt - startAt) / 1000),
        intervalSec: typeof data.intervalSec === "number" ? data.intervalSec : null,
        intensity: data.intensity,
        note: data.note,
        createdBy: String(data.createdBy ?? ""),
      };
    });
    const evaluation = classifyPattern(contractions, now, safeThresholds(couple.thresholds));
    const transactionResult = await db.runTransaction(async (transaction) => {
      const latestSnapshot = await transaction.get(sessionRef);
      const latest = (latestSnapshot.data() ?? {}) as SessionRecord;
      const latestLevel = Math.min(3, Math.max(0, latest.notifiedLevel ?? 0)) as NotificationLevel;
      const currentDecision = decideContractionNotification({
        notifiedLevel: latestLevel,
        status: evaluation.status,
        hasContraction: contractions.length > 0,
        urgentRequested: Boolean(latest.urgentRequestedAt),
        acknowledged: Boolean(latest.ackAt),
        lastUrgentSentAt: epoch(latest.lastUrgentSentAt),
      });
      const shouldSend = currentDecision.event !== "none" && !latest.ackAt;
      const changes: Record<string, unknown> = {};
      if (latest.status !== evaluation.status) changes.status = evaluation.status;
      if (currentDecision.level > latestLevel) changes.notifiedLevel = currentDecision.level;
      if (shouldSend && currentDecision.level === 3) changes.lastUrgentSentAt = Timestamp.fromMillis(now);
      if (Object.keys(changes).length > 0) {
        changes.updatedAt = FieldValue.serverTimestamp();
        transaction.set(sessionRef, changes, { merge: true });
      }
      return shouldSend ? currentDecision : { level: latestLevel, event: "none" as const };
    });

    if (transactionResult.event === "none") return;
    const level = transactionResult.level;
    const intervalMinutes = evaluation.medianIntervalSec === null ? null : Math.round(evaluation.medianIntervalSec / 60);
    const eventType = transactionResult.event;
    const title = eventType === "info"
      ? "Wulan mulai mencatat kontraksi"
      : eventType === "regular"
        ? `Kontraksi Wulan mulai teratur${intervalMinutes === null ? "" : ` (tiap ±${intervalMinutes} mnt)`}`
        : "SEGERA: Pola 5-1-1 terpenuhi";
    const body = eventType === "urgent"
      ? "Hubungi Wulan sekarang. Ketuk untuk membuka layar URGENT."
      : eventType === "regular"
        ? "Pola kontraksi mulai teratur. Tetap pantau."
        : "Wulan mulai mencatat kontraksi.";
    const url = level === 3 ? `/urgent/${encodeURIComponent(sessionId)}` : "/";
    await sendToUsers(roleMembers(couple, "ayah"), { title, body }, {
      kind: "contraction",
      level: String(level),
      sessionId,
      url,
      tag: `contraction-${sessionId}-${level}`,
    }, eventType === "info" ? "normal" : "high");
}

export const onContractionWrite = onDocumentWritten(
  { document: "couples/{coupleId}/contractions/{contractionId}", region: REGION },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const sessionId = after.get("sessionId");
    if (typeof sessionId === "string") await evaluateAndNotify(event.params.coupleId, sessionId);
  }
);

export const onContractionSessionWrite = onDocumentWritten(
  { document: "couples/{coupleId}/contractionSessions/{sessionId}", region: REGION },
  async (event) => {
    if (!event.data?.after.exists) return;
    await evaluateAndNotify(event.params.coupleId, event.params.sessionId);
  }
);

export const acknowledgeUrgent = onCall(
  { region: REGION },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Silakan masuk terlebih dahulu.");
    const sessionId = typeof request.data?.sessionId === "string" ? request.data.sessionId : "";
    if (!sessionId) throw new HttpsError("invalid-argument", "Sesi urgent tidak valid.");
    const profileSnapshot = await db.doc(`users/${request.auth.uid}`).get();
    const coupleId = profileSnapshot.data()?.coupleId;
    if (typeof coupleId !== "string") throw new HttpsError("permission-denied", "Akun belum terhubung ke pasangan.");
    const coupleRef = db.doc(`couples/${coupleId}`);
    const coupleSnapshot = await coupleRef.get();
    if (!coupleSnapshot.exists) throw new HttpsError("not-found", "Data pasangan tidak ditemukan.");
    const couple = coupleSnapshot.data() as CoupleRecord;
    if (!couple.members?.includes(request.auth.uid) || couple.roles?.[request.auth.uid] !== "ayah") {
      throw new HttpsError("permission-denied", "Hanya Ayah Diaz yang dapat mengonfirmasi sedang menuju.");
    }
    const sessionRef = coupleRef.collection("contractionSessions").doc(sessionId);
    const ackAt = Timestamp.now();
    const didAcknowledge = await db.runTransaction(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      if (!sessionSnapshot.exists) throw new HttpsError("not-found", "Sesi kontraksi tidak ditemukan.");
      if (sessionSnapshot.get("notifiedLevel") !== 3) {
        throw new HttpsError("failed-precondition", "Sesi ini belum ditandai sebagai URGENT.");
      }
      if (sessionSnapshot.get("ackAt")) return false;
      transaction.set(sessionRef, {
        ackBy: request.auth!.uid,
        ackAt,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return true;
    });
    if (didAcknowledge) {
      await sendToUsers(roleMembers(couple, "ibu"), {
        title: "Ayah Diaz sedang menuju",
        body: "Ayah sudah menerima kabar dan sedang menuju.",
      }, { kind: "acknowledgement", sessionId, url: "/", tag: `ack-${sessionId}` });
    }
    return { success: true, acknowledgedAt: ackAt.toMillis() };
  }
);

export const repeatUrgentNotifications = onSchedule(
  { schedule: "every 1 minutes", timeZone: "Asia/Jakarta", region: REGION },
  async () => {
    const couplesSnapshot = await db.collection("couples").get();
    const now = Date.now();
    await Promise.all(couplesSnapshot.docs.map(async (coupleDoc) => {
      const couple = coupleDoc.data() as CoupleRecord;
      const sessions = await coupleDoc.ref.collection("contractionSessions")
        .where("notifiedLevel", "==", 3)
        .get();
      await Promise.all(sessions.docs.map(async (sessionDoc) => {
        const shouldSend = await db.runTransaction(async (transaction) => {
          const freshSnapshot = await transaction.get(sessionDoc.ref);
          const fresh = (freshSnapshot.data() ?? {}) as SessionRecord;
          const lastSentAt = epoch(fresh.lastUrgentSentAt);
          if (!shouldRepeatUrgent({
            notifiedLevel: Math.min(3, Math.max(0, fresh.notifiedLevel ?? 0)) as NotificationLevel,
            acknowledged: Boolean(fresh.ackAt),
            lastUrgentSentAt: lastSentAt,
          }, now, URGENT_REPEAT_INTERVAL_MS)) return false;
          transaction.update(sessionDoc.ref, { lastUrgentSentAt: Timestamp.fromMillis(now) });
          return true;
        });
        if (shouldSend) {
          const sessionId = sessionDoc.id;
          await sendToUsers(roleMembers(couple, "ayah"), {
            title: "SEGERA: Wulan membutuhkan bantuan",
            body: "Konfirmasi jika Anda sedang menuju. Ketuk untuk membuka layar URGENT.",
          }, {
            kind: "contraction",
            level: "3",
            sessionId,
            url: `/urgent/${encodeURIComponent(sessionId)}`,
            tag: `contraction-${sessionId}-urgent-repeat-${Math.floor(now / URGENT_REPEAT_INTERVAL_MS)}`,
          });
        }
      }));
    }));
  }
);