import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import type { MeClient, User } from "./types";

type AuthState = {
  loading: boolean;
  user: User | null;
  client: MeClient | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ loading: boolean; user: User | null; client: MeClient | null }>({
    loading: true,
    user: null,
    client: null,
  });

  const refresh = useCallback(async () => {
    try {
      const me = await api.get<{ user: User; client: MeClient | null }>("/api/auth/me");
      setState({ loading: false, user: me.user, client: me.client });
    } catch (e) {
      if (!(e instanceof ApiError) || e.status !== 401) console.error(e);
      setState({ loading: false, user: null, client: null });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    setState({ loading: false, user: null, client: null });
  }, []);

  return <Ctx.Provider value={{ ...state, refresh, logout }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth outside AuthProvider");
  return v;
}
