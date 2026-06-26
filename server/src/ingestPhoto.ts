import { extractPhotoMeta } from "./exif.js";
import { matchPhotoToSite } from "./matcher.js";
import { store } from "./store.js";
import type { ClientPhotoMeta } from "./uploadSessions.js";
import type { Photo, User } from "./types.js";

function mergeMeta(
  serverMeta: Awaited<ReturnType<typeof extractPhotoMeta>>,
  clientMeta: ClientPhotoMeta | null | undefined,
  originalName: string,
) {
  return {
    lat: clientMeta?.lat ?? serverMeta.lat ?? null,
    lng: clientMeta?.lng ?? serverMeta.lng ?? null,
    takenAt: clientMeta?.takenAt ?? serverMeta.takenAt ?? null,
    width: clientMeta?.width ?? serverMeta.width ?? null,
    height: clientMeta?.height ?? serverMeta.height ?? null,
    originalName: clientMeta?.originalName ?? originalName,
  };
}

export async function ingestUploadedFile(input: {
  filePath: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  clientMeta?: ClientPhotoMeta | null;
  uploadedBy?: User | null;
}) {
  const ingestStart = Date.now();
  const serverMeta = await extractPhotoMeta(input.filePath);
  const meta = mergeMeta(serverMeta, input.clientMeta, input.originalName);

  let photo = store.createPhoto({
    filename: input.filename,
    originalName: meta.originalName,
    mimeType: input.mimeType,
    lat: meta.lat,
    lng: meta.lng,
    takenAt: meta.takenAt,
    width: meta.width,
    height: meta.height,
    uploadedBy: input.uploadedBy ?? null,
  });

  const hasGps = meta.lat != null && meta.lng != null;
  if (hasGps) {
    const matched = matchPhotoToSite(photo.id);
    if (matched) photo = matched;
  }

  const autoMatched = Boolean(photo.siteId);

  return {
    ...photo,
    autoMatched,
    hasGps,
    sizeBytes: input.sizeBytes,
    ingestMs: Date.now() - ingestStart,
    matchStatus: autoMatched ? "routed" as const : hasGps ? "queued" as const : "no_fix" as const,
  };
}