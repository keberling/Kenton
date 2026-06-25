import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, Satellite } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DeploymentRecommendationPanel } from "../components/DeploymentRecommendationPanel";
import { PageHeader } from "../components/PageHeader";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { PhotoMatchActions } from "../components/PhotoMatchActions";
import { TechMeta, TechMetaRow, TechStatusChip } from "../components/TechMeta";
import { useLiveData, useLivePoll } from "../lib/LiveDataContext";
import { getPhotos, getSites, rematchAllPhotos } from "../lib/api";
import { formatCoords, formatDate, mapsUrl } from "../lib/format";
import type { Photo, Site } from "../types";

export function MatchQueuePage() {
  const { invalidate } = useLiveData();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [rematching, setRematching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const withGps = useMemo(
    () => photos.filter((photo) => photo.lat != null && photo.lng != null),
    [photos],
  );
  const noGps = useMemo(
    () => photos.filter((photo) => photo.lat == null || photo.lng == null),
    [photos],
  );

  const handlePhotoUpdated = (updated: Photo) => {
    if (updated.siteId) {
      setPhotos((prev) => prev.filter((photo) => photo.id !== updated.id));
      setLightboxIndex(null);
      setMessage(
        updated.siteName
          ? `Routed to ${updated.siteName}.`
          : "Asset routed to deployment.",
      );
    } else {
      setPhotos((prev) =>
        prev.map((photo) => (photo.id === updated.id ? updated : photo)),
      );
    }
    invalidate();
  };

  const handleRematchAll = async () => {
    setRematching(true);
    setMessage(null);
    try {
      const result = await rematchAllPhotos();
      if (result.matched > 0) {
        setMessage(
          `Auto-matched ${result.matched} asset${result.matched === 1 ? "" : "s"}.`,
        );
      } else {
        setMessage("No new auto-matches — try manual assignment or register a deployment.");
      }
      load();
      invalidate();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setRematching(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Routing ops"
        title="Match queue"
        description="Unassigned field assets land here. Retry GPS auto-matching, pick the right deployment manually, or register a new site when captures cluster somewhere new."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <TechStatusChip
              code="QUE"
              label={`${photos.length} waiting`}
              tone={photos.length > 0 ? "amber" : "emerald"}
            />
            <TechStatusChip code="GPS" label={`${withGps.length} fix`} tone="cyan" />
            <button
              type="button"
              disabled={rematching || withGps.length === 0}
              onClick={() => void handleRematchAll()}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
            >
              <RefreshCw size={14} className={rematching ? "animate-spin" : ""} />
              {rematching ? "Scanning…" : "Retry all auto-match"}
            </button>
          </div>
        }
      />

      <section className="panel window rounded-2xl px-5 py-4">
        <p className="hud-label text-cyan-400/70">Workflow</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            {
              step: "01",
              title: "Retry auto-match",
              body: "Strict ~100 m, soft to nearest site within ~2 mi when isolated (~1 mi cushion).",
            },
            {
              step: "02",
              title: "Assign manually",
              body: "Pick the deployment from the dropdown — distances sort by GPS.",
            },
            {
              step: "03",
              title: "Fix bad routes",
              body: (
                <>
                  Open any routed asset in{" "}
                  <Link to="/photos" className="text-cyan-400 hover:text-cyan-300">
                    Archive
                  </Link>{" "}
                  to reassign or send back to this queue.
                </>
              ),
            },
          ].map((item) => (
            <div key={item.step} className="neu-inset rounded-xl px-4 py-3">
              <p className="font-mono text-[10px] text-white/30">{item.step}</p>
              <p className="mt-1 text-sm font-medium text-white/85">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/40">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {message && (
        <div className="rounded-xl bg-cyan-500/10 px-4 py-3 font-mono text-sm text-cyan-200 ring-1 ring-cyan-400/20">
          {message}
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
      ) : (
        <>
          {withGps.length > 0 && (
            <DeploymentRecommendationPanel
              photos={withGps.map((photo) => ({ ...photo, matchStatus: "queued" as const }))}
              title="Register a deployment for clustered captures"
              onCreated={() => {
                load();
                invalidate();
              }}
            />
          )}

          {withGps.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="hud-label text-amber-300/80">
                  GPS assets · {withGps.length}
                </h3>
              </div>
              <div className="space-y-3">
                {withGps.map((photo, index) => (
                  <motion.article
                    key={photo.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="panel window rounded-2xl p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
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
                        <div>
                          <p className="truncate font-medium text-white">{photo.originalName}</p>
                          <div className="mt-2">
                            <TechMetaRow>
                            <TechMeta
                              label="Captured"
                              value={formatDate(photo.takenAt ?? photo.uploadedAt)}
                              accent="muted"
                            />
                            {formatCoords(photo.lat, photo.lng) && (
                              <TechMeta
                                label="Fix"
                                value={formatCoords(photo.lat, photo.lng)!}
                                accent="cyan"
                              />
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
          )}

          {noGps.length > 0 && (
            <section className="space-y-3">
              <h3 className="hud-label text-rose-300/80">No GPS · {noGps.length}</h3>
              <p className="font-mono text-xs text-white/35">
                These need manual deployment assignment or a registered client address for future
                captures.
              </p>
              <div className="space-y-3">
                {noGps.map((photo, index) => (
                  <motion.article
                    key={photo.id}
                    layout
                    className="panel window rounded-2xl p-3 sm:p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(withGps.length + index)}
                        className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl bg-black/50 sm:h-24 sm:w-32"
                      >
                        <img
                          src={photo.url}
                          alt={photo.originalName}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="truncate font-medium text-white">{photo.originalName}</p>
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
          )}
        </>
      )}

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