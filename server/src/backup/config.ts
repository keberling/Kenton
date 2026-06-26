import { graphAppAuthEnabled } from "../auth/config.js";
import { sharePointDriveId, sharePointSettingsPublic, sharePointSiteUrl } from "./settings.js";

export function backupEnabled(): boolean {
  return process.env.BACKUP_ENABLED === "true";
}

export function backupRetentionCount(): number {
  const raw = Number(process.env.BACKUP_RETENTION ?? 10);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 10;
}

export function backupCronSchedule(): string {
  return process.env.BACKUP_CRON?.trim() || "0 2 * * *";
}

export function backupCronTimezone(): string {
  return process.env.BACKUP_TIMEZONE?.trim() || "America/Chicago";
}

export function sharePointConfigured(): boolean {
  return backupEnabled() && graphAppAuthEnabled() && Boolean(sharePointDriveId());
}

export function backupStatus() {
  const sp = sharePointSettingsPublic();
  return {
    enabled: backupEnabled(),
    retention: backupRetentionCount(),
    cron: backupCronSchedule(),
    timezone: backupCronTimezone(),
    sharePointConfigured: sharePointConfigured(),
    siteUrl: sp.siteUrl ?? sharePointSiteUrl(),
    folderPath: sp.folderPath,
    driveName: sp.driveName,
    graphAuthReady: sp.graphAuthReady,
  };
}