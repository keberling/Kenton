import type { AuthConfig } from "./types";
import type { GraphProfile, User } from "./types";
import {
  activeAccount,
  apiBearerToken,
  apiRequest,
  consumeRedirectResult,
  getMsal,
  graphRequest,
  storeAuthResult,
} from "./msal";
import { authHeaders } from "./token";

async function fetchGraphProfile(graphToken: string): Promise<GraphProfile | null> {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,jobTitle,department,officeLocation",
    { headers: { Authorization: `Bearer ${graphToken}` } },
  );
  if (!res.ok) return null;
  return res.json() as Promise<GraphProfile>;
}

async function postProfileSync(patch: GraphProfile, idToken: string): Promise<User | null> {
  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
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

async function fetchMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { headers: await authHeaders() });
  if (!res.ok) return null;
  const body = (await res.json()) as { user: User };
  return body.user;
}

export async function establishSession(config: AuthConfig): Promise<User | null> {
  const instance = getMsal();
  if (!instance || !config.enabled) return null;

  const account = activeAccount(instance);
  if (!account) return null;

  const redirect = consumeRedirectResult();
  if (redirect?.idToken) {
    storeAuthResult(instance, redirect);
    const profile = redirect.accessToken ? await fetchGraphProfile(redirect.accessToken) : null;
    if (profile) {
      const synced = await postProfileSync(profile, redirect.idToken);
      if (synced) return synced;
    }
    const me = await fetchMe();
    if (me) return me;
  }

  try {
    const apiResult = await instance.acquireTokenSilent({ ...apiRequest(config), account });
    storeAuthResult(instance, apiResult);
    const idToken = apiBearerToken(apiResult);
    if (!idToken) return null;

    try {
      const graphResult = await instance.acquireTokenSilent({ ...graphRequest(), account });
      const profile = await fetchGraphProfile(graphResult.accessToken);
      if (profile) {
        const synced = await postProfileSync(profile, idToken);
        if (synced) return synced;
      }
    } catch {
      // Graph profile enrichment is optional
    }

    return fetchMe();
  } catch {
    return null;
  }
}