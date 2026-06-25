import { v4 as uuid } from "uuid";
import { siteMatchRadiusM } from "./config.js";
import { db } from "./db.js";
import type { AuthUser, Photo, PhotoUploader, Site, User } from "./types.js";

interface SiteRow {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
  geocode_source: string | null;
  created_at: number;
  updated_at: number;
}

interface UserRow {
  id: string;
  microsoft_oid: string;
  tenant_id: string;
  email: string | null;
  display_name: string;
  preferred_username: string | null;
  job_title: string | null;
  department: string | null;
  office_location: string | null;
  first_seen_at: number;
  last_seen_at: number;
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
  uploaded_by_user_id?: string | null;
  uploader_microsoft_oid?: string | null;
  uploader_display_name?: string | null;
  uploader_email?: string | null;
  uploader_preferred_username?: string | null;
  uploader_job_title?: string | null;
  uploader_department?: string | null;
  uploader_office_location?: string | null;
  match_hold?: number | null;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    microsoftOid: row.microsoft_oid,
    tenantId: row.tenant_id,
    email: row.email,
    displayName: row.display_name,
    preferredUsername: row.preferred_username,
    jobTitle: row.job_title,
    department: row.department,
    officeLocation: row.office_location,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  };
}

function uploaderFromRow(row: PhotoRow): PhotoUploader | null {
  if (!row.uploaded_by_user_id || !row.uploader_display_name || !row.uploader_microsoft_oid) {
    return null;
  }
  return {
    userId: row.uploaded_by_user_id,
    microsoftOid: row.uploader_microsoft_oid,
    displayName: row.uploader_display_name,
    email: row.uploader_email ?? null,
    preferredUsername: row.uploader_preferred_username ?? null,
    jobTitle: row.uploader_job_title ?? null,
    department: row.uploader_department ?? null,
    officeLocation: row.uploader_office_location ?? null,
  };
}

function rowToSite(row: SiteRow, photoCount = 0): Site {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radius_meters,
    geocodeSource: row.geocode_source ?? null,
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
    matchHold: Boolean(row.match_hold),
    siteName: row.site_name ?? null,
    lat: row.lat,
    lng: row.lng,
    takenAt: row.taken_at,
    uploadedAt: row.uploaded_at,
    width: row.width,
    height: row.height,
    url: `/uploads/${row.filename}`,
    uploader: uploaderFromRow(row),
  };
}

function uploaderSnapshot(user: User): {
  uploadedByUserId: string;
  uploaderMicrosoftOid: string;
  uploaderDisplayName: string;
  uploaderEmail: string | null;
  uploaderPreferredUsername: string | null;
  uploaderJobTitle: string | null;
  uploaderDepartment: string | null;
  uploaderOfficeLocation: string | null;
} {
  return {
    uploadedByUserId: user.id,
    uploaderMicrosoftOid: user.microsoftOid,
    uploaderDisplayName: user.displayName,
    uploaderEmail: user.email,
    uploaderPreferredUsername: user.preferredUsername,
    uploaderJobTitle: user.jobTitle,
    uploaderDepartment: user.department,
    uploaderOfficeLocation: user.officeLocation,
  };
}

class Store {
  getUserByMicrosoftOid(microsoftOid: string): User | null {
    const row = db
      .prepare(`SELECT * FROM users WHERE microsoft_oid = ?`)
      .get(microsoftOid) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  }

  getUser(id: string): User | null {
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
    return row ? rowToUser(row) : null;
  }

