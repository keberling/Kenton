import { motion } from "framer-motion";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteGeocodeInfo } from "../components/SiteGeocodeInfo";
import { createSite, deleteSite, getSites, regeocodeSite } from "../lib/api";
import { formatRadiusMeters } from "../lib/format";
import type { Site } from "../types";

export function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getSites().then(setSites).catch(() => setError("Could not load sites"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
          ? `Site created via ${result.geocodeSource ?? "geocoder"}. ${result.matchedPhotos} nearby photo${result.matchedPhotos === 1 ? "" : "s"} auto-tagged.`
          : `Site created, but geocoding failed: ${result.geocodeError ?? "unknown error"}`,
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create site");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this job site? Photos will return to the general pool.")) return;
    await deleteSite(id);
    load();
  };

  const defaultRadius = sites[0]?.radiusMeters;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="glass h-fit rounded-3xl p-5">
        <h2 className="font-display text-xl font-semibold text-stone-900">Add job site</h2>
        <p className="mt-2 text-sm text-stone-500">
          Enter the site address. Photos with GPS within{" "}
          {defaultRadius ? formatRadiusMeters(defaultRadius) : "~10 miles"} are tagged automatically.
        </p>

        <form onSubmit={handleCreate} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">Site name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Riverside HVAC install"
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-stone-500">Address</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Portland, OR"
              className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
          >
            <Plus size={16} />
            {saving ? "Creating…" : "Create site"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-rose-700">{error}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-stone-900">Job sites</h2>
        {sites.length === 0 ? (
          <div className="glass rounded-3xl px-6 py-16 text-center text-stone-500">
            No job sites yet. Add one to start auto-tagging nearby photos.
          </div>
        ) : (
          sites.map((site, index) => (
            <motion.div
              key={site.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              className="glass rounded-2xl px-4 py-4"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
                  <MapPin size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/sites/${site.id}`}
                        className="font-display text-lg font-semibold text-stone-900 hover:text-orange-700"
                      >
                        {site.name}
                      </Link>
                      <p className="text-sm text-stone-500">{site.address}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {site.lat == null ? (
                        <button
                          onClick={async () => {
                            try {
                              const result = await regeocodeSite(site.id);
                              setMessage(`Geocoded via ${result.geocodeSource}. ${result.matchedPhotos} photos matched.`);
                              load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Geocode failed");
                            }
                          }}
                          className="rounded-xl px-3 py-2 text-xs font-medium text-orange-700 transition hover:bg-orange-50"
                        >
                          Retry geocode
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              const result = await regeocodeSite(site.id);
                              setMessage(`Refreshed geocode via ${result.geocodeSource}. ${result.matchedPhotos} photos matched.`);
                              load();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Geocode failed");
                            }
                          }}
                          className="rounded-xl px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-100"
                        >
                          Refresh geocode
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(site.id)}
                        className="rounded-xl p-2 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete site"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <SiteGeocodeInfo site={site} />
                </div>
              </div>
            </motion.div>
          ))
        )}
      </section>
    </div>
  );
}