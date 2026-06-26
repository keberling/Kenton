import { graphAppAuthEnabled } from "../auth/config.js";

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

export function sharePointDriveId(): string | null {
  const value = process.env.SHAREPOINT_DRIVE_ID?.trim();
  return value || null;
}

export function sharePointFolderPath(): string {
  const value = process.env.SHAREPOINT_FOLDER_PATH?.trim();
  return value || "Kenton/Backups";
}

export function sharePointConfigured(): boolean {
  return backupEnabled() && graphAppAuthEnabled() && Boolean(sharePointDriveId());
}

export function backupStatus() {
  return {
    enabled: backupEnabled(),
    retention: backupRetentionCount(),
    cron: backupCronSchedule(),
    timezone: backupCronTimezone(),
    sharePointConfigured: sharePointConfigured(),
    driveId: sharePointDriveId(),
    folderPath: sharePointFolderPath(),
  };
}