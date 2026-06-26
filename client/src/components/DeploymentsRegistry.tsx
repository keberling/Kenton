import { ChevronDown, ChevronRight, ExternalLink, Images, RefreshCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_BASE } from "../lib/routes";
import { SiteGeocodeInfo } from "./SiteGeocodeInfo";
import { TechStatusChip } from "./TechMeta";
import { shortId } from "../lib/format";
import type { Site } from "../types";

type StatusFilter = "all" | "online" | "no-fix" | "autotask";
type SortKey = "name" | "photos" | "status";

interface DeploymentsRegistryProps {
  sites: Site[];
  onDelete: (id: string) => void;
  onRegeocode: (id: string) => Promise<void>;
}

export function DeploymentsRegistry({ sites, onDelete, onRegeocode }: DeploymentsRegistryProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [regeocodingId, setRegeocodingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let result = sites;

    if (query) {
      result = result.filter(
        (site) =>
          site.name.toLowerCase().includes(query) ||
          site.address.toLowerCase().includes(query) ||
          shortId(site.id, 8).toLowerCase().includes(query),
      );
    }

    if (statusFilter === "online") {
      result = result.filter((site) => site.lat != null);
    } else if (statusFilter === "no-fix") {
      result = result.filter((site) => site.lat == null);
    } else if (statusFilter === "autotask") {
      result = result.filter((site) => site.autotaskCompanyId != null);
    }

    const sorted = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      } else if (sortKey === "photos") {
        cmp = (a.photoCount ?? 0) - (b.photoCount ?? 0);
      } else {
        const aOnline = a.lat != null ? 1 : 0;
        const bOnline = b.lat != null ? 1 : 0;
        cmp = aOnline - bOnline;
      }
      return sortAsc ? cmp : -cmp;
    });

    return sorted;
  }, [sites, search, statusFilter, sortKey, sortAsc]);

  const counts = useMemo(
    () => ({
      all: sites.length,
      online: sites.filter((s) => s.lat != null).length,
      noFix: sites.filter((s) => s.lat == null).length,
      autotask: sites.filter((s) => s.autotaskCompanyId != null).length,
    }),
    [sites],
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortAsc ? " ↑" : " ↓";
  };

  const handleRegeocode = async (site: Site) => {
    setRegeocodingId(site.id);
    try {
      await onRegeocode(site.id);
    } finally {
      setRegeocodingId(null);
    }
  };

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "online", label: "Online", count: counts.online },
    { key: "no-fix", label: "No fix", count: counts.noFix },
    { key: "autotask", label: "Autotask", count: counts.autotask },
  ];

  return (
    <section className="panel window overflow-hidden rounded-2xl">
      <div className="border-b border-white/5 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="hud-label text-cyan-400/70">Registry</p>
            <h3 className="font-display text-lg font-bold text-white">
              {filtered.length === sites.length
                ? `${sites.length} deployment${sites.length === 1 ? "" : "s"}`
                : `${filtered.length} of ${sites.length}`}
            </h3>
          </div>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, address…"
              className="input-field w-full rounded-xl py-2 pl-9 pr-4 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {filterButtons.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={`rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition ${
                statusFilter === key
                  ? "bg-cyan-400/10 text-cyan-300"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {sites.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-white/40">No deployments yet. Register a client site to start routing assets.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-white/40">No deployments match your search or filters.</p>
        </div>
      ) : (
        <div className="max-h-[calc(100dvh-18rem)] overflow-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-[1] bg-[#12151f]/95 backdrop-blur-sm">
              <tr className="border-b border-white/5 font-mono text-[10px] uppercase tracking-wider text-white/35">
                <th className="w-8 px-3 py-2.5" aria-label="Expand" />
                <th className="w-20 px-3 py-2.5">
                  <button type="button" onClick={() => handleSort("status")} className="hover:text-white/60">
                    Status{sortIndicator("status")}
                  </button>
                </th>
                <th className="px-3 py-2.5">
                  <button type="button" onClick={() => handleSort("name")} className="hover:text-white/60">
                    Deployment{sortIndicator("name")}
                  </button>
                </th>
                <th className="hidden px-3 py-2.5 md:table-cell">Address</th>
                <th className="w-20 px-3 py-2.5 text-right">
                  <button type="button" onClick={() => handleSort("photos")} className="hover:text-white/60">
                    Photos{sortIndicator("photos")}
                  </button>
                </th>
                <th className="w-28 px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((site) => {
                const expanded = expandedSiteId === site.id;
                const online = site.lat != null;

                return (
                  <tr
                    key={site.id}
                    className="group border-b border-white/[0.04] transition hover:bg-white/[0.02]"
                  >
                    <td colSpan={6} className="p-0">
                      <div className="flex min-w-0 items-center">
                        <button
                          type="button"
                          onClick={() => setExpandedSiteId((current) => (current === site.id ? null : site.id))}
                          className="flex w-8 shrink-0 items-center justify-center py-3 text-white/25 hover:text-white/50"
                          aria-label={expanded ? "Collapse telemetry" : "Expand telemetry"}
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>

                        <button
                          type="button"
                          onClick={() => navigate(`${APP_BASE}/sites/${site.id}`)}
                          className="flex min-w-0 flex-1 items-center text-left"
                        >
                          <span className="flex w-20 shrink-0 items-center gap-1.5 px-3">
                            <span
                              className={`status-dot ${online ? "status-dot-live" : "status-dot-warn"}`}
                            />
                            <span className="font-mono text-[10px] uppercase text-white/50">
                              {online ? "Online" : "No fix"}
                            </span>
                          </span>

                          <span className="min-w-0 flex-1 px-3 py-3">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="truncate font-medium text-white group-hover:text-cyan-200">
                                {site.name}
                              </span>
                              {site.autotaskCompanyId != null && (
                                <TechStatusChip code="AT" label="Autotask" tone="violet" />
                              )}
                            </span>
                            <span className="mt-0.5 block truncate font-mono text-[10px] text-white/25 md:hidden">
                              {site.address}
                            </span>
                            <span className="mt-0.5 hidden font-mono text-[9px] text-white/20 md:block">
                              NODE::{shortId(site.id, 8)} · RAD::{site.radiusMeters}m
                            </span>
                          </span>

                          <span className="hidden min-w-0 flex-[1.2] truncate px-3 text-white/45 md:block">
                            {site.address}
                          </span>

                          <span className="flex w-20 shrink-0 items-center justify-end gap-1 px-3 font-mono text-xs text-violet-300">
                            <Images size={12} className="opacity-70" />
                            {site.photoCount ?? 0}
                          </span>
                        </button>

                        <div className="flex w-28 shrink-0 items-center justify-end gap-0.5 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => navigate(`${APP_BASE}/sites/${site.id}`)}
                            className="btn-ghost rounded-lg p-2 text-white/30 hover:text-cyan-300"
                            aria-label="Open gallery"
                            title="Open gallery"
                          >
                            <ExternalLink size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={regeocodingId === site.id}
                            onClick={() => void handleRegeocode(site)}
                            className="btn-ghost rounded-lg p-2 text-white/30 hover:text-white/70 disabled:opacity-40"
                            aria-label={online ? "Refresh geocode" : "Retry geocode"}
                            title={online ? "Refresh geocode" : "Retry geocode"}
                          >
                            <RefreshCw
                              size={14}
                              className={regeocodingId === site.id ? "animate-spin" : ""}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(site.id)}
                            className="rounded-lg p-2 text-white/30 transition hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label="Delete deployment"
                            title="Delete deployment"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="border-t border-white/5 bg-black/15 px-5 pb-4 pt-2">
                          <SiteGeocodeInfo site={site} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}