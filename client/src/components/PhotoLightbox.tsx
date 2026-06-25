import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Satellite, X } from "lucide-react";
import { useCallback, useEffect } from "react";
import type { Photo } from "../types";
import { formatCoords, formatDate } from "../lib/format";

interface PhotoLightboxProps {
  photos: Photo[];
  index: number;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}

export function PhotoLightbox({ photos, index, onClose, onChangeIndex }: PhotoLightboxProps) {
  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onChangeIndex(index - 1);
  }, [hasPrev, index, onChangeIndex]);

  const goNext = useCallback(() => {
    if (hasNext) onChangeIndex(index + 1);
  }, [hasNext, index, onChangeIndex]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPrev();
      if (event.key === "ArrowRight") goNext();
    };

    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [goNext, goPrev, onClose]);

  if (!photo) return null;

  const progress = ((index + 1) / photos.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-[#05060a]/98 backdrop-blur-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Asset viewer"
      >
        {/* Blurred backdrop */}
        <div
          className="pointer-events-none absolute inset-0 scale-110 opacity-30 blur-3xl"
          style={{ backgroundImage: `url(${photo.url})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />

        {/* Progress bar */}
        <div className="relative h-0.5 w-full bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-400 to-violet-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Top bar */}
        <div className="relative flex items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="hud-label text-cyan-400/70">Asset viewer</p>
            <p className="font-mono text-sm text-white/60">
              {String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost rounded-xl p-2.5"
            aria-label="Close viewer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main stage */}
        <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 sm:px-20">
            {hasPrev && (
              <button
                onClick={goPrev}
                className="btn-ghost absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 sm:left-4"
                aria-label="Previous"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <motion.img
              key={photo.id}
              src={photo.url}
              alt={photo.originalName}
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="max-h-[calc(100dvh-14rem)] max-w-full rounded-xl object-contain lg:max-h-[calc(100dvh-11rem)]"
            style={{
              boxShadow:
                "12px 14px 32px -8px rgba(0,0,0,0.7), -6px -6px 20px -8px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) goNext();
                else if (info.offset.x > 80) goPrev();
              }}
            />

            {hasNext && (
              <button
                onClick={goNext}
                className="btn-ghost absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 sm:right-4"
                aria-label="Next"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Metadata panel */}
          <aside className="panel window m-4 mt-0 shrink-0 rounded-2xl p-4 lg:m-6 lg:mt-0 lg:w-72">
            <p className="hud-label">Metadata</p>
            <h3 className="mt-2 truncate font-display text-lg font-semibold text-white">{photo.originalName}</h3>
            <dl className="mt-4 space-y-3 font-mono text-xs">
              <div>
                <dt className="text-white/35">CAPTURED</dt>
                <dd className="mt-0.5 text-white/80">{formatDate(photo.takenAt ?? photo.uploadedAt)}</dd>
              </div>
              {photo.siteName && (
                <div>
                  <dt className="text-white/35">DEPLOYMENT</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1.5 text-violet-300">
                    <MapPin size={12} />
                    {photo.siteName}
                  </dd>
                </div>
              )}
              {formatCoords(photo.lat, photo.lng) ? (
                <div>
                  <dt className="text-white/35">COORDINATES</dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1.5 text-cyan-300">
                    <Satellite size={12} />
                    {formatCoords(photo.lat, photo.lng)}
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="text-white/35">COORDINATES</dt>
                  <dd className="mt-0.5 text-amber-400/80">NO GPS EMBEDDED</dd>
                </div>
              )}
              {photo.width && photo.height && (
                <div>
                  <dt className="text-white/35">RESOLUTION</dt>
                  <dd className="mt-0.5 text-white/80">
                    {photo.width} × {photo.height}
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>

        {/* Filmstrip */}
        <div className="relative border-t border-white/5 bg-black/40 px-4 py-3 sm:px-6">
          <div className="filmstrip flex gap-2 overflow-x-auto pb-1">
            {photos.map((thumb, thumbIndex) => (
              <button
                key={thumb.id}
                onClick={() => onChangeIndex(thumbIndex)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg transition ${
                  thumbIndex === index
                    ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-[#05060a]"
                    : "opacity-50 hover:opacity-90"
                }`}
              >
                <img src={thumb.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}