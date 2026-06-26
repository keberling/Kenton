export interface DeviceLocation {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  capturedAt: number;
}

export type GeolocationPermissionState = "granted" | "denied" | "prompt" | "unsupported";

let cached: DeviceLocation | null = null;
const CACHE_MS = 5 * 60 * 1000;
let inFlight: Promise<DeviceLocation | null> | null = null;

function isSecureContext(): boolean {
  return typeof window !== "undefined" && window.isSecureContext;
}

export function clearDeviceLocationCache() {
  cached = null;
}

export async function getGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (!isSecureContext() || !navigator.geolocation) return "unsupported";
  if (!navigator.permissions?.query) return "prompt";

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state as GeolocationPermissionState;
  } catch {
    return "prompt";
  }
}

function storePosition(position: GeolocationPosition): DeviceLocation {
  const fix: DeviceLocation = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    capturedAt: Date.now(),
  };
  cached = fix;
  return fix;
}

function readPosition(options?: { timeoutMs?: number; maximumAgeMs?: number }): Promise<DeviceLocation | null> {
  if (!isSecureContext() || !navigator.geolocation) return Promise.resolve(null);

  const timeoutMs = options?.timeoutMs ?? 20_000;
  const maximumAgeMs = options?.maximumAgeMs ?? 120_000;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: DeviceLocation | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      resolve(value);
    };

    const timer = window.setTimeout(() => finish(cached), timeoutMs);

    const onSuccess = (position: GeolocationPosition) => {
      finish(storePosition(position));
    };

    const onError = () => {
      finish(cached);
    };

    let watchId: number | null = null;

    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      maximumAge: maximumAgeMs,
      timeout: Math.min(timeoutMs, 15_000),
    });

    watchId = navigator.geolocation.watchPosition(
      onSuccess,
      () => {
        // Keep waiting for a fix via getCurrentPosition timeout.
      },
      {
        enableHighAccuracy: true,
        maximumAge: maximumAgeMs,
      },
    );
  });
}

export async function getDeviceLocation(options?: {
  timeoutMs?: number;
  maximumAgeMs?: number;
  force?: boolean;
}): Promise<DeviceLocation | null> {
  if (!options?.force && cached && Date.now() - cached.capturedAt < CACHE_MS) {
    return cached;
  }

  if (inFlight) return inFlight;

  inFlight = readPosition(options).finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/** Call on a user tap before opening the Android photo picker. */
export function captureLocationOnGesture() {
  if (!isSecureContext() || !navigator.geolocation) return;
  void getDeviceLocation({ timeoutMs: 20_000, maximumAgeMs: 180_000, force: true });
}

/** Warm permission prompt early so ingest is less likely to miss GPS. */
export function prefetchDeviceLocation() {
  captureLocationOnGesture();
}

export function isLikelyMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}