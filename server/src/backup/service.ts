import fs from "fs";
import path from "path";
import {
  backupEnabled,
  backupRetentionCount,
  backupStatus,
  sharePointConfigured,
} from "./config.js";
import { backupFilename, backupsDir, createBackupArchive } from "./archive.js";
import {
  getBackup,
  listBackups,
  removeBackupRecords,
  upsertBackup,
  type BackupRecord,
} from "./manifest.js";
import {
  deleteSharePointItems,
  downloadSharePointFile,
  listSharePointBackups,
  uploadFileToSharePoint,
} from "./sharepoint.js";

function makeBackupId(stamp: Date): string {
  return stamp.toISOString().replace(/[:.]/g, "-");
}

async function pruneBackups() {
  const retention = backupRetentionCount();
  const records = listBackups();
  const stale = records.slice(retention);
  if (!stale.length) return;

  const removeIds = new Set(stale.map((entry) => entry.id));
  for (const entry of stale) {
    if (fs.existsSync(entry.localPath)) {
      fs.unlinkSync(entry.localPath);
    }
  }

  if (sharePointConfigured()) {
    const spIds = stale.map((entry) => entry.sharePointItemId).filter(Boolean) as string[];
    await deleteSharePointItems(spIds);
  }

  removeBackupRecords(removeIds);
}

export async function runBackup(trigger: "scheduled" | "manual"): Promise<BackupRecord> {
  if (!backupEnabled()) {
    throw new Error("Backups are disabled. Set BACKUP_ENABLED=true");
  }

  const stamp = new Date();
  const id = makeBackupId(stamp);
  const filename = backupFilename(stamp);
  const localPath = path.join(backupsDir(), filename);

  const sizeBytes = await createBackupArchive(localPath);

  let record: BackupRecord = {
    id,
    filename,
    createdAt: stamp.getTime(),
    sizeBytes,
    localPath,
    sharePointItemId: null,
    sharePointWebUrl: null,
    trigger,
    status: "local",
    error: null,
  };

  if (sharePointConfigured()) {
    try {
      const uploaded = await uploadFileToSharePoint(localPath, filename);
      record = {
        ...record,
        sharePointItemId: uploaded.itemId,
        sharePointWebUrl: uploaded.webUrl,
        status: "uploaded",
      };
    } catch (err) {
      record = {
        ...record,
        status: "failed",
        error: err instanceof Error ? err.message : "SharePoint upload failed",
      };
    }
  }

  upsertBackup(record);
  await pruneBackups();
  return record;
}

export function getBackupDownloadPath(id: string): string | null {
  const record = getBackup(id);
  if (!record) return null;
  if (fs.existsSync(record.localPath)) return record.localPath;
  return null;
}

export async function ensureBackupDownload(id: string): Promise<string> {
  const record = getBackup(id);
  if (!record) throw new Error("Backup not found");

  if (fs.existsSync(record.localPath)) return record.localPath;

  if (!record.sharePointItemId) {
    throw new Error("Backup file is not available locally or in SharePoint");
  }

  const cachePath = path.join(backupsDir(), record.filename);
  await downloadSharePointFile(record.sharePointItemId, cachePath);
  upsertBackup({ ...record, localPath: cachePath });
  return cachePath;
}

export async function syncBackupManifestFromSharePoint() {
  if (!sharePointConfigured()) return listBackups();

  const remote = await listSharePointBackups();
  const local = listBackups();
  const localByName = new Map(local.map((entry) => [entry.filename, entry]));

  for (const item of remote) {
    if (localByName.has(item.name)) continue;
    upsertBackup({
      id: item.id,
      filename: item.name,
      createdAt: item.createdAt || Date.now(),
      sizeBytes: item.sizeBytes,
      localPath: path.join(backupsDir(), item.name),
      sharePointItemId: item.id,
      sharePointWebUrl: item.webUrl,
      trigger: "scheduled",
      status: "uploaded",
      error: null,
    });
  }

  return listBackups();
}

export function backupPublicStatus() {
  return backupStatus();
}