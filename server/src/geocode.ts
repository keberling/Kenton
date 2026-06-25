import { db } from "./db.js";

export interface GeoPoint {
  lat: number;
  lng: number;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function geocodeAddress(address: string): Promise<GeoPoint | null> {
  const key = normalizeAddress(address);
  const cached = db.prepare(`
    SELECT lat, lng FROM geocode_cache WHERE address_key = ?
  `).get(key) as { lat: number; lng: number } | undefined;

  if (cached) {
    return { lat: cached.lat, lng: cached.lng };
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address.trim());
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Kenton-JobPhotos/1.0 (field photo manager)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return null;

    const results = await res.json() as Array<{ lat: string; lon: string }>;
    const hit = results[0];
    if (!hit) return null;

    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    db.prepare(`
      INSERT INTO geocode_cache (address_key, lat, lng, cached_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(address_key) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, cached_at = excluded.cached_at
    `).run(key, lat, lng, Date.now());

    return { lat, lng };
  } catch {
    return null;
  }
}