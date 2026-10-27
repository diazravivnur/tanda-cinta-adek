import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  Timestamp,
  type SnapshotMetadata,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Contraction, ContractionSession, PatternEvaluation } from "../../types";
import { classifyPattern } from "./patternEngine";
import { resolveThresholds } from "../../config/thresholds";
import {
  computeSessionId,
  getActiveSession,
  resolveOpenContraction,
  computeNewIntervalSec,
} from "./sessionUtils";
import { nanoid } from "./nanoid";

// ── Helpers: Konversi Firestore Timestamp ↔ epoch ms ──────────────────────────

function tsToMs(val: Timestamp | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;
  return val.toMillis();
}

function toFirestoreContraction(raw: Record<string, unknown>): Contraction {
  return {
    id: raw.id as string,
    sessionId: raw.sessionId as string,
    startAt: tsToMs(raw.startAt as Timestamp) ?? 0,
    endAt: tsToMs(raw.endAt as Timestamp | null),
    durationSec: (raw.durationSec as number | null) ?? null,
    intervalSec: (raw.intervalSec as number | null) ?? null,
    intensity: raw.intensity as 1 | 2 | 3 | undefined,
    note: raw.note as string | undefined,
    createdBy: raw.createdBy as string,
  };
}

// ── Hook State ─────────────────────────────────────────────────────────────────

export interface UseContractionsResult {
  contractions: Contraction[];
  openContraction: Contraction | null;
  patternEval: PatternEvaluation | null;
  activeSession: ReturnType<typeof getActiveSession>;
  ayahPhone: string | null;
  loading: boolean;
  error: string | null;
  hasPendingWrites: boolean;
  /** Ketuk MULAI: buat dokumen kontraksi baru dengan endAt=null */
  startContraction: () => Promise<void>;
  /** Ketuk SELESAI: update endAt, durationSec, optional intensity/note */
  finishContraction: (opts?: { intensity?: 1 | 2 | 3; note?: string }) => Promise<void>;
  /** Buang kontraksi terbuka tanpa menyimpan */
  discardOpenContraction: () => Promise<void>;
  /** Hapus kontraksi dari daftar */
  deleteContraction: (id: string) => Promise<void>;
  /** Tandai sesi aktif sebagai URGENT */
  markUrgent: () => Promise<void>;
  /** now berdetak tiap detik (epoch ms), hanya berasal dari Date.now() di lapisan ini */
  now: number;
}

/**
 * Custom hook untuk layar Kontraksi.
 * Date.now() hanya dipanggil di sini; semua fungsi patternEngine menerima `now` sebagai parameter.
 */
