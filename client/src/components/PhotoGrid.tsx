import { motion } from "framer-motion";
import { Crosshair, Expand, MapPin, Satellite, Trash2 } from "lucide-react";
import type { Photo } from "../types";
import { formatCoords, formatDate, formatMimeShort, formatResolution, shortId } from "../lib/format";

interface PhotoGridProps {
  photos: Photo[];
  onDelete?: (id: string) => void;
  onPhotoClick?: (photo: Photo, index: number) => void;
  showSiteLabel?: boolean;
  layout?: "masonry" | "bento";
  emptyMessage?: string;
}

function photoAspectStyle(photo: Photo): { aspectRatio: string } {
  if (photo.width && photo.height && photo.width > 0) {
    return { aspectRatio: `${photo.width} / ${photo.height}` };
  }
  return { aspectRatio: "4 / 5" };
}

function bentoClass(index: number, total: number): string {
  if (index === 0 && total > 2) return "bento-featured";
  if (index % 7 === 3) return "bento-tall";
  if (index % 5 === 2) return "bento-wide";
  return "";
}

export function PhotoGrid({
  photos,
  onDelete,
  onPhotoClick,
  showSiteLabel = true,
  layout = "masonry",
  emptyMessage = "No assets in archive",
}: PhotoGridProps) {
  if (photos.length === 0) {
    return (
      <div className="panel flex flex-col items-center justify-center rounded-2xl px-6 py-24 text-center">
        <div className="neu-inset mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
          <Crosshair size={28} className="text-white/25" />
        </div>
        <p className="text-white/40">{emptyMessage}</p>
      </div>
    );
  }

  const containerClass = layout === "bento" ? "bento-grid" : "masonry";

  return (
    <div className={containerClass}>
      {photos.map((photo, index) => (
        <motion.article
          key={photo.id}
          initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.45 }}
          className={`panel panel-interactive photo-tile group relative ${
            layout === "masonry" ? "masonry-item" : bentoClass(index, photos.length)
          }`}
        >
          <div
            className={`relative w-full overflow-hidden bg-black/50 ${onPhotoClick ? "cursor-zoom-in" : ""}`}
            style={photoAspectStyle(photo)}
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
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.06]"
              loading="lazy"
            />

            {/* Gradient overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 transition duration-300 group-hover:opacity-100" />

            {/* HUD corner bracket */}
            <div className="pointer-events-none absolute left-3 top-3 h-5 w-5 border-l border-t border-cyan-400/50 opacity-0 transition group-hover:opacity-100" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-5 w-5 border-b border-r border-cyan-400/50 opacity-0 transition group-hover:opacity-100" />

            {/* Top badges */}
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {photo.lat != null && (
                <span className="glass-badge inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] text-emerald-300/90">
                  <Satellite size={10} />
                  GPS
                </span>
              )}
              {showSiteLabel && (
                photo.siteName ? (
                  <span className="glass-badge inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[10px] text-violet-200">
                    <MapPin size={10} />
                    {photo.siteName}
                  </span>
                ) : (
                  <span className="glass-badge rounded-md px-2 py-0.5 font-mono text-[10px] text-amber-200/90">
                    UNASSIGNED
                  </span>
                )
              )}
            </div>

            {/* Actions */}
            <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition group-hover:opacity-100">
              {onPhotoClick && (
                <span className="neu-raised-sm flex h-8 w-8 items-center justify-center rounded-lg text-white/80">
                  <Expand size={14} />
                </span>
              )}
              {onDelete && (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(photo.id);
                  }}
                  className="neu-raised-sm flex h-8 w-8 items-center justify-center rounded-lg text-rose-300 transition hover:text-rose-200"
                  aria-label="Delete photo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            {/* Bottom metadata HUD */}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <p className="truncate font-medium text-sm text-white">{photo.originalName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] text-white/45">
                <span>ID::{shortId(photo.id, 6)}</span>
                <span>{formatMimeShort(photo.mimeType)}</span>
                {formatResolution(photo.width, photo.height) && (
                  <span>{formatResolution(photo.width, photo.height)}</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-white/50">
                <span>{formatDate(photo.takenAt ?? photo.uploadedAt)}</span>
                {formatCoords(photo.lat, photo.lng) && (
                  <span className="text-cyan-400/70">{formatCoords(photo.lat, photo.lng)}</span>
                )}
              </div>
            </div>
          </div>
        </motion.article>
      ))}
    </div>
  );
}