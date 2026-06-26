import { execFile } from "child_process";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { dataDir, dbPath } from "../db.js";

const execFileAsync = promisify(execFile);

export function backupsDir(): string {
  return path.join(dataDir, "backups");
}

export function backupFilename(stamp: Date): string {
  const iso = stamp.toISOString().replace(/[:.]/g, "-");
  return `kenton-backup-${iso}.tar.gz`;
}

export async function createBackupArchive(outputPath: string): Promise<number> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const uploadsDir = path.join(dataDir, "uploads");
  const args = ["-czf", outputPath, "-C", dataDir];

  if (fs.existsSync(dbPath)) {
    args.push("kenton.db");
  }

  if (fs.existsSync(uploadsDir)) {
    args.push("uploads");
  }

  if (args.length <= 3) {
    throw new Error("Nothing to back up — database and uploads folder are missing");
  }

  await execFileAsync("tar", args);
  return fs.statSync(outputPath).size;
}