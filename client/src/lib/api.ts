import type { AddressSuggestion, DeploymentRecommendation, Photo, Site, Stats } from "../types";
import { authHeaders } from "./auth/token";

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const auth = await authHeaders();
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(auth)) {
    headers.set(key, value);
  }
  return fetch(url, { ...init, headers });
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function searchAddresses(query: string, limit = 6) {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return apiFetch(`/api/addresses/search?${params}`).then((r) =>
    parse<{ suggestions: AddressSuggestion[] }>(r),
  );
}

export function reverseGeocodeAddress(lat: number, lng: number) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return apiFetch(`/api/addresses/reverse?${params}`).then((r) =>
    parse<{ suggestion: AddressSuggestion }>(r),
  );
}

export function getDeploymentRecommendations() {
  return apiFetch("/api/recommendations/deployments").then((r) =>
    parse<{ recommendations: DeploymentRecommendation[] }>(r),
  );
}

export function getStats() {
  return apiFetch("/api/stats").then((r) => parse<Stats>(r));
}

export function getSites() {
  return apiFetch("/api/sites").then((r) => parse<Site[]>(r));
}

export function getSite(id: string) {
  return apiFetch(`/api/sites/${id}`).then((r) => parse<Site>(r));
}

export function createSite(input: { name: string; address: string; radiusMeters?: number }) {
  return apiFetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => parse<{
    site: Site;
    matchedPhotos: number;
    geocoded: boolean;
    geocodeSource?: string | null;
    geocodeError?: string | null;
  }>(r));
}

