export const METERS_PER_MILE = 1609.344;
export const TEN_MILES_M = Math.round(10 * METERS_PER_MILE);

/** Previous defaults — upgraded to the current default on startup. */
export const LEGACY_SITE_MATCH_RADIUS_M = [100, 500] as const;

export function siteMatchRadiusM(): number {
  const fromEnv = Number(process.env.SITE_MATCH_RADIUS_M);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  return TEN_MILES_M;
}