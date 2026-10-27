import React, { useState, useEffect } from "react";
import "../styles/tokens.css";
import "./App.css";
import { AuthProvider } from "../features/auth/AuthContext";
import { AuthGuard } from "../features/auth/AuthGuard";
import { useAuth } from "../features/auth/useAuth";
import { DevUiView } from "../features/dev/DevUiView";
import { ContractionsView } from "../features/contractions/ContractionsView";
import { UrgentView } from "../features/contractions/UrgentView";
import { NotificationSettingsView } from "../features/settings/NotificationSettingsView";

const AuthenticatedHome: React.FC = () => {
  const { coupleId } = useAuth();

  // Untuk saat ini, tampilkan layar kontraksi sebagai layar utama (pre-TabBar)
  // TabBar (M3 Tahap B) akan ditambahkan di fase berikutnya
  return <ContractionsView />;
  void coupleId; // akan dipakai saat TabBar ditambahkan
};

export const App: React.FC = () => {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const [isDevUi, setIsDevUi] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.location.pathname === "/dev/ui" ||
      window.location.hash === "#/dev/ui" ||
      window.location.search.includes("dev=ui")
    );
  });

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
      setIsDevUi(
        window.location.pathname === "/dev/ui" ||
        window.location.hash === "#/dev/ui" ||
        window.location.search.includes("dev=ui")
      );
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (isDevUi) {
    return <DevUiView />;
  }

  return (
    <AuthProvider>
      <AuthGuard>
        {pathname === "/settings" ? (
          <NotificationSettingsView />
        ) : pathname.startsWith("/urgent/") ? (
          <UrgentView sessionId={decodeURIComponent(pathname.slice("/urgent/".length))} />
        ) : (
          <AuthenticatedHome />
        )}
      </AuthGuard>
    </AuthProvider>
  );
};

export default App;