export function updateSite(id: string, input: { name?: string; address?: string }) {
  return apiFetch(`/api/sites/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) =>
    parse<{
      site: Site;
      matchedPhotos: number;
      geocoded: boolean;
      geocodeSource?: string | null;
      geocodeError?: string | null;
    }>(r),
  );
}

export function regeocodeSite(id: string) {
  return apiFetch(`/api/sites/${id}/geocode`, { method: "POST" }).then((r) =>
    parse<{ site: Site; matchedPhotos: number; geocodeSource: string }>(r),
  );
}

export function deleteSite(id: string) {
  return apiFetch(`/api/sites/${id}`, { method: "DELETE" }).then((r) => parse<{ ok: boolean }>(r));
}

export function getPhotoGeoPoints() {
  return apiFetch("/api/photos/geo").then((r) =>
    parse<{ points: Array<{ lat: number; lng: number }>; total: number }>(r),
  );
}

export function getPhotos(params?: { siteId?: string; unassigned?: boolean }) {
  const query = new URLSearchParams();
  if (params?.siteId) query.set("siteId", params.siteId);
  if (params?.unassigned) query.set("unassigned", "true");
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch(`/api/photos${suffix}`).then((r) => parse<Photo[]>(r));
}

export function uploadPhotos(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("photos", file);
  return fetch("/api/photos/upload", { method: "POST", body: form }).then((r) =>
    parse<{ photos: Photo[] }>(r),
  );
}

export function deletePhoto(id: string) {
  return apiFetch(`/api/photos/${id}`, { method: "DELETE" }).then((r) => parse<{ ok: boolean }>(r));
}

export function rematchPhoto(id: string) {
  return apiFetch(`/api/photos/${id}/match`, { method: "POST" }).then((r) => parse<Photo>(r));
}

export interface RescanMatchesResult {
  scanned: number;
  matched: number;
  reassigned: number;
  unassigned: number;
  unchanged: number;
  matchRadiusM: number;
  softMatchCushionM: number;
  maxMatchDistanceM: number;
}

export function rematchAllPhotos() {
  return apiFetch("/api/photos/rematch", { method: "POST" }).then((r) =>
    parse<RescanMatchesResult>(r),
  );
}

export function assignPhotoToSite(photoId: string, siteId: string) {
  return apiFetch(`/api/photos/${photoId}/site`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId }),
  }).then((r) => parse<Photo>(r));
}

export function unassignPhoto(photoId: string) {
  return apiFetch(`/api/photos/${photoId}/site`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ siteId: null }),
  }).then((r) => parse<Photo>(r));
}

export interface AutotaskEnvDiagnostics {
  hasUsername: boolean;
  hasSecret: boolean;
  hasIntegrationCode: boolean;
  usernameLooksLikeEmail?: boolean;
  integrationCodeLength?: number;
  secretLength?: number;
  hadWrappingQuotes?: boolean;
  integrationCodeLooksValid?: boolean;
  activeSource?: "database" | "environment" | null;
}

export interface AutotaskStatus {
  configured: boolean;
  username?: string;
  hasZoneOverride?: boolean;
  source?: "database" | "environment" | null;
  env?: AutotaskEnvDiagnostics;
}

export interface AutotaskCompanyListItem {
  id: number;
  companyName: string;
  companyType: number | null;
  isActive: boolean;
  address: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  alreadyImported: boolean;
  existingSiteId: string | null;
}

export interface AutotaskImportResult {
  created: number;
  updated: number;
  skipped: number;
  geocoded: number;
  matchedPhotos: number;
}

export function getAutotaskStatus() {
  return apiFetch("/api/integrations/autotask/status").then((r) => parse<AutotaskStatus>(r));
}

export function saveAutotaskConfig(input: {
  username: string;
  secret: string;
  integrationCode: string;
  zoneUrl?: string;
}) {
  return apiFetch("/api/integrations/autotask/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) =>
    parse<{
      ok: boolean;
      saved?: boolean;
      zoneName?: string;
      zoneUrl?: string;
      webUrl?: string;
      error?: string;
    }>(r),
  );
}

export function clearAutotaskConfig() {
  return apiFetch("/api/integrations/autotask/config", { method: "DELETE" }).then((r) =>
    parse<{ ok: boolean }>(r),
  );
}

export function testAutotaskConnection() {
  return apiFetch("/api/integrations/autotask/test", { method: "POST" }).then((r) =>
    parse<{ ok: boolean; zoneName?: string; zoneUrl?: string; webUrl?: string; error?: string }>(r),
  );
}

export function getAutotaskCompanies(search?: string, limit = 100) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search?.trim()) params.set("search", search.trim());
  return apiFetch(`/api/integrations/autotask/companies?${params}`).then((r) =>
    parse<{ companies: AutotaskCompanyListItem[] }>(r),
  );
}

export interface BackupRecord {
  id: string;
  filename: string;
  createdAt: number;
  sizeBytes: number;
  localPath: string;
  sharePointItemId: string | null;
  sharePointWebUrl: string | null;
  trigger: "scheduled" | "manual";
  status: "local" | "uploaded" | "failed";
  error: string | null;
}

export interface SharePointBackupSettings {
  configured: boolean;
  graphAuthReady: boolean;
  siteUrl: string | null;
  folderPath: string;
  driveName: string | null;
  updatedAt: number | null;
  saved?: boolean;
  test?: { ok: boolean; message: string };
}

export interface BackupStatus {
  enabled: boolean;
  retention: number;
  cron: string;
  timezone: string;
  sharePointConfigured: boolean;
  siteUrl: string | null;
  folderPath: string;
  driveName: string | null;
  graphAuthReady: boolean;
}

export function getSharePointBackupSettings() {
  return apiFetch("/api/settings/backup-sharepoint").then((r) => parse<SharePointBackupSettings>(r));
}

export function saveSharePointBackupSettings(input: { siteUrl: string; folderPath: string }) {
  return apiFetch("/api/settings/backup-sharepoint", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).then((r) => parse<SharePointBackupSettings>(r));
}

export function testSharePointBackupSettings() {
  return apiFetch("/api/settings/backup-sharepoint/test", { method: "POST" }).then((r) =>
    parse<{ ok: boolean; message: string }>(r),
  );
}

export async function getBackups() {
  return apiFetch("/api/backups").then((r) =>
    parse<{ backups: BackupRecord[]; status: BackupStatus }>(r),
  );
}

export async function runBackup() {
  return apiFetch("/api/backups/run", { method: "POST" }).then((r) =>
    parse<{ backup: BackupRecord }>(r),
  );
}

export async function downloadBackup(id: string, filename: string) {
  const res = await apiFetch(`/api/backups/${encodeURIComponent(id)}/download`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function importAutotaskCompanies(companyIds: number[]) {
  return apiFetch("/api/integrations/autotask/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyIds }),
  }).then((r) => parse<AutotaskImportResult>(r));
}