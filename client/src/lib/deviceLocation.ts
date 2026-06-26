export interface DeviceLocation {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: number;
}

let cached: DeviceLocation | null = null;
const CACHE_MS = 2 * 60 * 1000;

function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function clearDeviceLocationCache() {
  cached = null;
}

export async function getDeviceLocation(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
}): Promise<DeviceLocation | null> {
  if (!isSecureContext() || !navigator.geolocation) return null;

  const timeoutMs = options?.timeoutMs ?? 12_000;
  const maximumAgeMs = options?.maximumAgeMs ?? 60_000;

  if (cached && Date.now() - cached.capturedAt < CACHE_MS) {
    return cached;
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timer);
        const fix: DeviceLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          capturedAt: Date.now(),
        };
        cached = fix;
        resolve(fix);
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        maximumAge: maximumAgeMs,
        timeout: timeoutMs,
      },
    );
  });
}

/** Warm permission prompt early so the first photo ingest isn't blocked on GPS. */
export function prefetchDeviceLocation() {
  if (!isSecureContext() || !navigator.geolocation) return;
  void getDeviceLocation({ timeoutMs: 8_000 });
}