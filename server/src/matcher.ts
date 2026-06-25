import { siteMaxMatchDistanceM, siteSoftMatchCushionM } from "./config.js";
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

  const maxMatchM = siteMaxMatchDistanceM();
  const cushionM = siteSoftMatchCushionM();
  const withinMax = ranked.filter((entry) => entry.distanceM <= maxMatchM);
  if (!withinMax.length) return null;

  const withinStrict = withinMax.filter(
    (entry) => entry.distanceM <= entry.site.radiusMeters,
  );
  if (withinStrict.length) {
    const best = withinStrict[0];
    return { site: best.site, kind: "strict", distanceM: best.distanceM };
  }

  const nearest = withinMax[0];
  const competingWithinCushion = withinMax
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

/** Release manual holds on queued photos near a deployment so new sites can pick them up. */
export function releaseMatchHoldsNearSite(site: Site, maxDistanceM = siteMaxMatchDistanceM()): number {
  if (site.lat == null || site.lng == null) return 0;

  let released = 0;
  for (const photo of store.listUnassignedPhotosWithGps()) {
    if (photo.lat == null || photo.lng == null || !photo.matchHold) continue;
    const distanceM = haversineMeters(photo.lat, photo.lng, site.lat, site.lng);
    if (distanceM <= maxDistanceM) {
      store.releaseMatchHold(photo.id);
      released++;
    }
  }

  return released;
}

export function matchSiteToPhotos(siteId: string): number {
  const site = store.getSite(siteId);
  if (!site || site.lat == null || site.lng == null) return 0;

  releaseMatchHoldsNearSite(site);

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

export interface FullRescanResult {
  scanned: number;
  matched: number;
  reassigned: number;
  unassigned: number;
  unchanged: number;
}

function distanceToSiteM(photo: Photo, site: Site | null | undefined): number | null {
  if (
    photo.lat == null ||
    photo.lng == null ||
    site?.lat == null ||
    site?.lng == null
  ) {
    return null;
  }
  return haversineMeters(photo.lat, photo.lng, site.lat, site.lng);
}

/** Drop assignments farther than the max match distance (e.g. legacy soft matches). */
export function pruneDistantAssignments(): number {
  const maxMatchM = siteMaxMatchDistanceM();
  let pruned = 0;

  for (const photo of store.listPhotosWithGps()) {
    if (!photo.siteId) continue;
    const site = store.getSite(photo.siteId);
    const distanceM = distanceToSiteM(photo, site);
    if (distanceM != null && distanceM > maxMatchM) {
      store.unassignForRescan(photo.id);
      pruned++;
    }
  }

  return pruned;
}

/**
 * Re-evaluate every GPS photo against current deployments.
 * Fixes stale long-distance routes and picks the nearest valid site within range.
 */
export function rescanAllPhotoMatches(options?: { releaseHeld?: boolean }): FullRescanResult {
  if (options?.releaseHeld) {
    store.releaseAllMatchHolds();
  }

  const sites = store.listSites();
  const photos = store.listPhotosWithGps();
  const result: FullRescanResult = {
    scanned: photos.length,
    matched: 0,
    reassigned: 0,
    unassigned: 0,
    unchanged: 0,
  };

  for (const photo of photos) {
    if (photo.lat == null || photo.lng == null) continue;
    if (!photo.siteId && photo.matchHold) continue;

    const ideal = resolvePhotoSiteMatch(photo.lat, photo.lng, sites);
    const currentSiteId = photo.siteId;

    if (!ideal) {
      if (currentSiteId) {
        store.unassignForRescan(photo.id);
        result.unassigned++;
      }
      continue;
    }

    if (!currentSiteId) {
      store.assignPhotoToSite(photo.id, ideal.site.id);
      result.matched++;
      continue;
    }

    if (currentSiteId === ideal.site.id) {
      result.unchanged++;
      continue;
    }

    store.assignPhotoToSite(photo.id, ideal.site.id);
    result.reassigned++;
  }

  return result;
}

/** After a deployment is registered or re-geocoded, rematch the queue. */
export function rematchAfterSiteChange(siteId: string): number {
  const site = store.getSite(siteId);
  if (!site || site.lat == null || site.lng == null) return 0;

  releaseMatchHoldsNearSite(site);
  const result = rescanAllPhotoMatches({ releaseHeld: false });
  return result.matched + result.reassigned;
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

/** Background sync — prune impossible routes, then match the open queue. */
export function syncExistingPhotoMatches(): number {
  const pruned = pruneDistantAssignments();
  const matched = rematchAllUnassignedPhotos({ releaseHeld: false });
  return pruned + matched;
}