import { getMessaging, getToken, isSupported, Messaging } from "firebase/messaging";
import { doc, runTransaction } from "firebase/firestore";
import { app } from "./firebase";
import { db } from "./firebase";

let messagingInstance: Messaging | null = null;

export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

export function isStandalonePwa(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export async function enablePushNotifications(uid: string): Promise<string> {
  if (!isStandalonePwa()) {
    throw new Error("Tambahkan aplikasi ke Layar Utama dan buka dari ikonnya untuk mengaktifkan notifikasi.");
  }
  if (!("Notification" in window)) {
    throw new Error("Perangkat ini tidak mendukung notifikasi web.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi belum diberikan. Ubah izinnya di Pengaturan perangkat.");
  }

  const messaging = await getFirebaseMessaging();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!messaging || !vapidKey) {
    throw new Error("Notifikasi belum tersedia. Periksa konfigurasi Firebase Web Push.");
  }

  const registration = await navigator.serviceWorker.ready;
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Token notifikasi tidak berhasil dibuat. Coba lagi.");

  const userRef = doc(db, "users", uid);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists()) throw new Error("Profil akun belum tersedia. Muat ulang aplikasi lalu coba lagi.");
    const existing = Array.isArray(snapshot.data().fcmTokens) ? snapshot.data().fcmTokens : [];
    const fcmTokens = existing.filter((entry: { token?: string }) => entry.token !== token);
    fcmTokens.push({ token, ua: navigator.userAgent, updatedAt: Date.now() });
    transaction.update(userRef, { fcmTokens });
  });
  return token;
}
