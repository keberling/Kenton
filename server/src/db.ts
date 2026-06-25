import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";
import { LEGACY_SITE_MATCH_RADIUS_M, METERS_PER_MILE, siteMatchRadiusM } from "./config.js";

function ensureSitesColumn(name: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(sites)`).all() as { name: string }[];
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE sites ADD COLUMN ${name} ${definition}`);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devDataDir = path.join(__dirname, "../data");
const productionDataDir = "/data";

function resolveDataDir(): string {
  const fromEnv = process.env.DATA_DIR?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") return productionDataDir;
  return devDataDir;
}

function migrateLegacyDatabase(targetDir: string): string {
  const dbPath = path.join(targetDir, "kenton.db");
  const legacyDirs = [
    path.join(__dirname, "../data"),
    "/app/server/data",
  ];

  if (fs.existsSync(dbPath)) return dbPath;

  for (const legacyDir of legacyDirs) {
    const legacyPath = path.join(legacyDir, "kenton.db");
    if (!fs.existsSync(legacyPath) || legacyDir === targetDir) continue;

    fs.renameSync(legacyPath, dbPath);
    for (const suffix of ["-wal", "-shm"]) {
      const from = `${legacyPath}${suffix}`;
      const to = `${dbPath}${suffix}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }

    const legacyUploads = path.join(legacyDir, "uploads");
    const targetUploads = path.join(targetDir, "uploads");
    if (fs.existsSync(legacyUploads)) {
      fs.mkdirSync(targetUploads, { recursive: true });
      for (const file of fs.readdirSync(legacyUploads)) {
        const from = path.join(legacyUploads, file);
        const to = path.join(targetUploads, file);
        if (!fs.existsSync(to)) fs.renameSync(from, to);
      }
    }

    console.log(`Migrated database: ${legacyPath} → ${dbPath}`);
    break;
  }

  return dbPath;
}

export const dataDir = resolveDataDir();
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });

export const dbPath = migrateLegacyDatabase(dataDir);
export const db = new DatabaseSync(dbPath);

if (process.env.NODE_ENV === "production" && dataDir !== productionDataDir) {
  console.warn(
    `WARNING: DATA_DIR is "${dataDir}" but Coolify should mount a volume at /data. ` +
    `Sites and photos will be lost on redeploy unless persistence is configured correctly.`,
  );
}

db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat REAL,
    lng REAL,
    radius_meters INTEGER NOT NULL DEFAULT 16093,
    geocode_source TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    site_id TEXT REFERENCES sites(id) ON DELETE SET NULL,
    lat REAL,
    lng REAL,
    taken_at INTEGER,
    uploaded_at INTEGER NOT NULL,
    width INTEGER,
    height INTEGER
  );

  CREATE TABLE IF NOT EXISTS geocode_cache (
    address_key TEXT PRIMARY KEY,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    cached_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_photos_site ON photos(site_id);
  CREATE INDEX IF NOT EXISTS idx_photos_unassigned ON photos(site_id) WHERE site_id IS NULL;
  CREATE INDEX IF NOT EXISTS idx_photos_coords ON photos(lat, lng) WHERE lat IS NOT NULL;
`);

ensureSitesColumn("geocode_source", "TEXT");

const matchRadius = siteMatchRadiusM();
for (const legacyRadius of LEGACY_SITE_MATCH_RADIUS_M) {
  const radiusMigration = db
    .prepare(`UPDATE sites SET radius_meters = ? WHERE radius_meters = ?`)
    .run(matchRadius, legacyRadius);
  if (radiusMigration.changes > 0) {
    console.log(
      `Updated ${radiusMigration.changes} site(s) match radius ${legacyRadius}m → ${matchRadius}m`,
    );
  }
}

console.log(`Site match radius: ${matchRadius}m (${(matchRadius / METERS_PER_MILE).toFixed(1)} mi)`);

console.log(`Kenton data directory: ${dataDir}`);
console.log(`SQLite database: ${dbPath}`);