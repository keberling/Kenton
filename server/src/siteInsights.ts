import { haversineMeters } from "./geo.js";
import { store } from "./store.js";
import type { Site } from "./types.js";

export interface NearbyPhotoInsight {
  photoId: string;
  originalName: string;
  lat: number;
  lng: number;
  distanceM: number;
  withinRadius: boolean;
}

export interface SiteInsights {
  nearestUnassigned: NearbyPhotoInsight | null;
  unassignedWithinRadius: number;
  unassignedWithGps: number;
  nearbyUnassigned: NearbyPhotoInsight[];
}

export function computeSiteInsights(site: Site): SiteInsights {
  const unassigned = store.listUnassignedPhotosWithGps();
  let nearest: NearbyPhotoInsight | null = null;
  let unassignedWithinRadius = 0;
  const nearbyUnassigned: NearbyPhotoInsight[] = [];

  if (site.lat == null || site.lng == null) {
    return {
      nearestUnassigned: null,
      unassignedWithinRadius: 0,
      unassignedWithGps: unassigned.length,
      nearbyUnassigned: [],
    };
  }

  for (const photo of unassigned) {
    if (photo.lat == null || photo.lng == null) continue;

    const distanceM = Math.round(haversineMeters(photo.lat, photo.lng, site.lat, site.lng));
    const withinRadius = distanceM <= site.radiusMeters;
    const insight: NearbyPhotoInsight = {
      photoId: photo.id,
      originalName: photo.originalName,
      lat: photo.lat,
      lng: photo.lng,
      distanceM,
      withinRadius,
    };

    if (withinRadius) unassignedWithinRadius++;
    nearbyUnassigned.push(insight);

    if (!nearest || distanceM < nearest.distanceM) {
      nearest = insight;
    }
  }

  nearbyUnassigned.sort((a, b) => a.distanceM - b.distanceM);

  return {
    nearestUnassigned: nearest,
    unassignedWithinRadius,
    unassignedWithGps: unassigned.length,
    nearbyUnassigned: nearbyUnassigned.slice(0, 5),
  };
}

export function enrichSite(site: Site): Site {
  return { ...site, ...computeSiteInsights(site) };
}