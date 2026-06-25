import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import { dataDir } from "./db.js";

export interface ClientPhotoMeta {
  lat?: number | null;
  lng?: number | null;
  takenAt?: number | null;
  width?: number | null;
  height?: number | null;
  originalName?: string;
}

interface SessionManifest {
  id: string;
  originalName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  clientMeta: ClientPhotoMeta | null;
  createdAt: number;
  receivedChunks: number[];
}

const sessionsRoot = path.join(dataDir, "uploads", ".sessions");
const STALE_MS = 24 * 60 * 60 * 1000;

function sessionDir(id: string) {
  return path.join(sessionsRoot, id);
}

function manifestPath(id: string) {
  return path.join(sessionDir(id), "manifest.json");
}

function chunkPath(id: string, index: number) {
  return path.join(sessionDir(id), `chunk-${String(index).padStart(5, "0")}`);
}

function readManifest(id: string): SessionManifest | null {
  const file = manifestPath(id);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as SessionManifest;
  } catch {
    return null;
  }
}

function writeManifest(manifest: SessionManifest) {
  fs.mkdirSync(sessionDir(manifest.id), { recursive: true });
  fs.writeFileSync(manifestPath(manifest.id), JSON.stringify(manifest));
}

export function cleanupStaleUploadSessions() {
  fs.mkdirSync(sessionsRoot, { recursive: true });
  const now = Date.now();
  for (const id of fs.readdirSync(sessionsRoot)) {
    const manifest = readManifest(id);
    if (!manifest || now - manifest.createdAt > STALE_MS) {
      fs.rmSync(sessionDir(id), { recursive: true, force: true });
    }
  }
}

export function createUploadSession(input: {
  originalName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  clientMeta?: ClientPhotoMeta | null;
}): SessionManifest {
  fs.mkdirSync(sessionsRoot, { recursive: true });
  cleanupStaleUploadSessions();

  const manifest: SessionManifest = {
    id: uuid(),
    originalName: input.originalName,
    mimeType: input.mimeType,
    totalSize: input.totalSize,
    totalChunks: input.totalChunks,
    clientMeta: input.clientMeta ?? null,
    createdAt: Date.now(),
    receivedChunks: [],
  };

  writeManifest(manifest);
  return manifest;
}

export function getUploadSession(id: string): SessionManifest | null {
  return readManifest(id);
}

export function writeUploadChunk(id: string, index: number, data: Buffer): SessionManifest | null {
  const manifest = readManifest(id);
  if (!manifest) return null;
  if (index < 0 || index >= manifest.totalChunks) return null;

  fs.mkdirSync(sessionDir(id), { recursive: true });
  fs.writeFileSync(chunkPath(id, index), data);

  if (!manifest.receivedChunks.includes(index)) {
    manifest.receivedChunks.push(index);
    manifest.receivedChunks.sort((a, b) => a - b);
    writeManifest(manifest);
  }

  return manifest;
}

export function completeUploadSession(id: string): {
  filePath: string;
  filename: string;
  originalName: string;
  mimeType: string;
  clientMeta: ClientPhotoMeta | null;
} | null {
  const manifest = readManifest(id);
  if (!manifest) return null;

  if (manifest.receivedChunks.length !== manifest.totalChunks) {
    return null;
  }

  for (let i = 0; i < manifest.totalChunks; i++) {
    if (!manifest.receivedChunks.includes(i)) return null;
  }

  const ext = path.extname(manifest.originalName).toLowerCase() || ".jpg";
  const base = path
    .basename(manifest.originalName, ext)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 48);
  const filename = `${Date.now()}-${base || "photo"}${ext}`;
  const uploadsDir = path.join(dataDir, "uploads");
  const filePath = path.join(uploadsDir, filename);

  fs.mkdirSync(uploadsDir, { recursive: true });
  const fd = fs.openSync(filePath, "w");

  try {
    for (let i = 0; i < manifest.totalChunks; i++) {
      const part = fs.readFileSync(chunkPath(id, i));
      fs.writeSync(fd, part);
    }
  } finally {
    fs.closeSync(fd);
  }

  fs.rmSync(sessionDir(id), { recursive: true, force: true });

  return {
    filePath,
    filename,
    originalName: manifest.originalName,
    mimeType: manifest.mimeType,
    clientMeta: manifest.clientMeta,
  };
}