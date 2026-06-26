import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  activeAccount,
  apiBearerToken,
  apiRequest,
  getMsal,
  initMsal,
  loginRequest,
  storeAuthResult,
} from "./auth/msal";
import { establishSession } from "./auth/session";
import { setTokenProvider } from "./auth/token";
import type { AuthConfig, User } from "./auth/types";

interface AuthContextValue {
  ready: boolean;
  config: AuthConfig;
  user: User | null;
  accountLabel: string | null;
  signingIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  syncProfile: () => Promise<void>;
}

const disabledConfig: AuthConfig = {
  enabled: false,
  required: false,
  clientId: null,
  tenantId: null,
  apiScope: null,
  graphScopes: [],
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch("/api/auth/config");
  if (!res.ok) return disabledConfig;
  return res.json() as Promise<AuthConfig>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<AuthConfig>(disabledConfig);
  const [user, setUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const instance = getMsal();
    if (!instance || !config.enabled) return null;

    const account = activeAccount(instance);
    if (!account) return null;

    try {
      const result = await instance.acquireTokenSilent({
        ...apiRequest(config),
        account,
      });
      storeAuthResult(instance, result);
      return apiBearerToken(result);
    } catch {
      return null;
    }
  }, [config]);

  const syncProfile = useCallback(async () => {
    const synced = await establishSession(config);
    if (synced) setUser(synced);
  }, [config]);

  const login = useCallback(async () => {
    const instance = getMsal();
    if (!instance) return;
    setSigningIn(true);
    try {
      await instance.loginRedirect(loginRequest(config));
    } finally {
      setSigningIn(false);
    }
  }, [config]);

  const logout = useCallback(async () => {
    const instance = getMsal();
    setUser(null);
    setLabel(null);
    if (!instance) return;
    const account = activeAccount(instance);
    await instance.logoutRedirect({ account: account ?? undefined });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const nextConfig = await fetchAuthConfig();
      if (cancelled) return;
      setConfig(nextConfig);

      await initMsal(nextConfig);
      if (cancelled) return;

      const instance = getMsal();
      if (instance) {
        const account = activeAccount(instance);
        setLabel(account?.name ?? account?.username ?? null);
      }

      setTokenProvider(async () => {
        const inst = getMsal();
        if (!inst || !nextConfig.enabled) return null;
        const acct = activeAccount(inst);
        if (!acct) return null;
        try {
          const result = await inst.acquireTokenSilent({
            ...apiRequest(nextConfig),
            account: acct,
          });
          storeAuthResult(inst, result);
          return apiBearerToken(result);
        } catch {
          return null;
        }
      });

      const synced = await establishSession(nextConfig);
      if (synced && !cancelled) setUser(synced);

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      setTokenProvider(null);
    };
  }, []);

  const value = useMemo(
    () => ({
      ready,
      config,
      user,
      accountLabel: user?.displayName ?? label,
      signingIn,
      login,
      logout,
      getAccessToken,
      syncProfile,
    }),
    [ready, config, user, label, signingIn, login, logout, getAccessToken, syncProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}