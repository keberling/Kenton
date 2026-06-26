import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AuthUser } from "../types.js";
import { backupEnabled } from "../backup/config.js";
import {
  authRequired,
  authUploadRequired,
  azureApiScope,
  azureAudiences,
  azureAuthEnabled,
  azureClientId,
  azureIssuer,
  azureTenantId,
  graphAppAuthEnabled,
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

async function verifyWithAudiences(token: string, audiences: string[]): Promise<AuthUser | null> {
  const tenantId = azureTenantId();
  const issuers = [
    azureIssuer(),
    `https://login.microsoftonline.com/${tenantId}/`,
    `https://sts.windows.net/${tenantId}/`,
  ];

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: issuers,
      audience: audiences,
      clockTolerance: 60,
    });
    return authUserFromPayload(payload);
  } catch {
    return null;
  }
}

export async function verifyMicrosoftAccessToken(token: string): Promise<AuthUser | null> {
  if (!azureAuthEnabled()) return null;

  const clientId = azureClientId();

  // SPA login sends the Entra ID token (aud = app client ID).
  const fromIdToken = await verifyWithAudiences(token, [clientId]);
  if (fromIdToken) return fromIdToken;

  // Fallback: Graph or custom API access tokens.
  return verifyWithAudiences(token, azureAudiences());
}

export function publicAuthConfig() {
  const enabled = azureAuthEnabled();
  const viewRequired = authRequired();
  return {
    enabled,
    required: viewRequired,
    viewRequired,
    uploadRequired: authUploadRequired(),
    clientId: enabled ? azureClientId() : null,
    tenantId: enabled ? azureTenantId() : null,
    apiScope: enabled ? azureApiScope() : null,
    graphScopes: enabled ? ["User.Read"] : [],
    backupEnabled: backupEnabled(),
    graphSecretConfigured: graphAppAuthEnabled(),
  };
}

export function publicAuthStatus() {
  const enabled = azureAuthEnabled();
  return {
    azureConfigured: enabled,
    clientId: enabled ? azureClientId() : null,
    tenantId: enabled ? azureTenantId() : null,
    authRequired: authRequired(),
    uploadAuthRequired: authUploadRequired(),
    graphSecretConfigured: graphAppAuthEnabled(),
    backupEnabled: backupEnabled(),
  };
}