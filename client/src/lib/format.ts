import type { PhotoUploader } from "../types";

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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

export function formatThroughput(bytes: number, ms: number): string {
  if (ms <= 0) return "—";
  const perSec = (bytes / ms) * 1000;
  return `${formatBytes(perSec)}/s`;
}

export function shortId(id: string, len = 8): string {
  return id.replace(/-/g, "").slice(0, len).toUpperCase();
}

export function formatResolution(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  const mp = ((width * height) / 1_000_000).toFixed(1);
  return `${width}×${height} · ${mp}MP`;
}

export function formatMimeShort(mime: string): string {
  return mime.replace("image/", "").toUpperCase() || "BIN";
}

export function formatUploaderShort(uploader: PhotoUploader | null | undefined): string | null {
  if (!uploader) return null;
  return uploader.displayName;
}

export function formatUploaderDetail(uploader: PhotoUploader | null | undefined): string | null {
  if (!uploader) return null;
  const parts = [uploader.displayName];
  if (uploader.email) parts.push(uploader.email);
  if (uploader.jobTitle) parts.push(uploader.jobTitle);
  if (uploader.department) parts.push(uploader.department);
  if (uploader.officeLocation) parts.push(uploader.officeLocation);
  return parts.join(" · ");
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