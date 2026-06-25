export const METERS_PER_MILE = 1609.344;
export const DEFAULT_SITE_MATCH_RADIUS_M = 100;
export const DEFAULT_SOFT_MATCH_CUSHION_M = Math.round(METERS_PER_MILE);
export const DEFAULT_MAX_MATCH_DISTANCE_M = Math.round(2 * METERS_PER_MILE);

/** Previous defaults — upgraded to the current default on startup. */
export const LEGACY_SITE_MATCH_RADIUS_M = [500, 16093] as const;

export function siteMatchRadiusM(): number {
  const fromEnv = Number(process.env.SITE_MATCH_RADIUS_M);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  return DEFAULT_SITE_MATCH_RADIUS_M;
}

/** When no strict match, assign to the nearest site if no other site is within this distance. */
export function siteSoftMatchCushionM(): number {
  const fromEnv = Number(process.env.SITE_SOFT_MATCH_CUSHION_M);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  return DEFAULT_SOFT_MATCH_CUSHION_M;
}

/** Hard ceiling — photos farther than this from every deployment stay in the queue. */
export function siteMaxMatchDistanceM(): number {
  const fromEnv = Number(process.env.SITE_MAX_MATCH_DISTANCE_M);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  return DEFAULT_MAX_MATCH_DISTANCE_M;
}