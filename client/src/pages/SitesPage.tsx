import { motion } from "framer-motion";
import { ChevronRight, Images, MapPinned, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { PageHeader } from "../components/PageHeader";
import { SiteGeocodeInfo } from "../components/SiteGeocodeInfo";
import { useLiveData, useLivePoll } from "../lib/LiveDataContext";
import { createSite, deleteSite, getSites, regeocodeSite } from "../lib/api";
import { formatRadiusMeters, shortId } from "../lib/format";
import type { Site } from "../types";

export function SitesPage() {
  const { invalidate } = useLiveData();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);

  const load = useCallback(() => {
    getSites().then(setSites).catch(() => setError("Could not load deployments"));
  }, []);

  useLivePoll(load, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createSite({ name: name.trim(), address: address.trim() });
      setName("");
      setAddress("");
      setMessage(
        result.geocoded
          ? `Node online via ${result.geocodeSource ?? "geocoder"}. ${result.matchedPhotos} asset${result.matchedPhotos === 1 ? "" : "s"} routed.`
          : `Node created — geocode failed: ${result.geocodeError ?? "unknown"}`,
      );
      invalidate();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create deployment");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this deployment? Photos return to the queue.")) return;
    await deleteSite(id);
    invalidate();
    load();
  };

  const defaultRadius = sites[0]?.radiusMeters;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Deployment registry"
        title="Client sites"
        description="AV & IT install locations across your clients. GPS-tagged field photos auto-route to deployments within range. Registry syncs live."
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <section className="panel window h-fit rounded-2xl p-5">
          <p className="hud-label text-cyan-400/70">New deployment</p>
          <h3 className="font-display mt-1 text-xl font-bold text-white">Register site</h3>
          <p className="mt-2 text-sm text-white/40">
            Assets with GPS within{" "}
            {defaultRadius ? formatRadiusMeters(defaultRadius) : "~100 m"} auto-route here
            (within ~2 mi; soft match when no other deployment is within ~1 mi).
          </p>

          <form onSubmit={handleCreate} className="mt-5 space-y-3">
            <label className="block">
              <span className="hud-label mb-1.5 block">Client / project</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp — Boardroom AV"
                className="input-field w-full rounded-xl px-4 py-3 text-sm"
              />
            </label>
            <label className="block">
              <span className="hud-label mb-1.5 block">Address</span>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                placeholder="Search street, city, state…"
              />
              <p className="mt-1.5 font-mono text-[10px] t-faint">
                Live search · Photon + OpenStreetMap · no API key
              </p>
            </label>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm disabled:opacity-50"
            >
              <Plus size={16} />
              {saving ? "Provisioning…" : "Create deployment"}
            </button>
          </form>

          {message && <p className="mt-4 font-mono text-xs text-emerald-400">{message}</p>}
          {error && <p className="mt-4 font-mono text-xs text-rose-400">{error}</p>}
        </section>

        <section className="space-y-4">
          {sites.length === 0 ? (
            <div className="panel rounded-2xl px-6 py-24 text-center">
              <MapPinned size={32} className="mx-auto text-white/20" />
              <p className="mt-4 text-white/40">No deployments yet. Register a client site to start routing assets.</p>
            </div>
          ) : (
            sites.map((site, index) => (
              <motion.div
                key={site.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="panel window overflow-hidden rounded-2xl"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/sites/${site.id}`)}
                  className="group relative w-full text-left"
                >
                  {site.previewPhotos && site.previewPhotos.length > 0 && (
                    <div className="relative h-36 overflow-hidden sm:h-44">
                      <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 gap-0.5">
                        {site.previewPhotos.slice(0, 5).map((url, i) => (
                          <img
                            key={url}
                            src={url}
                            alt=""
                            className={`h-full w-full object-cover transition duration-500 group-hover:scale-[1.03] ${
                              i === 0 ? "col-span-2 row-span-2" : ""
                            }`}
                            loading="lazy"
                          />
                        ))}
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1018] via-[#0e1018]/50 to-transparent" />
                    </div>
                  )}

                  <div className={`relative p-5 ${!site.previewPhotos?.length ? "pt-5" : ""}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`status-dot ${
                              site.lat != null ? "status-dot-live" : "status-dot-warn"
                            }`}
                          />
                          <p className="hud-label">{site.lat != null ? "Online" : "No fix"}</p>
                        </div>
                        <h3 className="font-display mt-1 text-xl font-bold text-white transition group-hover:text-cyan-200 sm:text-2xl">
                          {site.name}
                        </h3>
                        <p className="mt-1 text-sm text-white/45">{site.address}</p>
                        <p className="mt-1 font-mono text-[9px] text-white/25">
                          NODE::{shortId(site.id, 8)} · RAD::{site.radiusMeters}m
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="glass-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs text-violet-300">
                          <Images size={13} />
                          {site.photoCount ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-cyan-400/80 transition group-hover:text-cyan-300">
                          Open gallery
                          <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedSiteId((current) => (current === site.id ? null : site.id))}
                    className="font-mono text-[10px] uppercase tracking-wider text-white/35 transition hover:text-white/60"
                  >
                    {expandedSiteId === site.id ? "− Telemetry" : "+ Telemetry"}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={async () => {
                        try {
                          const result = await regeocodeSite(site.id);
                          setMessage(`Fix updated. ${result.matchedPhotos} assets routed.`);
                          invalidate();
                          load();
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Geocode failed");
                        }
                      }}
                      className="btn-ghost rounded-lg px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
                    >
                      {site.lat == null ? "Retry fix" : "Refresh"}
                    </button>
                    <button
                      onClick={() => handleDelete(site.id)}
                      className="rounded-lg p-2 text-white/30 transition hover:bg-rose-500/10 hover:text-rose-400"
                      aria-label="Delete site"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {expandedSiteId === site.id && (
                  <div className="border-t border-white/5 px-5 pb-5">
                    <SiteGeocodeInfo site={site} />
                  </div>
                )}
              </motion.div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}