# Kenton — Job Site Photo Manager

Interactive upload site for field techs to drop project photos. GPS metadata from each image is extracted automatically, and photos are matched to job sites when they're within ~10 miles of the geocoded site address.

## How it works

1. **Upload anytime** — techs upload photos to a general pool from their phone or desktop.
2. **GPS tagging** — EXIF location data is read from each photo on upload.
3. **Auto-match on upload** — if a job site already exists within 10 miles, the photo is tagged immediately.
4. **Auto-match on site create** — when a new job site address is added, all nearby unassigned photos are tagged retroactively.
5. **Retroactive matching** — on server startup and when loading photos/sites, already-uploaded unassigned photos with GPS are matched against all geocoded job sites.
6. **Deployment recommendations** — when uploads cannot match a site, Kenton suggests creating one and pre-fills the address from GPS (reverse geocode).
7. **Live address search** — deployment registration uses Photon + OpenStreetMap autocomplete (no API key); full geocode on save uses the same stack as before.

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
| `AZURE_CLIENT_ID` | — | Microsoft Entra app (client) ID — enables SSO when set with tenant |
| `AZURE_TENANT_ID` | — | Microsoft Entra directory (tenant) ID |
| `AZURE_API_SCOPE` | `api://{clientId}/access_as_user` | API scope exposed in your app registration |
| `AUTH_REQUIRED` | `true` when Azure is set | Require Microsoft sign-in for uploads |

## Microsoft SSO (Entra ID)

Kenton supports Microsoft single sign-on so every field upload is attributed to the signed-in operator. When Azure env vars are **not** set, the app works as before with anonymous uploads. When configured, uploads are tied to the Microsoft identity and snapshot on each photo (name, email, job title, department, office).

### App registration (one-time)

1. In [Microsoft Entra admin center](https://entra.microsoft.com), register a new application (**Single-page application**).
2. Add redirect URI: your Kenton URL (e.g. `https://kenton.yourcompany.com` and `http://localhost:5173` for dev).
3. Under **Expose an API**, set Application ID URI to `api://{client-id}` and add scope **`access_as_user`** (admin consent if required).
4. Under **API permissions**, add **Microsoft Graph → User.Read** (delegated) for profile enrichment (job title, department).
5. Copy **Application (client) ID** → `AZURE_CLIENT_ID`
6. Copy **Directory (tenant) ID** → `AZURE_TENANT_ID`
7. Deploy with both variables set on Coolify.

### Behaviour

- Sidebar shows Microsoft sign-in / signed-in operator telemetry.
- Each uploaded photo stores operator snapshot fields at ingest time.
- Archive, galleries, and ingest pipeline display **OPERATOR** metadata.
- Set `AUTH_REQUIRED=false` temporarily to test SSO without blocking anonymous uploads.

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