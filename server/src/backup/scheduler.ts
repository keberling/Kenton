import cron from "node-cron";
import { backupCronSchedule, backupCronTimezone, backupEnabled } from "./config.js";
import { runBackup } from "./service.js";

let started = false;

export function startBackupScheduler() {
  if (started || !backupEnabled()) return;
  started = true;

  const schedule = backupCronSchedule();
  const timezone = backupCronTimezone();

  if (!cron.validate(schedule)) {
    console.warn(`Invalid BACKUP_CRON schedule "${schedule}" — nightly backup disabled`);
    return;
  }

  cron.schedule(
    schedule,
    () => {
      void runBackup("scheduled").catch((err) => {
        console.error("Scheduled backup failed:", err);
      });
    },
    { timezone },
  );

  console.log(`Backup scheduler active (${schedule}, ${timezone})`);
}