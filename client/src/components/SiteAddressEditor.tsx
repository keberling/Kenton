import { Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { updateSite } from "../lib/api";
import type { Site } from "../types";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { TechStatusChip } from "./TechMeta";

interface SiteAddressEditorProps {
  site: Site;
  onUpdated: (site: Site, message: string) => void;
  onError: (message: string) => void;
}

export function SiteAddressEditor({ site, onUpdated, onError }: SiteAddressEditorProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(site.name);
  const [address, setAddress] = useState(site.address);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) {
      setName(site.name);
      setAddress(site.address);
    }
  }, [site.name, site.address, editing]);

  const handleCancel = () => {
    setName(site.name);
    setAddress(site.address);
    setEditing(false);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !address.trim()) return;

    const patch: { name?: string; address?: string } = {};
    if (name.trim() !== site.name) patch.name = name.trim();
    if (address.trim() !== site.address) patch.address = address.trim();

    if (!patch.name && !patch.address) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const result = await updateSite(site.id, patch);
      const message = result.geocoded
        ? `Address updated via ${result.geocodeSource ?? "geocoder"}. ${result.matchedPhotos} asset${result.matchedPhotos === 1 ? "" : "s"} routed.`
        : `Address saved — geocode failed: ${result.geocodeError ?? "unknown"}`;
      onUpdated(result.site, message);
      setEditing(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update deployment");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex flex-wrap items-start gap-3">
        <p className="min-w-0 flex-1 text-white/50">{site.address}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="btn-ghost inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm"
        >
          <Pencil size={14} />
          Edit address
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSave(event)} className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="hud-label text-cyan-300/80">Edit deployment</p>
        {site.autotaskCompanyId != null && (
          <TechStatusChip code="AT" label="Autotask import" tone="violet" />
        )}
      </div>

      <label className="block">
        <span className="hud-label mb-1.5 block">Client / project</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
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

      <p className="text-xs leading-relaxed text-white/35">
        Saving a new address re-geocodes the deployment and re-routes nearby photos. Autotask re-import
        can overwrite this address unless you skip that client on the next sync.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim() || !address.trim()}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={saving}
          className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm"
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </form>
  );
}