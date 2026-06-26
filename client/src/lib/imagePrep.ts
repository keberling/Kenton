import { extractImageMeta } from "./exifExtract";
import { isImageFile, normalizeImageMime } from "./imageTypes";

export type GpsSource = "exif" | null;

export interface ClientPhotoMeta {
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  width: number | null;
  height: number | null;
  originalName: string;
  gpsSource?: GpsSource;
}

export interface PreparedUpload {
  file: File;
  originalSize: number;
  uploadSize: number;
  compressed: boolean;
  meta: ClientPhotoMeta;
}

const MAX_EDGE = 2400;
const JPEG_QUALITY = 0.82;
const SKIP_COMPRESS_BELOW = 450_000;

async function extractMeta(file: File): Promise<ClientPhotoMeta> {
  try {
    const extracted = await extractImageMeta(file);
    return {
      ...extracted,
      originalName: file.name,
      gpsSource: extracted.lat != null && extracted.lng != null ? "exif" : null,
    };
  } catch {
    return {
      lat: null,
      lng: null,
      takenAt: null,
      width: null,
      height: null,
      originalName: file.name,
      gpsSource: null,
    };
  }
}

async function compressRaster(file: File, meta: ClientPhotoMeta): Promise<File | null> {
  const mime = normalizeImageMime(file);
  if (!isImageFile(file) || mime.includes("svg")) return null;
  if (file.size < SKIP_COMPRESS_BELOW && (mime === "image/jpeg" || mime === "image/webp")) {
    return null;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", JPEG_QUALITY);
  });

  if (!blob || blob.size >= file.size * 0.97) return null;

  meta.width = width;
  meta.height = height;

  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
}

export async function prepareUploadFile(
  file: File,
  onProgress?: (message: string) => void,
): Promise<PreparedUpload> {
  onProgress?.("EXIF::SCAN");
  const meta = await extractMeta(file);
  onProgress?.(meta.gpsSource === "exif" ? "GPS::EXIF" : "GPS::NONE");
  onProgress?.("IMG::OPTIMIZE");
  const compressed = await compressRaster(file, meta);
  const uploadFile = compressed ?? file;

  return {
    file: uploadFile,
    originalSize: file.size,
    uploadSize: uploadFile.size,
    compressed: compressed != null,
    meta,
  };
}