import { useCallback, useEffect, useState } from "react";
import { PhotoGrid } from "../components/PhotoGrid";
import { deletePhoto, getPhotos, rematchAllPhotos } from "../lib/api";
import type { Photo } from "../types";

type Filter = "all" | "unassigned";

export function PhotosPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rematching, setRematching] = useState(false);

  const load = useCallback(() => {
    getPhotos(filter === "unassigned" ? { unassigned: true } : undefined)
      .then(setPhotos)
      .catch(() => setPhotos([]));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-stone-900">Photo library</h2>
          <p className="text-sm text-stone-500">All uploads, including the general pool waiting for a site match.</p>
        </div>
        <div className="flex gap-2 rounded-2xl bg-white/70 p-1 ring-1 ring-stone-200">
          {(["all", "unassigned"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                filter === value ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {value === "all" ? "All" : "Unassigned"}
            </button>
          ))}
        </div>
      </div>

      <PhotoGrid
        photos={photos}
        onDelete={async (photoId) => {
          await deletePhoto(photoId);
          load();
        }}
        emptyMessage={
          filter === "unassigned"
            ? "No unassigned photos. Everything has been matched to a job site."
            : "No photos uploaded yet. Head to Upload to add field photos."
        }
      />

      {filter === "unassigned" && photos.length > 0 && (
        <p className="text-sm text-stone-500">
          Tip: photos with GPS auto-tag when within ~500m of a geocoded job site. Geocoded
          addresses can be offset from where photos were taken, so a wider radius helps.
          {" "}
          <button
            className="font-medium text-orange-700 underline disabled:opacity-50"
            disabled={rematching}
            onClick={async () => {
              setRematching(true);
              try {
                const result = await rematchAllPhotos();
                if (result.matched > 0) {
                  window.alert(`${result.matched} photo${result.matched === 1 ? "" : "s"} matched to job sites.`);
                }
                load();
              } finally {
                setRematching(false);
              }
            }}
          >
            {rematching ? "Matching…" : "Retry matching now"}
          </button>
        </p>
      )}
    </div>
  );
}