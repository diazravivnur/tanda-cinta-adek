"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repeatUrgentNotifications = exports.acknowledgeUrgent = exports.onContractionSessionWrite = exports.onContractionWrite = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const messaging_1 = require("firebase-admin/messaging");
const firestore_2 = require("firebase-functions/v2/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const src_1 = require("../../packages/shared/src");
if ((0, app_1.getApps)().length === 0)
    (0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
const REGION = "asia-southeast2";
function epoch(value) {
    if (value instanceof firestore_1.Timestamp)
        return value.toMillis();
    return typeof value === "number" ? value : null;
}
function getTokensFromUserData(data) {
    return Array.isArray(data?.fcmTokens)
        ? data.fcmTokens
            .map((entry) => entry?.token)
            .filter((token) => typeof token === "string" && token.length > 0)
        : [];
}
async function sendToUsers(recipientUids, notification, data, urgency = "high") {
    const uniqueUids = [...new Set(recipientUids)];
    const userSnapshots = await Promise.all(uniqueUids.map((uid) => db.doc(`users/${uid}`).get()));
    const tokenOwners = userSnapshots.flatMap((snapshot) => getTokensFromUserData(snapshot.data()).map((token) => ({ token, uid: snapshot.id })));
    if (tokenOwners.length === 0)
        return;
    for (let index = 0; index < tokenOwners.length; index += 500) {
        const batch = tokenOwners.slice(index, index + 500);
        const message = {
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
        const result = await (0, messaging_1.getMessaging)().sendEachForMulticast(message);
        const invalidByUid = new Map();
        result.responses.forEach((response, responseIndex) => {
            const code = response.error?.code;
            if (code !== "messaging/registration-token-not-registered" && code !== "messaging/invalid-registration-token")
                return;
            const owner = batch[responseIndex];
            const tokens = invalidByUid.get(owner.uid) ?? new Set();
            tokens.add(owner.token);
            invalidByUid.set(owner.uid, tokens);
        });
        await Promise.all([...invalidByUid].map(async ([uid, invalidTokens]) => {
            const userRef = db.doc(`users/${uid}`);
            const userSnapshot = await userRef.get();
            const entries = Array.isArray(userSnapshot.data()?.fcmTokens) ? userSnapshot.data()?.fcmTokens : [];
            await userRef.update({ fcmTokens: entries.filter((entry) => !invalidTokens.has(entry.token ?? "")) });
        }));
    }
}
function roleMembers(couple, role) {
    return (couple.members ?? []).filter((uid) => couple.roles?.[uid] === role);
}
function safeThresholds(partial) {
    try {
        return (0, src_1.resolveThresholds)(partial);
    }
    catch {
        return (0, src_1.resolveThresholds)();
    }
}
async function evaluateAndNotify(coupleId, sessionId) {
    const coupleRef = db.doc(`couples/${coupleId}`);
    const sessionRef = coupleRef.collection("contractionSessions").doc(sessionId);
    const [coupleSnapshot, contractionSnapshot] = await Promise.all([
        coupleRef.get(),
        coupleRef.collection("contractions").where("sessionId", "==", sessionId).get(),
    ]);
    if (!coupleSnapshot.exists)
        return;
    const couple = coupleSnapshot.data();
    const now = Date.now();
    const contractions = contractionSnapshot.docs.map((snapshot) => {
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
    const evaluation = (0, src_1.classifyPattern)(contractions, now, safeThresholds(couple.thresholds));
    const transactionResult = await db.runTransaction(async (transaction) => {
        const latestSnapshot = await transaction.get(sessionRef);
        const latest = (latestSnapshot.data() ?? {});
        const latestLevel = Math.min(3, Math.max(0, latest.notifiedLevel ?? 0));
        const currentDecision = (0, src_1.decideContractionNotification)({
            notifiedLevel: latestLevel,
            status: evaluation.status,
            hasContraction: contractions.length > 0,
            urgentRequested: Boolean(latest.urgentRequestedAt),
            acknowledged: Boolean(latest.ackAt),
            lastUrgentSentAt: epoch(latest.lastUrgentSentAt),
        });
        const shouldSend = currentDecision.event !== "none" && !latest.ackAt;
        const changes = {};
        if (latest.status !== evaluation.status)
            changes.status = evaluation.status;
        if (currentDecision.level > latestLevel)
            changes.notifiedLevel = currentDecision.level;
        if (shouldSend && currentDecision.level === 3)
            changes.lastUrgentSentAt = firestore_1.Timestamp.fromMillis(now);
        if (Object.keys(changes).length > 0) {
            changes.updatedAt = firestore_1.FieldValue.serverTimestamp();
            transaction.set(sessionRef, changes, { merge: true });
        }
        return shouldSend ? currentDecision : { level: latestLevel, event: "none" };
    });
    if (transactionResult.event === "none")
        return;
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
exports.onContractionWrite = (0, firestore_2.onDocumentWritten)({ document: "couples/{coupleId}/contractions/{contractionId}", region: REGION }, async (event) => {
    const after = event.data?.after;
    if (!after?.exists)
        return;
    const sessionId = after.get("sessionId");
    if (typeof sessionId === "string")
        await evaluateAndNotify(event.params.coupleId, sessionId);
});
exports.onContractionSessionWrite = (0, firestore_2.onDocumentWritten)({ document: "couples/{coupleId}/contractionSessions/{sessionId}", region: REGION }, async (event) => {
    if (!event.data?.after.exists)
        return;
    await evaluateAndNotify(event.params.coupleId, event.params.sessionId);
});
exports.acknowledgeUrgent = (0, https_1.onCall)({ region: REGION }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Silakan masuk terlebih dahulu.");
    const sessionId = typeof request.data?.sessionId === "string" ? request.data.sessionId : "";
    if (!sessionId)
        throw new https_1.HttpsError("invalid-argument", "Sesi urgent tidak valid.");
    const profileSnapshot = await db.doc(`users/${request.auth.uid}`).get();
    const coupleId = profileSnapshot.data()?.coupleId;
    if (typeof coupleId !== "string")
        throw new https_1.HttpsError("permission-denied", "Akun belum terhubung ke pasangan.");
    const coupleRef = db.doc(`couples/${coupleId}`);
    const coupleSnapshot = await coupleRef.get();
    if (!coupleSnapshot.exists)
        throw new https_1.HttpsError("not-found", "Data pasangan tidak ditemukan.");
    const couple = coupleSnapshot.data();
    if (!couple.members?.includes(request.auth.uid) || couple.roles?.[request.auth.uid] !== "ayah") {
        throw new https_1.HttpsError("permission-denied", "Hanya Ayah Diaz yang dapat mengonfirmasi sedang menuju.");
    }
    const sessionRef = coupleRef.collection("contractionSessions").doc(sessionId);
    const ackAt = firestore_1.Timestamp.now();
    const didAcknowledge = await db.runTransaction(async (transaction) => {
        const sessionSnapshot = await transaction.get(sessionRef);
        if (!sessionSnapshot.exists)
            throw new https_1.HttpsError("not-found", "Sesi kontraksi tidak ditemukan.");
        if (sessionSnapshot.get("notifiedLevel") !== 3) {
            throw new https_1.HttpsError("failed-precondition", "Sesi ini belum ditandai sebagai URGENT.");
        }
        if (sessionSnapshot.get("ackAt"))
            return false;
        transaction.set(sessionRef, {
            ackBy: request.auth.uid,
            ackAt,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
});
exports.repeatUrgentNotifications = (0, scheduler_1.onSchedule)({ schedule: "every 1 minutes", timeZone: "Asia/Jakarta", region: REGION }, async () => {
    const couplesSnapshot = await db.collection("couples").get();
    const now = Date.now();
    await Promise.all(couplesSnapshot.docs.map(async (coupleDoc) => {
        const couple = coupleDoc.data();
        const sessions = await coupleDoc.ref.collection("contractionSessions")
            .where("notifiedLevel", "==", 3)
            .get();
        await Promise.all(sessions.docs.map(async (sessionDoc) => {
            const shouldSend = await db.runTransaction(async (transaction) => {
                const freshSnapshot = await transaction.get(sessionDoc.ref);
                const fresh = (freshSnapshot.data() ?? {});
                const lastSentAt = epoch(fresh.lastUrgentSentAt);
                if (!(0, src_1.shouldRepeatUrgent)({
                    notifiedLevel: Math.min(3, Math.max(0, fresh.notifiedLevel ?? 0)),
                    acknowledged: Boolean(fresh.ackAt),
                    lastUrgentSentAt: lastSentAt,
                }, now, src_1.URGENT_REPEAT_INTERVAL_MS))
                    return false;
                transaction.update(sessionDoc.ref, { lastUrgentSentAt: firestore_1.Timestamp.fromMillis(now) });
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
                    tag: `contraction-${sessionId}-urgent-repeat-${Math.floor(now / src_1.URGENT_REPEAT_INTERVAL_MS)}`,
                });
            }
        }));
    }));
});
//# sourceMappingURL=notifications.js.map