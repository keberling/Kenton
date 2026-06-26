import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UploadQueueItem } from "../components/UploadPipeline";
import { prepareUploadFile, type PreparedUpload } from "./imagePrep";
import { isImageFile } from "./imageTypes";
import {
  deletePersistedItem,
  loadPersistedItems,
  savePersistedItem,
} from "./ingestPersistence";
import {
  createBatchId,
  isRetryableUploadError,
  retryDelayMs,
  uploadPreparedPhoto,
} from "./upload";
import { useAuth } from "./AuthContext";
import { useLiveData } from "./LiveDataContext";

const MAX_RETRIES = 6;

function createQueueItem(file: File): UploadQueueItem {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    previewUrl: URL.createObjectURL(file),
    phase: "queued",
    progress: 0,
    bytesLoaded: 0,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    sessionId: null,
    chunksCompleted: 0,
  };
}

function revokeQueue(items: UploadQueueItem[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
}

function toPrepared(item: UploadQueueItem): PreparedUpload | null {
  if (!item.preparedFile || !item.clientMeta) return null;
  return {
    file: item.preparedFile,
    originalSize: item.originalSize ?? item.file.size,
    uploadSize: item.uploadSize ?? item.preparedFile.size,
    compressed: item.compressed ?? false,
    meta: item.clientMeta,
  };
}

async function persistItem(item: UploadQueueItem, batchId: string | null) {
  const file = item.preparedFile ?? item.file;
  await savePersistedItem({
    id: item.id,
    blob: file,
    fileName: item.clientMeta?.originalName ?? item.file.name,
    originalSize: item.originalSize ?? item.file.size,
    uploadSize: item.uploadSize ?? file.size,
    compressed: item.compressed ?? false,
    meta: item.clientMeta ?? {
      lat: null,
      lng: null,
      takenAt: null,
      width: null,
      height: null,
      originalName: item.file.name,
    },
    retryCount: item.retryCount ?? 0,
    sessionId: item.sessionId ?? null,
    chunksCompleted: item.chunksCompleted ?? 0,
    batchId,
    updatedAt: Date.now(),
  });
}

interface IngestContextValue {
  queue: UploadQueueItem[];
  batchId: string | null;
  sessionStartedAt: number;
  uploading: boolean;
  error: string | null;
  overallPercent: number;
  doneCount: number;
  totalCount: number;
  startIngest: (files: FileList | File[]) => Promise<void>;
  clearError: () => void;
  retryFailed: () => void;
}

const IngestContext = createContext<IngestContextValue | null>(null);

export function IngestProvider({ children }: { children: React.ReactNode }) {
  const { config, user } = useAuth();
  const { invalidate } = useLiveData();
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  const queueRef = useRef(queue);
  queueRef.current = queue;
  const batchIdRef = useRef(batchId);
  batchIdRef.current = batchId;
  const workerRef = useRef<Promise<void> | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, ...patch } : item));
      queueRef.current = next;
      return next;
    });
  }, []);

  const processItem = useCallback(
    async (item: UploadQueueItem) => {
      const started = Date.now();
      let working = { ...item, startedAt: started };

      try {
        let prepared = toPrepared(working);
        if (!prepared) {
          updateItem(working.id, { phase: "compressing", progress: 0, bytesLoaded: 0, startedAt: started });
          prepared = await prepareUploadFile(working.file);
          working = {
            ...working,
            preparedFile: prepared.file,
            originalSize: prepared.originalSize,
            uploadSize: prepared.uploadSize,
            compressed: prepared.compressed,
            clientMeta: prepared.meta,
          };
          updateItem(working.id, {
            phase: "queued",
            preparedFile: prepared.file,
            originalSize: prepared.originalSize,
            uploadSize: prepared.uploadSize,
            compressed: prepared.compressed,
            clientMeta: prepared.meta,
          });
          await persistItem(working, batchIdRef.current);
        }

        let attempt = working.retryCount ?? 0;

        while (attempt < MAX_RETRIES) {
          const current = queueRef.current.find((entry) => entry.id === working.id) ?? working;
          working = {
            ...current,
            preparedFile: prepared.file,
            clientMeta: prepared.meta,
            startedAt: current.startedAt ?? started,
          };

          updateItem(working.id, {
            phase: attempt > 0 ? "retrying" : "uplink",
            progress: 0,
            bytesLoaded: 0,
            retryCount: attempt,
          });

          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, retryDelayMs(attempt - 1)));
            updateItem(working.id, { phase: "uplink" });
          }

          try {
            const result = await uploadPreparedPhoto(
              prepared,
              (progress) => {
                updateItem(working.id, {
                  progress: progress.percent,
                  bytesLoaded: progress.loaded,
                  chunksCompleted: progress.chunkIndex ?? working.chunksCompleted,
                  sessionId: progress.sessionId ?? working.sessionId,
                });
              },
              {
                sessionId: working.sessionId,
                chunksCompleted: working.chunksCompleted,
              },
            );

            updateItem(working.id, {
              phase: "processing",
              progress: 100,
              bytesLoaded: prepared.uploadSize,
              sessionId: result.sessionId,
              chunksCompleted: result.chunksCompleted,
            });
            await new Promise((r) => setTimeout(r, 120));

            updateItem(working.id, {
              phase: "done",
              progress: 100,
              bytesLoaded: prepared.uploadSize,
              completedAt: Date.now(),
              result: result.photo,
              sessionId: result.sessionId,
              chunksCompleted: result.chunksCompleted,
            });
            await deletePersistedItem(working.id);
            invalidate();
            return;
          } catch (err) {
            attempt += 1;
            const message = err instanceof Error ? err.message : "Upload failed";
            working = {
              ...working,
              retryCount: attempt,
              sessionId: working.sessionId,
            };

            if (!isRetryableUploadError(err) || attempt >= MAX_RETRIES) {
              updateItem(working.id, {
                phase: "error",
                completedAt: Date.now(),
                error: message,
                retryCount: attempt,
              });
              await persistItem(working, batchIdRef.current);
              return;
            }

            updateItem(working.id, {
              phase: "retrying",
              error: message,
              retryCount: attempt,
            });
            await persistItem(working, batchIdRef.current);
          }
        }
      } catch (err) {
        updateItem(working.id, {
          phase: "error",
          completedAt: Date.now(),
          error: err instanceof Error ? err.message : "Upload failed",
        });
        await persistItem(working, batchIdRef.current);
      }
    },
    [invalidate, updateItem],
  );

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const worker = (async () => {
      setUploading(true);
      try {
        while (true) {
          const pending = queueRef.current.find((item) => item.phase === "queued");
          if (!pending) break;
          await processItem(pending);
        }
      } finally {
        setUploading(false);
        workerRef.current = null;
        invalidate();
      }
    })();

    workerRef.current = worker;
    return worker;
  }, [invalidate, processItem]);

  const retryFailed = useCallback(() => {
    setQueue((prev) => {
      const next = prev.map((item) =>
        item.phase === "error"
          ? {
              ...item,
              phase: "queued" as const,
              progress: 0,
              bytesLoaded: 0,
              error: undefined,
              completedAt: null,
            }
          : item,
      );
      queueRef.current = next;
      return next;
    });
    void ensureWorker();
  }, [ensureWorker]);

  const startIngest = useCallback(
    async (files: FileList | File[]) => {
      const images = [...files].filter((f) => isImageFile(f));
      if (!images.length) {
        setError("Image files only.");
        return;
      }

      if (config.enabled && config.required && !user) {
        setError("Sign in with Microsoft to upload photos.");
        return;
      }

      setError(null);
      const items = images.map(createQueueItem);

      if (uploading) {
        setQueue((prev) => {
          const next = [...prev, ...items];
          queueRef.current = next;
          return next;
        });
        if (!batchId) {
          setBatchId(createBatchId());
          setSessionStartedAt(Date.now());
        }
      } else {
        revokeQueue(queueRef.current.filter((item) => item.phase === "done"));
        setBatchId(createBatchId());
        setSessionStartedAt(Date.now());
        setQueue((prev) => {
          const keep = prev.filter((item) => item.phase !== "done");
          const next = [...keep, ...items];
          queueRef.current = next;
          return next;
        });
      }

      for (const item of items) {
        await persistItem(item, batchIdRef.current ?? createBatchId());
      }

      await ensureWorker();
    },
    [batchId, config.enabled, config.required, ensureWorker, uploading, user],
  );

  useEffect(() => {
    if (restored) return;
    let cancelled = false;

    void loadPersistedItems().then(async (records) => {
      if (cancelled || !records.length) {
        setRestored(true);
        return;
      }

      const items: UploadQueueItem[] = records.map((record) => ({
        id: record.id,
        file: new File([record.blob], record.fileName, {
          type: record.blob.type || "image/jpeg",
          lastModified: record.updatedAt,
        }),
        preparedFile: new File([record.blob], record.fileName, {
          type: record.blob.type || "image/jpeg",
          lastModified: record.updatedAt,
        }),
        previewUrl: URL.createObjectURL(record.blob),
        phase: "queued",
        progress: 0,
        bytesLoaded: 0,
        startedAt: null,
        completedAt: null,
        originalSize: record.originalSize,
        uploadSize: record.uploadSize,
        compressed: record.compressed,
        clientMeta: record.meta,
        retryCount: record.retryCount,
        sessionId: record.sessionId,
        chunksCompleted: record.chunksCompleted,
      }));

      const restoredBatch = records[0]?.batchId ?? createBatchId();
      setBatchId(restoredBatch);
      setSessionStartedAt(records[0]?.updatedAt ?? Date.now());
      setQueue(items);
      queueRef.current = items;
      setRestored(true);
      await ensureWorker();
    });

    return () => {
      cancelled = true;
    };
  }, [ensureWorker, restored]);

  useEffect(() => {
    const onOnline = () => {
      const hasWork = queueRef.current.some(
        (item) => item.phase === "queued" || item.phase === "error",
      );
      if (hasWork && !workerRef.current) {
        retryFailed();
      }
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [retryFailed]);

  const clearError = useCallback(() => setError(null), []);

  const { overallPercent, doneCount, totalCount } = useMemo(() => {
    const totalBytes = queue.reduce((sum, item) => sum + (item.uploadSize ?? item.file.size), 0);
    const uploadedBytes = queue.reduce((sum, item) => {
      const size = item.uploadSize ?? item.file.size;
      if (item.phase === "done") return sum + size;
      if (item.phase === "uplink" || item.phase === "processing" || item.phase === "retrying") {
        return sum + item.bytesLoaded;
      }
      return sum;
    }, 0);
    return {
      overallPercent: totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0,
      doneCount: queue.filter((i) => i.phase === "done").length,
      totalCount: queue.length,
    };
  }, [queue]);

  const value = useMemo(
    () => ({
      queue,
      batchId,
      sessionStartedAt,
      uploading,
      error,
      overallPercent,
      doneCount,
      totalCount,
      startIngest,
      clearError,
      retryFailed,
    }),
    [
      queue,
      batchId,
      sessionStartedAt,
      uploading,
      error,
      overallPercent,
      doneCount,
      totalCount,
      startIngest,
      clearError,
      retryFailed,
    ],
  );

  return <IngestContext.Provider value={value}>{children}</IngestContext.Provider>;
}

export function useIngest() {
  const ctx = useContext(IngestContext);
  if (!ctx) {
    throw new Error("useIngest must be used within IngestProvider");
  }
  return ctx;
}