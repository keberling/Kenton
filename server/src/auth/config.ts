export function azureAuthEnabled(): boolean {
  return Boolean(process.env.AZURE_CLIENT_ID?.trim() && process.env.AZURE_TENANT_ID?.trim());
}

/** When Azure is configured, app views/admin APIs require sign-in unless disabled. */
export function authViewRequired(): boolean {
  if (!azureAuthEnabled()) return false;
  return process.env.AUTH_REQUIRED !== "false";
}

/** @deprecated alias for authViewRequired */
export function authRequired(): boolean {
  return authViewRequired();
}

/** Uploads are public by default; set AUTH_UPLOAD_REQUIRED=true to require sign-in. */
export function authUploadRequired(): boolean {
  if (!azureAuthEnabled()) return false;
  return process.env.AUTH_UPLOAD_REQUIRED === "true";
}

export function azureClientSecret(): string {
  return process.env.AZURE_CLIENT_SECRET?.trim() ?? "";
}

export function graphAppAuthEnabled(): boolean {
  return azureAuthEnabled() && Boolean(azureClientSecret());
}

export function azureClientId(): string {
  return process.env.AZURE_CLIENT_ID?.trim() ?? "";
}

export function azureTenantId(): string {
  return process.env.AZURE_TENANT_ID?.trim() ?? "";
}

export function azureIssuer(): string {
  return `https://login.microsoftonline.com/${azureTenantId()}/v2.0`;
}

export function azureApiScope(): string {
  const scope = process.env.AZURE_API_SCOPE?.trim();
  if (scope) return scope;
  const clientId = azureClientId();
  return `api://${clientId}/access_as_user`;
}

const GRAPH_AUDIENCES = [
  "00000003-0000-0000-c000-000000000000",
  "https://graph.microsoft.com",
] as const;

export function azureAudiences(): string[] {
  const clientId = azureClientId();
  return [clientId, `api://${clientId}`, ...GRAPH_AUDIENCES];
}