import { useContext } from "react";
import { AuthContext, AuthContextValue } from "./authContextDef";

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam AuthProvider");
  }
  return context;
};

// Alias useCouple untuk kemudahan akses role & couple
export const useCouple = () => {
  const { role, coupleId, isAllowed, loading } = useAuth();
  return { role, coupleId, isAllowed, loading };
};
