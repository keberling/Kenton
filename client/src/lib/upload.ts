import type { Photo } from "../types";
import { authHeaders } from "./auth/token";
import type { ClientPhotoMeta, PreparedUpload } from "./imagePrep";
import { normalizeImageMime } from "./imageTypes";

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  mode?: "compress" | "uplink" | "chunk";
  chunkIndex?: number;
  chunkTotal?: number;
  sessionId?: string | null;
}

export interface UploadResumeState {
  sessionId?: string | null;
  chunksCompleted?: number;
}

const CHUNK_SIZE = 256 * 1024;
const CHUNK_THRESHOLD = 512 * 1024;
const MAX_RETRIES = 6;
const RETRY_BACKOFF_MS = [1500, 3000, 6000, 12_000, 24_000, 45_000];
const REQUEST_TIMEOUT_MS = 120_000;

export function isRetryableUploadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("failed") ||
    message.includes("502") ||
    message.includes("503") ||
    message.includes("504") ||
    message.includes("429")
  );
}

export function retryDelayMs(attempt: number): number {
  return RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)] ?? 45_000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Upload timeout — will retry");
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

async function createUploadSession(prepared: PreparedUpload, totalChunks: number) {
  const headers = await authHeaders();
  const res = await fetchWithTimeout("/api/photos/upload/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      originalName: prepared.meta.originalName,
      mimeType: normalizeImageMime(prepared.file),
      totalSize: prepared.uploadSize,
      totalChunks,
      clientMeta: prepared.meta,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Session start failed (${res.status})`);
  }

  return res.json() as Promise<{ sessionId: string; totalChunks: number }>;
}

async function uploadChunk(sessionId: string, index: number, chunk: Blob) {
  const headers = await authHeaders();
  const res = await fetchWithTimeout(
    `/api/photos/upload/session/${sessionId}/chunk/${index}`,
    {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/octet-stream",
      },
      body: chunk,
    },
    90_000,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Chunk ${index} failed (${res.status})`);
  }

  return res.json() as Promise<{ received: number; totalChunks: number }>;
}

async function completeUploadSession(sessionId: string): Promise<Photo> {
  const headers = await authHeaders();
  const res = await fetchWithTimeout(`/api/photos/upload/session/${sessionId}/complete`, {
    method: "POST",
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Complete failed (${res.status})`);
  }

  const body = (await res.json()) as { photo: Photo };
  if (!body.photo) throw new Error("Server returned no photo");
  return body.photo;
}

async function uploadChunked(
  prepared: PreparedUpload,
  onProgress?: (progress: UploadProgress) => void,
  resume: UploadResumeState = {},
): Promise<{ photo: Photo; sessionId: string; chunksCompleted: number }> {
  const blob = prepared.file;
  const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
  let sessionId = resume.sessionId ?? null;
  let startChunk = resume.chunksCompleted ?? 0;

  if (!sessionId || startChunk >= totalChunks) {
    const session = await createUploadSession(prepared, totalChunks);
    sessionId = session.sessionId;
    startChunk = 0;
  }

  let loaded = startChunk * CHUNK_SIZE;

  for (let index = startChunk; index < totalChunks; index++) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, blob.size);
    const chunk = blob.slice(start, end);

    await uploadChunk(sessionId, index, chunk);
    loaded = end;

    onProgress?.({
      loaded,
      total: blob.size,
      percent: Math.round((loaded / blob.size) * 100),
      mode: "chunk",
      chunkIndex: index + 1,
      chunkTotal: totalChunks,
      sessionId,
    });
  }

  const photo = await completeUploadSession(sessionId);
  return { photo, sessionId, chunksCompleted: totalChunks };
}

function uploadSingleXHR(
  file: File,
  meta: ClientPhotoMeta,
  onProgress?: (progress: UploadProgress) => void,
): Promise<Photo> {
  return new Promise((resolve, reject) => {
    void (async () => {
      const headers = await authHeaders();
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append("photos", file);
      form.append("clientMeta", JSON.stringify(meta));

      xhr.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        onProgress?.({
          loaded: event.loaded,
          total: event.total,
          percent: Math.round((event.loaded / event.total) * 100),
          mode: "uplink",
        });
      });

      xhr.addEventListener("load", () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let message = `Upload failed (${xhr.status})`;
          try {
            const body = JSON.parse(xhr.responseText) as { error?: string };
            if (body.error) message = body.error;
          } catch {
            // ignore
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
      xhr.addEventListener("abort", () => reject(new Error("Upload timeout — will retry")));
      xhr.timeout = REQUEST_TIMEOUT_MS;
      xhr.addEventListener("timeout", () => reject(new Error("Upload timeout — will retry")));

      xhr.open("POST", "/api/photos/upload");
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }
      xhr.send(form);
    })().catch(reject);
  });
}

export async function uploadPreparedPhoto(
  prepared: PreparedUpload,
  onProgress?: (progress: UploadProgress) => void,
  resume: UploadResumeState = {},
): Promise<{ photo: Photo; sessionId: string | null; chunksCompleted: number }> {
  if (prepared.uploadSize > CHUNK_THRESHOLD) {
    return uploadChunked(prepared, onProgress, resume);
  }

  const photo = await uploadSingleXHR(prepared.file, prepared.meta, onProgress);
  return { photo, sessionId: null, chunksCompleted: 0 };
}

export async function uploadPreparedPhotoWithRetry(
  prepared: PreparedUpload,
  options: {
    onProgress?: (progress: UploadProgress) => void;
    resume?: UploadResumeState;
    attempt?: number;
  } = {},
): Promise<{ photo: Photo; sessionId: string | null; chunksCompleted: number }> {
  const attempt = options.attempt ?? 0;

  try {
    return await uploadPreparedPhoto(prepared, options.onProgress, options.resume ?? {});
  } catch (err) {
    if (!isRetryableUploadError(err) || attempt >= MAX_RETRIES - 1) {
      throw err;
    }
    await sleep(retryDelayMs(attempt));
    return uploadPreparedPhotoWithRetry(prepared, {
      ...options,
      attempt: attempt + 1,
      resume: options.resume,
    });
  }
}

export function createBatchId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BATCH-${stamp}-${rand}`;
}