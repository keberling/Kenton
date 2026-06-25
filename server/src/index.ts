import cors from "cors";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { siteMatchRadiusM, siteMaxMatchDistanceM, siteSoftMatchCushionM } from "./config.js";
import { dataDir, dbPath } from "./db.js";
import { ingestUploadedFile } from "./ingestPhoto.js";
import { reverseGeocodeAddress, searchAddresses } from "./addressSearch.js";
import { geocodeAddress } from "./geocode.js";
import { buildDeploymentRecommendations } from "./siteRecommendations.js";
import {
  matchPhotoToSite,
  rematchAfterSiteChange,
  rematchAllUnassignedPhotos,
  syncExistingPhotoMatches,
} from "./matcher.js";
import { attachAuth, mergeProfilePatch, requireAuthForUpload } from "./auth/middleware.js";
import { publicAuthConfig } from "./auth/microsoft.js";
import { enrichSite } from "./siteInsights.js";
import { store } from "./store.js";
import type { AuthUser } from "./types.js";
import {
  cleanupStaleUploadSessions,
  completeUploadSession,
  createUploadSession,
  getUploadSession,
  writeUploadChunk,
  type ClientPhotoMeta,
} from "./uploadSessions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || (isProduction ? 3000 : 3001);
const clientOriginEnv = process.env.CLIENT_ORIGIN?.trim();
const corsOrigin = clientOriginEnv || (isProduction ? true : "http://localhost:5173");
const clientDist = path.join(__dirname, "../../client/dist");
const uploadDir = path.join(dataDir, "uploads");

