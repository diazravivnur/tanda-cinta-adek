/**
 * Screen Wake Lock API Helper
 * Menjaga layar tetap aktif saat pencatatan kontraksi berlangsung (SPEC §4.1).
 * Minta ulang saat visibilitychange (diperlukan di iOS PWA setelah kembali dari background).
 */

let wakeLockSentinel: WakeLockSentinel | null = null;
let visibilityListenerAttached = false;

/** Minta Wake Lock. Kembalikan true bila berhasil, false bila tidak didukung/gagal. */
export async function requestWakeLock(): Promise<boolean> {
  if (typeof window === "undefined" || !("wakeLock" in navigator)) {
    return false;
  }
  try {
    wakeLockSentinel = await navigator.wakeLock.request("screen");
    wakeLockSentinel.addEventListener("release", () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn("Wake lock request failed:", err);
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch (_err) {
      // Abaikan jika sudah lepas
    } finally {
      wakeLockSentinel = null;
    }
  }
}

/**
 * Aktifkan pendengar visibilitychange agar Wake Lock diminta ulang
 * saat tab kembali terlihat (iOS melepas wakeLock saat backgrounded).
 * Callback onRestored dipanggil jika berhasil memperoleh ulang.
 */
export function attachWakeLockVisibilityListener(
  onRestored?: () => void
): () => void {
  if (visibilityListenerAttached) return () => undefined;
  visibilityListenerAttached = true;

  const handler = async () => {
    if (document.visibilityState === "visible" && wakeLockSentinel === null) {
      const ok = await requestWakeLock();
      if (ok && onRestored) onRestored();
    }
  };

  document.addEventListener("visibilitychange", handler);
  return () => {
    document.removeEventListener("visibilitychange", handler);
    visibilityListenerAttached = false;
  };
}

/** Cek apakah Wake Lock API tersedia di perangkat ini. */
export function isWakeLockSupported(): boolean {
  return typeof navigator !== "undefined" && "wakeLock" in navigator;
}
