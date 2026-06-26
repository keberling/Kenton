import { ChevronDown, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { AddressAutocomplete } from "../components/AddressAutocomplete";
import { AutotaskImportPanel } from "../components/AutotaskImportPanel";
import { DeploymentsRegistry } from "../components/DeploymentsRegistry";
import { RescanMatchesButton } from "../components/RescanMatchesButton";
import { useLiveData, useLivePoll } from "../lib/LiveDataContext";
import { createSite, deleteSite, getSites, regeocodeSite } from "../lib/api";
import { formatRadiusMeters } from "../lib/format";
import type { Site } from "../types";

export function SitesPage() {
  const { invalidate } = useLiveData();
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

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
      setShowNewForm(false);
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

  const handleRegeocode = async (id: string) => {
    try {
      const result = await regeocodeSite(id);
      setMessage(`Fix updated. ${result.matchedPhotos} assets routed.`);
      setError(null);
      invalidate();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geocode failed");
      setMessage(null);
    }
  };

  const defaultRadius = sites[0]?.radiusMeters;

  const handleAutotaskMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    setError(null);
  }, []);

  const handleAutotaskImported = useCallback(
    (nextMessage: string) => {
      setMessage(nextMessage);
      setError(null);
      invalidate();
      load();
    },
    [invalidate, load],
  );

  const handleAutotaskError = useCallback((nextError: string) => {
    setError(nextError);
    setMessage(null);
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="hud-label t-accent">Deployment registry</p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Client sites
          </h2>
          <p className="mt-1 max-w-xl text-sm text-white/40">
            GPS-tagged photos auto-route to deployments within range. Registry syncs live.
          </p>
        </div>
        <RescanMatchesButton
          variant="ghost"
          onMessage={(nextMessage) => {
            setMessage(nextMessage);
            setError(null);
          }}
        />
      </header>

      {(message || error) && (
        <div className="font-mono text-xs">
          {message && <p className="text-emerald-400">{message}</p>}
          {error && <p className="text-rose-400">{error}</p>}
        </div>
      )}

      <AutotaskImportPanel
        defaultCollapsed
        onMessage={handleAutotaskMessage}
        onImported={handleAutotaskImported}
        onError={handleAutotaskError}
      />

      <section className="panel window overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setShowNewForm((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
        >
          <div className="flex items-center gap-3">
            <div className="neu-inset flex h-9 w-9 items-center justify-center rounded-lg">
              <Plus size={16} className="text-cyan-300" />
            </div>
            <div>
              <p className="hud-label text-cyan-400/70">New deployment</p>
              <p className="text-sm text-white/50">Register a client site manually</p>
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`shrink-0 text-white/30 transition ${showNewForm ? "rotate-180" : ""}`}
          />
        </button>

        {showNewForm && (
          <div className="border-t border-white/5 px-4 pb-4 pt-3 sm:px-5">
            <p className="text-sm text-white/40">
              Assets with GPS within{" "}
              {defaultRadius ? formatRadiusMeters(defaultRadius) : "~100 m"} auto-route here
              (within ~2 mi; soft match when no other deployment is within ~1 mi).
            </p>

            <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="hud-label mb-1.5 block">Client / project</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp — Boardroom AV"
                  className="input-field w-full rounded-xl px-4 py-2.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="hud-label mb-1.5 block">Address</span>
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  placeholder="Search street, city, state…"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50 sm:col-span-2 sm:w-fit"
              >
                <Plus size={16} />
                {saving ? "Provisioning…" : "Create deployment"}
              </button>
            </form>
          </div>
        )}
      </section>

      <DeploymentsRegistry
        sites={sites}
        onDelete={(id) => void handleDelete(id)}
        onRegeocode={handleRegeocode}
      />
    </div>
  );
}