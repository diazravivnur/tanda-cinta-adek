import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const DEFAULT_COUPLE_ID = "default-couple";

export const joinCouple = onCall(
  {
    region: "asia-southeast2",
  },
  async (request) => {
    // 1. Validasi Autentikasi
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Pengguna belum terautentikasi."
      );
    }

    const { uid, token } = request.auth;
    const rawEmail = token.email;

    if (!rawEmail) {
      throw new HttpsError(
        "unauthenticated",
        "Email tidak ditemukan pada token autentikasi."
      );
    }

    // 2. Validasi status verifikasi email
    if (token.email_verified !== true) {
      throw new HttpsError(
        "failed-precondition",
        "Email belum diverifikasi oleh penyedia akun Google."
      );
    }

    const normalizedUserEmail = rawEmail.trim().toLowerCase();

    // 3. Validasi Allowlist
    const allowedEnv = process.env.ALLOWED_EMAILS || "";
    const allowedEmails = allowedEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    let role: "ibu" | "ayah";
    if (allowedEmails.length >= 1 && normalizedUserEmail === allowedEmails[0]) {
      role = "ibu";
    } else if (allowedEmails.length >= 2 && normalizedUserEmail === allowedEmails[1]) {
      role = "ayah";
    } else {
      throw new HttpsError(
        "permission-denied",
        "Akun ini tidak diizinkan."
      );
    }

    // 4. Eksekusi Atomic Transaction di Firestore
    const db = getFirestore();
    const coupleRef = db.collection("couples").doc(DEFAULT_COUPLE_ID);
    const userRef = db.collection("users").doc(uid);

    const displayName =
      (token.name as string | undefined) ||
      (token.email as string | undefined)?.split("@")[0] ||
      "";

    await db.runTransaction(async (transaction) => {
      const coupleDoc = await transaction.get(coupleRef);

      if (!coupleDoc.exists) {
        // Inisialisasi dokumen couple pertama kali
        // hplDate dibiarkan null sampai diisi pada Pengaturan
        transaction.set(coupleRef, {
          members: [uid],
          roles: { [uid]: role },
          hplDate: null,
          phones: { ayah: "", ibu: "" },
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const coupleData = coupleDoc.data() || {};
        const currentMembers: string[] = coupleData.members || [];
        const currentRoles: Record<string, string> = coupleData.roles || {};

        const updatedMembers = currentMembers.includes(uid)
          ? currentMembers
          : [...currentMembers, uid];

        const updatedRoles = {
          ...currentRoles,
          [uid]: role,
        };

        transaction.update(coupleRef, {
          members: updatedMembers,
          roles: updatedRoles,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Buat atau perbarui dokumen users/{uid}
      // Hanya joinCouple yang berwenang menetapkan role dan coupleId
      transaction.set(
        userRef,
        {
          uid,
          displayName,
          email: normalizedUserEmail,
          role,
          coupleId: DEFAULT_COUPLE_ID,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return {
      success: true,
      coupleId: DEFAULT_COUPLE_ID,
      role,
      displayName,
      email: normalizedUserEmail,
    };
  }
);

