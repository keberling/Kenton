import { motion } from "framer-motion";
import { Camera, CheckCircle2, Loader2, MapPin, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
      setError("Please choose image files only.");
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
    <div className="space-y-6">
      {stats && <StatCards stats={stats} />}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass rounded-3xl border-2 border-dashed p-8 text-center transition ${
          dragOver ? "border-orange-400 bg-orange-50/60" : "border-stone-200"
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

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-100 text-orange-600">
          {uploading ? <Loader2 size={28} className="animate-spin" /> : <Camera size={28} />}
        </div>

        <h2 className="font-display mt-5 text-2xl font-semibold text-stone-900">
          Upload field photos
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-stone-500">
          Drop photos here or tap to capture. GPS from your phone tags the location automatically.
          Photos land in the general pool until a nearby job site is added.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-stone-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            <Upload size={16} />
            Choose photos
          </button>
          <button
            onClick={() => {
              inputRef.current?.setAttribute("capture", "environment");
              inputRef.current?.click();
            }}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-orange-400 disabled:opacity-50"
          >
            <Camera size={16} />
            Take photo
          </button>
        </div>
      </motion.section>

      {error && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {results.length > 0 && (
        <section className="glass rounded-3xl p-5">
          <h3 className="font-display text-lg font-semibold text-stone-900">Uploaded</h3>
          <ul className="mt-4 space-y-3">
            {results.map((photo) => (
              <li
                key={photo.id}
                className="flex items-start gap-3 rounded-2xl bg-stone-50 px-4 py-3 text-sm"
              >
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-stone-800">{photo.originalName}</p>
                  <p className="mt-1 text-stone-500">
                    {photo.hasGps ? "GPS found in photo" : "No GPS data in this photo"}
                  </p>
                  {photo.siteName ? (
                    <p className="mt-1 inline-flex items-center gap-1 text-orange-700">
                      <MapPin size={14} />
                      Auto-tagged to {photo.siteName}
                    </p>
                  ) : (
                    <p className="mt-1 text-stone-400">
                      Added to general pool — will auto-tag when a nearby site is created
                    </p>
                  )}
                </div>
                <img src={photo.url} alt="" className="h-14 w-14 rounded-xl object-cover" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}