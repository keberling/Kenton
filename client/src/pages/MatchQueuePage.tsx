import { motion } from "framer-motion";
import { CheckCircle2, CheckSquare, Play, Satellite, Square, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DeploymentRecommendationPanel } from "../components/DeploymentRecommendationPanel";
import { RescanMatchesButton } from "../components/RescanMatchesButton";
import { PageHeader } from "../components/PageHeader";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { PhotoMatchActions } from "../components/PhotoMatchActions";
import { TechMeta, TechMetaRow, TechStatusChip } from "../components/TechMeta";
import { useLiveData, useLivePoll } from "../lib/LiveDataContext";
import { deletePhoto, getPhotos, getSites } from "../lib/api";
import { formatCoords, formatDate, mapsUrl } from "../lib/format";
import type { Photo, Site } from "../types";

type QueueFilter = "all" | "no-gps" | "has-gps";

function hasGps(photo: Photo): boolean {
  return photo.lat != null && photo.lng != null;
}

export function MatchQueuePage() {
  const { invalidate } = useLiveData();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("no-gps");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const load = useCallback(() => {
    Promise.all([getPhotos({ unassigned: true }), getSites()])
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

  const withGps = useMemo(() => photos.filter((photo) => hasGps(photo)), [photos]);
  const noGps = useMemo(() => photos.filter((photo) => !hasGps(photo)), [photos]);

  const filteredPhotos = useMemo(() => {
    if (filter === "no-gps") return noGps;
    if (filter === "has-gps") return withGps;
    return photos;
  }, [filter, noGps, photos, withGps]);

  const selectedCount = useMemo(
    () => filteredPhotos.filter((photo) => selectedIds.has(photo.id)).length,
    [filteredPhotos, selectedIds],
  );

  const clearSelection = () => setSelectedIds(new Set());

  const toggleSelected = (photoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredPhotos.map((photo) => photo.id)));
  };

  const adjustLightboxAfterDelete = (deletedId: string, remaining: Photo[]) => {
    if (lightboxIndex == null) return;
    const deletedIndex = filteredPhotos.findIndex((photo) => photo.id === deletedId);
    if (deletedIndex < 0) return;

    if (remaining.length === 0) {
      setLightboxIndex(null);
      return;
    }

    const nextIndex = Math.min(deletedIndex, remaining.length - 1);
    setLightboxIndex(nextIndex);
  };

  const handleDelete = async (photoId: string) => {
    setDeletingId(photoId);
    setError(null);
    try {
      await deletePhoto(photoId);
      const remaining = photos.filter((photo) => photo.id !== photoId);
      setPhotos(remaining);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
      adjustLightboxAfterDelete(
        photoId,
        filter === "all"
          ? remaining
          : filter === "no-gps"
            ? remaining.filter((photo) => !hasGps(photo))
            : remaining.filter((photo) => hasGps(photo)),
      );
      setMessage("Photo deleted.");
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = filteredPhotos.filter((photo) => selectedIds.has(photo.id)).map((photo) => photo.id);
    if (!ids.length) return;

    const label = ids.length === 1 ? "this photo" : `${ids.length} photos`;
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;

    setBulkDeleting(true);
    setError(null);
    try {
      const results = await Promise.allSettled(ids.map((id) => deletePhoto(id)));
      const succeededIds = new Set(
        ids.filter((_, index) => results[index].status === "fulfilled"),
      );
      const failed = ids.length - succeededIds.size;
      const deleted = succeededIds.size;
      const remaining = photos.filter((photo) => !succeededIds.has(photo.id));
      setPhotos(remaining);
      clearSelection();
      setLightboxIndex(null);
      setMessage(
        failed > 0
          ? `Deleted ${deleted} photo${deleted === 1 ? "" : "s"}. ${failed} failed.`
          : `Deleted ${deleted} photo${deleted === 1 ? "" : "s"}.`,
      );
      invalidate();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handlePhotoUpdated = (updated: Photo) => {
    if (updated.siteId) {
      setPhotos((prev) => prev.filter((photo) => photo.id !== updated.id));
      setLightboxIndex(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(updated.id);
        return next;
      });
      setMessage(
        updated.siteName ? `Routed to ${updated.siteName}.` : "Asset routed to deployment.",
      );
    } else {
      setPhotos((prev) => prev.map((photo) => (photo.id === updated.id ? updated : photo)));
    }
    invalidate();
  };

  const startReview = () => {
    if (!filteredPhotos.length) return;
    setLightboxIndex(0);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Routing ops"
        title="Match queue"
        description="Unassigned field assets land here. Review untagged photos, purge junk captures, retry auto-matching, or assign deployments manually."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TechStatusChip
              code="QUE"
              label={`${photos.length} waiting`}
              tone={photos.length > 0 ? "amber" : "emerald"}
            />
            <TechStatusChip code="GPS" label={`${withGps.length} fix`} tone="cyan" />
            <TechStatusChip code="NONE" label={`${noGps.length} no GPS`} tone="rose" />
            <RescanMatchesButton
              onMessage={(nextMessage) => {
                setMessage(nextMessage);
                load();
              }}
            />
          </div>
        }
      />

      {photos.length > 0 && (
        <section className="panel window rounded-2xl px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="hud-label text-rose-300/80">Purge untagged</p>
              <p className="mt-1 text-sm text-white/45">
                Step through unassigned photos and delete bad captures. Start with no-GPS junk, then
                assign or remove the rest.
              </p>
            </div>
            <button
              type="button"
              onClick={startReview}
              disabled={!filteredPhotos.length}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <Play size={14} />
              Review {filteredPhotos.length} shown
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(
              [
                ["no-gps", `No GPS (${noGps.length})`],
                ["has-gps", `Has GPS (${withGps.length})`],
                ["all", `All (${photos.length})`],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setFilter(value);
                  clearSelection();
                }}
                className={`rounded-full px-3 py-1.5 font-mono text-[11px] transition ${
                  filter === value
                    ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/30"
                    : "bg-white/5 text-white/45 hover:text-white/70"
                }`}
              >
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                setSelectMode((open) => !open);
                if (selectMode) clearSelection();
              }}
              className={`ml-auto rounded-full px-3 py-1.5 font-mono text-[11px] transition ${
                selectMode
                  ? "bg-violet-400/15 text-violet-200 ring-1 ring-violet-400/30"
                  : "bg-white/5 text-white/45 hover:text-white/70"
              }`}
            >
              {selectMode ? "Done selecting" : "Select multiple"}
            </button>
          </div>

          {selectMode && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
              >
                Select all {filteredPhotos.length}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedCount === 0}
                className="btn-ghost rounded-lg px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void handleBulkDelete()}
                disabled={selectedCount === 0 || bulkDeleting}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 disabled:opacity-40"
              >
                <Trash2 size={12} />
                {bulkDeleting ? "Deleting…" : `Delete ${selectedCount} selected`}
              </button>
            </div>
          )}
        </section>
      )}

      {message && (
        <div className="rounded-xl bg-cyan-500/10 px-4 py-3 font-mono text-sm text-cyan-200 ring-1 ring-cyan-400/20">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-3 font-mono text-sm text-rose-300 ring-1 ring-rose-400/20">
          {error}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center rounded-2xl px-6 py-20 text-center">
          <CheckCircle2 size={36} className="text-emerald-400/80" />
          <h3 className="font-display mt-4 text-2xl font-bold text-white">Queue clear</h3>
          <p className="mt-2 max-w-md text-sm text-white/45">
            Every asset is routed to a deployment. New uploads without a match will appear here
            automatically.
          </p>
          <Link to="/photos" className="btn-ghost mt-6 rounded-xl px-5 py-2.5 text-sm">
            Browse archive
          </Link>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="panel rounded-2xl px-6 py-16 text-center text-white/40">
          No photos in this filter.
        </div>
      ) : (
        <>
          {filter !== "no-gps" && withGps.length > 0 && (
            <DeploymentRecommendationPanel
              photos={withGps.map((photo) => ({ ...photo, matchStatus: "queued" as const }))}
              title="Register a deployment for clustered captures"
              onCreated={() => {
                load();
                invalidate();
              }}
            />
          )}

          <section className="space-y-3">
            <h3 className="hud-label text-amber-300/80">
              {filter === "no-gps"
                ? `Untagged · no GPS · ${filteredPhotos.length}`
                : filter === "has-gps"
                  ? `Untagged · has GPS · ${filteredPhotos.length}`
                  : `Untagged · all · ${filteredPhotos.length}`}
            </h3>

            <div className="space-y-3">
              {filteredPhotos.map((photo, index) => (
                <motion.article
                  key={photo.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="panel window rounded-2xl p-3 sm:p-4"
                >
                  <div className="flex flex-col gap-4 sm:flex-row">
                    {selectMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelected(photo.id)}
                        className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-lg bg-white/5 text-white/50 hover:text-white"
                        aria-label={selectedIds.has(photo.id) ? "Deselect photo" : "Select photo"}
                      >
                        {selectedIds.has(photo.id) ? (
                          <CheckSquare size={18} className="text-cyan-300" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-black/50 sm:h-24 sm:w-32"
                    >
                      <img
                        src={photo.url}
                        alt={photo.originalName}
                        className="h-full w-full object-cover"
                      />
                    </button>

                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">{photo.originalName}</p>
                          <div className="mt-2">
                            <TechMetaRow>
                              <TechMeta
                                label="Captured"
                                value={formatDate(photo.takenAt ?? photo.uploadedAt)}
                                accent="muted"
                              />
                              {formatCoords(photo.lat, photo.lng) ? (
                                <TechMeta
                                  label="Fix"
                                  value={formatCoords(photo.lat, photo.lng)!}
                                  accent="cyan"
                                />
                              ) : (
                                <TechMeta label="Fix" value="NO GPS" accent="rose" />
                              )}
                            </TechMetaRow>
                          </div>
                          {photo.lat != null && photo.lng != null && (
                            <a
                              href={mapsUrl(photo.lat, photo.lng)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-cyan-400/80 hover:text-cyan-300"
                            >
                              <Satellite size={10} />
                              Open capture on map
                            </a>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleDelete(photo.id)}
                          disabled={deletingId === photo.id || bulkDeleting}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          {deletingId === photo.id ? "Deleting…" : "Delete"}
                        </button>
                      </div>

                      <PhotoMatchActions
                        photo={photo}
                        sites={sites}
                        onUpdated={handlePhotoUpdated}
                        compact
                      />
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </section>
        </>
      )}

      {lightboxIndex != null && (
        <PhotoLightbox
          photos={filteredPhotos}
          index={lightboxIndex}
          sites={sites}
          showMatchActions
          onPhotoUpdated={handlePhotoUpdated}
          onDelete={handleDelete}
          deleting={deletingId != null}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}
    </div>
  );
}