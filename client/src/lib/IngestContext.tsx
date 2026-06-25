import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { UploadQueueItem } from "../components/UploadPipeline";
import { createBatchId, uploadSinglePhoto } from "./upload";
import { useAuth } from "./AuthContext";
import { useLiveData } from "./LiveDataContext";

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
  };
}

function revokeQueue(items: UploadQueueItem[]) {
  for (const item of items) URL.revokeObjectURL(item.previewUrl);
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

  const queueRef = useRef(queue);
  queueRef.current = queue;
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
      const uplinkStart = Date.now();
      updateItem(item.id, {
        phase: "uplink",
        startedAt: uplinkStart,
        progress: 0,
        bytesLoaded: 0,
      });

      try {
        const photo = await uploadSinglePhoto(item.file, (progress) => {
          updateItem(item.id, {
            progress: progress.percent,
            bytesLoaded: progress.loaded,
          });
        });

        updateItem(item.id, { phase: "processing", progress: 100, bytesLoaded: item.file.size });
        await new Promise((r) => setTimeout(r, 120));

        updateItem(item.id, {
          phase: "done",
          progress: 100,
          bytesLoaded: item.file.size,
          completedAt: Date.now(),
          result: photo,
        });
        invalidate();
      } catch (err) {
        updateItem(item.id, {
          phase: "error",
          completedAt: Date.now(),
          error: err instanceof Error ? err.message : "Upload failed",
        });
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

  const startIngest = useCallback(
    async (files: FileList | File[]) => {
      const images = [...files].filter((f) => f.type.startsWith("image/"));
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
        revokeQueue(queueRef.current);
        setBatchId(createBatchId());
        setSessionStartedAt(Date.now());
        setQueue(items);
        queueRef.current = items;
      }

      await ensureWorker();
    },
    [batchId, config.enabled, config.required, ensureWorker, uploading, user],
  );

  const clearError = useCallback(() => setError(null), []);

  const { overallPercent, doneCount, totalCount } = useMemo(() => {
    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    const uploadedBytes = queue.reduce((sum, item) => {
      if (item.phase === "done") return sum + item.file.size;
      if (item.phase === "uplink" || item.phase === "processing") return sum + item.bytesLoaded;
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