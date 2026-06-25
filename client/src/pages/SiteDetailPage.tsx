import { ArrowLeft, ChevronDown, Images } from "lucide-react";
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
      <div className="glass rounded-3xl px-6 py-16 text-center text-stone-500">
        Loading gallery…
      </div>
    );
  }

  if (!site) {
    return (
      <div className="glass rounded-3xl px-6 py-16 text-center text-stone-500">
        Site not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/sites" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={16} />
        Back to sites
      </Link>

      <section className="glass rounded-3xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-orange-700">Job site gallery</p>
            <h2 className="font-display text-2xl font-bold text-stone-900">{site.name}</h2>
            <p className="mt-1 text-stone-500">{site.address}</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-stone-600">
              <Images size={16} />
              {photos.length} photo{photos.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={async () => {
              try {
                const result = await regeocodeSite(site.id);
                setMessage(`Geocoded via ${result.geocodeSource}. ${result.matchedPhotos} photos matched.`);
                load();
              } catch {
                setMessage("Geocode failed — check the address and try again.");
              }
            }}
            className="rounded-xl bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-200"
          >
            Refresh geocode
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}

        <button
          onClick={() => setShowDetails((open) => !open)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-stone-900"
        >
          <ChevronDown size={16} className={`transition ${showDetails ? "rotate-180" : ""}`} />
          {showDetails ? "Hide geocoding details" : "Show geocoding details"}
        </button>
        {showDetails && <SiteGeocodeInfo site={site} detailed />}
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="font-display text-xl font-semibold text-stone-900">Photos</h3>
          <p className="text-sm text-stone-500">Tap any photo to open the gallery viewer.</p>
        </div>

        <PhotoGrid
          photos={photos}
          showSiteLabel={false}
          onPhotoClick={(_photo, index) => setLightboxIndex(index)}
          onDelete={async (photoId) => {
            await deletePhoto(photoId);
            setLightboxIndex(null);
            load();
          }}
          emptyMessage="No photos tagged to this site yet. Upload field photos nearby or add the site after photos are taken."
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