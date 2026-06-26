import { autotaskConfig } from "./config.js";
import type { AutotaskCompany, AutotaskZoneInfo } from "./types.js";

const ZONE_LOOKUP_URL =
  "http://webservices.autotask.net/atservicesrest/v1.0/zoneInformation";

let cachedZone: { username: string; url: string } | null = null;

function authHeaders(config: NonNullable<ReturnType<typeof autotaskConfig>>): HeadersInit {
  return {
    UserName: config.username,
    Secret: config.secret,
    ApiIntegrationCode: config.integrationCode,
    "Content-Type": "application/json",
  };
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function formatAutotaskHttpError(
  entity: string,
  status: number,
  text: string,
  zoneUrl?: string,
): string {
  if (status === 401) {
    const hints = [
      "Autotask authentication failed (401). Check:",
      "• AUTOTASK_API_USERNAME = API-only user email (not your login)",
      "• AUTOTASK_API_SECRET = that API user's password",
      "• AUTOTASK_INTEGRATION_CODE = tracking identifier from that user's Security tab (long key, not the integration name)",
      "• User security level is API User (API-only) with Companies read access",
      zoneUrl ? `• API zone: ${zoneUrl}` : "",
    ].filter(Boolean);
    return hints.join(" ");
  }

  return `Autotask ${entity} query failed (${status})${text ? `: ${text.slice(0, 180)}` : ""}${
    zoneUrl ? ` [zone: ${zoneUrl}]` : ""
  }`;
}

export function requireAutotaskConfig() {
  const config = autotaskConfig();
  if (!config) {
    throw new Error(
      "Autotask is not configured. Set AUTOTASK_API_USERNAME, AUTOTASK_API_SECRET, and AUTOTASK_INTEGRATION_CODE.",
    );
  }
  return config;
}

export async function resolveAutotaskZoneUrl(
  config: NonNullable<ReturnType<typeof autotaskConfig>>,
): Promise<string> {
  if (config.zoneUrl) return normalizeBaseUrl(config.zoneUrl);
  if (cachedZone?.username === config.username) return cachedZone.url;

  const params = new URLSearchParams({ user: config.username });
  const response = await fetch(`${ZONE_LOOKUP_URL}?${params}`);
  if (!response.ok) {
    throw new Error(`Autotask zone lookup failed (${response.status})`);
  }

  const body = (await response.json()) as AutotaskZoneInfo;
  if (!body.url) throw new Error("Autotask zone lookup returned no API URL");

  const url = normalizeBaseUrl(body.url);
  cachedZone = { username: config.username, url };
  return url;
}

interface QueryBody {
  filter: unknown[];
  MaxRecords?: number;
}

interface QueryResponse<T> {
  items?: T[];
  pageDetails?: { count?: number; nextPageUrl?: string | null };
}

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return false;
}

export function mapAutotaskCompany(raw: Record<string, unknown>): AutotaskCompany {
  return {
    id: pickNumber(raw, ["id", "Id"]) ?? 0,
    companyName: pickString(raw, ["companyName", "CompanyName"]) ?? "Unnamed client",
    companyType: pickNumber(raw, ["companyType", "CompanyType"]),
    isActive: pickBoolean(raw, ["isActive", "IsActive"]),
    address1: pickString(raw, ["address1", "Address1"]),
    address2: pickString(raw, ["address2", "Address2"]),
    city: pickString(raw, ["city", "City"]),
    state: pickString(raw, ["state", "State"]),
    postalCode: pickString(raw, ["postalCode", "PostalCode"]),
    phone: pickString(raw, ["phone", "Phone"]),
  };
}

export function formatCompanyAddress(company: AutotaskCompany): string {
  return [company.address1, company.address2, company.city, company.state, company.postalCode]
    .filter((part) => part && part.trim())
    .join(", ")
    .trim();
}

async function autotaskQuery<T>(
  entity: string,
  body: QueryBody,
): Promise<T[]> {
  const config = requireAutotaskConfig();
  const baseUrl = await resolveAutotaskZoneUrl(config);
  const response = await fetch(`${baseUrl}/v1.0/${entity}/query`, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(formatAutotaskHttpError(entity, response.status, text, baseUrl));
  }

  const payload = (await response.json()) as QueryResponse<T>;
  return payload.items ?? [];
}

export async function testAutotaskConnection(): Promise<{
  zoneName: string;
  zoneUrl: string;
}> {
  const config = requireAutotaskConfig();
  const zoneUrl = await resolveAutotaskZoneUrl(config);

  await autotaskQuery("Companies", {
    filter: [{ op: "exist", field: "id" }],
    MaxRecords: 1,
  });

  const params = new URLSearchParams({ user: config.username });
  const zoneResponse = await fetch(`${ZONE_LOOKUP_URL}?${params}`);
  const zone = (await zoneResponse.json()) as AutotaskZoneInfo;

  return { zoneName: zone.zoneName, zoneUrl };
}

export async function queryAutotaskCompanies(options?: {
  search?: string;
  limit?: number;
  customersOnly?: boolean;
}): Promise<AutotaskCompany[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const search = options?.search?.trim();

  const filters: unknown[] = [{ op: "eq", field: "isActive", value: true }];

  if (options?.customersOnly !== false) {
    filters.push({ op: "eq", field: "companyType", value: 1 });
  }

  if (search) {
    filters.push({ op: "contains", field: "companyName", value: search });
  }

  const filter =
    filters.length === 1
      ? filters
      : [{ op: "and", items: filters }];

  const rows = await autotaskQuery<Record<string, unknown>>("Companies", {
    filter,
    MaxRecords: limit,
  });

  return rows
    .map(mapAutotaskCompany)
    .filter((company) => company.id > 0)
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
}

export async function getAutotaskCompany(companyId: number): Promise<AutotaskCompany | null> {
  const config = requireAutotaskConfig();
  const baseUrl = await resolveAutotaskZoneUrl(config);
  const response = await fetch(`${baseUrl}/v1.0/Companies/${companyId}`, {
    headers: authHeaders(config),
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Autotask company lookup failed (${response.status})`);
  }

  const body = (await response.json()) as
    | { item?: Record<string, unknown> }
    | Record<string, unknown>;
  const item =
    "item" in body && body.item && typeof body.item === "object"
      ? body.item
      : body;
  if (!item || typeof item !== "object" || !("id" in item)) return null;
  return mapAutotaskCompany(item as Record<string, unknown>);
}