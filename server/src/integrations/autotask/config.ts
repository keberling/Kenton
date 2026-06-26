export interface AutotaskConfig {
  username: string;
  secret: string;
  integrationCode: string;
  zoneUrl: string | null;
}

/** Strip whitespace and wrapping quotes from env values (common Coolify/.env mistake). */
export function sanitizeAutotaskEnvValue(value: string): string {
  let v = value.trim().replace(/^\uFEFF/, "");
  while (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1).trim();
  }
  return v;
}

/** Map common mistakes (ww22 web UI URL) to the REST zone base URL. */
export function normalizeAutotaskZoneUrl(url: string): string {
  const trimmed = sanitizeAutotaskEnvValue(url).replace(/\/+$/, "");
  const wwMatch = trimmed.match(/^https?:\/\/ww(\d+)\.autotask\.net/i);
  if (wwMatch) {
    return `https://webservices${wwMatch[1]}.autotask.net/atservicesrest`;
  }
  if (/^https?:\/\/webservices\d+\.autotask\.net$/i.test(trimmed)) {
    return `${trimmed}/atservicesrest`;
  }
  return trimmed;
}

export function autotaskConfigFromEnv(): AutotaskConfig | null {
  const username = sanitizeAutotaskEnvValue(process.env.AUTOTASK_API_USERNAME ?? "");
  const secret = sanitizeAutotaskEnvValue(process.env.AUTOTASK_API_SECRET ?? "");
  const integrationCode = sanitizeAutotaskEnvValue(process.env.AUTOTASK_INTEGRATION_CODE ?? "");
  const rawZoneUrl = process.env.AUTOTASK_ZONE_URL?.trim() || null;
  const zoneUrl = rawZoneUrl ? normalizeAutotaskZoneUrl(rawZoneUrl) : null;

  if (!username || !secret || !integrationCode) return null;

  return { username, secret, integrationCode, zoneUrl };
}

export function maskAutotaskUsername(username: string): string {
  const at = username.indexOf("@");
  if (at <= 1) return "***";
  return `${username.slice(0, 2)}***${username.slice(at)}`;
}