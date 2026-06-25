import { motion } from "framer-motion";
import { MapPin, Trash2 } from "lucide-react";
import type { Photo } from "../types";
import { formatCoords, formatDate } from "../lib/format";

interface PhotoGridProps {
  photos: Photo[];
  onDelete?: (id: string) => void;
  onPhotoClick?: (photo: Photo, index: number) => void;
  showSiteLabel?: boolean;
  emptyMessage?: string;
}

export function PhotoGrid({
  photos,
  onDelete,
  onPhotoClick,
  showSiteLabel = true,
  emptyMessage = "No photos yet",
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="glass rounded-3xl px-6 py-16 text-center text-stone-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {photos.map((photo, index) => (
        <motion.article
          key={photo.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03 }}
          className="glass group overflow-hidden rounded-2xl"
        >
          <div
            className={`relative aspect-square overflow-hidden bg-stone-100 ${onPhotoClick ? "cursor-zoom-in" : ""}`}
            onClick={() => onPhotoClick?.(photo, index)}
            onKeyDown={(event) => {
              if (onPhotoClick && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onPhotoClick(photo, index);
              }
            }}
            role={onPhotoClick ? "button" : undefined}
            tabIndex={onPhotoClick ? 0 : undefined}
          >
            <img
              src={photo.url}
              alt={photo.originalName}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {onDelete && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(photo.id);
                }}
                className="absolute right-2 top-2 rounded-xl bg-black/55 p-2 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Delete photo"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="space-y-1 p-3 text-xs">
            <p className="truncate font-medium text-stone-800">{photo.originalName}</p>
            <p className="text-stone-500">{formatDate(photo.takenAt ?? photo.uploadedAt)}</p>
            {showSiteLabel && (
              photo.siteName ? (
                <p className="inline-flex items-center gap-1 text-orange-700">
                  <MapPin size={12} />
                  {photo.siteName}
                </p>
              ) : (
                <p className="text-stone-400">Unassigned</p>
              )
            )}
            {formatCoords(photo.lat, photo.lng) && (
              <p className="truncate text-stone-400">{formatCoords(photo.lat, photo.lng)}</p>
            )}
          </div>
        </motion.article>
      ))}
    </div>
  );
}