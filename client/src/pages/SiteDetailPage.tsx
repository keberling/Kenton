import { ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PhotoGrid } from "../components/PhotoGrid";
import { deletePhoto, getPhotos, getSite } from "../lib/api";
import type { Photo, Site } from "../types";

export function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [site, setSite] = useState<Site | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

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
        <h2 className="font-display text-2xl font-bold text-stone-900">{site.name}</h2>
        <p className="mt-1 text-stone-500">{site.address}</p>
        <p className="mt-3 text-sm text-stone-400">
          {photos.length} photos tagged within {site.radiusMeters} meters of this address
        </p>
      </section>

      <PhotoGrid
        photos={photos}
        onDelete={async (photoId) => {
          await deletePhoto(photoId);
          load();
        }}
        emptyMessage="No photos tagged to this site yet. Upload field photos nearby or add the site after photos are taken."
      />
    </div>
  );
}