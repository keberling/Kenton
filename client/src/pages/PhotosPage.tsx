import { motion } from "framer-motion";
import { ArrowRight, Radio } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { RescanMatchesButton } from "../components/RescanMatchesButton";
import { PhotoGrid } from "../components/PhotoGrid";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { TechStatusChip } from "../components/TechMeta";
import { useLiveData, useLivePoll } from "../lib/LiveDataContext";
import { deletePhoto, getPhotos, getSites } from "../lib/api";
import type { Photo, Site } from "../types";

export function PhotosPage() {
  const { stats, invalidate } = useLiveData();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([getPhotos(), getSites()])
      .then(([nextPhotos, nextSites]) => {
        setPhotos(nextPhotos);
        setSites(nextSites);
      })
      .catch(() => {
        setPhotos([]);
        setSites([]);
      });
  }, []);

  useLivePoll(load, []);

  const handlePhotoUpdated = (updated: Photo) => {
    setPhotos((prev) => prev.map((photo) => (photo.id === updated.id ? updated : photo)));
    invalidate();
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Asset archive"
        title="Photo library"
        description="Every field capture across all client deployments. Open any asset to fix a bad route — reassign, send back to the match queue, or retry auto-matching."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TechStatusChip code="VIEW" label="masonry" tone="muted" />
            <TechStatusChip code="LIVE" label="polling" tone="emerald" />
            <TechStatusChip code="CNT" label={`${photos.length} loaded`} tone="cyan" />
            <RescanMatchesButton
              variant="ghost"
              compact
              onMessage={() => {
                invalidate();
                load();
              }}
            />
            {(stats?.unassignedPhotos ?? 0) > 0 && (
              <Link
                to="/match"
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
              >
                <Radio size={14} />
                {stats?.unassignedPhotos} in match queue
                <ArrowRight size={14} />
              </Link>
            )}
          </div>
        }
      />

      {(stats?.unassignedPhotos ?? 0) > 0 && (
        <Link
          to="/match"
          className="panel window flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition hover:ring-1 hover:ring-amber-400/25"
        >
          <div>
            <p className="hud-label text-amber-300/80">Routing attention</p>
            <p className="mt-1 text-sm text-white/55">
              {stats?.unassignedPhotos} asset{(stats?.unassignedPhotos ?? 0) === 1 ? "" : "s"} still
              need a deployment — retry auto-match or assign manually.
            </p>
          </div>
          <span className="btn-ghost shrink-0 rounded-xl px-4 py-2 text-sm">Open match queue</span>
        </Link>
      )}

      <motion.div
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
          emptyMessage="No assets yet. Head to Ingest to capture field photos."
        />
      </motion.div>

      {lightboxIndex != null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          sites={sites}
          showMatchActions
          onPhotoUpdated={handlePhotoUpdated}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}
    </div>
  );
}