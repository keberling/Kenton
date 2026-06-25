# Kenton — Job Site Photo Manager

Interactive upload site for field techs to drop project photos. GPS metadata from each image is extracted automatically, and photos are matched to job sites when they're within ~10 miles of the geocoded site address.

## How it works

1. **Upload anytime** — techs upload photos to a general pool from their phone or desktop.
2. **GPS tagging** — EXIF location data is read from each photo on upload.
3. **Auto-match on upload** — if a job site already exists within 10 miles, the photo is tagged immediately.
4. **Auto-match on site create** — when a new job site address is added, all nearby unassigned photos are tagged retroactively.
5. **Retroactive matching** — on server startup and when loading photos/sites, already-uploaded unassigned photos with GPS are matched against all geocoded job sites.

## Stack

- **Client:** React 19, Vite, Tailwind CSS 4, React Router
- **Server:** Node.js, Express, SQLite (`node:sqlite`), EXIF via `exifr`
- **Geocoding:** Nominatim + US Census + Photon fallbacks (cached in SQLite)

## Quick start

```bash
npm install
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:3001

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run client + server |
| `npm run build` | Production build |
| `npm start` | Run production server |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` (prod) / `3001` (dev) | HTTP port |
| `DATA_DIR` | `./server/data` | SQLite + photo storage |
| `CLIENT_ORIGIN` | same-origin in prod | CORS origin for Coolify |
| `SITE_MATCH_RADIUS_M` | `16093` (~10 mi) | GPS match radius in meters (existing sites at older defaults are upgraded on startup) |
| `NOMINATIM_EMAIL` | — | Contact email for Nominatim (recommended in production) |

## Docker / Coolify

Single container on port **3000**. Mount a persistent volume at **`/data`** — this stores both the database and uploaded photos.

```bash
docker compose up --build
```

### Coolify setup

1. Create a **Dockerfile** application pointing at `keberling/Kenton`
2. Expose port **3000**
3. Set `CLIENT_ORIGIN` to your public URL
4. **Add persistent storage** (required — without this, sites and photos are wiped on every redeploy):
   - Go to **Storages** → **Add Storage**
   - Mount path: **`/data`** (exactly this path)
   - Do **not** mount `/app/server/data`
   - Do **not** leave `DATA_DIR` blank or set it to another path unless you mount that same path
5. Deploy

Verify persistence after deploy: `GET /api/health` should return:

```json
{
  "ok": true,
  "dataDir": "/data",
  "persistent": true,
  "sites": 1
}
```

If `persistent` is `false` or `dataDir` is not `/data`, your volume is not mounted correctly.