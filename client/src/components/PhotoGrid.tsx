import { motion } from "framer-motion";
import { MapPin, Trash2 } from "lucide-react";
import type { Photo } from "../types";
import { formatCoords, formatDate } from "../lib/format";

interface PhotoGridProps {
  photos: Photo[];
  onDelete?: (id: string) => void;
  emptyMessage?: string;
}

export function PhotoGrid({ photos, onDelete, emptyMessage = "No photos yet" }: PhotoGridProps) {
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
          <div className="relative aspect-square overflow-hidden bg-stone-100">
            <img
              src={photo.url}
              alt={photo.originalName}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
            {onDelete && (
              <button
                onClick={() => onDelete(photo.id)}
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
            {photo.siteName ? (
              <p className="inline-flex items-center gap-1 text-orange-700">
                <MapPin size={12} />
                {photo.siteName}
              </p>
            ) : (
              <p className="text-stone-400">Unassigned</p>
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