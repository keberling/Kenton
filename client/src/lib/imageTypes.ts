const IMAGE_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
  ".bmp",
  ".tif",
  ".tiff",
]);

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
};

export function imageExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot).toLowerCase();
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/") && !file.type.includes("svg")) return true;
  return IMAGE_EXTENSIONS.has(imageExtension(file.name));
}

export function normalizeImageMime(file: File): string {
  if (file.type.startsWith("image/") && !file.type.includes("svg")) return file.type;
  const ext = imageExtension(file.name);
  return EXT_TO_MIME[ext] ?? "image/jpeg";
}