  upsertUser(input: AuthUser): User {
    const now = Date.now();
    const existing = this.getUserByMicrosoftOid(input.microsoftOid);

    if (existing) {
      db.prepare(`
        UPDATE users SET
          tenant_id = ?,
          email = ?,
          display_name = ?,
          preferred_username = ?,
          job_title = ?,
          department = ?,
          office_location = ?,
          last_seen_at = ?
        WHERE id = ?
      `).run(
        input.tenantId,
        input.email,
        input.displayName,
        input.preferredUsername,
        input.jobTitle,
        input.department,
        input.officeLocation,
        now,
        existing.id,
      );
      return this.getUser(existing.id)!;
    }

    const row: UserRow = {
      id: uuid(),
      microsoft_oid: input.microsoftOid,
      tenant_id: input.tenantId,
      email: input.email,
      display_name: input.displayName,
      preferred_username: input.preferredUsername,
      job_title: input.jobTitle,
      department: input.department,
      office_location: input.officeLocation,
      first_seen_at: now,
      last_seen_at: now,
    };

    db.prepare(`
      INSERT INTO users (
        id, microsoft_oid, tenant_id, email, display_name, preferred_username,
        job_title, department, office_location, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id,
      row.microsoft_oid,
      row.tenant_id,
      row.email,
      row.display_name,
      row.preferred_username,
      row.job_title,
      row.department,
      row.office_location,
      row.first_seen_at,
      row.last_seen_at,
    );

    return rowToUser(row);
  }

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
    geocodeSource?: string | null;
  }): Site {
    const now = Date.now();
    const site: SiteRow = {
      id: uuid(),
      name: input.name.trim().slice(0, 120) || "Untitled Site",
      address: input.address.trim().slice(0, 240),
      lat: input.lat,
      lng: input.lng,
      radius_meters: input.radiusMeters ?? siteMatchRadiusM(),
      geocode_source: input.geocodeSource ?? null,
      created_at: now,
      updated_at: now,
    };

    db.prepare(`
      INSERT INTO sites (id, name, address, lat, lng, radius_meters, geocode_source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      site.id,
      site.name,
      site.address,
      site.lat,
      site.lng,
      site.radius_meters,
      site.geocode_source,
      site.created_at,
      site.updated_at,
    );

    return rowToSite(site, 0);
  }

  updateSiteCoords(
    id: string,
    lat: number,
    lng: number,
    geocodeSource?: string | null,
  ): Site | null {
    const now = Date.now();
    if (geocodeSource !== undefined) {
      db.prepare(`
        UPDATE sites SET lat = ?, lng = ?, geocode_source = ?, updated_at = ? WHERE id = ?
      `).run(lat, lng, geocodeSource, now, id);
    } else {
      db.prepare(`
        UPDATE sites SET lat = ?, lng = ?, updated_at = ? WHERE id = ?
      `).run(lat, lng, now, id);
    }
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

  listSitePreviewUrls(siteId: string, limit = 4): string[] {
    const rows = db.prepare(`
      SELECT filename
      FROM photos
      WHERE site_id = ?
      ORDER BY COALESCE(taken_at, uploaded_at) DESC
      LIMIT ?
    `).all(siteId, limit) as { filename: string }[];

    return rows.map((row) => `/uploads/${row.filename}`);
  }

  listUnassignedPhotosWithGps(): Photo[] {
    const rows = db.prepare(`
      SELECT p.*, NULL AS site_name
      FROM photos p
      WHERE p.site_id IS NULL AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    `).all() as unknown as PhotoRow[];
    return rows.map(rowToPhoto);
  }

  listAutoMatchCandidates(): Photo[] {
    const rows = db.prepare(`
      SELECT p.*, NULL AS site_name
      FROM photos p
      WHERE p.site_id IS NULL
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND COALESCE(p.match_hold, 0) = 0
    `).all() as unknown as PhotoRow[];
    return rows.map(rowToPhoto);
  }

  releaseMatchHold(photoId: string): void {
    db.prepare(`UPDATE photos SET match_hold = 0 WHERE id = ?`).run(photoId);
  }

  releaseAllMatchHolds(): void {
    db.prepare(`UPDATE photos SET match_hold = 0 WHERE site_id IS NULL`).run();
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
    uploadedBy?: User | null;
  }): Photo {
    const uploader = input.uploadedBy ? uploaderSnapshot(input.uploadedBy) : null;
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
      uploaded_by_user_id: uploader?.uploadedByUserId ?? null,
      uploader_microsoft_oid: uploader?.uploaderMicrosoftOid ?? null,
      uploader_display_name: uploader?.uploaderDisplayName ?? null,
      uploader_email: uploader?.uploaderEmail ?? null,
      uploader_preferred_username: uploader?.uploaderPreferredUsername ?? null,
      uploader_job_title: uploader?.uploaderJobTitle ?? null,
      uploader_department: uploader?.uploaderDepartment ?? null,
      uploader_office_location: uploader?.uploaderOfficeLocation ?? null,
    };

    db.prepare(`
      INSERT INTO photos (
        id, filename, original_name, mime_type, site_id,
        lat, lng, taken_at, uploaded_at, width, height,
        uploaded_by_user_id, uploader_microsoft_oid, uploader_display_name,
        uploader_email, uploader_preferred_username, uploader_job_title,
        uploader_department, uploader_office_location
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      row.uploaded_by_user_id ?? null,
      row.uploader_microsoft_oid ?? null,
      row.uploader_display_name ?? null,
      row.uploader_email ?? null,
      row.uploader_preferred_username ?? null,
      row.uploader_job_title ?? null,
      row.uploader_department ?? null,
      row.uploader_office_location ?? null,
    );

    return rowToPhoto(row);
  }

  assignPhotoToSite(photoId: string, siteId: string): Photo | null {
    db.prepare(`UPDATE photos SET site_id = ?, match_hold = 0 WHERE id = ?`).run(siteId, photoId);
    return this.getPhoto(photoId);
  }

  unassignPhoto(photoId: string): Photo | null {
    db.prepare(`UPDATE photos SET site_id = NULL, match_hold = 1 WHERE id = ?`).run(photoId);
    return this.getPhoto(photoId);
  }

  deletePhoto(id: string): { filename: string } | null {
    const row = db.prepare(`SELECT filename FROM photos WHERE id = ?`).get(id) as { filename: string } | undefined;
    if (!row) return null;
    db.prepare(`DELETE FROM photos WHERE id = ?`).run(id);
    return row;
  }

  listPhotoGeoPoints(): Array<{ lat: number; lng: number }> {
    const rows = db
      .prepare(`SELECT lat, lng FROM photos WHERE lat IS NOT NULL AND lng IS NOT NULL`)
      .all() as Array<{ lat: number; lng: number }>;
    return rows;
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