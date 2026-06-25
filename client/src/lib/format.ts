export function formatDate(ts: number | null): string {
  if (!ts) return "Unknown date";
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatCoords(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const METERS_PER_MILE = 1609.344;

export function formatDistanceMeters(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  if (miles >= 0.1) {
    return `${miles.toFixed(2)} mi (${Math.round(meters).toLocaleString()} m)`;
  }
  return `${Math.round(meters)} m`;
}

export function formatRadiusMeters(meters: number): string {
  const miles = meters / METERS_PER_MILE;
  return `${miles.toFixed(1)} mi (${meters.toLocaleString()} m)`;
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function geocodeSourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown";
  const labels: Record<string, string> = {
    nominatim: "OpenStreetMap (Nominatim)",
    census: "US Census Bureau",
    photon: "Photon",
    cache: "Cached geocode",
  };
  return labels[source] ?? source;
}