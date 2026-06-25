import { ExternalLink } from "lucide-react";
import type { Site } from "../types";
import {
  formatCoords,
  formatDistanceMeters,
  formatRadiusMeters,
  geocodeSourceLabel,
  mapsUrl,
} from "../lib/format";

interface SiteGeocodeInfoProps {
  site: Site;
  detailed?: boolean;
}

export function SiteGeocodeInfo({ site, detailed = false }: SiteGeocodeInfoProps) {
  const coords = formatCoords(site.lat, site.lng);

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-stone-50/80 p-3 text-xs text-stone-600">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <p className="font-medium uppercase tracking-wider text-stone-400">Geocoded location</p>
          {coords ? (
            <p className="mt-1 font-mono text-stone-700">{coords}</p>
          ) : (
            <p className="mt-1 text-amber-700">Not geocoded — address could not be placed on a map.</p>
          )}
        </div>
        <div>
          <p className="font-medium uppercase tracking-wider text-stone-400">Geocoder</p>
          <p className="mt-1 text-stone-700">{geocodeSourceLabel(site.geocodeSource)}</p>
        </div>
        <div>
          <p className="font-medium uppercase tracking-wider text-stone-400">Match radius</p>
          <p className="mt-1 text-stone-700">{formatRadiusMeters(site.radiusMeters)}</p>
        </div>
        <div>
          <p className="font-medium uppercase tracking-wider text-stone-400">Tagged photos</p>
          <p className="mt-1 text-stone-700">{site.photoCount ?? 0} at this site</p>
        </div>
      </div>

      {coords && (
        <a
          href={mapsUrl(site.lat!, site.lng!)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium text-orange-700 hover:text-orange-800"
        >
          View site on map
          <ExternalLink size={12} />
        </a>
      )}

      {site.lat != null && site.lng != null && (
        <div className="border-t border-stone-200/80 pt-2">
          <p className="font-medium uppercase tracking-wider text-stone-400">Unassigned photos (GPS)</p>
          {(site.unassignedWithGps ?? 0) === 0 ? (
            <p className="mt-1 text-stone-500">No unassigned photos with GPS in the pool.</p>
          ) : site.nearestUnassigned ? (
            <div className="mt-1 space-y-1">
              <p>
                Nearest:{" "}
                <span className={site.nearestUnassigned.withinRadius ? "text-emerald-700" : "text-amber-700"}>
                  {formatDistanceMeters(site.nearestUnassigned.distanceM)}
                  {site.nearestUnassigned.withinRadius ? " (within radius)" : " (outside radius)"}
                </span>
              </p>
              <p className="font-mono text-stone-500">
                {formatCoords(site.nearestUnassigned.lat, site.nearestUnassigned.lng)}
                {" · "}
                {site.nearestUnassigned.originalName}
              </p>
              <p className="text-stone-500">
                {site.unassignedWithinRadius ?? 0} of {site.unassignedWithGps} unassigned photo
                {(site.unassignedWithGps ?? 0) === 1 ? "" : "s"} fall within the match radius.
              </p>
            </div>
          ) : null}
        </div>
      )}

      {detailed && site.nearbyUnassigned && site.nearbyUnassigned.length > 0 && (
        <div className="border-t border-stone-200/80 pt-2">
          <p className="font-medium uppercase tracking-wider text-stone-400">Closest unassigned photos</p>
          <ul className="mt-2 space-y-2">
            {site.nearbyUnassigned.map((photo) => (
              <li key={photo.photoId} className="rounded-xl bg-white/70 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate font-medium text-stone-800">{photo.originalName}</span>
                  <span className={photo.withinRadius ? "text-emerald-700" : "text-amber-700"}>
                    {formatDistanceMeters(photo.distanceM)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-stone-500">{formatCoords(photo.lat, photo.lng)}</p>
                <a
                  href={mapsUrl(photo.lat, photo.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-orange-700 hover:text-orange-800"
                >
                  View photo on map
                  <ExternalLink size={12} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}