import React from "react";
import { useAuth } from "./useAuth";
import { LoginView } from "./LoginView";
import { UnauthorizedView } from "./UnauthorizedView";

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, isAllowed, loading, error } = useAuth();

  // Tampilkan layar loading awal atau saat redirect diproses
  if (loading) {
    return (
      <div className="auth-view-container" aria-live="polite" aria-busy="true">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div className="auth-spinner" aria-hidden="true" />
          <h2 style={{ fontSize: "20px", marginTop: "16px" }}>Memeriksa akun...</h2>
          <p style={{ fontSize: "14px", opacity: 0.8, marginTop: "8px" }}>
            Menghubungkan ke layanan autentikasi
          </p>
        </div>
      </div>
    );
  }

  // Belum login -> Arahkan ke Layar Login
  if (!user) {
    return <LoginView />;
  }

  // Sudah login tetapi ditolak / belum masuk allowlist
  if (!isAllowed) {
    return <UnauthorizedView />;
  }

  // Terautentikasi dan diizinkan
  return (
    <>
      {error && (
        <div className="auth-inline-warning" role="alert">
          {error}
        </div>
      )}
      {children}
    </>
  );
};
