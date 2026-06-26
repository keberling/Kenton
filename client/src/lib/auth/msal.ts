import {
  type AccountInfo,
  type AuthenticationResult,
  PublicClientApplication,
  type RedirectRequest,
  type SilentRequest,
} from "@azure/msal-browser";
import type { AuthConfig } from "./types";

let msal: PublicClientApplication | null = null;
let initPromise: Promise<PublicClientApplication | null> | null = null;

export async function initMsal(config: AuthConfig): Promise<PublicClientApplication | null> {
  if (!config.enabled || !config.clientId || !config.tenantId) return null;
  if (msal) return msal;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const instance = new PublicClientApplication({
      auth: {
        clientId: config.clientId!,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: {
        cacheLocation: "localStorage",
      },
    });

    await instance.initialize();
    try {
      const result = await instance.handleRedirectPromise();
      storeAuthResult(instance, result);
    } catch (err) {
      console.warn("Microsoft sign-in redirect could not be completed:", err);
    }
    msal = instance;
    return instance;
  })();

  return initPromise;
}

export function getMsal(): PublicClientApplication | null {
  return msal;
}

const DELEGATED_SCOPES = ["openid", "profile", "email", "User.Read"] as const;

export function loginRequest(_config: AuthConfig): RedirectRequest {
  return { scopes: [...DELEGATED_SCOPES] };
}

export function graphRequest(): SilentRequest {
  return { scopes: ["User.Read"] };
}

/** Graph User.Read token — works without Expose an API on the app registration. */
export function apiRequest(_config: AuthConfig): SilentRequest {
  return { scopes: ["User.Read"] };
}

export function activeAccount(instance: PublicClientApplication): AccountInfo | null {
  const active = instance.getActiveAccount();
  if (active) return active;
  const accounts = instance.getAllAccounts();
  if (accounts.length === 1) {
    instance.setActiveAccount(accounts[0]);
    return accounts[0];
  }
  return null;
}

export function accountLabel(account: AccountInfo | null): string | null {
  if (!account) return null;
  return account.name ?? account.username ?? null;
}

export function storeAuthResult(instance: PublicClientApplication, result: AuthenticationResult | null) {
  if (result?.account) instance.setActiveAccount(result.account);
}