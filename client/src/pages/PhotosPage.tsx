import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { DeploymentRecommendationPanel } from "../components/DeploymentRecommendationPanel";
import { PageHeader } from "../components/PageHeader";
import { PhotoGrid } from "../components/PhotoGrid";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { TechStatusChip } from "../components/TechMeta";
import { useLiveData, useLivePoll } from "../lib/LiveDataContext";
import { deletePhoto, getPhotos, rematchAllPhotos } from "../lib/api";
import type { Photo } from "../types";

type Filter = "all" | "unassigned";

export function PhotosPage() {
  const { invalidate } = useLiveData();
  const [filter, setFilter] = useState<Filter>("all");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rematching, setRematching] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    getPhotos(filter === "unassigned" ? { unassigned: true } : undefined)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [filter]);

  useLivePoll(load, [filter]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Asset archive"
        title="Photo library"
        description="Every field capture across all client deployments. Masonry layout · tap to enter cinematic viewer · auto-refreshes live."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TechStatusChip code="VIEW" label="masonry" tone="muted" />
            <TechStatusChip code="LIVE" label="polling" tone="emerald" />
            <TechStatusChip code="CNT" label={`${photos.length} loaded`} tone="cyan" />
            <div className="neu-inset flex gap-1 rounded-xl p-1">
              {(["all", "unassigned"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`rounded-lg px-4 py-2 font-mono text-xs font-medium uppercase tracking-wider transition ${
                    filter === value
                      ? "neu-raised-sm text-cyan-300/95"
                      : "text-white/38 hover:text-white/68"
                  }`}
                >
                  {value === "all" ? "All assets" : "Queued"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {filter === "unassigned" && photos.length > 0 && (
        <DeploymentRecommendationPanel
          photos={photos.map((photo) => ({
            ...photo,
            matchStatus: photo.lat != null ? "queued" : "no_fix",
          }))}
          title="Queued assets need a deployment"
        />
      )}

      <motion.div
        key={filter}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <PhotoGrid
          photos={photos}
          layout="masonry"
          onPhotoClick={(_photo, index) => setLightboxIndex(index)}
          onDelete={async (photoId) => {
            await deletePhoto(photoId);
            setLightboxIndex(null);
            invalidate();
            load();
          }}
          emptyMessage={
            filter === "unassigned"
              ? "Queue empty — all assets routed to deployments."
              : "No assets yet. Head to Ingest to capture field photos."
          }
        />
      </motion.div>

      {lightboxIndex != null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}

      {filter === "unassigned" && photos.length > 0 && (
        <p className="font-mono text-xs text-white/35">
          Strict match ~100 m; soft match to nearest site when isolated (~1 mi cushion). Rescan on sync.{" "}
          <button
            className="inline-flex items-center gap-1 text-cyan-400 transition hover:text-cyan-300 disabled:opacity-50"
            disabled={rematching}
            onClick={async () => {
              setRematching(true);
              try {
                const result = await rematchAllPhotos();
                if (result.matched > 0) {
                  window.alert(`${result.matched} asset${result.matched === 1 ? "" : "s"} routed.`);
                }
                load();
              } finally {
                setRematching(false);
              }
            }}
          >
            <RefreshCw size={12} className={rematching ? "animate-spin" : ""} />
            {rematching ? "Scanning…" : "Force rescan"}
          </button>
        </p>
      )}
    </div>
  );
}