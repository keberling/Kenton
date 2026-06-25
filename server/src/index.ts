import cors from "cors";
import express from "express";
import fs from "fs";
import { createServer } from "http";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { dataDir } from "./db.js";
import { extractPhotoMeta } from "./exif.js";
import { geocodeAddress } from "./geocode.js";
import { matchPhotoToSite, matchSiteToPhotos } from "./matcher.js";
import { store } from "./store.js";

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

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/stats", (_req, res) => {
  res.json(store.stats());
});

app.get("/api/sites", (_req, res) => {
  res.json(store.listSites());
});

app.get("/api/sites/:id", (req, res) => {
  const site = store.getSite(req.params.id);
  if (!site) {
    res.status(404).json({ error: "Site not found" });
    return;
  }
  res.json(site);
});

app.post("/api/sites", async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  const address = typeof req.body?.address === "string" ? req.body.address : "";
  const radiusMeters = Number(req.body?.radiusMeters) || undefined;

  if (!name.trim() || !address.trim()) {
    res.status(400).json({ error: "Name and address are required" });
    return;
  }

  const coords = await geocodeAddress(address);
  const site = store.createSite({
    name,
    address,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    radiusMeters,
  });

  const matched = coords ? matchSiteToPhotos(site.id) : 0;

  res.status(201).json({
    site: store.getSite(site.id),
    matchedPhotos: matched,
    geocoded: Boolean(coords),
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

app.get("/api/photos/:id", (req, res) => {
  const photo = store.getPhoto(req.params.id);
  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }
  res.json(photo);
});

app.post("/api/photos/upload", upload.array("photos", 20), async (req, res) => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files?.length) {
    res.status(400).json({ error: "No photos uploaded" });
    return;
  }

  const results = [];

  for (const file of files) {
    const filePath = path.join(uploadDir, file.filename);
    const meta = await extractPhotoMeta(filePath);

    let photo = store.createPhoto({
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      lat: meta.lat,
      lng: meta.lng,
      takenAt: meta.takenAt,
      width: meta.width,
      height: meta.height,
    });

    if (meta.lat != null && meta.lng != null) {
      const matched = matchPhotoToSite(photo.id);
      if (matched) photo = matched;
    }

    results.push({
      ...photo,
      autoMatched: Boolean(photo.siteId),
      hasGps: meta.lat != null && meta.lng != null,
    });
  }

  res.status(201).json({ photos: results });
});

app.post("/api/photos/:id/match", (req, res) => {
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
  console.log(`Kenton running on http://0.0.0.0:${PORT}`);
  if (isProduction) {
    console.log(`Serving client from ${clientDist}`);
  }
});