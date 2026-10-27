import React, { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { Banner, Button } from "../../components/ui";
import { enablePushNotifications, isStandalonePwa } from "../../lib/messaging";

export const NotificationSettingsView: React.FC = () => {
  const { user } = useAuth();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const standalone = isStandalonePwa();

  const activate = async () => {
    if (!user || !standalone || working) return;
    setWorking(true);
    setMessage(null);
    try {
      await enablePushNotifications(user.uid);
      setMessage("Notifikasi berhasil diaktifkan di perangkat ini.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifikasi belum dapat diaktifkan.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <button type="button" onClick={() => window.location.assign("/")} style={backStyle} aria-label="Kembali">
          Kembali
        </button>
        <h1 style={{ fontSize: "24px", lineHeight: 1.2 }}>Pengaturan Notifikasi</h1>
      </header>
      <section style={contentStyle}>
        {!standalone && (
          <Banner
            variant="warn"
            title="Buka dari Layar Utama"
            message="Tambahkan aplikasi ini ke Layar Utama, lalu buka dari ikonnya sebelum mengaktifkan notifikasi."
          />
        )}
        {message && <Banner variant={message.startsWith("Notifikasi berhasil") ? "info" : "warn"} message={message} />}
        <p style={{ fontSize: "18px", lineHeight: 1.45 }}>
          Izinkan notifikasi agar kabar kontraksi penting dapat diterima di perangkat ini.
        </p>
        <Button fullWidth onClick={() => void activate()} disabled={!standalone || working} loading={working}>
          Aktifkan notifikasi
        </Button>
        <p style={{ fontSize: "15px", color: "var(--text-muted)", lineHeight: 1.45 }}>
          Pastikan aplikasi ini diizinkan pada pengaturan Fokus agar pemberitahuan dapat terdengar.
        </p>
      </section>
    </main>
  );
};

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  maxWidth: "540px",
  margin: "0 auto",
  padding: "max(var(--safe-top), 16px) 16px max(var(--safe-bottom), 24px)",
  color: "var(--text)",
  background: "var(--bg)",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  minHeight: "56px",
  borderBottom: "1px solid var(--border)",
};

const backStyle: React.CSSProperties = {
  minHeight: "48px",
  border: 0,
  background: "transparent",
  color: "var(--primary)",
  fontSize: "16px",
  fontWeight: 600,
};

const contentStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "20px",
  paddingTop: "24px",
};