import React from "react";
import { useAuth } from "./useAuth";

export const UnauthorizedView: React.FC = () => {
  const { user, signOut, loading } = useAuth();

  return (
    <div className="auth-view-container">
      <div className="auth-card unauthorized-card">
        <div className="unauthorized-icon" aria-hidden="true">
          ⛔
        </div>

        <h1 className="auth-title">Akun Tidak Diizinkan</h1>

        <p className="auth-subtitle">
          Akun <strong>{user?.email || "Google Anda"}</strong> belum terdaftar untuk mengakses
          aplikasi ini.
        </p>

        <p className="unauthorized-description">
          Aplikasi ini adalah ruang pribadi yang dikunci khusus untuk <strong>Ibu Wulan</strong> dan{" "}
          <strong>Ayah Diaz</strong>. Jika Anda merasa ini kekeliruan, pastikan Anda masuk
          menggunakan akun Google yang sudah didaftarkan.
        </p>

        <div className="auth-action-area">
          <button
            type="button"
            className="btn-danger-action"
            onClick={() => void signOut()}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Keluar dari Akun"}
          </button>
        </div>
      </div>
    </div>
  );
};
