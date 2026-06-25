import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PhotoGrid } from "../components/PhotoGrid";
import { SiteGeocodeInfo } from "../components/SiteGeocodeInfo";
import { deletePhoto, getPhotos, getSite, regeocodeSite } from "../lib/api";
import type { Photo, Site } from "../types";

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    getSite(id).then(setSite).catch(() => setSite(null));
    getPhotos({ siteId: id }).then(setPhotos).catch(() => setPhotos([]));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

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
            <h2 className="font-display text-2xl font-bold text-stone-900">{site.name}</h2>
            <p className="mt-1 text-stone-500">{site.address}</p>
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
        <SiteGeocodeInfo site={site} detailed />
      </section>

      <PhotoGrid
        photos={photos}
        onDelete={async (photoId) => {
          await deletePhoto(photoId);
          load();
        }}
        emptyMessage="No photos tagged to this site yet. Compare the geocoded location above with unassigned photo coordinates on the Sites page."
      />
    </div>
  );
}