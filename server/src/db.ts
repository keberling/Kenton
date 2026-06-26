import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";
import {
  LEGACY_SITE_MATCH_RADIUS_M,
  METERS_PER_MILE,
  siteMatchRadiusM,
  siteMaxMatchDistanceM,
  siteSoftMatchCushionM,
} from "./config.js";

function ensureTableColumn(table: string, name: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

function ensureSitesColumn(name: string, definition: string) {
  ensureTableColumn("sites", name, definition);
}

function ensurePhotosColumn(name: string, definition: string) {
  ensureTableColumn("photos", name, definition);
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
    radius_meters INTEGER NOT NULL DEFAULT 100,
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

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    microsoft_oid TEXT NOT NULL UNIQUE,
    tenant_id TEXT NOT NULL,
    email TEXT,
    display_name TEXT NOT NULL,
    preferred_username TEXT,
    job_title TEXT,
    department TEXT,
    office_location TEXT,
    first_seen_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_oid ON users(microsoft_oid);
`);

ensureSitesColumn("geocode_source", "TEXT");

ensurePhotosColumn("uploaded_by_user_id", "TEXT REFERENCES users(id) ON DELETE SET NULL");
ensurePhotosColumn("uploader_microsoft_oid", "TEXT");
ensurePhotosColumn("uploader_display_name", "TEXT");
ensurePhotosColumn("uploader_email", "TEXT");
ensurePhotosColumn("uploader_preferred_username", "TEXT");
ensurePhotosColumn("uploader_job_title", "TEXT");
ensurePhotosColumn("uploader_department", "TEXT");
ensurePhotosColumn("uploader_office_location", "TEXT");
ensurePhotosColumn("match_hold", "INTEGER NOT NULL DEFAULT 0");
ensureSitesColumn("autotask_company_id", "INTEGER");

db.exec(
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_autotask_company ON sites(autotask_company_id) WHERE autotask_company_id IS NOT NULL`,
);

db.exec(`CREATE INDEX IF NOT EXISTS idx_photos_uploader ON photos(uploaded_by_user_id)`);
db.exec(
  `CREATE INDEX IF NOT EXISTS idx_photos_auto_match ON photos(match_hold) WHERE site_id IS NULL AND lat IS NOT NULL`,
);

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

const cushionM = siteSoftMatchCushionM();
const maxMatchM = siteMaxMatchDistanceM();
console.log(
  `Site match radius: ${matchRadius}m (${(matchRadius / METERS_PER_MILE).toFixed(2)} mi); ` +
    `soft cushion: ${cushionM}m (${(cushionM / METERS_PER_MILE).toFixed(1)} mi); ` +
    `max distance: ${maxMatchM}m (${(maxMatchM / METERS_PER_MILE).toFixed(1)} mi)`,
);

console.log(`Kenton data directory: ${dataDir}`);
console.log(`SQLite database: ${dbPath}`);