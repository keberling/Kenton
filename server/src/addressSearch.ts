export interface AddressSuggestion {
  id: string;
  label: string;
  shortLabel: string;
  lat: number;
  lng: number;
  source: "photon" | "nominatim";
  kind?: string;
}

function nominatimUserAgent(): string {
  const email = process.env.NOMINATIM_EMAIL?.trim();
  return email
    ? `Kenton-JobPhotos/1.0 (${email})`
    : "Kenton-JobPhotos/1.0 (https://github.com/keberling/Kenton)";
}

function formatPhotonLabel(props: Record<string, string | undefined>): string {
  const line1 = [props.housenumber, props.street || props.name].filter(Boolean).join(" ");
  const locality = props.city || props.town || props.village || props.district || props.county;
  const region = props.state;
  const postal = props.postcode;
  const parts = [line1, locality, [region, postal].filter(Boolean).join(" "), props.country]
    .map((part) => part?.trim())
    .filter(Boolean);
  return parts.join(", ");
}

function parsePhotonFeature(
  feature: {
    geometry?: { coordinates?: [number, number] };
    properties?: Record<string, string | undefined>;
  },
  index: number,
): AddressSuggestion | null {
  const coords = feature.geometry?.coordinates;
  const props = feature.properties ?? {};
  if (!coords || coords.length < 2) return null;

  const [lng, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const label = formatPhotonLabel(props) || props.name || "";
  if (!label.trim()) return null;

  const osmId = props.osm_id ?? String(index);
  return {
    id: `photon-${props.osm_type ?? "node"}-${osmId}`,
    label,
    shortLabel: [props.name || props.street, props.city || props.town].filter(Boolean).join(", ") || label,
    lat,
    lng,
    source: "photon",
    kind: props.osm_value || props.type,
  };
}

async function searchPhoton(query: string, limit: number): Promise<AddressSuggestion[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("lang", "en");

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];

  const body = await res.json() as { features?: unknown[] };
  const features = Array.isArray(body.features) ? body.features : [];

  return features
    .map((feature, index) => parsePhotonFeature(feature as Parameters<typeof parsePhotonFeature>[0], index))
    .filter((item): item is AddressSuggestion => item != null);
}

function parseNominatimHit(
  hit: {
    place_id?: number;
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
    type?: string;
    address?: Record<string, string | undefined>;
  },
): AddressSuggestion | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const addr = hit.address ?? {};
  const label =
    hit.display_name ||
    [
      [addr.house_number, addr.road].filter(Boolean).join(" "),
      addr.city || addr.town || addr.village,
      addr.state,
      addr.postcode,
      addr.country,
    ]
      .filter(Boolean)
      .join(", ");

  if (!label.trim()) return null;

  return {
    id: `nominatim-${hit.place_id ?? `${lat},${lng}`}`,
    label,
    shortLabel: hit.name || label.split(",").slice(0, 2).join(","),
    lat,
    lng,
    source: "nominatim",
    kind: hit.type,
  };
}

async function searchNominatim(query: string, limit: number): Promise<AddressSuggestion[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));

  const email = process.env.NOMINATIM_EMAIL?.trim();
  if (email) url.searchParams.set("email", email);

  const res = await fetch(url, {
    headers: {
      "User-Agent": nominatimUserAgent(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return [];

  const body = await res.json();
  if (!Array.isArray(body)) return [];

  return body
    .map((hit) => parseNominatimHit(hit as Parameters<typeof parseNominatimHit>[0]))
    .filter((item): item is AddressSuggestion => item != null);
}

export async function searchAddresses(query: string, limit = 6): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const capped = Math.min(Math.max(limit, 1), 10);
  const seen = new Set<string>();
  const results: AddressSuggestion[] = [];

  const add = (items: AddressSuggestion[]) => {
    for (const item of items) {
      const key = `${item.label.toLowerCase()}|${item.lat.toFixed(5)}|${item.lng.toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
      if (results.length >= capped) break;
    }
  };

  try {
    add(await searchPhoton(trimmed, capped));
  } catch (err) {
    console.warn("Photon search failed:", err instanceof Error ? err.message : err);
  }

  if (results.length < capped) {
    try {
      add(await searchNominatim(trimmed, capped - results.length));
    } catch (err) {
      console.warn("Nominatim search failed:", err instanceof Error ? err.message : err);
    }
  }

  return results;
}

export async function reverseGeocodeAddress(lat: number, lng: number): Promise<AddressSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");

  const email = process.env.NOMINATIM_EMAIL?.trim();
  if (email) url.searchParams.set("email", email);

  const res = await fetch(url, {
    headers: {
      "User-Agent": nominatimUserAgent(),
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;

  const hit = await res.json() as {
    place_id?: number;
    lat?: string;
    lon?: string;
    display_name?: string;
    name?: string;
    type?: string;
    address?: Record<string, string | undefined>;
  };

  return parseNominatimHit(hit);
}