import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "demo-tanda-cinta";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
const FUNCTIONS_URL = `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast2/acknowledgeUrgent`;
const COUPLE_ID = "m4-notifications-test";

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const app = getApps().find((candidate) => candidate.name === "m4-notifications-test") ??
  initializeApp({ projectId: PROJECT_ID }, "m4-notifications-test");
const auth = getAuth(app);
const db = getFirestore(app);

async function createUserAndToken(email: string): Promise<{ uid: string; token: string }> {
  const user = await auth.createUser({ email, password: "password123!", emailVerified: true });
  const response = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "password123!", returnSecureToken: true }),
    }
  );
  const data = (await response.json()) as { idToken?: string };
  if (!data.idToken) throw new Error("Gagal membuat token Auth Emulator.");
  return { uid: user.uid, token: data.idToken };
}

async function callAcknowledge(token: string, sessionId: string) {
  const response = await fetch(FUNCTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: { sessionId } }),
  });
  return { status: response.status, body: await response.json() as { result?: unknown; error?: { status?: string } } };
}

async function waitForUrgentLevel(sessionRef: FirebaseFirestore.DocumentReference): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const snapshot = await sessionRef.get();
    if (snapshot.get("notifiedLevel") === 3 && snapshot.get("lastUrgentSentAt")) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Function tidak menaikkan sesi ke level URGENT.");
}

describe("Milestone M4: Notifications", () => {
  const createdUids: string[] = [];

  afterAll(async () => {
    await db.doc(`couples/${COUPLE_ID}`).delete().catch(() => undefined);
    await Promise.all(createdUids.map(async (uid) => {
      await db.doc(`users/${uid}`).delete().catch(() => undefined);
      await auth.deleteUser(uid).catch(() => undefined);
    }));
    await app.delete();
  });

  it("manual urgent promotes the session and only the father can acknowledge", async () => {
    const mother = await createUserAndToken("m4-mother@example.test");
    const father = await createUserAndToken("m4-father@example.test");
    createdUids.push(mother.uid, father.uid);

    await db.doc(`couples/${COUPLE_ID}`).set({
      members: [mother.uid, father.uid],
      roles: { [mother.uid]: "ibu", [father.uid]: "ayah" },
      phones: { ibu: "+62000000000", ayah: "+62000000001" },
    });
    await Promise.all([
      db.doc(`users/${mother.uid}`).set({ uid: mother.uid, role: "ibu", coupleId: COUPLE_ID, fcmTokens: [] }),
      db.doc(`users/${father.uid}`).set({ uid: father.uid, role: "ayah", coupleId: COUPLE_ID, fcmTokens: [] }),
    ]);

    const sessionId = `m4-${Date.now()}`;
    const sessionRef = db.doc(`couples/${COUPLE_ID}/contractionSessions/${sessionId}`);
    await sessionRef.set({
      sessionId,
      startedAt: Timestamp.now(),
      lastContractionAt: Timestamp.now(),
      status: "INSUFFICIENT",
      notifiedLevel: 0,
      urgentRequestedAt: FieldValue.serverTimestamp(),
    });
    await waitForUrgentLevel(sessionRef);

    const rejected = await callAcknowledge(mother.token, sessionId);
    expect(rejected.body.error?.status).toBe("PERMISSION_DENIED");

    const accepted = await callAcknowledge(father.token, sessionId);
    expect(accepted.body.result).toBeDefined();
    const finalSession = await sessionRef.get();
    expect(finalSession.get("ackBy")).toBe(father.uid);
    expect(finalSession.get("ackAt")).toBeInstanceOf(Timestamp);
  });
});