import { motion } from "framer-motion";
import { Camera, Loader2, Upload, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { TechMeta, TechMetaRow, TechStatusChip } from "../components/TechMeta";
import { UploadPipeline, type UploadQueueItem } from "../components/UploadPipeline";
import { getStats } from "../lib/api";
import { formatBytes } from "../lib/format";
import { createBatchId, uploadSinglePhoto } from "../lib/upload";
import type { Stats } from "../types";

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

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(0);
  const [uploading, setUploading] = useState(false);

  const refreshStats = useCallback(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    return () => {
      for (const item of queue) URL.revokeObjectURL(item.previewUrl);
    };
  }, [queue]);

  const updateItem = (id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleFiles = async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setError("Image files only.");
      return;
    }

    for (const item of queue) URL.revokeObjectURL(item.previewUrl);

    const newBatch = createBatchId();
    const items = images.map(createQueueItem);
    const started = Date.now();

    setBatchId(newBatch);
    setSessionStartedAt(started);
    setQueue(items);
    setUploading(true);
    setError(null);

    for (const item of items) {
      const uplinkStart = Date.now();
      updateItem(item.id, { phase: "uplink", startedAt: uplinkStart, progress: 0, bytesLoaded: 0 });

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
      } catch (err) {
        updateItem(item.id, {
          phase: "error",
          completedAt: Date.now(),
          error: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }

    setUploading(false);
    refreshStats();
  };

  const totalQueuedBytes = queue.reduce((s, i) => s + i.file.size, 0);
  const showPipeline = queue.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Asset ingest"
        title="Field capture"
        description="Drop install photos from the jobsite. Per-asset uplink telemetry, EXIF GPS extraction, and deployment routing in real time."
        action={
          <div className="flex flex-wrap gap-1.5">
            <TechStatusChip code="PIPE" label={uploading ? "ACTIVE" : "IDLE"} tone={uploading ? "cyan" : "muted"} />
            <TechStatusChip code="MAX" label="30MB/asset" tone="muted" />
            <TechStatusChip code="FMT" label="JPEG·PNG·HEIC" tone="muted" />
          </div>
        }
      />

      {stats && <StatCards stats={stats} />}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`panel panel-interactive window relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center sm:p-12 ${
          dragOver ? "border-cyan-400/40" : "border-white/[0.08]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-violet-500/5" />

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="neu-raised-sm relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl">
          {uploading ? (
            <Loader2 size={32} className="animate-spin text-cyan-300" />
          ) : (
            <Camera size={32} className="text-cyan-300" />
          )}
        </div>

        <h3 className="font-display relative mt-6 text-2xl font-bold text-white sm:text-3xl">
          {dragOver ? "Release to ingest" : uploading ? "Ingest in progress…" : "Ingest field photos"}
        </h3>
        <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/45">
          Rack shots, cable runs, display mounts, rack elevations — sequential uplink with live segment
          telemetry per asset.
        </p>

        <div className="relative mx-auto mt-5 max-w-md">
          <TechMetaRow>
            <TechMeta label="Protocol" value="HTTP POST" accent="muted" />
            <TechMeta label="Encoder" value="multipart" accent="muted" />
            <TechMeta label="Pipeline" value="EXIF→GPS→RT" accent="cyan" />
            <TechMeta label="Concurrency" value="1× sequential" accent="muted" />
          </TechMetaRow>
        </div>

        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm disabled:opacity-50"
          >
            <Upload size={16} />
            Select files
          </button>
          <button
            onClick={() => {
              inputRef.current?.setAttribute("capture", "environment");
              inputRef.current?.click();
            }}
            disabled={uploading}
            className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm disabled:opacity-50"
          >
            <Zap size={16} />
            Capture now
          </button>
        </div>

        {showPipeline && !uploading && (
          <p className="relative mt-4 font-mono text-[10px] text-white/30">
            Last batch · {queue.length} files · {formatBytes(totalQueuedBytes)}
          </p>
        )}
      </motion.section>

      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-3 font-mono text-sm text-rose-300 ring-1 ring-rose-400/25">
          {error}
        </div>
      )}

      {showPipeline && batchId && (
        <UploadPipeline
          batchId={batchId}
          items={queue}
          sessionStartedAt={sessionStartedAt}
          active={uploading}
        />
      )}
    </div>
  );
}