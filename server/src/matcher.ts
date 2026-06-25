import { haversineMeters, withinRadius } from "./geo.js";
import { store } from "./store.js";
import type { Photo, Site } from "./types.js";

export function findMatchingSite(
  lat: number,
  lng: number,
  sites: Site[] = store.listSites(),
): Site | null {
  let best: { site: Site; distance: number } | null = null;

  for (const site of sites) {
    if (site.lat == null || site.lng == null) continue;
    if (!withinRadius(lat, lng, site.lat, site.lng, site.radiusMeters)) continue;

    const distance = haversineMeters(lat, lng, site.lat, site.lng);
    if (!best || distance < best.distance) {
      best = { site, distance };
    }
  }

  return best?.site ?? null;
}

export function matchPhotoToSite(photoId: string): Photo | null {
  const photo = store.getPhoto(photoId);
  if (!photo || photo.lat == null || photo.lng == null) return photo;

  const site = findMatchingSite(photo.lat, photo.lng);
  if (!site) return photo;

  return store.assignPhotoToSite(photoId, site.id);
}

export function matchSiteToPhotos(siteId: string): number {
  const site = store.getSite(siteId);
  if (!site || site.lat == null || site.lng == null) return 0;

  const candidates = store.listUnassignedPhotosWithGps();
  let matched = 0;

  for (const photo of candidates) {
    if (photo.lat == null || photo.lng == null) continue;
    if (!withinRadius(photo.lat, photo.lng, site.lat, site.lng, site.radiusMeters)) continue;
    store.assignPhotoToSite(photo.id, site.id);
    matched++;
  }

  return matched;
}

/** Try to tag every unassigned photo that has GPS against current job sites. */
export function rematchAllUnassignedPhotos(): number {
  const candidates = store.listUnassignedPhotosWithGps();
  let matched = 0;

  for (const photo of candidates) {
    if (photo.lat == null || photo.lng == null) continue;
    const updated = matchPhotoToSite(photo.id);
    if (updated?.siteId) matched++;
  }

  return matched;
}

export function syncExistingPhotoMatches(): number {
  return rematchAllUnassignedPhotos();
}