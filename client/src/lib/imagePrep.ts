import exifr from "exifr";

export interface ClientPhotoMeta {
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  width: number | null;
  height: number | null;
  originalName: string;
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
    const [gps, parsed] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr
        .parse(file, {
          pick: ["DateTimeOriginal", "CreateDate", "ImageWidth", "ImageHeight", "ExifImageWidth", "ExifImageHeight"],
        })
        .catch(() => null),
    ]);

    let takenAt: number | null = null;
    const dateValue = parsed?.DateTimeOriginal ?? parsed?.CreateDate;
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      takenAt = dateValue.getTime();
    }

    const width = parsed?.ExifImageWidth ?? parsed?.ImageWidth ?? null;
    const height = parsed?.ExifImageHeight ?? parsed?.ImageHeight ?? null;

    return {
      lat: gps?.latitude ?? null,
      lng: gps?.longitude ?? null,
      takenAt,
      width: typeof width === "number" ? width : null,
      height: typeof height === "number" ? height : null,
      originalName: file.name,
    };
  } catch {
    return {
      lat: null,
      lng: null,
      takenAt: null,
      width: null,
      height: null,
      originalName: file.name,
    };
  }
}

async function compressRaster(file: File, meta: ClientPhotoMeta): Promise<File | null> {
  if (!file.type.startsWith("image/") || file.type.includes("svg")) return null;
  if (file.size < SKIP_COMPRESS_BELOW && (file.type === "image/jpeg" || file.type === "image/webp")) {
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