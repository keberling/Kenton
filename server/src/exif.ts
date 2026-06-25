import exifr from "exifr";
import type { PhotoExif } from "./types.js";

export async function extractPhotoMeta(filePath: string): Promise<PhotoExif> {
  try {
    const [gps, parsed] = await Promise.all([
      exifr.gps(filePath).catch(() => null),
      exifr.parse(filePath, {
        pick: ["DateTimeOriginal", "CreateDate", "ImageWidth", "ImageHeight", "ExifImageWidth", "ExifImageHeight"],
      }).catch(() => null),
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
    };
  } catch {
    return {
      lat: null,
      lng: null,
      takenAt: null,
      width: null,
      height: null,
    };
  }
}