import { motion } from "framer-motion";
import { Camera, CheckCircle2, Loader2, MapPin, Satellite, Upload, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { getStats, uploadPhotos } from "../lib/api";
import type { Photo, Stats } from "../types";

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [results, setResults] = useState<Photo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshStats = useCallback(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  const handleFiles = async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setError("Image files only.");
      return;
    }

    setUploading(true);
    setError(null);
    setResults([]);

    try {
      const { photos } = await uploadPhotos(images);
      setResults(photos);
      refreshStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Asset ingest"
        title="Field capture"
        description="Drop install photos from the jobsite. EXIF GPS auto-tags location — assets route to deployments when in range."
      />

      {stats && <StatCards stats={stats} />}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`panel relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12 ${
          dragOver
            ? "border-cyan-400/60 bg-cyan-400/5"
            : "border-white/10"
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

        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-cyan-400/30">
          {uploading ? (
            <Loader2 size={32} className="animate-spin text-cyan-300" />
          ) : (
            <Camera size={32} className="text-cyan-300" />
          )}
        </div>

        <h3 className="font-display relative mt-6 text-2xl font-bold text-white sm:text-3xl">
          {dragOver ? "Release to ingest" : "Ingest field photos"}
        </h3>
        <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/45">
          Rack shots, cable runs, display mounts, rack elevations — anything documenting the install.
          GPS metadata routes assets to the right client deployment automatically.
        </p>

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
      </motion.section>

      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-3 font-mono text-sm text-rose-300 ring-1 ring-rose-400/25">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <section className="panel rounded-2xl p-5">
          <p className="hud-label text-emerald-400/80">Ingest complete</p>
          <h3 className="font-display mt-1 text-xl font-semibold text-white">
            {results.length} asset{results.length === 1 ? "" : "s"} processed
          </h3>
          <ul className="mt-5 space-y-3">
            {results.map((photo, index) => (
              <motion.li
                key={photo.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 rounded-xl bg-black/30 p-3 ring-1 ring-white/5"
              >
                <img src={photo.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{photo.originalName}</p>
                  <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-white/40">
                    {photo.hasGps ? (
                      <>
                        <Satellite size={12} className="text-emerald-400" />
                        GPS lock acquired
                      </>
                    ) : (
                      "No GPS in EXIF"
                    )}
                  </p>
                  {photo.siteName ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-violet-300">
                      <MapPin size={14} />
                      Routed → {photo.siteName}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-white/35">Queued — awaiting deployment match</p>
                  )}
                </div>
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
              </motion.li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}