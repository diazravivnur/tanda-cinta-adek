/**
 * Utilitas pure function untuk manajemen sesi kontraksi.
 * Tidak ada I/O atau efek samping — aman dipakai di Cloud Functions dan browser.
 */

import { groupIntoSessions } from "../contractions/patternEngine";
import type { Contraction, ContractionSessionGroup } from "../../types";
import { DEFAULT_THRESHOLDS } from "../../config/thresholds";

/**
 * Membuat sessionId deterministik dari epoch ms kontraksi pertama sesi.
 * Format: "s_<epoch>" (contoh: "s_1700000000000")
 */
export function computeSessionId(sessionStartMs: number): string {
  return `s_${sessionStartMs}`;
}

/**
 * Mendapatkan sesi aktif dari daftar kontraksi dan waktu sekarang.
 * Sesi aktif = sesi terakhir dari groupIntoSessions, jika kontraksi terakhirnya
 * tidak lebih tua dari SESSION_GAP_MIN dibanding `now`.
 *
 * @param contractions - Semua kontraksi yang tersedia (epoch ms)
 * @param now - Waktu sekarang dalam epoch ms (diterima sebagai parameter, tidak memanggil Date.now)
 * @param sessionGapMin - Override jeda sesi (default: 60 menit)
 * @returns ContractionSessionGroup atau null jika tidak ada sesi aktif
 */
export function getActiveSession(
  contractions: readonly Contraction[],
  now: number,
  sessionGapMin: number = DEFAULT_THRESHOLDS.SESSION_GAP_MIN
): ContractionSessionGroup | null {
  if (contractions.length === 0) return null;

  const groups = groupIntoSessions(contractions, sessionGapMin);
  if (groups.length === 0) return null;

  const lastGroup = groups[groups.length - 1];
  const lastContraction = lastGroup.contractions[lastGroup.contractions.length - 1];
  const gapMs = now - lastContraction.startAt;
  const gapLimitMs = sessionGapMin * 60 * 1000;

  // Jeda tepat = tidak memisah; lebih dari itu = sesi sudah tidak aktif
  if (gapMs > gapLimitMs) return null;

  return lastGroup;
}

/**
 * Menemukan kontraksi yang sedang terbuka (endAt === null) dalam daftar.
 * Bila ada lebih dari satu (kondisi tidak normal), kembalikan yang paling terbaru.
 */
export function resolveOpenContraction(
  contractions: readonly Contraction[]
): Contraction | null {
  const open = contractions.filter((c) => c.endAt === null);
  if (open.length === 0) return null;
  // Ambil yang paling baru berdasarkan startAt
  return open.reduce((latest, c) => (c.startAt > latest.startAt ? c : latest), open[0]);
}

/**
 * Menentukan apakah kontraksi terbuka "terlalu lama" (defaultnya: > 5 menit)
 * sehingga harus ditanya ke pengguna apakah masih berlangsung.
 */
export function isContractionStallyOpen(
  contraction: Contraction,
  now: number,
  thresholdSec: number = 5 * 60
): boolean {
  if (contraction.endAt !== null) return false;
  return (now - contraction.startAt) / 1000 > thresholdSec;
}

/**
 * Membuat intervalSec untuk kontraksi baru berdasarkan kontraksi terakhir dalam sesi.
 * Kembalikan null jika ini adalah kontraksi pertama dalam sesi.
 */
export function computeNewIntervalSec(
  newStartAt: number,
  prevContraction: Contraction | null
): number | null {
  if (!prevContraction) return null;
  return Math.round((newStartAt - prevContraction.startAt) / 1000);
}

