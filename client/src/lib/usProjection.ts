/** Continental US bounds for sketch map projection */
export const US_BOUNDS = {
  minLng: -124.85,
  maxLng: -66.95,
  minLat: 24.52,
  maxLat: 49.38,
};

/** Simplified lower-48 coastline / border (lng, lat) */
export const US_OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [-124.21, 48.38],
  [-123.12, 46.17],
  [-124.02, 43.61],
  [-124.56, 42.0],
  [-120.0, 42.0],
  [-117.12, 32.53],
  [-114.72, 32.72],
  [-111.07, 31.33],
  [-108.21, 31.33],
  [-106.45, 31.76],
  [-103.06, 29.37],
  [-99.14, 26.41],
  [-97.17, 25.84],
  [-96.79, 28.31],
  [-93.89, 29.76],
  [-88.01, 30.22],
  [-84.32, 29.93],
  [-82.65, 27.43],
  [-80.03, 25.13],
  [-80.48, 28.43],
  [-81.95, 30.74],
  [-79.99, 32.01],
  [-75.46, 35.2],
  [-75.14, 39.45],
  [-74.04, 40.56],
  [-71.12, 41.49],
  [-69.99, 43.66],
  [-67.79, 44.82],
  [-67.13, 47.46],
  [-69.23, 47.06],
  [-71.08, 45.3],
  [-74.69, 45.01],
  [-79.76, 42.27],
  [-82.44, 41.68],
  [-84.49, 46.45],
  [-87.99, 47.95],
  [-89.57, 48.01],
  [-95.15, 49.0],
  [-123.12, 49.0],
  [-124.21, 48.38],
];

export interface MapDimensions {
  width: number;
  height: number;
  padding: number;
}

const DEFAULT_DIMS: MapDimensions = { width: 1000, height: 620, padding: 36 };

export function projectUS(
  lat: number,
  lng: number,
  dims: MapDimensions = DEFAULT_DIMS,
): { x: number; y: number } {
  const innerW = dims.width - dims.padding * 2;
  const innerH = dims.height - dims.padding * 2;
  const x =
    dims.padding +
    ((lng - US_BOUNDS.minLng) / (US_BOUNDS.maxLng - US_BOUNDS.minLng)) * innerW;
  const y =
    dims.padding +
    ((US_BOUNDS.maxLat - lat) / (US_BOUNDS.maxLat - US_BOUNDS.minLat)) * innerH;
  return { x, y };
}

export function isInContinentalUS(lat: number, lng: number): boolean {
  return (
    lat >= US_BOUNDS.minLat &&
    lat <= US_BOUNDS.maxLat &&
    lng >= US_BOUNDS.minLng &&
    lng <= US_BOUNDS.maxLng
  );
}

export function outlinePath(dims: MapDimensions = DEFAULT_DIMS): string {
  const points = US_OUTLINE.map(([lng, lat]) => projectUS(lat, lng, dims));
  if (!points.length) return "";
  const [first, ...rest] = points;
  return `M ${first.x.toFixed(1)} ${first.y.toFixed(1)} ${rest
    .map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ")} Z`;
}

export interface GeoCluster {
  lat: number;
  lng: number;
  count: number;
}

export function clusterGeoPoints(
  points: Array<{ lat: number; lng: number }>,
  precision = 1,
): GeoCluster[] {
  const buckets = new Map<string, GeoCluster>();

  for (const point of points) {
    if (!isInContinentalUS(point.lat, point.lng)) continue;
    const lat = Number(point.lat.toFixed(precision));
    const lng = Number(point.lng.toFixed(precision));
    const key = `${lat},${lng}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { lat, lng, count: 1 });
    }
  }

  return [...buckets.values()].sort((a, b) => b.count - a.count);
}