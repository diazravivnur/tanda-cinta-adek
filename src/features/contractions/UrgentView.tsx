import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../auth/useAuth";
import { AlertTriangleIcon, Banner, Button, PhoneIcon } from "../../components/ui";
import { db, functions } from "../../lib/firebase";

interface UrgentViewProps {
  sessionId: string;
}

interface AcknowledgeResponse {
  success: boolean;
  acknowledgedAt: number;
}

export const UrgentView: React.FC<UrgentViewProps> = ({ sessionId }) => {
  const { coupleId, role } = useAuth();
  const [ibuPhone, setIbuPhone] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coupleId) return;
    getDoc(doc(db, "couples", coupleId)).then((snapshot) => {
      setIbuPhone(snapshot.data()?.phones?.ibu ?? "");
    }).catch(() => setError("Nomor telepon Ibu belum dapat dimuat."));
  }, [coupleId]);

  const acknowledge = async () => {
    if (role !== "ayah" || working || acknowledged) return;
    setWorking(true);
    setError(null);
    try {
      const call = httpsCallable<{ sessionId: string }, AcknowledgeResponse>(functions, "acknowledgeUrgent");
      await call({ sessionId });
      setAcknowledged(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Kabar belum terkirim. Coba lagi saat online.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <main style={pageStyle}>
      <div style={{ display: "grid", justifyItems: "center", gap: "20px", textAlign: "center" }}>
        <AlertTriangleIcon size={48} color="var(--danger)" aria-hidden="true" />
        <h1 style={{ fontSize: "28px", lineHeight: 1.15 }}>Pemberitahuan penting</h1>
        <p style={{ fontSize: "18px", lineHeight: 1.45 }}>
          {acknowledged ? "Kabar bahwa Ayah sedang menuju sudah terkirim." : "Hubungi Ibu Wulan dan beri tahu jika Anda sedang menuju."}
        </p>
      </div>
      <div style={{ display: "grid", gap: "16px", marginTop: "32px" }}>
        {ibuPhone ? (
          <a href={`tel:${ibuPhone}`} style={phoneLinkStyle}>
            <PhoneIcon size={22} aria-hidden="true" />
            Telepon Wulan
          </a>
        ) : (
          <Banner variant="warn" message="Nomor Ibu belum diatur. Hubungi lewat telepon secara langsung." />
        )}
        {role === "ayah" && (
          <Button fullWidth variant="danger" onClick={() => void acknowledge()} disabled={working || acknowledged} loading={working}>
            {acknowledged ? "Ayah sedang menuju" : "Saya menuju"}
          </Button>
        )}
        {role !== "ayah" && <Banner variant="info" message="Layar ini ditujukan untuk Ayah Diaz." />}
        {error && <Banner variant="danger" message={error} />}
      </div>
    </main>
  );
};

const pageStyle: React.CSSProperties = {
  minHeight: "100dvh",
  maxWidth: "540px",
  margin: "0 auto",
  padding: "max(var(--safe-top), 32px) 20px max(var(--safe-bottom), 24px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  color: "var(--text)",
  background: "var(--bg)",
};

const phoneLinkStyle: React.CSSProperties = {
  minHeight: "72px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  padding: "16px 24px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: "20px",
  fontWeight: 700,
  textDecoration: "none",
};