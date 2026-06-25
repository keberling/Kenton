import { Link2, RefreshCw, Unlink } from "lucide-react";
import { useMemo, useState } from "react";
import {
  assignPhotoToSite,
  rematchPhoto,
  unassignPhoto,
} from "../lib/api";
import { formatDistanceMeters } from "../lib/format";
import { haversineMeters } from "../lib/geo";
import type { Photo, Site } from "../types";
import { TechStatusChip } from "./TechMeta";

interface SiteOption {
  site: Site;
  distanceM: number | null;
}

function sortSitesForPhoto(photo: Photo, sites: Site[]): SiteOption[] {
  return sites
    .map((site) => ({
      site,
      distanceM:
        photo.lat != null &&
        photo.lng != null &&
        site.lat != null &&
        site.lng != null
          ? haversineMeters(photo.lat, photo.lng, site.lat, site.lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.distanceM != null && b.distanceM != null) return a.distanceM - b.distanceM;
      if (a.distanceM != null) return -1;
      if (b.distanceM != null) return 1;
      return a.site.name.localeCompare(b.site.name);
    });
}

interface PhotoMatchActionsProps {
  photo: Photo;
  sites: Site[];
  onUpdated: (photo: Photo) => void;
  compact?: boolean;
}

export function PhotoMatchActions({
  photo,
  sites,
  onUpdated,
  compact = false,
}: PhotoMatchActionsProps) {
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [busy, setBusy] = useState<"retry" | "assign" | "unassign" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const siteOptions = useMemo(() => sortSitesForPhoto(photo, sites), [photo, sites]);
  const hasGps = photo.lat != null && photo.lng != null;
  const statusTone = photo.siteId ? "emerald" : hasGps ? "amber" : "rose";
  const statusLabel = photo.siteId
    ? "ROUTED"
    : photo.matchHold
      ? "HELD"
      : hasGps
        ? "QUEUED"
        : "NO GPS";

  const run = async (action: typeof busy, fn: () => Promise<Photo>) => {
    setBusy(action);
    setError(null);
    try {
      const updated = await fn();
      onUpdated(updated);
      if (action === "assign") setSelectedSiteId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const retryAutoMatch = async () => {
    let current = photo;
    if (current.siteId) {
      current = await unassignPhoto(current.id);
    }
    return rematchPhoto(current.id);
  };

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <TechStatusChip code="RT" label={statusLabel} tone={statusTone} />
        {photo.siteName && (
          <span className="font-mono text-[10px] text-violet-300/90">{photo.siteName}</span>
        )}
      </div>

      <div className={`flex flex-wrap gap-2 ${compact ? "" : "sm:gap-3"}`}>
        {hasGps && (
          <button
            type="button"
            disabled={busy != null || sites.length === 0}
            onClick={() => run("retry", retryAutoMatch)}
            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-[11px] disabled:opacity-50"
          >
            <RefreshCw size={12} className={busy === "retry" ? "animate-spin" : ""} />
            {busy === "retry" ? "Matching…" : "Retry auto-match"}
          </button>
        )}
        {photo.siteId && (
          <button
            type="button"
            disabled={busy != null}
            onClick={() => run("unassign", () => unassignPhoto(photo.id))}
            className="btn-ghost inline-flex items-center gap-1.5 rounded-xl px-3 py-2 font-mono text-[11px] text-amber-300/90 disabled:opacity-50"
          >
            <Unlink size={12} />
            {busy === "unassign" ? "Holding…" : "Send to queue"}
          </button>
        )}
      </div>

      {photo.matchHold && !photo.siteId && (
        <p className="font-mono text-[10px] leading-relaxed text-amber-300/75">
          Auto-match paused — use Retry auto-match or assign manually.
        </p>
      )}

      {sites.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="input-field min-w-0 flex-1 rounded-xl px-3 py-2.5 font-mono text-xs"
          >
            <option value="">Assign to deployment…</option>
            {siteOptions.map(({ site, distanceM }) => (
              <option key={site.id} value={site.id}>
                {site.name}
                {distanceM != null ? ` · ${formatDistanceMeters(distanceM)}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedSiteId || busy != null}
            onClick={() =>
              run("assign", () => assignPhotoToSite(photo.id, selectedSiteId))
            }
            className="btn-primary inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 font-mono text-[11px] disabled:opacity-50"
          >
            <Link2 size={12} />
            {busy === "assign" ? "Assigning…" : "Assign"}
          </button>
        </div>
      ) : (
        <p className="font-mono text-[10px] text-white/35">
          Register a deployment under Sites before manual assignment.
        </p>
      )}

      {!hasGps && (
        <p className="font-mono text-[10px] leading-relaxed text-amber-300/75">
          No embedded GPS — assign manually or register a deployment at the client address.
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-rose-500/10 px-3 py-2 font-mono text-[10px] text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}