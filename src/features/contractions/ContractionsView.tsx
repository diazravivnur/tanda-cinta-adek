import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useAuth } from "../auth/useAuth";
import { useContractions } from "./useContractions";
import { isContractionStallyOpen } from "./sessionUtils";
import {
  BigRecordButton,
  StatusBadge,
  Banner,
  Sheet,
  Button,
  Skeleton,
  EmptyState,
  PhoneIcon,
  AlertTriangleIcon,
  Trash2Icon,
  ClockIcon,
  Volume2Icon,
  VolumeXIcon,
  ActivityIcon,
} from "../../components/ui";
import { playFeedbackClick } from "../../lib/haptics";
import {
  requestWakeLock,
  releaseWakeLock,
  attachWakeLockVisibilityListener,
  isWakeLockSupported,
} from "../../lib/wakeLock";
import { formatDuration, formatTimeOfDay } from "../../lib/time";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";

// ── Audio Preference (localStorage, try/catch safe) ────────────────────────────
function getSoundPref(): boolean {
  try {
    return localStorage.getItem("sound_enabled") !== "false";
  } catch {
    return true;
  }
}
function setSoundPref(val: boolean): void {
  try {
    localStorage.setItem("sound_enabled", val ? "true" : "false");
  } catch {
    /* noop */
  }
}

// ── Teks status pola ─────────────────────────────────────────────────────────
function getPatternMessage(status: string | undefined): string {
  switch (status) {
    case "ACTIVE_511":
      return "Pola 5-1-1 terpenuhi. Saatnya berangkat ke rumah sakit.";
    case "REGULAR":
      return "Pola mulai teratur. Terus pantau dan siapkan tas bersalin.";
    case "IRREGULAR":
      return "Pola belum teratur. Coba minum, ganti posisi, dan istirahat.";
    default:
      return "Terus catat. Butuh beberapa kontraksi untuk melihat pola.";
  }
}

