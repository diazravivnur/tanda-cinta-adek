import { createContext } from "react";
import { User } from "firebase/auth";
import { UserRole } from "../../types";

export interface AuthContextValue {
  user: User | null;
  role: UserRole | null;
  coupleId: string | null;
  isAllowed: boolean;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

