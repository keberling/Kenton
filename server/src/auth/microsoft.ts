import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthUser } from "../types.js";
import {
  authRequired,
  azureApiScope,
  azureAudiences,
  azureAuthEnabled,
  azureClientId,
  azureIssuer,
  azureTenantId,
} from "./config.js";

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    const tenantId = azureTenantId();
    jwks = createRemoteJWKSet(
      new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
    );
  }
  return jwks;
}

function claimString(payload: JWTPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function authUserFromPayload(payload: JWTPayload): AuthUser | null {
  const microsoftOid = claimString(payload, "oid");
  const tenantId = claimString(payload, "tid") ?? azureTenantId();
  if (!microsoftOid) return null;

  const displayName =
    claimString(payload, "name") ??
    claimString(payload, "preferred_username") ??
    claimString(payload, "email") ??
    claimString(payload, "upn") ??
    "Microsoft user";

  return {
    microsoftOid,
    tenantId,
    displayName,
    email: claimString(payload, "email") ?? claimString(payload, "upn"),
    preferredUsername: claimString(payload, "preferred_username") ?? claimString(payload, "upn"),
    jobTitle: claimString(payload, "jobTitle"),
    department: claimString(payload, "department"),
    officeLocation: claimString(payload, "officeLocation"),
  };
}

export async function verifyMicrosoftAccessToken(token: string): Promise<AuthUser | null> {
  if (!azureAuthEnabled()) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: azureIssuer(),
      audience: azureAudiences(),
    });
    return authUserFromPayload(payload);
  } catch {
    return null;
  }
}

export function publicAuthConfig() {
  const enabled = azureAuthEnabled();
  return {
    enabled,
    required: authRequired(),
    clientId: enabled ? azureClientId() : null,
    tenantId: enabled ? azureTenantId() : null,
    apiScope: enabled ? azureApiScope() : null,
    graphScopes: enabled ? ["User.Read"] : [],
  };
}