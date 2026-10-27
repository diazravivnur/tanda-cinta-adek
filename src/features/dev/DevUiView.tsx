import React, { useState } from "react";
import {
  BigRecordButton,
  StatusBadge,
  Banner,
  Sheet,
  Button,
  Skeleton,
  EmptyState,
  SunIcon,
  MoonIcon,
  PlayIcon,
  SquareIcon,
  PhoneIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  XIcon,
  ChevronRightIcon,
  ActivityIcon,
  Trash2Icon,
  ClockIcon,
  Volume2Icon,
  VolumeXIcon,
  WifiOffIcon,
  RotateCcwIcon,
} from "../../components/ui";

export const DevUiView: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [recordState, setRecordState] = useState<"idle" | "running">("idle");
  const [intensity, setIntensity] = useState<1 | 2 | 3 | null>(null);
  const [note, setNote] = useState("");

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        fontFamily: "var(--font-family)",
        transition: "background-color var(--duration-transition) ease",
        padding: "var(--space-6) var(--space-4)",
        paddingBottom: "max(var(--space-12), var(--safe-bottom))",
      }}
    >
      {/* Container max-width 480px untuk merepresentasikan layar iPhone */}
      <div style={{ maxWidth: "480px", margin: "0 auto" }}>
        {/* Header Dev Tools */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "var(--space-6)",
            paddingBottom: "var(--space-4)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--primary)",
              }}
            >
              Design System Showcase (/dev/ui)
            </span>
            <h1 style={{ fontSize: "24px", fontWeight: 700, marginTop: "2px" }}>
              Komponen UI — M3
            </h1>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "var(--radius-full)",
              backgroundColor: "var(--surface)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {theme === "light" ? <MoonIcon size={16} /> : <SunIcon size={16} />}
            <span>{theme === "light" ? "Gelap" : "Terang"}</span>
          </button>
        </header>

        {/* 1. BigRecordButton */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            1. BIG RECORD BUTTON (≥ 220px, state idle vs running)
          </h2>
          <div
            style={{
              padding: "var(--space-6)",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <BigRecordButton
              status={recordState}
              sublabel={recordState === "running" ? "Ketuk untuk akhiri" : "Ketuk saat mulai terasa"}
              onClick={() => {
                setRecordState((prev) => (prev === "idle" ? "running" : "idle"));
              }}
            />
            <p style={{ marginTop: "12px", fontSize: "14px", color: "var(--text-muted)" }}>
              Status saat ini: <strong>{recordState.toUpperCase()}</strong> (klik tombol di atas untuk beralih)
            </p>
          </div>
        </section>

        {/* 2. StatusBadge */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            2. STATUS BADGE (Ikon + Teks, 4 Pola Kontraksi)
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-3)",
              padding: "var(--space-4)",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            <div>
              <StatusBadge status="ACTIVE_511" subtext="Segera ke RS" />
            </div>
            <div>
              <StatusBadge status="REGULAR" subtext="Interval ±7 mnt" />
            </div>
            <div>
              <StatusBadge status="IRREGULAR" subtext="Palsu / Braxton Hicks" />
            </div>
            <div>
              <StatusBadge status="INSUFFICIENT" subtext="Butuh 5 kontraksi" />
            </div>
            <div style={{ marginTop: "6px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <StatusBadge status="ACTIVE_511" size="sm" />
              <StatusBadge status="REGULAR" size="sm" />
              <StatusBadge status="IRREGULAR" size="sm" />
            </div>
          </div>
        </section>

        {/* 3. Banner */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            3. BANNER (Info, Waspada, Bahaya, Offline)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Banner
              variant="offline"
              title="Mode Offline Aktif"
              message="Pencatatan tetap tersimpan di HP dan otomatis sinkron saat internet kembali."
            />
            <Banner
              variant="danger"
              title="Peringatan 5-1-1"
              message="Kontraksi datang tiap 5 menit selama 1 jam. Saatnya berangkat ke RS."
              action={{ label: "Telepon Bidan", onClick: () => alert("Panggil bidan") }}
            />
            <Banner
              variant="warn"
              title="Pola Mulai Teratur"
              message="Kontraksi stabil. Siapkan tas bersalin dan tetap tenang."
            />
            <Banner
              variant="info"
              message="Layar akan tetap menyala selama pencatatan kontraksi berlangsung."
              onDismiss={() => alert("Banner ditutup")}
            />
          </div>
        </section>

        {/* 4. Button Variants */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            4. BUTTON (Tinggi min 56px, Target Sentuh Native)
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Button variant="primary" fullWidth icon={<PlayIcon size={20} />}>
              Mulai Sesi Baru
            </Button>
            <Button variant="secondary" fullWidth icon={<PhoneIcon size={20} />}>
              Telepon Ayah Diaz
            </Button>
            <Button variant="danger" fullWidth icon={<AlertTriangleIcon size={20} />}>
              Saya Perlu ke RS Sekarang
            </Button>
            <Button variant="ghost" fullWidth>
              Batal / Tutup
            </Button>
            <div style={{ display: "flex", gap: "12px" }}>
              <Button variant="secondary" size="sm" style={{ flex: 1 }}>
                Tombol Kecil 44px
              </Button>
              <Button variant="primary" size="sm" loading style={{ flex: 1 }}>
                Loading
              </Button>
            </div>
          </div>
        </section>

        {/* 5. Bottom Sheet Interaktif */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            5. SHEET (Bottom Sheet iOS + Auto-Close 5 Detik)
          </h2>
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            <p style={{ fontSize: "14px", marginBottom: "12px", color: "var(--text)" }}>
              Buka bottom sheet untuk input intensitas dan catatan singkat setelah kontraksi selesai (auto-close 5 detik).
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setIsSheetOpen(true)}
            >
              Buka Sheet Catatan Kontraksi
            </Button>
          </div>

          <Sheet
            isOpen={isSheetOpen}
            onClose={() => setIsSheetOpen(false)}
            title="Catatan Kontraksi"
            description="Opsional: bisa diabaikan atau tutup otomatis."
            autoCloseSeconds={5}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                  Tingkat Intensitas:
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {([1, 2, 3] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      style={{
                        flex: 1,
                        padding: "12px",
                        borderRadius: "var(--radius-sm)",
                        border: intensity === lvl ? "2px solid var(--primary)" : "1px solid var(--border)",
                        backgroundColor: intensity === lvl ? "var(--primary-surface)" : "var(--surface)",
                        color: intensity === lvl ? "var(--primary)" : "var(--text)",
                        fontWeight: 600,
                        fontSize: "15px",
                      }}
                    >
                      {lvl === 1 ? "Ringan" : lvl === 2 ? "Sedang" : "Kuat"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>
                  Catatan Singkat:
                </label>
                <input
                  type="text"
                  placeholder="Misal: sambil jalan kaki, pinggang pegal"
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
                  }}
                />
              </div>

              <Button
                variant="primary"
                fullWidth
                onClick={() => {
                  setIsSheetOpen(false);
                }}
              >
                Simpan Catatan
              </Button>
            </div>
          </Sheet>
        </section>

        {/* 6. Skeleton & EmptyState */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            6. SKELETON &amp; EMPTY STATE
          </h2>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
              marginBottom: "var(--space-4)",
              padding: "var(--space-4)",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>Skeleton Loading</span>
            <Skeleton height="32px" width="60%" />
            <Skeleton height="56px" />
            <Skeleton height="56px" />
          </div>

          <div
            style={{
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
            }}
          >
            <EmptyState
              title="Belum Ada Kontraksi"
              description="Ketuk tombol MULAI saat kontraksi pertama terasa. Data akan otomatis tercatat di sini."
              action={{
                label: "Panduan Penggunaan",
                onClick: () => alert("Membuka panduan"),
              }}
            />
          </div>
        </section>

        {/* 7. Icon Set Lucide Style */}
        <section style={{ marginBottom: "var(--space-8)" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            7. IKON SVG (Satu set stroke 2px konsisten)
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "12px",
              padding: "var(--space-4)",
              backgroundColor: "var(--surface)",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <div title="Play"><PlayIcon size={24} /></div>
            <div title="Square"><SquareIcon size={24} /></div>
            <div title="Phone"><PhoneIcon size={24} /></div>
            <div title="AlertTriangle"><AlertTriangleIcon size={24} /></div>
            <div title="CheckCircle"><CheckCircleIcon size={24} /></div>
            <div title="Info"><InfoIcon size={24} /></div>
            <div title="X"><XIcon size={24} /></div>
            <div title="ChevronRight"><ChevronRightIcon size={24} /></div>
            <div title="Activity"><ActivityIcon size={24} /></div>
            <div title="Trash2"><Trash2Icon size={24} /></div>
            <div title="Clock"><ClockIcon size={24} /></div>
            <div title="Volume2"><Volume2Icon size={24} /></div>
            <div title="VolumeX"><VolumeXIcon size={24} /></div>
            <div title="WifiOff"><WifiOffIcon size={24} /></div>
            <div title="RotateCcw"><RotateCcwIcon size={24} /></div>
          </div>
        </section>
      </div>
    </div>
  );
};

