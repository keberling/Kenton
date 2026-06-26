export interface AutotaskConfig {
  username: string;
  secret: string;
  integrationCode: string;
  zoneUrl: string | null;
}

/** Map common mistakes (ww22 web UI URL) to the REST zone base URL. */
export function normalizeAutotaskZoneUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  const wwMatch = trimmed.match(/^https?:\/\/ww(\d+)\.autotask\.net/i);
  if (wwMatch) {
    return `https://webservices${wwMatch[1]}.autotask.net/atservicesrest`;
  }
  if (/^https?:\/\/webservices\d+\.autotask\.net$/i.test(trimmed)) {
    return `${trimmed}/atservicesrest`;
  }
  return trimmed;
}

export function autotaskConfig(): AutotaskConfig | null {
  const username = process.env.AUTOTASK_API_USERNAME?.trim() ?? "";
  const secret = process.env.AUTOTASK_API_SECRET?.trim() ?? "";
  const integrationCode = process.env.AUTOTASK_INTEGRATION_CODE?.trim() ?? "";
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