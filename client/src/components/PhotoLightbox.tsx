import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex flex-col bg-black/95"
        role="dialog"
        aria-modal="true"
        aria-label="Photo gallery"
      >
        <div className="flex items-center justify-between px-4 py-3 text-white">
          <p className="text-sm text-white/80">
            {index + 1} of {photos.length}
          </p>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close gallery"
          >
            <X size={22} />
          </button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 sm:px-20">
          {hasPrev && (
            <button
              onClick={goPrev}
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:left-4"
              aria-label="Previous photo"
            >
              <ChevronLeft size={24} />
            </button>
          )}

          <motion.img
            key={photo.id}
            src={photo.url}
            alt={photo.originalName}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="max-h-[calc(100dvh-10rem)] max-w-full object-contain"
          />

          {hasNext && (
            <button
              onClick={goNext}
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:right-4"
              aria-label="Next photo"
            >
              <ChevronRight size={24} />
            </button>
          )}
        </div>

        <div className="space-y-1 px-4 pb-6 pt-2 text-center text-sm text-white/80">
          <p className="font-medium text-white">{photo.originalName}</p>
          <p>{formatDate(photo.takenAt ?? photo.uploadedAt)}</p>
          {photo.siteName && <p>{photo.siteName}</p>}
          {formatCoords(photo.lat, photo.lng) && <p className="font-mono text-xs">{formatCoords(photo.lat, photo.lng)}</p>}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}