// ── Komponen Utama ────────────────────────────────────────────────────────────
export const ContractionsView: React.FC = () => {
  const { coupleId, user, role } = useAuth();
  const {
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
  } = useContractions(coupleId, user?.uid ?? null);

  // ── State UI ────────────────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled] = useState(getSoundPref);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wakeLockSupported, setWakeLockSupported] = useState(true);
  const [isIntensitySheetOpen, setIsIntensitySheetOpen] = useState(false);
  const [isStallySheetOpen, setIsStallySheetOpen] = useState(false);
  const [isUrgentSheetOpen, setIsUrgentSheetOpen] = useState(false);
  const [urgentDone, setUrgentDone] = useState(false);
  const [intensity, setIntensity] = useState<1 | 2 | 3 | undefined>(undefined);
  const [note, setNote] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [undoQueue, setUndoQueue] = useState<{ id: string; timeoutId: ReturnType<typeof setTimeout> }[]>([]);
  const [pendingDelete, setPendingDelete] = useState<Set<string>>(new Set());
  const [flashColor, setFlashColor] = useState<"start" | "stop" | null>(null);
  const audioContextCreated = useRef(false);
  const [urgentFallback, setUrgentFallback] = useState(false);
  const [urgentSentAt, setUrgentSentAt] = useState<number | null>(null);

  useEffect(() => {
    const sessionId = activeSession?.sessionId;
    if (!coupleId || !sessionId) {
      setUrgentFallback(false);
      setUrgentSentAt(null);
      return;
    }
    return onSnapshot(doc(db, "couples", coupleId, "contractionSessions", sessionId), (snapshot) => {
      const session = snapshot.data();
      const sentAt = session?.lastUrgentSentAt;
      const sentAtMs = sentAt instanceof Timestamp ? sentAt.toMillis() : typeof sentAt === "number" ? sentAt : null;
      setUrgentSentAt(session?.notifiedLevel === 3 && !session?.ackAt ? sentAtMs : null);
    });
  }, [activeSession?.sessionId, coupleId]);

  useEffect(() => {
    setUrgentFallback(role === "ibu" && urgentSentAt !== null && now - urgentSentAt >= 5 * 60 * 1000);
  }, [now, role, urgentSentAt]);

  // ── Online / Offline listener ───────────────────────────────────────────────
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  // ── Wake Lock lifecycle ─────────────────────────────────────────────────────
  const isRunning = !!openContraction;
  useEffect(() => {
    if (!isWakeLockSupported()) {
      setWakeLockSupported(false);
      return;
    }
    if (isRunning) {
      void requestWakeLock();
      const cleanup = attachWakeLockVisibilityListener();
      return () => {
        cleanup();
        void releaseWakeLock();
      };
    } else {
      void releaseWakeLock();
    }
  }, [isRunning]);

  // ── Tampilkan sheet "Masih berlangsung?" bila kontraksi terbuka > 5 menit ──
  const openContractionId = openContraction?.id ?? null;
  useEffect(() => {
    if (
      openContraction &&
      isContractionStallyOpen(openContraction, now) &&
      !isStallySheetOpen &&
      !isIntensitySheetOpen
    ) {
      setIsStallySheetOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, openContractionId]);

  // ── Flash warna layar saat MULAI/SELESAI ────────────────────────────────────
  useEffect(() => {
    if (!flashColor) return;
    const id = setTimeout(() => setFlashColor(null), 400);
    return () => clearTimeout(id);
  }, [flashColor]);

  // ── Timer hitungan detik sejak MULAI ───────────────────────────────────────
  const elapsedSec = openContraction
    ? Math.round((now - openContraction.startAt) / 1000)
    : null;

  // ── Handler tombol MULAI / SELESAI ─────────────────────────────────────────
  const handleRecordButton = useCallback(async () => {
    if (isWorking) return;
    setIsWorking(true);

    try {
      if (openContraction) {
        // Tutup AudioContext jika belum dibuat (pertama kali)
        if (!audioContextCreated.current) audioContextCreated.current = true;
        playFeedbackClick(soundEnabled);
        setFlashColor("stop");
        await finishContraction();
        setIntensity(undefined);
        setNote("");
        setIsIntensitySheetOpen(true);
      } else {
        if (!audioContextCreated.current) audioContextCreated.current = true;
        playFeedbackClick(soundEnabled);
        setFlashColor("start");
        await startContraction();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsWorking(false);
    }
  }, [isWorking, openContraction, soundEnabled, finishContraction, startContraction]);

  // ── Swipe-to-delete dengan Urungkan ────────────────────────────────────────
  const handleDeleteWithUndo = useCallback((id: string) => {
    setPendingDelete((prev) => new Set([...prev, id]));
    const timeoutId = setTimeout(async () => {
      await deleteContraction(id);
      setPendingDelete((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setUndoQueue((prev) => prev.filter((u) => u.id !== id));
    }, 5000);
    setUndoQueue((prev) => [...prev, { id, timeoutId }]);
  }, [deleteContraction]);

  const handleUndo = useCallback((id: string) => {
    const item = undoQueue.find((u) => u.id === id);
    if (item) {
      clearTimeout(item.timeoutId);
      setUndoQueue((prev) => prev.filter((u) => u.id !== id));
      setPendingDelete((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [undoQueue]);

  // ── Simpan intensity/note dari Sheet ───────────────────────────────────────
  const handleSaveIntensity = useCallback(async () => {
    // finishContraction sudah dipanggil; update catatan opsional via updateDoc bila diperlukan
    setIsIntensitySheetOpen(false);
  }, []);

  // ── Tombol darurat ─────────────────────────────────────────────────────────
  const handleUrgent = useCallback(async () => {
    setIsUrgentSheetOpen(false);
    setIsWorking(true);
    try {
      await markUrgent();
      setUrgentDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsWorking(false);
    }
  }, [markUrgent]);

  // ── Daftar 10 kontraksi untuk tampilan (desc, tidak termasuk pendingDelete) ─
  const visibleContractions = [...contractions]
    .sort((a, b) => b.startAt - a.startAt)
    .filter((c) => !pendingDelete.has(c.id))
    .slice(0, 10);

  // ── RENDER ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={pageStyle}>
        <PageHeader soundEnabled={soundEnabled} onToggleSound={() => {
          setSoundEnabled((v) => { setSoundPref(!v); return !v; });
        }} />
        <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "16px" }}>
          <Skeleton height="230px" borderRadius="var(--radius-full)" style={{ width: "230px", margin: "0 auto" }} />
          <Skeleton height="52px" />
          <Skeleton height="72px" />
          <Skeleton height="72px" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <PageHeader soundEnabled={soundEnabled} onToggleSound={() => {
          setSoundEnabled((v) => { setSoundPref(!v); return !v; });
        }} />
        <div style={{ padding: "var(--space-6)" }}>
          <Banner
            variant="danger"
            title="Gagal memuat data"
            message={error + " Coba tutup dan buka kembali aplikasi."}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{
      ...pageStyle,
      transition: "background-color 400ms ease",
      backgroundColor: flashColor === "start"
        ? "var(--primary-surface)"
        : flashColor === "stop"
          ? "var(--ok-surface)"
          : "var(--bg)",
    }}>
      <PageHeader
        soundEnabled={soundEnabled}
        onToggleSound={() => {
          setSoundEnabled((v) => { setSoundPref(!v); return !v; });
        }}
      />

      {role === "ibu" && urgentFallback && ayahPhone && (
        <div style={{ padding: "0 var(--space-4) var(--space-2)" }}>
          <Banner
            variant="danger"
            title="Ayah belum menanggapi"
            message="Telepon Ayah sekarang untuk memastikan kabar diterima."
            action={{ label: "Telepon Ayah Diaz", onClick: () => { window.location.href = `tel:${ayahPhone}`; } }}
          />
        </div>
      )}

      {/* Banner Offline */}
      {!isOnline && (
        <div style={{ padding: "0 var(--space-4) var(--space-2)" }}>
          <Banner
            variant="offline"
            title="Mode Offline"
            message="Pencatatan tetap tersimpan di HP. Data sinkron otomatis saat koneksi kembali."
          />
        </div>
      )}

      {/* Banner menunggu sinkron */}
      {hasPendingWrites && isOnline && (
        <div style={{ padding: "0 var(--space-4) var(--space-2)" }}>
          <Banner
            variant="info"
            message="Menyinkronkan data..."
          />
        </div>
      )}

      {/* Banner Wake Lock tidak didukung */}
      {!wakeLockSupported && openContraction && (
        <div style={{ padding: "0 var(--space-4) var(--space-2)" }}>
          <Banner
            variant="info"
            message="Saran: nonaktifkan Auto-Lock di Pengaturan → Layar & Kecerahan selama pencatatan."
          />
        </div>
      )}

      {/* Banner Urungkan Hapus */}
      {undoQueue.map((item) => (
        <div key={item.id} style={{ padding: "0 var(--space-4) var(--space-2)" }}>
          <Banner
            variant="info"
            message="Kontraksi dihapus."
            action={{ label: "Urungkan", onClick: () => handleUndo(item.id) }}
            onDismiss={() => {
              clearTimeout(item.timeoutId);
              setUndoQueue((prev) => prev.filter((u) => u.id !== item.id));
            }}
          />
        </div>
      ))}

      {/* Timer Besar */}
      <div style={{ textAlign: "center", minHeight: "80px", padding: "var(--space-4) 0 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {elapsedSec !== null ? (
          <>
            <div style={{
              fontSize: "88px",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: "var(--danger)",
            }}>
              {formatDuration(elapsedSec)}
            </div>
            <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "6px" }}>
              Kontraksi sedang berlangsung
            </div>
          </>
        ) : (
          <div style={{ fontSize: "15px", color: "var(--text-muted)", height: "80px", display: "flex", alignItems: "center" }}>
            {contractions.length === 0 ? "Ketuk MULAI saat kontraksi pertama terasa" : "Ketuk MULAI saat kontraksi berikutnya terasa"}
          </div>
        )}
      </div>

      {/* BigRecordButton */}
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-4) 0" }}>
        <BigRecordButton
          status={openContraction ? "running" : "idle"}
          onClick={() => void handleRecordButton()}
          disabled={isWorking}
          sublabel={openContraction ? "Ketuk saat kontraksi reda" : "Ketuk saat mulai terasa"}
        />
      </div>

      {/* Status Pola */}
      {patternEval && (
        <div style={{
          margin: "0 var(--space-4) var(--space-4)",
          padding: "var(--space-4)",
          borderRadius: "var(--radius-sm)",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
        }}>
          <div style={{ marginBottom: "var(--space-2)" }}>
            <StatusBadge
              status={patternEval.status}
              subtext={
                patternEval.medianIntervalSec
                  ? `tiap ${Math.round(patternEval.medianIntervalSec / 60)} mnt`
                  : undefined
              }
            />
          </div>
          <p style={{ fontSize: "15px", color: "var(--text)", lineHeight: 1.4 }}>
            {getPatternMessage(patternEval.status)}
          </p>
          {patternEval.medianDurationSec !== null && (
            <div style={{ display: "flex", gap: "var(--space-4)", marginTop: "var(--space-3)", flexWrap: "wrap" }}>
              <StatChip label="Interval" value={`${Math.round((patternEval.medianIntervalSec ?? 0) / 60)} mnt`} />
              <StatChip label="Durasi" value={`${patternEval.medianDurationSec} dtk`} />
              <StatChip label="Tren" value={
                patternEval.trend === "converging" ? "↘ Makin rapat" :
                patternEval.trend === "diverging" ? "↗ Makin renggang" :
                patternEval.trend === "stable" ? "→ Stabil" : "—"
              } />
            </div>
          )}
        </div>
      )}

      {/* Daftar Kontraksi Terakhir */}
      <div style={{ padding: "0 var(--space-4)" }}>
        <h2 style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "var(--space-2)",
        }}>
          {contractions.length > 0 ? `${Math.min(contractions.length, 10)} Kontraksi Terakhir` : ""}
        </h2>

        {contractions.length === 0 ? (
          <EmptyState
            title="Belum Ada Kontraksi"
            description="Ketuk MULAI saat kontraksi pertama terasa. Data akan otomatis tercatat di sini."
          />
        ) : (
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {visibleContractions.map((c, idx) => (
              <ContractionItem
                key={c.id}
                contraction={c}
                isFirst={idx === 0}
                onDelete={() => handleDeleteWithUndo(c.id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Tombol Sekunder Permanen */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        padding: "var(--space-6) var(--space-4)",
        paddingBottom: "max(var(--space-6), var(--safe-bottom))",
      }}>
        {/* Telepon Ayah */}
        <Button
          variant="secondary"
          fullWidth
          icon={<PhoneIcon size={20} />}
          onClick={() => {
            if (ayahPhone) {
              window.location.href = `tel:${ayahPhone}`;
            } else {
              alert("Nomor telepon Ayah belum diisi. Silakan isi di Pengaturan.");
            }
          }}
        >
          {ayahPhone ? "Telepon Ayah Diaz" : "Isi Nomor Telepon Ayah"}
        </Button>

        {/* Ke RS */}
        {urgentDone ? (
          <div style={{
            padding: "var(--space-4)",
            borderRadius: "var(--radius-sm)",
            backgroundColor: "var(--danger-surface)",
            border: "1px solid var(--danger-border)",
            textAlign: "center",
          }}>
            <p style={{ color: "var(--danger)", fontWeight: 600, fontSize: "16px", marginBottom: "var(--space-3)" }}>
              Telepon Ayah sekarang — sebelum berangkat
            </p>
            {ayahPhone && (
              <Button
                variant="danger"
                fullWidth
                icon={<PhoneIcon size={20} />}
                onClick={() => { window.location.href = `tel:${ayahPhone}`; }}
              >
                Telepon Ayah Diaz Sekarang
              </Button>
            )}
          </div>
        ) : (
          <Button
            variant="danger"
            fullWidth
            icon={<AlertTriangleIcon size={20} />}
            onClick={() => setIsUrgentSheetOpen(true)}
          >
            Saya Perlu ke RS Sekarang
          </Button>
        )}
      </div>

      {/* Sheet: Catatan Intensitas (auto-close 5 detik) */}
      <Sheet
        isOpen={isIntensitySheetOpen}
        onClose={handleSaveIntensity}
        title="Catatan Kontraksi"
        description="Opsional — lewati jika sedang tidak nyaman."
        autoCloseSeconds={5}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
              Tingkat Intensitas
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              {([1, 2, 3] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setIntensity(lvl)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: "var(--radius-sm)",
                    border: intensity === lvl ? "2px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: intensity === lvl ? "var(--primary-surface)" : "var(--surface)",
                    color: intensity === lvl ? "var(--primary)" : "var(--text)",
                    fontWeight: 600,
                    fontSize: "15px",
                    cursor: "pointer",
                  }}
                >
                  {lvl === 1 ? "Ringan" : lvl === 2 ? "Sedang" : "Kuat"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
              Catatan Singkat
            </label>
            <input
              type="text"
              placeholder="Mis: sambil duduk, pinggang pegal"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface)",
                color: "var(--text)",
                outline: "none",
                fontSize: "16px",
              }}
            />
          </div>
          <Button variant="secondary" fullWidth onClick={handleSaveIntensity}>
            Tutup
          </Button>
        </div>
      </Sheet>

      {/* Sheet: Masih Berlangsung? */}
      <Sheet
        isOpen={isStallySheetOpen}
        onClose={() => setIsStallySheetOpen(false)}
        title="Masih berlangsung?"
        description={`Kontraksi sudah berlangsung ${elapsedSec !== null ? Math.round(elapsedSec / 60) : "?"} menit.`}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button
            variant="primary"
            fullWidth
            onClick={async () => {
              setIsStallySheetOpen(false);
              setIsWorking(true);
              playFeedbackClick(soundEnabled);
              setFlashColor("stop");
              try { await finishContraction(); } finally { setIsWorking(false); }
              setIsIntensitySheetOpen(true);
            }}
          >
            Akhiri Sekarang
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={async () => {
              setIsStallySheetOpen(false);
              await discardOpenContraction();
            }}
          >
            Buang (salah ketuk)
          </Button>
        </div>
      </Sheet>

      {/* Sheet: Konfirmasi ke RS */}
      <Sheet
        isOpen={isUrgentSheetOpen}
        onClose={() => setIsUrgentSheetOpen(false)}
        title="Perlu ke RS sekarang?"
        description="Ini akan mencatat waktu keputusan Anda dan mempersiapkan tombol panggilan darurat."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Button
            variant="danger"
            fullWidth
            loading={isWorking}
            onClick={() => void handleUrgent()}
          >
            Ya, Saya Perlu ke RS Sekarang
          </Button>
          <Button variant="ghost" fullWidth onClick={() => setIsUrgentSheetOpen(false)}>
            Belum, Kembali ke Pantau
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

// ── Sub-komponen ──────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  backgroundColor: "var(--bg)",
  color: "var(--text)",
  fontFamily: "var(--font-family)",
  paddingTop: "max(var(--safe-top), 16px)",
  overflowX: "hidden",
};

interface PageHeaderProps {
  soundEnabled: boolean;
  onToggleSound: () => void;
}

const PageHeader: React.FC<PageHeaderProps> = ({ soundEnabled, onToggleSound }) => (
  <header style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--space-3) var(--space-4)",
    borderBottom: "1px solid var(--border)",
    marginBottom: "var(--space-3)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <ActivityIcon size={20} color="var(--primary)" />
      <h1 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)" }}>Kontraksi</h1>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <a href="/settings" aria-label="Pengaturan notifikasi" style={{ ...headerActionStyle, textDecoration: "none" }}>
        Pengaturan
      </a>
      <button
        type="button"
        onClick={onToggleSound}
        aria-label={soundEnabled ? "Matikan bunyi" : "Nyalakan bunyi"}
        style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "44px",
        height: "44px",
        borderRadius: "var(--radius-full)",
        backgroundColor: "var(--surface)",
        color: soundEnabled ? "var(--text)" : "var(--text-muted)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        }}
      >
        {soundEnabled ? <Volume2Icon size={18} /> : <VolumeXIcon size={18} />}
      </button>
    </div>
  </header>
);

const headerActionStyle: React.CSSProperties = {
  minHeight: "44px",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--text)",
  fontSize: "14px",
  fontWeight: 600,
};

