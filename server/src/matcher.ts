import { siteSoftMatchCushionM } from "./config.js";
import { haversineMeters } from "./geo.js";
import { store } from "./store.js";
import type { Photo, Site } from "./types.js";

export type MatchKind = "strict" | "soft";

export interface SiteMatchResult {
  site: Site;
  kind: MatchKind;
  distanceM: number;
}

function rankedSites(lat: number, lng: number, sites: Site[]) {
  return sites
    .filter((site) => site.lat != null && site.lng != null)
    .map((site) => ({
      site,
      distanceM: haversineMeters(lat, lng, site.lat!, site.lng!),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export function resolvePhotoSiteMatch(
  lat: number,
  lng: number,
  sites: Site[] = store.listSites(),
): SiteMatchResult | null {
  const ranked = rankedSites(lat, lng, sites);
  if (!ranked.length) return null;

  const cushionM = siteSoftMatchCushionM();

  const withinStrict = ranked.filter((entry) => entry.distanceM <= entry.site.radiusMeters);
  if (withinStrict.length) {
    const best = withinStrict[0];
    return { site: best.site, kind: "strict", distanceM: best.distanceM };
  }

  const nearest = ranked[0];
  const competingWithinCushion = ranked
    .slice(1)
    .filter((entry) => entry.distanceM <= cushionM);

  if (competingWithinCushion.length === 0) {
    return { site: nearest.site, kind: "soft", distanceM: nearest.distanceM };
  }

  return null;
}

export function findMatchingSite(
  lat: number,
  lng: number,
  sites: Site[] = store.listSites(),
): Site | null {
  return resolvePhotoSiteMatch(lat, lng, sites)?.site ?? null;
}

export function matchPhotoToSite(photoId: string): Photo | null {
  const photo = store.getPhoto(photoId);
  if (!photo || photo.lat == null || photo.lng == null) return photo;

  const match = resolvePhotoSiteMatch(photo.lat, photo.lng);
  if (!match) return photo;

  return store.assignPhotoToSite(photoId, match.site.id);
}

export function matchSiteToPhotos(siteId: string): number {
  const site = store.getSite(siteId);
  if (!site || site.lat == null || site.lng == null) return 0;

  const candidates = store.listAutoMatchCandidates();
  let matched = 0;

  for (const photo of candidates) {
    if (photo.lat == null || photo.lng == null) continue;
    const match = resolvePhotoSiteMatch(photo.lat, photo.lng);
    if (match?.site.id === siteId) {
      store.assignPhotoToSite(photo.id, siteId);
      matched++;
    }
  }

  return matched;
}

/** Try to tag unassigned photos that are eligible for auto-match. */
export function rematchAllUnassignedPhotos(options?: { releaseHeld?: boolean }): number {
  if (options?.releaseHeld) {
    store.releaseAllMatchHolds();
  }

  const candidates = store.listAutoMatchCandidates();
  let matched = 0;

  for (const photo of candidates) {
    if (photo.lat == null || photo.lng == null) continue;
    const updated = matchPhotoToSite(photo.id);
    if (updated?.siteId) matched++;
  }

  return matched;
}

/** Background sync — never overrides photos the user sent back to the queue. */
export function syncExistingPhotoMatches(): number {
  return rematchAllUnassignedPhotos({ releaseHeld: false });
}