const app = express();
const httpServer = createServer(app);

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "1mb" }));
app.use(attachAuth);
app.use("/uploads", express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 48);
    cb(null, `${Date.now()}-${base || "photo"}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image uploads are allowed"));
  },
});

app.get("/api/auth/config", (_req, res) => {
  res.json(publicAuthConfig());
});

app.get("/api/auth/me", (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }
  res.json({ user: req.authUser });
});

app.post("/api/auth/sync", (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "Not signed in" });
    return;
  }

  const body = req.body as Partial<AuthUser>;
  const patch: Partial<AuthUser> = {};

  if (typeof body.displayName === "string" && body.displayName.trim()) {
    patch.displayName = body.displayName.trim();
  }
  if (typeof body.email === "string") patch.email = body.email.trim() || null;
  if (typeof body.preferredUsername === "string") {
    patch.preferredUsername = body.preferredUsername.trim() || null;
  }
  if (typeof body.jobTitle === "string") patch.jobTitle = body.jobTitle.trim() || null;
  if (typeof body.department === "string") patch.department = body.department.trim() || null;
  if (typeof body.officeLocation === "string") {
    patch.officeLocation = body.officeLocation.trim() || null;
  }

  const user = mergeProfilePatch(req.authUser, patch);
  res.json({ user });
});

app.get("/api/health", (_req, res) => {
  const stats = store.stats();
  const dbExists = fs.existsSync(dbPath);
  const uploadsDir = path.join(dataDir, "uploads");
  const uploadsExist = fs.existsSync(uploadsDir);

  res.json({
    ok: true,
    dataDir,
    dbPath,
    dbExists,
    uploadsDir,
    uploadsExist,
    persistent: isProduction ? dataDir === "/data" : true,
    sites: stats.sites,
    photos: stats.totalPhotos,
    matchRadiusM: siteMatchRadiusM(),
    softMatchCushionM: siteSoftMatchCushionM(),
    maxMatchDistanceM: siteMaxMatchDistanceM(),
  });
});

app.get("/api/stats", (_req, res) => {
  syncExistingPhotoMatches();
  res.json(store.stats());
});

app.get("/api/addresses/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const limit = Number(req.query.limit) || 6;

  if (q.trim().length < 3) {
    res.json({ suggestions: [] });
    return;
  }

  try {
    const suggestions = await searchAddresses(q, limit);
    res.json({ suggestions });
  } catch {
    res.status(502).json({ error: "Address search unavailable" });
  }
});

app.get("/api/addresses/reverse", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  try {
    const suggestion = await reverseGeocodeAddress(lat, lng);
    if (!suggestion) {
      res.status(404).json({ error: "No address found for coordinates" });
      return;
    }
    res.json({ suggestion });
  } catch {
    res.status(502).json({ error: "Reverse geocode unavailable" });
  }
});

app.get("/api/recommendations/deployments", async (_req, res) => {
  syncExistingPhotoMatches();
  try {
    const recommendations = await buildDeploymentRecommendations();
    res.json({ recommendations });
  } catch {
    res.status(502).json({ error: "Could not build deployment recommendations" });
  }
});

app.get("/api/sites", (_req, res) => {
  syncExistingPhotoMatches();
  res.json(store.listSites().map(enrichSite));
});

app.get("/api/sites/:id", (req, res) => {
  syncExistingPhotoMatches();
  const site = store.getSite(req.params.id);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(enrichSite(site));
});

app.post("/api/sites", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  const address = typeof req.body?.address === "string" ? req.body.address : "";
  const radiusMeters = Number(req.body?.radiusMeters) || undefined;

  if (!name.trim() || !address.trim()) {
    res.status(400).json({ error: "Name and address are required" });
    return;
  }

  const geocoded = await geocodeAddress(address);
  const site = store.createSite({
    name,
    address,
    lat: geocoded.point?.lat ?? null,
    lng: geocoded.point?.lng ?? null,
    radiusMeters,
    geocodeSource: geocoded.point?.source ?? null,
  });

  const matched = geocoded.point ? rematchAfterSiteChange(site.id) : 0;

  res.status(201).json({
    site: enrichSite(store.getSite(site.id)!),
    matchedPhotos: matched,
    geocoded: Boolean(geocoded.point),
    geocodeSource: geocoded.point?.source ?? null,
    geocodeError: geocoded.error,
  });
});

app.post("/api/sites/:id/geocode", async (req, res) => {
  const site = store.getSite(req.params.id);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }

  const geocoded = await geocodeAddress(site.address);
  if (!geocoded.point) {
    res.status(422).json({ error: geocoded.error ?? "Could not geocode address" });
    return;
  }

  store.updateSiteCoords(site.id, geocoded.point.lat, geocoded.point.lng, geocoded.point.source);
  const matched = rematchAfterSiteChange(site.id);

  res.json({
    site: enrichSite(store.getSite(site.id)!),
    matchedPhotos: matched,
    geocodeSource: geocoded.point.source,
  });
});

app.delete("/api/sites/:id", (req, res) => {
  if (!store.deleteSite(req.params.id)) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/photos", (req, res) => {
  syncExistingPhotoMatches();

  const siteId = typeof req.query.siteId === "string" ? req.query.siteId : undefined;
  const unassigned = req.query.unassigned === "true";

  if (siteId) {
    res.json(store.listPhotos({ siteId }));
    return;
  }
  if (unassigned) {
    res.json(store.listPhotos({ unassigned: true }));
    return;
  }
  res.json(store.listPhotos());
});

app.get("/api/photos/geo", (_req, res) => {
  syncExistingPhotoMatches();
  const points = store.listPhotoGeoPoints();
  res.json({
    points,
    total: points.length,
  });
});

app.get("/api/photos/:id", (req, res) => {
  const photo = store.getPhoto(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  res.json(photo);
});

function parseClientMeta(raw: unknown): ClientPhotoMeta | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return parseClientMeta(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || raw == null) return null;
  const body = raw as Record<string, unknown>;
  const num = (key: string) => {
    const value = body[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };
  return {
    lat: num("lat"),
    lng: num("lng"),
    takenAt: num("takenAt"),
    width: num("width"),
    height: num("height"),
    originalName: typeof body.originalName === "string" ? body.originalName : undefined,
  };
}

app.post("/api/photos/upload/session", requireAuthForUpload, express.json(), (req, res) => {
  const originalName = typeof req.body?.originalName === "string" ? req.body.originalName : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType : "image/jpeg";
  const totalSize = Number(req.body?.totalSize);
  const totalChunks = Number(req.body?.totalChunks);

  if (!originalName.trim() || !Number.isFinite(totalSize) || totalSize <= 0) {
    res.status(400).json({ error: "originalName and totalSize are required" });
    return;
  }
  if (!Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 512) {
    res.status(400).json({ error: "totalChunks must be between 1 and 512" });
    return;
  }

  const session = createUploadSession({
    originalName,
    mimeType,
    totalSize,
    totalChunks,
    clientMeta: parseClientMeta(req.body?.clientMeta),
  });

  res.status(201).json({
    sessionId: session.id,
    totalChunks: session.totalChunks,
  });
});

app.put(
  "/api/photos/upload/session/:id/chunk/:index",
  requireAuthForUpload,
  express.raw({ type: "*/*", limit: "512kb" }),
  (req, res) => {
    const sessionId = String(req.params.id);
    const session = getUploadSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Upload session not found" });
      return;
    }

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) {
      res.status(400).json({ error: "Invalid chunk index" });
      return;
    }

    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    if (!body.length) {
      res.status(400).json({ error: "Empty chunk body" });
      return;
    }

    const updated = writeUploadChunk(sessionId, index, body);
    if (!updated) {
      res.status(500).json({ error: "Could not store chunk" });
      return;
    }

    res.json({
      received: updated.receivedChunks.length,
      totalChunks: updated.totalChunks,
    });
  },
);

app.post("/api/photos/upload/session/:id/complete", requireAuthForUpload, async (req, res) => {
  const assembled = completeUploadSession(String(req.params.id));
  if (!assembled) {
    res.status(400).json({ error: "Upload incomplete or session not found" });
    return;
  }

  try {
    const photo = await ingestUploadedFile({
      filePath: assembled.filePath,
      filename: assembled.filename,
      originalName: assembled.originalName,
      mimeType: assembled.mimeType,
      sizeBytes: fs.statSync(assembled.filePath).size,
      clientMeta: assembled.clientMeta,
      uploadedBy: req.authUser ?? null,
    });
    res.status(201).json({ photo });
  } catch {
    res.status(500).json({ error: "Could not ingest uploaded photo" });
  }
});

app.post("/api/photos/upload", requireAuthForUpload, upload.array("photos", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ error: "No photos uploaded" });
    return;
  }

  const clientMeta = parseClientMeta(
    typeof req.body?.clientMeta === "string" ? req.body.clientMeta : req.body?.clientMeta,
  );

  const results = [];

  for (const file of files) {
    const filePath = path.join(uploadDir, file.filename);
    const photo = await ingestUploadedFile({
      filePath,
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      clientMeta,
      uploadedBy: req.authUser ?? null,
    });
    results.push(photo);
  }

  res.status(201).json({ photos: results });
});

app.post("/api/photos/rematch", (_req, res) => {
  const matched = rematchAllUnassignedPhotos({ releaseHeld: true });
  res.json({
    matched,
    matchRadiusM: siteMatchRadiusM(),
    softMatchCushionM: siteSoftMatchCushionM(),
    maxMatchDistanceM: siteMaxMatchDistanceM(),
  });
});

app.post("/api/photos/:id/match", (req, res) => {
  store.releaseMatchHold(req.params.id);
  const photo = matchPhotoToSite(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  res.json(photo);
});

app.patch("/api/photos/:id/site", (req, res) => {
  const siteId = req.body?.siteId;
  const photo = store.getPhoto(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  if (siteId === null || siteId === "") {
    res.json(store.unassignPhoto(req.params.id));
    return;
  }

  if (typeof siteId !== "string" || !store.getSite(siteId)) {
    res.status(400).json({ error: "Invalid site" });
    return;
  }

  res.json(store.assignPhotoToSite(req.params.id, siteId));
});

app.delete("/api/photos/:id", (req, res) => {
  const removed = store.deletePhoto(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  const filePath = path.join(uploadDir, removed.filename);
  fs.unlink(filePath, () => {});
  res.json({ ok: true });
});

fs.mkdirSync(uploadDir, { recursive: true });
cleanupStaleUploadSessions();

if (isProduction && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

httpServer.listen(PORT, "0.0.0.0", () => {
  const matched = syncExistingPhotoMatches();
  console.log(`Kenton running on http://0.0.0.0:${PORT}`);
  if (matched > 0) {
    console.log(`Matched ${matched} existing unassigned photo(s) to job sites`);
  }
  if (isProduction) {
    console.log(`Serving client from ${clientDist}`);
  }
});