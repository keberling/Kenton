import type { Photo } from "../types";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export function uploadSinglePhoto(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("photos", file);

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      onProgress?.({
        loaded: event.loaded,
        total: event.total,
        percent: Math.round((event.loaded / event.total) * 100),
      });
    });

    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // ignore parse errors
        }
        reject(new Error(message));
        return;
      }

      try {
        const body = JSON.parse(xhr.responseText) as { photos: Photo[] };
        const photo = body.photos?.[0];
        if (!photo) {
          reject(new Error("Server returned no photo"));
          return;
        }
        resolve(photo);
      } catch {
        reject(new Error("Invalid server response"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));

    xhr.open("POST", "/api/photos/upload");
    xhr.send(form);
  });
}

export function createBatchId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BATCH-${stamp}-${rand}`;
}