interface StatChipProps {
  label: string;
  value: string;
}

const StatChip: React.FC<StatChipProps> = ({ label, value }) => (
  <div style={{
    display: "flex",
    flexDirection: "column",
    minWidth: "70px",
  }}>
    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    <span style={{ fontSize: "16px", fontWeight: 600, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
  </div>
);

interface ContractionItemProps {
  contraction: import("../../types").Contraction;
  isFirst: boolean;
  onDelete: () => void;
}

const ContractionItem: React.FC<ContractionItemProps> = ({ contraction: c, isFirst, onDelete }) => {
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const itemRef = useRef<HTMLLIElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    if (dx > 60) {
      // Swipe kiri
      setSwiping(true);
      setTimeout(() => {
        setSwiping(false);
        onDelete();
      }, 200);
    }
    touchStartX.current = null;
  };

  const isOpen = c.endAt === null;

  return (
    <li
      ref={itemRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: isOpen ? "var(--danger-surface)" : "var(--surface)",
        border: isOpen ? "1px solid var(--danger-border)" : "1px solid var(--border)",
        transform: swiping ? "translateX(-80px)" : "translateX(0)",
        transition: "transform 200ms var(--ease-ios), opacity 200ms ease",
        opacity: swiping ? 0 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
        <ClockIcon size={16} color={isOpen ? "var(--danger)" : "var(--text-muted)"} />
        <div>
          <div style={{ fontSize: "16px", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
            {formatTimeOfDay(c.startAt)}
            {isFirst && isOpen && (
              <span style={{ marginLeft: "6px", fontSize: "12px", color: "var(--danger)", fontWeight: 700 }}>BERLANGSUNG</span>
            )}
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-muted)", display: "flex", gap: "12px", marginTop: "2px" }}>
            {c.durationSec !== null && (
              <span>Durasi: {c.durationSec}dtk</span>
            )}
            {c.intervalSec !== null && (
              <span>Interval: {Math.round(c.intervalSec / 60)}mnt</span>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        aria-label="Hapus kontraksi ini"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "40px",
          height: "40px",
          borderRadius: "var(--radius-full)",
          color: "var(--text-muted)",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <Trash2Icon size={16} />
      </button>
    </li>
  );
};
