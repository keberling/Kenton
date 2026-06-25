import type { Photo, Site, Stats } from "../types";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function getStats() {
  return fetch("/api/stats").then((r) => parse<Stats>(r));
}

export function getSites() {
  return fetch("/api/sites").then((r) => parse<Site[]>(r));
}

export function getSite(id: string) {
  return fetch(`/api/sites/${id}`).then((r) => parse<Site>(r));
}

export function createSite(input: { name: string; address: string; radiusMeters?: number }) {
  return fetch("/api/sites", {
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

export function regeocodeSite(id: string) {
  return fetch(`/api/sites/${id}/geocode`, { method: "POST" }).then((r) =>
    parse<{ site: Site; matchedPhotos: number; geocodeSource: string }>(r),
  );
}

export function deleteSite(id: string) {
  return fetch(`/api/sites/${id}`, { method: "DELETE" }).then((r) => parse<{ ok: boolean }>(r));
}

export function getPhotos(params?: { siteId?: string; unassigned?: boolean }) {
  const query = new URLSearchParams();
  if (params?.siteId) query.set("siteId", params.siteId);
  if (params?.unassigned) query.set("unassigned", "true");
  const suffix = query.toString() ? `?${query}` : "";
  return fetch(`/api/photos${suffix}`).then((r) => parse<Photo[]>(r));
}

export function uploadPhotos(files: File[]) {
  const form = new FormData();
  for (const file of files) form.append("photos", file);
  return fetch("/api/photos/upload", { method: "POST", body: form }).then((r) =>
    parse<{ photos: Photo[] }>(r),
  );
}

export function deletePhoto(id: string) {
  return fetch(`/api/photos/${id}`, { method: "DELETE" }).then((r) => parse<{ ok: boolean }>(r));
}

export function rematchPhoto(id: string) {
  return fetch(`/api/photos/${id}/match`, { method: "POST" }).then((r) => parse<Photo>(r));
}