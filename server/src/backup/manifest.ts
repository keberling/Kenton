import fs from "fs";
import path from "path";
import { dataDir } from "../db.js";

export interface BackupRecord {
  id: string;
  filename: string;
  createdAt: number;
  sizeBytes: number;
  localPath: string;
  sharePointItemId: string | null;
  sharePointWebUrl: string | null;
  trigger: "scheduled" | "manual";
  status: "local" | "uploaded" | "failed";
  error: string | null;
}

interface BackupManifest {
  backups: BackupRecord[];
}

const manifestPath = path.join(dataDir, "backup-manifest.json");

function readManifest(): BackupManifest {
  if (!fs.existsSync(manifestPath)) return { backups: [] };
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as BackupManifest;
  } catch {
    return { backups: [] };
  }
}

function writeManifest(manifest: BackupManifest) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

export function listBackups(): BackupRecord[] {
  return readManifest().backups.sort((a, b) => b.createdAt - a.createdAt);
}

export function getBackup(id: string): BackupRecord | null {
  return listBackups().find((entry) => entry.id === id) ?? null;
}

export function upsertBackup(record: BackupRecord) {
  const manifest = readManifest();
  const index = manifest.backups.findIndex((entry) => entry.id === record.id);
  if (index >= 0) manifest.backups[index] = record;
  else manifest.backups.unshift(record);
  writeManifest(manifest);
}

export function removeBackupRecords(ids: Set<string>) {
  const manifest = readManifest();
  manifest.backups = manifest.backups.filter((entry) => !ids.has(entry.id));
  writeManifest(manifest);
}