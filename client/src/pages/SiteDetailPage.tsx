import { motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Images, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PhotoGrid } from "../components/PhotoGrid";
import { PhotoLightbox } from "../components/PhotoLightbox";
import { SiteGeocodeInfo } from "../components/SiteGeocodeInfo";
import { deletePhoto, getPhotos, getSite, regeocodeSite } from "../lib/api";
import type { Photo, Site } from "../types";

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getSite(id), getPhotos({ siteId: id })])
      .then(([nextSite, nextPhotos]) => {
        setSite(nextSite);
        setPhotos(nextPhotos);
      })
      .catch(() => {
        setSite(null);
        setPhotos([]);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="panel flex items-center justify-center rounded-2xl px-6 py-32">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
          <p className="mt-4 font-mono text-sm text-white/40">Loading deployment gallery…</p>
        </div>
      </div>
    );
  }

  if (!site) {
    return (
      <div className="panel rounded-2xl px-6 py-24 text-center text-white/40">
        Deployment not found.
      </div>
    );
  }

  const heroPhoto = photos[0];

  return (
    <div className="space-y-8">
      <Link
        to="/sites"
        className="inline-flex items-center gap-2 font-mono text-xs text-white/40 transition hover:text-cyan-300"
      >
        <ArrowLeft size={14} />
        BACK TO DEPLOYMENTS
      </Link>

      {/* Cinematic hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel relative overflow-hidden rounded-2xl"
      >
        {heroPhoto && (
          <>
            <img
              src={heroPhoto.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07080d] via-[#07080d]/85 to-[#07080d]/60" />
          </>
        )}

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="hud-label text-violet-400/80">Client deployment</p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                {site.name}
              </h2>
              <p className="mt-2 max-w-xl text-white/50">{site.address}</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1.5 font-mono text-xs text-cyan-300 ring-1 ring-cyan-400/25">
                  <Images size={14} />
                  {photos.length} ASSET{photos.length === 1 ? "" : "S"}
                </span>
                {site.lat != null && (
                  <span className="status-dot status-dot-live" title="Geocoded" />
                )}
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  const result = await regeocodeSite(site.id);
                  setMessage(`Fix updated via ${result.geocodeSource}. ${result.matchedPhotos} assets matched.`);
                  load();
                } catch {
                  setMessage("Geocode failed.");
                }
              }}
              className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
            >
              <RefreshCw size={14} />
              Refresh fix
            </button>
          </div>
          {message && <p className="mt-4 font-mono text-sm text-emerald-400">{message}</p>}

          <button
            onClick={() => setShowDetails((open) => !open)}
            className="mt-5 inline-flex items-center gap-2 font-mono text-xs text-white/40 transition hover:text-white/70"
          >
            <ChevronDown size={14} className={`transition ${showDetails ? "rotate-180" : ""}`} />
            {showDetails ? "Hide telemetry" : "Show telemetry"}
          </button>
          {showDetails && <SiteGeocodeInfo site={site} detailed />}
        </div>
      </motion.section>

      {/* Bento gallery */}
      <section className="space-y-4">
        <div>
          <p className="hud-label">Install documentation</p>
          <h3 className="font-display text-2xl font-bold text-white">Gallery</h3>
          <p className="mt-1 text-sm text-white/40">Tap any asset · swipe in viewer · filmstrip navigation</p>
        </div>

        <PhotoGrid
          photos={photos}
          layout="bento"
          showSiteLabel={false}
          onPhotoClick={(_photo, index) => setLightboxIndex(index)}
          onDelete={async (photoId) => {
            await deletePhoto(photoId);
            setLightboxIndex(null);
            load();
          }}
          emptyMessage="No assets at this deployment yet. Capture photos on-site — they'll auto-route here when in range."
        />
      </section>

      {lightboxIndex != null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}
    </div>
  );
}