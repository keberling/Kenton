import { v4 as uuid } from "uuid";
import { db } from "./db.js";
import type { Photo, Site } from "./types.js";

interface SiteRow {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
  created_at: number;
  updated_at: number;
}

interface PhotoRow {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  site_id: string | null;
  lat: number | null;
  lng: number | null;
  taken_at: number | null;
  uploaded_at: number;
  width: number | null;
  height: number | null;
  site_name?: string | null;
}

function rowToSite(row: SiteRow, photoCount = 0): Site {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radius_meters,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoCount,
  };
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.original_name,
    mimeType: row.mime_type,
    siteId: row.site_id,
    siteName: row.site_name ?? null,
    lat: row.lat,
    lng: row.lng,
    takenAt: row.taken_at,
    uploadedAt: row.uploaded_at,
    width: row.width,
    height: row.height,
    url: `/uploads/${row.filename}`,
  };
}

class Store {
  listSites(): Site[] {
    const rows = db.prepare(`
      SELECT s.*, COUNT(p.id) AS photo_count
      FROM sites s
      LEFT JOIN photos p ON p.site_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `).all() as unknown as Array<SiteRow & { photo_count: number }>;

    return rows.map((row) => rowToSite(row, row.photo_count));
  }

  getSite(id: string): Site | null {
    const row = db.prepare(`SELECT * FROM sites WHERE id = ?`).get(id) as SiteRow | undefined;
    if (!row) return null;

    const count = db.prepare(`SELECT COUNT(*) AS c FROM photos WHERE site_id = ?`).get(id) as { c: number };
    return rowToSite(row, count.c);
  }

  createSite(input: {
    name: string;
    address: string;
    lat: number | null;
    lng: number | null;
    radiusMeters?: number;
  }): Site {
    const now = Date.now();
    const site: SiteRow = {
      id: uuid(),
      name: input.name.trim().slice(0, 120) || "Untitled Site",
      address: input.address.trim().slice(0, 240),
      lat: input.lat,
      lng: input.lng,
      radius_meters: input.radiusMeters ?? Number(process.env.SITE_MATCH_RADIUS_M ?? 100),
      created_at: now,
      updated_at: now,
    };

    db.prepare(`
      INSERT INTO sites (id, name, address, lat, lng, radius_meters, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      site.id,
      site.name,
      site.address,
      site.lat,
      site.lng,
      site.radius_meters,
      site.created_at,
      site.updated_at,
    );

    return rowToSite(site, 0);
  }

  updateSiteCoords(id: string, lat: number, lng: number): Site | null {
    const now = Date.now();
    db.prepare(`
      UPDATE sites SET lat = ?, lng = ?, updated_at = ? WHERE id = ?
    `).run(lat, lng, now, id);
    return this.getSite(id);
  }

  deleteSite(id: string): boolean {
    db.prepare(`UPDATE photos SET site_id = NULL WHERE site_id = ?`).run(id);
    const result = db.prepare(`DELETE FROM sites WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  listPhotos(filter?: { siteId?: string | null; unassigned?: boolean }): Photo[] {
    let sql = `
      SELECT p.*, s.name AS site_name
      FROM photos p
      LEFT JOIN sites s ON s.id = p.site_id
    `;
    const params: unknown[] = [];

    if (filter?.siteId) {
      sql += ` WHERE p.site_id = ?`;
      params.push(filter.siteId);
    } else if (filter?.unassigned) {
      sql += ` WHERE p.site_id IS NULL`;
    }

    sql += ` ORDER BY COALESCE(p.taken_at, p.uploaded_at) DESC`;

    const rows = db.prepare(sql).all(...(params as never[])) as unknown as PhotoRow[];
    return rows.map(rowToPhoto);
  }

  listUnassignedPhotosWithGps(): Photo[] {
    const rows = db.prepare(`
      SELECT p.*, NULL AS site_name
      FROM photos p
      WHERE p.site_id IS NULL AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    `).all() as unknown as PhotoRow[];
    return rows.map(rowToPhoto);
  }

  getPhoto(id: string): Photo | null {
    const row = db.prepare(`
      SELECT p.*, s.name AS site_name
      FROM photos p
      LEFT JOIN sites s ON s.id = p.site_id
      WHERE p.id = ?
    `).get(id) as PhotoRow | undefined;
    return row ? rowToPhoto(row) : null;
  }

  createPhoto(input: {
    filename: string;
    originalName: string;
    mimeType: string;
    lat: number | null;
    lng: number | null;
    takenAt: number | null;
    width: number | null;
    height: number | null;
    siteId?: string | null;
  }): Photo {
    const row: PhotoRow = {
      id: uuid(),
      filename: input.filename,
      original_name: input.originalName,
      mime_type: input.mimeType,
      site_id: input.siteId ?? null,
      lat: input.lat,
      lng: input.lng,
      taken_at: input.takenAt,
      uploaded_at: Date.now(),
      width: input.width,
      height: input.height,
    };

    db.prepare(`
      INSERT INTO photos (
        id, filename, original_name, mime_type, site_id,
        lat, lng, taken_at, uploaded_at, width, height
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      row.filename,
      row.original_name,
      row.mime_type,
      row.site_id,
      row.lat,
      row.lng,
      row.taken_at,
      row.uploaded_at,
      row.width,
      row.height,
    );

    return rowToPhoto(row);
  }

  assignPhotoToSite(photoId: string, siteId: string): Photo | null {
    db.prepare(`UPDATE photos SET site_id = ? WHERE id = ?`).run(siteId, photoId);
    return this.getPhoto(photoId);
  }

  unassignPhoto(photoId: string): Photo | null {
    db.prepare(`UPDATE photos SET site_id = NULL WHERE id = ?`).run(photoId);
    return this.getPhoto(photoId);
  }

  deletePhoto(id: string): { filename: string } | null {
    const row = db.prepare(`SELECT filename FROM photos WHERE id = ?`).get(id) as { filename: string } | undefined;
    if (!row) return null;
    db.prepare(`DELETE FROM photos WHERE id = ?`).run(id);
    return row;
  }

  stats() {
    const total = db.prepare(`SELECT COUNT(*) AS c FROM photos`).get() as { c: number };
    const unassigned = db.prepare(`SELECT COUNT(*) AS c FROM photos WHERE site_id IS NULL`).get() as { c: number };
    const sites = db.prepare(`SELECT COUNT(*) AS c FROM sites`).get() as { c: number };
    const withGps = db.prepare(`SELECT COUNT(*) AS c FROM photos WHERE lat IS NOT NULL`).get() as { c: number };
    return {
      totalPhotos: total.c,
      unassignedPhotos: unassigned.c,
      sites: sites.c,
      photosWithGps: withGps.c,
    };
  }
}

export const store = new Store();