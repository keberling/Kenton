import { geoAlbersUsa, geoPath, type GeoProjection } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import statesData from "../data/us-states.json";

/** Lower-48 bounds for quick inclusion checks */
export const US_BOUNDS = {
  minLng: -124.85,
  maxLng: -66.95,
  minLat: 24.52,
  maxLat: 49.38,
};

const EXCLUDED_TERRITORIES = new Set(["Puerto Rico", "Guam"]);

export type StateFeature = Feature<Geometry, { name: string }>;

/** All US states + DC; Alaska and Hawaii render in geoAlbersUsa inset boxes. */
export const MAP_STATES: StateFeature[] = (
  statesData as FeatureCollection<Geometry, { name: string }>
).features.filter((feature) => !EXCLUDED_TERRITORIES.has(feature.properties?.name ?? ""));

/** @deprecated use MAP_STATES */
export const CONTINENTAL_STATES = MAP_STATES;

export interface MapDimensions {
  width: number;
  height: number;
  padding: number;
}

const DEFAULT_DIMS: MapDimensions = { width: 1000, height: 620, padding: 28 };

export interface UsMapContext {
  projection: GeoProjection;
  path: ReturnType<typeof geoPath>;
  width: number;
  height: number;
}

export function createUsMapContext(dims: MapDimensions = DEFAULT_DIMS): UsMapContext {
  const projection = geoAlbersUsa();
  const collection: FeatureCollection = {
    type: "FeatureCollection",
    features: MAP_STATES,
  };

  projection.fitExtent(
    [
      [dims.padding, dims.padding],
      [dims.width - dims.padding, dims.height - dims.padding],
    ],
    collection,
  );

  return {
    projection,
    path: geoPath(projection),
    width: dims.width,
    height: dims.height,
  };
}

export function projectUS(
  lat: number,
  lng: number,
  map: UsMapContext,
): { x: number; y: number } | null {
  const point = map.projection([lng, lat]);
  if (!point) return null;
  return { x: point[0], y: point[1] };
}

export function isInContinentalUS(lat: number, lng: number): boolean {
  return (
    lat >= US_BOUNDS.minLat &&
    lat <= US_BOUNDS.maxLat &&
    lng >= US_BOUNDS.minLng &&
    lng <= US_BOUNDS.maxLng
  );
}

function isInAlaska(lat: number, lng: number): boolean {
  return lat >= 51 && lat <= 72 && lng >= -170 && lng <= -129;
}

function isInHawaii(lat: number, lng: number): boolean {
  return lat >= 18 && lat <= 23 && lng >= -161 && lng <= -154;
}

export function isInMappableUS(lat: number, lng: number): boolean {
  return isInContinentalUS(lat, lng) || isInAlaska(lat, lng) || isInHawaii(lat, lng);
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
    if (!isInMappableUS(point.lat, point.lng)) continue;
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