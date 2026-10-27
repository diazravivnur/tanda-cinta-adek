import React, { useEffect, useState, useMemo } from "react";
import {
  User,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  getRedirectResult,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, authReady, db, functions } from "../../lib/firebase";
import { UserRole } from "../../types";
import { AuthContext } from "./authContextDef";

interface JoinCoupleResponse {
  success: boolean;
  coupleId: string;
  role: UserRole;
  displayName: string;
  email: string;
}

const redirectResultPromise = authReady.then(() => getRedirectResult(auth));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Tangani hasil redirect saat aplikasi dibuka kembali di iPhone / PWA standalone
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await authReady;
        await redirectResultPromise;
      } catch (err: unknown) {
        if (isMounted) {
          const authError = err as { code?: string; message?: string };
          setError(getAuthErrorMessage(authError));
        }
      }

      if (!isMounted) return;

      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        setLoading(true);
        if (currentUser) setError(null);

        if (!currentUser) {
          setUser(null);
          setRole(null);
          setCoupleId(null);
          setIsAllowed(true);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data?.role && data?.coupleId) {
              setRole(data.role as UserRole);
              setCoupleId(data.coupleId);
              setIsAllowed(true);
              setLoading(false);
              return;
            }
          }

          const joinCoupleFn = httpsCallable<void, JoinCoupleResponse>(functions, "joinCouple");
          const res = await joinCoupleFn();

          if (res.data?.success) {
            setRole(res.data.role);
            setCoupleId(res.data.coupleId);
            setIsAllowed(true);
          } else {
            setIsAllowed(false);
          }
        } catch (err: unknown) {
          const authError = err as { code?: string; message?: string };
          if (
            authError.code === "functions/permission-denied" ||
            authError.code === "permission-denied" ||
            authError.message?.includes("tidak diizinkan")
          ) {
            setIsAllowed(false);
            setError("Akun Google ini belum diizinkan untuk mengakses aplikasi.");
          } else if (
            authError.code === "functions/failed-precondition" ||
            authError.message?.includes("diverifikasi")
          ) {
            setIsAllowed(false);
            setError("Email Google Anda belum diverifikasi.");
          } else {
            setError(authError.message || "Gagal memeriksa akun. Periksa koneksi, lalu coba lagi.");
          }
        } finally {
          setLoading(false);
        }
      });
    })();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // Listener perubahan status auth dan verifikasi keanggotaan couple
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        setUser(null);
        setRole(null);
        setCoupleId(null);
        setIsAllowed(true);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        // 1. Cek profil user di Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data?.role && data?.coupleId) {
            setRole(data.role as UserRole);
            setCoupleId(data.coupleId);
            setIsAllowed(true);
            setLoading(false);
            return;
          }
        }

        // 2. Jika belum ada atau belum lengkap, panggil Cloud Function joinCouple
        const joinCoupleFn = httpsCallable<void, JoinCoupleResponse>(functions, "joinCouple");
        const res = await joinCoupleFn();

        if (res.data?.success) {
          setRole(res.data.role);
          setCoupleId(res.data.coupleId);
          setIsAllowed(true);
        } else {
          setIsAllowed(false);
        }
      } catch (err: unknown) {
        // Tangani jika email ditolak oleh Cloud Function
        const errObj = err as { code?: string; message?: string };
        if (
          errObj.code === "functions/permission-denied" ||
          errObj.code === "permission-denied" ||
          errObj.message?.includes("tidak diizinkan")
        ) {
          setIsAllowed(false);
          setError("Akun ini tidak diizinkan untuk mengakses aplikasi.");
        } else if (
          errObj.code === "functions/failed-precondition" ||
          errObj.message?.includes("diverifikasi")
        ) {
          setIsAllowed(false);
          setError("Email Google Anda belum diverifikasi.");
        } else {
          setError(errObj.message || "Terjadi kesalahan saat memeriksa akun.");
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Masuk dengan Google menggunakan redirect (wajib untuk iOS PWA standalone)
  const signIn = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await authReady;
      await signInWithRedirect(auth, provider);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err as { code?: string; message?: string }));
      setLoading(false);
    }
  };

  // Keluar dari aplikasi
  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setRole(null);
      setCoupleId(null);
      setIsAllowed(true);
      setError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal keluar.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const contextValue = useMemo(
    () => ({
      user,
      role,
      coupleId,
      isAllowed,
      loading,
      error,
      signIn,
      signOut,
    }),
    [user, role, coupleId, isAllowed, loading, error]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

function getAuthErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "auth/configuration-not-found") {
    return "Firebase tidak menemukan konfigurasi Google Sign-In untuk project ini. Pastikan provider Google aktif pada project yang sama dengan aplikasi.";
  }
  if (error.code === "auth/unauthorized-domain") {
    return "Domain aplikasi belum diizinkan di Firebase Authentication → Settings → Authorized domains.";
  }
  if (error.code === "auth/operation-not-allowed") {
    return "Google Sign-In belum diaktifkan pada Firebase Authentication untuk project ini.";
  }
  return error.message || "Gagal menyelesaikan proses masuk. Periksa koneksi dan coba lagi.";
}