export function useContractions(
  coupleId: string | null,
  uid: string | null
): UseContractionsResult {
  const [contractions, setContractions] = useState<Contraction[]>([]);
  const [hasPendingWrites, setHasPendingWrites] = useState(false);
  const [ayahPhone, setAyahPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Berdetak tiap detik
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Baca nomor telepon Ayah dari couples/{coupleId}
  useEffect(() => {
    if (!coupleId) return;
    getDoc(doc(db, "couples", coupleId)).then((snap) => {
      if (snap.exists()) {
        const phones = snap.data()?.phones;
        setAyahPhone(phones?.ayah ?? null);
      }
    }).catch(() => {
      // Lanjut tanpa nomor telepon
    });
  }, [coupleId]);

  // Realtime listener: 100 kontraksi terbaru, includeMetadataChanges
  useEffect(() => {
    if (!coupleId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "couples", coupleId, "contractions"),
      orderBy("startAt", "desc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snapshot) => {
        const meta: SnapshotMetadata = snapshot.metadata;
        setHasPendingWrites(meta.hasPendingWrites);

        const docs: Contraction[] = snapshot.docs.map((d) =>
          toFirestoreContraction({ id: d.id, ...d.data() })
        );
        // Simpan urutan asc untuk patternEngine
        setContractions([...docs].sort((a, b) => a.startAt - b.startAt));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore listener error:", err);
        setError("Gagal memuat data. Periksa koneksi atau coba lagi.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [coupleId]);

  // Computed values (no additional hooks)
  const activeSession = getActiveSession(contractions, now);
  const openContraction = resolveOpenContraction(contractions);

  const thresholds = resolveThresholds();
  const patternEval =
    contractions.length > 0
      ? classifyPattern(contractions, now, thresholds)
      : null;

  // ── Refs untuk memastikan nilai segar di dalam callback async ──
  const activeSessionRef = useRef(activeSession);
  const openContractionRef = useRef(openContraction);
  useEffect(() => { activeSessionRef.current = activeSession; }, [activeSession]);
  useEffect(() => { openContractionRef.current = openContraction; }, [openContraction]);

  // ── Tulis dokumen sesi baru jika diperlukan ──────────────────────────────────
  const ensureSession = useCallback(async (
    sessionId: string,
    startedAt: number
  ) => {
    if (!coupleId) return;
    const sessionRef = doc(db, "couples", coupleId, "contractionSessions", sessionId);
    await setDoc(sessionRef, {
      sessionId,
      startedAt: Timestamp.fromMillis(startedAt),
      lastContractionAt: Timestamp.fromMillis(startedAt),
      status: "INSUFFICIENT",
      notifiedLevel: 0,
    }, { merge: true });
  }, [coupleId]);

  // ── startContraction ────────────────────────────────────────────────────────
  const startContraction = useCallback(async () => {
    if (!coupleId || !uid) return;

    const startAt = Date.now();
    const currentSession = activeSessionRef.current;

    // Tentukan sesi
    let sessionId: string;
    let prevContraction: Contraction | null = null;

    if (currentSession) {
      sessionId = computeSessionId(currentSession.startedAt);
      const sorted = [...currentSession.contractions].sort((a, b) => a.startAt - b.startAt);
      prevContraction = sorted[sorted.length - 1] ?? null;
    } else {
      // Sesi baru
      sessionId = computeSessionId(startAt);
      await ensureSession(sessionId, startAt);
    }

    // Aggiorna lastContractionAt nella sessione esistente
    if (currentSession && coupleId) {
      const sessionRef = doc(db, "couples", coupleId, "contractionSessions", sessionId);
      await setDoc(sessionRef, {
        lastContractionAt: Timestamp.fromMillis(startAt),
      }, { merge: true }).catch(() => undefined);
    }

    const intervalSec = computeNewIntervalSec(startAt, prevContraction);
    const newId = nanoid();
    const contractionRef = doc(db, "couples", coupleId, "contractions", newId);

    await setDoc(contractionRef, {
      sessionId,
      startAt: Timestamp.fromMillis(startAt),
      endAt: null,
      durationSec: null,
      intervalSec,
      createdBy: uid,
    });

    // Aggiorna lastContractionAt
    const sessionRef = doc(db, "couples", coupleId, "contractionSessions", sessionId);
    await setDoc(sessionRef, {
      lastContractionAt: Timestamp.fromMillis(startAt),
    }, { merge: true }).catch(() => undefined);

  }, [coupleId, uid, ensureSession]);

  // ── finishContraction ───────────────────────────────────────────────────────
  const finishContraction = useCallback(async (opts?: {
    intensity?: 1 | 2 | 3;
    note?: string;
  }) => {
    if (!coupleId) return;
    const open = openContractionRef.current;
    if (!open) return;

    const endAt = Date.now();
    const durationSec = Math.round((endAt - open.startAt) / 1000);

    const contractionRef = doc(db, "couples", coupleId, "contractions", open.id);
    await updateDoc(contractionRef, {
      endAt: Timestamp.fromMillis(endAt),
      durationSec,
      ...(opts?.intensity !== undefined && { intensity: opts.intensity }),
      ...(opts?.note !== undefined && { note: opts.note }),
    });

    const sessionId = computeSessionId(
      activeSessionRef.current?.startedAt ?? open.startAt
    );
    const sessionRef = doc(db, "couples", coupleId, "contractionSessions", sessionId);
    await setDoc(sessionRef, {
      lastContractionAt: Timestamp.fromMillis(endAt),
    }, { merge: true }).catch(() => undefined);

  }, [coupleId]);

  // ── discardOpenContraction ──────────────────────────────────────────────────
  const discardOpenContraction = useCallback(async () => {
    if (!coupleId) return;
    const open = openContractionRef.current;
    if (!open) return;
    const contractionRef = doc(db, "couples", coupleId, "contractions", open.id);
    await deleteDoc(contractionRef);
  }, [coupleId]);

  // ── deleteContraction ───────────────────────────────────────────────────────
  const deleteContraction = useCallback(async (id: string) => {
    if (!coupleId) return;
    await deleteDoc(doc(db, "couples", coupleId, "contractions", id));
  }, [coupleId]);

  // ── markUrgent ──────────────────────────────────────────────────────────────
  const markUrgent = useCallback(async () => {
    if (!coupleId) return;
    const session = activeSessionRef.current;
    const urgentAt = Date.now();

    let sessionId: string;
    if (session) {
      sessionId = computeSessionId(session.startedAt);
    } else {
      // Buat sesi dummy jika belum ada
      sessionId = computeSessionId(urgentAt);
      await ensureSession(sessionId, urgentAt);
    }

    const sessionRef = doc(db, "couples", coupleId, "contractionSessions", sessionId);
    await setDoc(sessionRef, {
      urgentRequestedAt: Timestamp.fromMillis(urgentAt),
    }, { merge: true });
  }, [coupleId, ensureSession]);

  return {
    contractions,
    openContraction,
    patternEval,
    activeSession,
    ayahPhone,
    loading,
    error,
    hasPendingWrites,
    startContraction,
    finishContraction,
    discardOpenContraction,
    deleteContraction,
    markUrgent,
    now,
  };
}

// Re-export ContractionSession untuk kemudahan
export type { ContractionSession };
