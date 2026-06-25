export function azureAuthEnabled(): boolean {
  return Boolean(process.env.AZURE_CLIENT_ID?.trim() && process.env.AZURE_TENANT_ID?.trim());
}

/** When Azure is configured, uploads require sign-in unless explicitly disabled. */
export function authRequired(): boolean {
  if (!azureAuthEnabled()) return false;
  return process.env.AUTH_REQUIRED !== "false";
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

export function azureAudiences(): string[] {
  const clientId = azureClientId();
  return [clientId, `api://${clientId}`];
}