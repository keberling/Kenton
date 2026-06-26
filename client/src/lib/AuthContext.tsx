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
  apiRequest,
  getMsal,
  graphRequest,
  initMsal,
  loginRequest,
  storeAuthResult,
} from "./auth/msal";
import { setTokenProvider } from "./auth/token";
import type { AuthConfig, GraphProfile, User } from "./auth/types";
import { authHeaders } from "./auth/token";

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

async function fetchMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { headers: await authHeaders() });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: User };
  return body.user;
}

async function fetchGraphProfile(graphToken: string): Promise<GraphProfile | null> {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,jobTitle,department,officeLocation",
    { headers: { Authorization: `Bearer ${graphToken}` } },
  );
  if (!res.ok) return null;
  return res.json() as Promise<GraphProfile>;
}

async function postProfileSync(patch: GraphProfile, accessToken: string): Promise<User | null> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      displayName: patch.displayName,
      email: patch.mail ?? patch.userPrincipalName ?? null,
      preferredUsername: patch.userPrincipalName ?? null,
      jobTitle: patch.jobTitle ?? null,
      department: patch.department ?? null,
      officeLocation: patch.officeLocation ?? null,
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: User };
  return body.user;
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
      return result.accessToken;
    } catch {
      await instance.acquireTokenRedirect({
        ...apiRequest(config),
        account,
      });
      return null;
    }
  }, [config]);

  const syncProfile = useCallback(async () => {
    const instance = getMsal();
    if (!instance || !config.enabled) return;

    const account = activeAccount(instance);
    if (!account) return;

    try {
      const graphResult = await instance.acquireTokenSilent({
        ...graphRequest(),
        account,
      });
      const profile = await fetchGraphProfile(graphResult.accessToken);
      if (profile) {
        const synced = await postProfileSync(profile, graphResult.accessToken);
        if (synced) setUser(synced);
        return;
      }
    } catch {
      // Graph enrichment is optional
    }

    const me = await fetchMe();
    if (me) setUser(me);
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

      const instance = await initMsal(nextConfig);
      if (cancelled) return;

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
          return result.accessToken;
        } catch {
          return null;
        }
      });

      if (instance && activeAccount(instance)) {
        const account = activeAccount(instance);
        if (account && nextConfig.enabled) {
          try {
            const graphResult = await instance.acquireTokenSilent({
              ...graphRequest(),
              account,
            });
            const profile = await fetchGraphProfile(graphResult.accessToken);
            if (profile) {
              const synced = await postProfileSync(profile, graphResult.accessToken);
              if (synced && !cancelled) setUser(synced);
            } else if (!cancelled) {
              const me = await fetchMe();
              if (me) setUser(me);
            }
          } catch {
            if (!cancelled) {
              const me = await fetchMe();
              if (me) setUser(me);
            }
          }
        }
      }

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