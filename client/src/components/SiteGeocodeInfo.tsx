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
    <div className="neu-inset mt-3 space-y-3 rounded-xl p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="hud-label">Geocoded fix</p>
          {coords ? (
            <p className="mt-1.5 font-mono text-sm text-cyan-300/90">{coords}</p>
          ) : (
            <p className="mt-1.5 text-sm text-amber-400/90">NO FIX — address not placed on map</p>
          )}
        </div>
        <div>
          <p className="hud-label">Geocoder</p>
          <p className="mt-1.5 text-sm text-white/70">{geocodeSourceLabel(site.geocodeSource)}</p>
        </div>
        <div>
          <p className="hud-label">Match radius</p>
          <p className="mt-1.5 font-mono text-sm text-white/70">{formatRadiusMeters(site.radiusMeters)}</p>
        </div>
        <div>
          <p className="hud-label">Tagged assets</p>
          <p className="mt-1.5 font-mono text-sm text-white/70">{site.photoCount ?? 0}</p>
        </div>
      </div>

      {coords && (
        <a
          href={mapsUrl(site.lat!, site.lng!)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan-400 transition hover:text-cyan-300"
        >
          Open in maps
          <ExternalLink size={12} />
        </a>
      )}

      {site.lat != null && site.lng != null && (
        <div className="border-t border-white/5 pt-3">
          <p className="hud-label">Proximity scan</p>
          {(site.unassignedWithGps ?? 0) === 0 ? (
            <p className="mt-1.5 text-sm text-white/40">No unassigned GPS assets in queue.</p>
          ) : site.nearestUnassigned ? (
            <div className="mt-2 space-y-1.5 text-sm">
              <p>
                Nearest:{" "}
                <span className={site.nearestUnassigned.withinRadius ? "text-emerald-400" : "text-amber-400"}>
                  {formatDistanceMeters(site.nearestUnassigned.distanceM)}
                  {site.nearestUnassigned.withinRadius ? " · IN RANGE" : " · OUT OF RANGE"}
                </span>
              </p>
              <p className="font-mono text-xs text-white/40">
                {formatCoords(site.nearestUnassigned.lat, site.nearestUnassigned.lng)}
                {" · "}
                {site.nearestUnassigned.originalName}
              </p>
              <p className="text-white/40">
                {site.unassignedWithinRadius ?? 0}/{site.unassignedWithGps} queued assets within radius
              </p>
            </div>
          ) : null}
        </div>
      )}

      {detailed && site.nearbyUnassigned && site.nearbyUnassigned.length > 0 && (
        <div className="border-t border-white/5 pt-3">
          <p className="hud-label">Closest queue</p>
          <ul className="mt-2 space-y-2">
            {site.nearbyUnassigned.map((photo) => (
              <li key={photo.photoId} className="neu-raised-sm hover-shake rounded-lg px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-sm text-white/80">{photo.originalName}</span>
                  <span className={`font-mono text-xs ${photo.withinRadius ? "text-emerald-400" : "text-amber-400"}`}>
                    {formatDistanceMeters(photo.distanceM)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-white/35">{formatCoords(photo.lat, photo.lng)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}