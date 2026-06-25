import { db } from "./db.js";

export interface GeoPoint {
  lat: number;
  lng: number;
  source: "cache" | "nominatim" | "census" | "photon";
}

export interface GeocodeResult {
  point: GeoPoint | null;
  error: string | null;
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

function looksLikeUS(address: string): boolean {
  return /\b(usa|united states|u\.s\.)\b/i.test(address)
    || /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(address)
    || /,\s*[A-Z]{2}\s*$/i.test(address);
}

function cacheGet(key: string): GeoPoint | null {
  const cached = db.prepare(`
    SELECT lat, lng FROM geocode_cache WHERE address_key = ?
  `).get(key) as { lat: number; lng: number } | undefined;

  if (!cached) return null;
  return { lat: cached.lat, lng: cached.lng, source: "cache" };
}

function cacheSet(key: string, lat: number, lng: number) {
  db.prepare(`
    INSERT INTO geocode_cache (address_key, lat, lng, cached_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(address_key) DO UPDATE SET lat = excluded.lat, lng = excluded.lng, cached_at = excluded.cached_at
  `).run(key, lat, lng, Date.now());
}

async function fetchNominatim(address: string): Promise<GeoPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const email = process.env.NOMINATIM_EMAIL?.trim();
  if (email) url.searchParams.set("email", email);
  if (looksLikeUS(address)) url.searchParams.set("countrycodes", "us");

  const res = await fetch(url, {
    headers: {
      "User-Agent": email
        ? `Kenton-JobPhotos/1.0 (${email})`
        : "Kenton-JobPhotos/1.0 (https://github.com/keberling/Kenton)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1100));
    const retry = await fetch(url, {
      headers: {
        "User-Agent": email
          ? `Kenton-JobPhotos/1.0 (${email})`
          : "Kenton-JobPhotos/1.0 (https://github.com/keberling/Kenton)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!retry.ok) return null;
    return parseNominatim(await retry.json());
  }

  if (!res.ok) return null;
  return parseNominatim(await res.json());
}

function parseNominatim(body: unknown): GeoPoint | null {
  const results = Array.isArray(body) ? body : [];
  const hit = results[0] as { lat?: string; lon?: string } | undefined;
  if (!hit) return null;

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, source: "nominatim" };
}

async function fetchCensus(address: string): Promise<GeoPoint | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", address.trim());
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;

  const body = await res.json() as {
    result?: {
      addressMatches?: Array<{
        coordinates?: { x?: number; y?: number };
      }>;
    };
  };

  const match = body.result?.addressMatches?.[0];
  const lng = match?.coordinates?.x;
  const lat = match?.coordinates?.y;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat: lat!, lng: lng!, source: "census" };
}

async function fetchPhoton(address: string): Promise<GeoPoint | null> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", address.trim());
  url.searchParams.set("limit", "1");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;

  const body = await res.json() as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
    }>;
  };

  const coords = body.features?.[0]?.geometry?.coordinates;
  if (!coords || coords.length < 2) return null;

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, source: "photon" };
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const trimmed = address.trim();
  if (!trimmed) {
    return { point: null, error: "Address is empty" };
  }

  const key = normalizeAddress(trimmed);
  const cached = cacheGet(key);
  if (cached) return { point: cached, error: null };

  const errors: string[] = [];

  try {
    const nominatim = await fetchNominatim(trimmed);
    if (nominatim) {
      cacheSet(key, nominatim.lat, nominatim.lng);
      return { point: nominatim, error: null };
    }
    errors.push("Nominatim: no match");
  } catch (err) {
    errors.push(`Nominatim: ${err instanceof Error ? err.message : "request failed"}`);
  }

  if (looksLikeUS(trimmed)) {
    try {
      const census = await fetchCensus(trimmed);
      if (census) {
        cacheSet(key, census.lat, census.lng);
        return { point: census, error: null };
      }
      errors.push("US Census: no match");
    } catch (err) {
      errors.push(`US Census: ${err instanceof Error ? err.message : "request failed"}`);
    }
  }

  try {
    const photon = await fetchPhoton(trimmed);
    if (photon) {
      cacheSet(key, photon.lat, photon.lng);
      return { point: photon, error: null };
    }
    errors.push("Photon: no match");
  } catch (err) {
    errors.push(`Photon: ${err instanceof Error ? err.message : "request failed"}`);
  }

  console.warn(`Geocode failed for "${trimmed}": ${errors.join("; ")}`);

  return {
    point: null,
    error: errors.join(". ") + ". Try a full street address with city, state, and ZIP.",
  };
}