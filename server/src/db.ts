import fs from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDataDir = path.join(__dirname, "../data");
export const dataDir = process.env.DATA_DIR?.trim() || defaultDataDir;

fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "kenton.db");
export const db = new DatabaseSync(dbPath);

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

console.log(`SQLite database: ${dbPath}`);