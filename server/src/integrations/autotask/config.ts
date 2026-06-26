export interface AutotaskConfig {
  username: string;
  secret: string;
  integrationCode: string;
  zoneUrl: string | null;
}

export function autotaskConfig(): AutotaskConfig | null {
  const username = process.env.AUTOTASK_API_USERNAME?.trim() ?? "";
  const secret = process.env.AUTOTASK_API_SECRET?.trim() ?? "";
  const integrationCode = process.env.AUTOTASK_INTEGRATION_CODE?.trim() ?? "";
  const zoneUrl = process.env.AUTOTASK_ZONE_URL?.trim() || null;

  if (!username || !secret || !integrationCode) return null;

  return { username, secret, integrationCode, zoneUrl };
}

export function maskAutotaskUsername(username: string): string {
  const at = username.indexOf("@");
  if (at <= 1) return "***";
  return `${username.slice(0, 2)}***${username.slice(at)}`;
}