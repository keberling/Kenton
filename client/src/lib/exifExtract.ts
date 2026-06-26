import exifr from "exifr";

export interface ExtractedGps {
  lat: number;
  lng: number;
}

const EXIF_PARSE_OPTIONS = {
  gps: true,
  tiff: true,
  xmp: true,
  mergeOutput: true,
  reviveValues: true,
  sanitize: true,
};

const EXIF_PICK = [
  "latitude",
  "longitude",
  "GPSLatitude",
  "GPSLongitude",
  "GPSLatitudeRef",
  "GPSLongitudeRef",
  "DateTimeOriginal",
  "CreateDate",
  "ModifyDate",
  "ImageWidth",
  "ImageHeight",
  "ExifImageWidth",
  "ExifImageHeight",
  "Orientation",
] as const;

function isValidCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

function dmsToDecimal(value: unknown, ref: unknown, axis: "lat" | "lng"): number | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const nums = value.map((part) => {
    if (typeof part === "number") return part;
    if (typeof part === "string") return Number.parseFloat(part);
    if (part && typeof part === "object" && "numerator" in part && "denominator" in part) {
      const num = part as { numerator: number; denominator: number };
      return num.denominator ? num.numerator / num.denominator : 0;
    }
    return Number.NaN;
  });
  if (nums.some((n) => !Number.isFinite(n))) return null;

  let decimal = nums[0] + nums[1] / 60 + nums[2] / 3600;
  const refStr = typeof ref === "string" ? ref.toUpperCase() : "";
  if (axis === "lat" && (refStr === "S" || refStr === "SOUTH")) decimal *= -1;
  if (axis === "lng" && (refStr === "W" || refStr === "WEST")) decimal *= -1;
  return decimal;
}

function coordsFromParsed(parsed: Record<string, unknown> | null | undefined): ExtractedGps | null {
  if (!parsed) return null;

  const directLat = parsed.latitude ?? parsed.Latitude;
  const directLng = parsed.longitude ?? parsed.Longitude;
  if (isValidCoord(directLat, directLng)) {
    return { lat: directLat as number, lng: directLng as number };
  }

  const manualLat = dmsToDecimal(parsed.GPSLatitude, parsed.GPSLatitudeRef, "lat");
  const manualLng = dmsToDecimal(parsed.GPSLongitude, parsed.GPSLongitudeRef, "lng");
  if (manualLat != null && manualLng != null && isValidCoord(manualLat, manualLng)) {
    return { lat: manualLat, lng: manualLng };
  }

  return null;
}

export async function extractGpsFromImage(file: File | Blob): Promise<ExtractedGps | null> {
  const attempts: Array<() => Promise<ExtractedGps | null>> = [
    async () => {
      const gps = await exifr.gps(file).catch(() => null);
      if (gps && isValidCoord(gps.latitude, gps.longitude)) {
        return { lat: gps.latitude, lng: gps.longitude };
      }
      return null;
    },
    async () => {
      const parsed = (await exifr
        .parse(file, { ...EXIF_PARSE_OPTIONS, pick: [...EXIF_PICK] })
        .catch(() => null)) as Record<string, unknown> | null;
      return coordsFromParsed(parsed);
    },
    async () => {
      const parsed = (await exifr.parse(file, EXIF_PARSE_OPTIONS).catch(() => null)) as Record<
        string,
        unknown
      > | null;
      return coordsFromParsed(parsed);
    },
  ];

  for (const attempt of attempts) {
    const result = await attempt();
    if (result) return result;
  }

  return null;
}

export interface ExtractedImageMeta {
  lat: number | null;
  lng: number | null;
  takenAt: number | null;
  width: number | null;
  height: number | null;
}

export async function extractImageMeta(file: File): Promise<ExtractedImageMeta> {
  const [gps, parsed] = await Promise.all([
    extractGpsFromImage(file),
    exifr
      .parse(file, {
        ...EXIF_PARSE_OPTIONS,
        pick: [
          "DateTimeOriginal",
          "CreateDate",
          "ModifyDate",
          "ImageWidth",
          "ImageHeight",
          "ExifImageWidth",
          "ExifImageHeight",
        ],
      })
      .catch(() => null) as Promise<Record<string, unknown> | null>,
  ]);

  let takenAt: number | null = null;
  const dateValue = parsed?.DateTimeOriginal ?? parsed?.CreateDate ?? parsed?.ModifyDate;
  if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
    takenAt = dateValue.getTime();
  }

  const width = parsed?.ExifImageWidth ?? parsed?.ImageWidth ?? null;
  const height = parsed?.ExifImageHeight ?? parsed?.ImageHeight ?? null;

  return {
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
    takenAt,
    width: typeof width === "number" ? width : null,
    height: typeof height === "number" ? height : null,
  };
}