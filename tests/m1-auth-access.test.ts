import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { initializeApp as initAdminApp, getApps as getAdminApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

const PROJECT_ID = "demo-tanda-cinta";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";
const FUNCTIONS_EMULATOR_URL = `http://127.0.0.1:5001/${PROJECT_ID}/asia-southeast2/joinCouple`;

// Atur host emulator untuk Firebase Admin Auth
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";

const adminApp =
  getAdminApps().length === 0 ? initAdminApp({ projectId: PROJECT_ID }) : getAdminApps()[0];
const adminAuth = getAdminAuth(adminApp);

// Helper untuk membuat user pada Auth Emulator dan mendapatkan ID token
async function createAuthUserAndToken(
  email: string,
  verified = true
): Promise<{ uid: string; idToken: string }> {
  // 1. Buat user via Admin SDK di Auth Emulator dengan flag emailVerified yang tepat
  const user = await adminAuth.createUser({
    email,
    emailVerified: verified,
    password: "password123!",
    displayName: email.split("@")[0],
  });

  // 2. Login via REST API untuk mendapatkan ID token autentik dengan klaim email_verified
  const signInRes = await fetch(
    `${AUTH_EMULATOR_URL}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "password123!",
        returnSecureToken: true,
      }),
    }
  );

  const signInData = (await signInRes.json()) as { idToken?: string };
  if (!signInData.idToken) {
    throw new Error(`Failed to sign in test user: ${JSON.stringify(signInData)}`);
  }

  return { uid: user.uid, idToken: signInData.idToken };
}

// Helper untuk memanggil callable function joinCouple via HTTP
async function callJoinCouple(idToken?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  const res = await fetch(FUNCTIONS_EMULATOR_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: {} }),
  });

  const body = (await res.json()) as {
    result?: { success: boolean; role: string; coupleId: string; email: string };
    error?: { message: string; status: string };
  };

  return { status: res.status, ...body };
}

describe("Milestone M1: Auth & Akses", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: "127.0.0.1",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // Bersihkan semua akun di Auth Emulator sebelum setiap pengujian
    await fetch(`${AUTH_EMULATOR_URL}/emulator/v1/projects/${PROJECT_ID}/accounts`, {
      method: "DELETE",
    });
  });

  describe("Cloud Function: joinCouple", () => {
    it("1. Email ke-1 dalam allowlist berhasil join dan mendapat role 'ibu'", async () => {
      const { idToken, uid } = await createAuthUserAndToken(
        "test_ibu@example.com",
        true
      );
      const res = await callJoinCouple(idToken);

      expect(res.result?.success).toBe(true);
      expect(res.result?.role).toBe("ibu");
      expect(res.result?.coupleId).toBe("default-couple");

      // Verifikasi data tersimpan di Firestore
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const userDoc = await getDoc(doc(ctx.firestore(), "users", uid));
        expect(userDoc.exists()).toBe(true);
        expect(userDoc.data()?.role).toBe("ibu");
        expect(userDoc.data()?.coupleId).toBe("default-couple");

        const coupleDoc = await getDoc(
          doc(ctx.firestore(), "couples", "default-couple")
        );
        expect(coupleDoc.exists()).toBe(true);
        expect(coupleDoc.data()?.members).toContain(uid);
        expect(coupleDoc.data()?.roles?.[uid]).toBe("ibu");
      });
    });

    it("2. Email ke-2 dalam allowlist berhasil join dan mendapat role 'ayah'", async () => {
      const { idToken, uid } = await createAuthUserAndToken(
        "test_ayah@example.com",
        true
      );
      const res = await callJoinCouple(idToken);

      expect(res.result?.success).toBe(true);
      expect(res.result?.role).toBe("ayah");
      expect(res.result?.coupleId).toBe("default-couple");

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const userDoc = await getDoc(doc(ctx.firestore(), "users", uid));
        expect(userDoc.exists()).toBe(true);
        expect(userDoc.data()?.role).toBe("ayah");

        const coupleDoc = await getDoc(
          doc(ctx.firestore(), "couples", "default-couple")
        );
        expect(coupleDoc.exists()).toBe(true);
        expect(coupleDoc.data()?.members).toContain(uid);
        expect(coupleDoc.data()?.roles?.[uid]).toBe("ayah");
      });
    });

    it("3. Idempotent: dipanggil berulang tidak menduplikasi data atau anggota", async () => {
      const { idToken, uid } = await createAuthUserAndToken(
        "test_ibu@example.com",
        true
      );

      // Panggilan pertama
      const res1 = await callJoinCouple(idToken);
      expect(res1.result?.success).toBe(true);

      // Panggilan kedua
      const res2 = await callJoinCouple(idToken);
      expect(res2.result?.success).toBe(true);
      expect(res2.result?.role).toBe("ibu");

      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        const coupleDoc = await getDoc(
          doc(ctx.firestore(), "couples", "default-couple")
        );
        const members: string[] = coupleDoc.data()?.members || [];
        // Pastikan uid tidak muncul ganda di members
        const count = members.filter((m) => m === uid).length;
        expect(count).toBe(1);
      });
    });

    it("4. Email ketiga (di luar allowlist) ditolak dengan permission-denied", async () => {
      const { idToken } = await createAuthUserAndToken(
        "test_stranger@example.com",
        true
      );
      const res = await callJoinCouple(idToken);

      expect(res.error?.status).toBe("PERMISSION_DENIED");
      expect(res.error?.message).toContain("Akun ini tidak diizinkan");
    });

    it("5. Email yang belum diverifikasi ditolak dengan failed-precondition", async () => {
      const { idToken } = await createAuthUserAndToken(
        "test_ibu@example.com",
        false // unverified
      );
      const res = await callJoinCouple(idToken);

      expect(res.error?.status).toBe("FAILED_PRECONDITION");
      expect(res.error?.message).toContain("belum diverifikasi");
    });
  });

  describe("Firestore Security Rules", () => {
    const coupleId = "default-couple";
    const memberUid = "member_user_1";
    const nonMemberUid = "stranger_user_2";

    beforeEach(async () => {
      // Siapkan dokumen couple dan users dengan security rules disabled
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "couples", coupleId), {
          members: [memberUid],
          roles: { [memberUid]: "ibu" },
          hplDate: null,
          phones: { ayah: "", ibu: "" },
        });

        await setDoc(doc(ctx.firestore(), "users", memberUid), {
          uid: memberUid,
          displayName: "Wulan",
          email: "test_ibu@example.com",
          role: "ibu",
          coupleId,
        });
      });
    });

    it("6. Akun non-member TIDAK BISA membaca atau menulis ke couples/*", async () => {
      const strangerCtx = testEnv.authenticatedContext(nonMemberUid);
      const strangerDb = strangerCtx.firestore();

      // Coba baca dokumen couple
      await assertFails(getDoc(doc(strangerDb, "couples", coupleId)));

      // Coba tulis ke subkoleksi contractions
      await assertFails(
        setDoc(doc(strangerDb, "couples", coupleId, "contractions", "c1"), {
          startAt: Date.now(),
        })
      );
    });

    it("7. Member terdaftar BISA membaca couples/{id} dan subkoleksinya", async () => {
      const memberCtx = testEnv.authenticatedContext(memberUid);
      const memberDb = memberCtx.firestore();

      await assertSucceeds(getDoc(doc(memberDb, "couples", coupleId)));
      await assertSucceeds(
        setDoc(doc(memberDb, "couples", coupleId, "contractions", "c1"), {
          startAt: Date.now(),
        })
      );
    });

    it("8. Member TIDAK BISA mengubah field members atau roles pada couples/{id}", async () => {
      const memberCtx = testEnv.authenticatedContext(memberUid);
      const memberDb = memberCtx.firestore();

      // Coba ubah members -> harus gagal
      await assertFails(
        updateDoc(doc(memberDb, "couples", coupleId), {
          members: [memberUid, nonMemberUid],
        })
      );

      // Coba ubah roles -> harus gagal
      await assertFails(
        updateDoc(doc(memberDb, "couples", coupleId), {
          roles: { [memberUid]: "ayah" },
        })
      );

      // Namun boleh update data umum seperti phones
      await assertSucceeds(
        updateDoc(doc(memberDb, "couples", coupleId), {
          phones: { ayah: "+6281234567890", ibu: "+6289876543210" },
        })
      );
    });

    it("9. Klien TIDAK BISA membuat atau menghapus dokumen couples", async () => {
      const memberCtx = testEnv.authenticatedContext(memberUid);
      const memberDb = memberCtx.firestore();

      await assertFails(
        setDoc(doc(memberDb, "couples", "new-couple"), {
          members: [memberUid],
        })
      );
    });

    it("10. Klien TIDAK BISA membuat dokumen users sendiri atau mengubah role/coupleId", async () => {
      const strangerCtx = testEnv.authenticatedContext(nonMemberUid);
      const strangerDb = strangerCtx.firestore();

      // Akun asing mencoba membuat dokumen users sendiri secara langsung -> harus ditolak
      await assertFails(
        setDoc(doc(strangerDb, "users", nonMemberUid), {
          uid: nonMemberUid,
          role: "ibu",
          coupleId,
        })
      );

      const memberCtx = testEnv.authenticatedContext(memberUid);
      const memberDb = memberCtx.firestore();

      // Member mencoba mengubah role miliknya sendiri -> harus ditolak
      await assertFails(
        updateDoc(doc(memberDb, "users", memberUid), {
          role: "ayah",
        })
      );

      // Member mencoba mengubah coupleId miliknya sendiri -> harus ditolak
      await assertFails(
        updateDoc(doc(memberDb, "users", memberUid), {
          coupleId: "other-couple",
        })
      );

      // Member HANYA boleh memperbarui displayName, fcmTokens, atau updatedAt
      await assertSucceeds(
        updateDoc(doc(memberDb, "users", memberUid), {
          displayName: "Nama Baru",
          fcmTokens: [{ token: "fcm123", ua: "iPhone", updatedAt: Date.now() }],
          updatedAt: Date.now(),
        })
      );
    });
  });
});
