export const LEGACY_SITE_MATCH_RADIUS_M = 100;

export function siteMatchRadiusM(): number {
  const fromEnv = Number(process.env.SITE_MATCH_RADIUS_M);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
  return 500;
}