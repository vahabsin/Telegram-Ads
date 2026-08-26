import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MeResponse } from "@telegram-ads/shared-types";
import { authenticateWithTelegram, getMe } from "./api";
import { getInitData, getTelegramWebApp } from "./telegram";

interface AuthState {
  status: "loading" | "error" | "ready";
  user: MeResponse | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const me = await getMe();
    setUser(me);
  }

  useEffect(() => {
    getTelegramWebApp()?.ready();
    getTelegramWebApp()?.expand();

    const initData = getInitData();
    if (!initData) {
      setStatus("error");
      setError("این اپلیکیشن باید از داخل تلگرام باز بشه.");
      return;
    }

    authenticateWithTelegram(initData)
      .then(() => getMe())
      .then((me) => {
        setUser(me);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "خطای ناشناخته در ورود");
        setStatus("error");
      });
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, error, refresh }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
