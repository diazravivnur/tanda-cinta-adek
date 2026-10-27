"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.joinCouple = exports.DEFAULT_COUPLE_ID = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
exports.DEFAULT_COUPLE_ID = "default-couple";
exports.joinCouple = (0, https_1.onCall)({
    region: "asia-southeast2",
}, async (request) => {
    // 1. Validasi Autentikasi
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Pengguna belum terautentikasi.");
    }
    const { uid, token } = request.auth;
    const rawEmail = token.email;
    if (!rawEmail) {
        throw new https_1.HttpsError("unauthenticated", "Email tidak ditemukan pada token autentikasi.");
    }
    // 2. Validasi status verifikasi email
    if (token.email_verified !== true) {
        throw new https_1.HttpsError("failed-precondition", "Email belum diverifikasi oleh penyedia akun Google.");
    }
    const normalizedUserEmail = rawEmail.trim().toLowerCase();
    // 3. Validasi Allowlist
    const allowedEnv = process.env.ALLOWED_EMAILS || "";
    const allowedEmails = allowedEnv
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    let role;
    if (allowedEmails.length >= 1 && normalizedUserEmail === allowedEmails[0]) {
        role = "ibu";
    }
    else if (allowedEmails.length >= 2 && normalizedUserEmail === allowedEmails[1]) {
        role = "ayah";
    }
    else {
        throw new https_1.HttpsError("permission-denied", "Akun ini tidak diizinkan.");
    }
    // 4. Eksekusi Atomic Transaction di Firestore
    const db = (0, firestore_1.getFirestore)();
    const coupleRef = db.collection("couples").doc(exports.DEFAULT_COUPLE_ID);
    const userRef = db.collection("users").doc(uid);
    const displayName = token.name ||
        token.email?.split("@")[0] ||
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
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        else {
            const coupleData = coupleDoc.data() || {};
            const currentMembers = coupleData.members || [];
            const currentRoles = coupleData.roles || {};
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
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        // Buat atau perbarui dokumen users/{uid}
        // Hanya joinCouple yang berwenang menetapkan role dan coupleId
        transaction.set(userRef, {
            uid,
            displayName,
            email: normalizedUserEmail,
            role,
            coupleId: exports.DEFAULT_COUPLE_ID,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    return {
        success: true,
        coupleId: exports.DEFAULT_COUPLE_ID,
        role,
        displayName,
        email: normalizedUserEmail,
    };
});
//# sourceMappingURL=joinCouple.js.map