import { motion } from "framer-motion";
import { Loader2, MapPinned, Plus, Satellite } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_BASE } from "../lib/routes";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { TechMeta, TechMetaRow, TechStatusChip } from "./TechMeta";
import { createSite, reverseGeocodeAddress } from "../lib/api";
import { useLiveData } from "../lib/LiveDataContext";
import { formatCoords, mapsUrl } from "../lib/format";
import type { AddressSuggestion, Photo } from "../types";

interface ClusterHint {
  id: string;
  photoCount: number;
  centroidLat: number;
  centroidLng: number;
  suggestedAddress: string | null;
}

interface DeploymentRecommendationPanelProps {
  photos: Photo[];
  title?: string;
  onCreated?: () => void;
}

function buildClusters(photos: Photo[]): ClusterHint[] {
  const withGps = photos.filter((p) => p.lat != null && p.lng != null);
  if (!withGps.length) return [];

  const lat = withGps.reduce((sum, p) => sum + p.lat!, 0) / withGps.length;
  const lng = withGps.reduce((sum, p) => sum + p.lng!, 0) / withGps.length;

  return [
    {
      id: "upload-cluster",
      photoCount: withGps.length,
      centroidLat: lat,
      centroidLng: lng,
      suggestedAddress: null,
    },
  ];
}

export function DeploymentRecommendationPanel({
  photos,
  title = "Register a deployment for these captures",
  onCreated,
}: DeploymentRecommendationPanelProps) {
  const navigate = useNavigate();
  const { invalidate } = useLiveData();
  const unrouted = useMemo(
    () =>
      photos.filter(
        (p) =>
          p.lat != null &&
          p.lng != null &&
          (p.matchStatus === "queued" || (!p.siteId && p.matchStatus !== "routed")),
      ),
    [photos],
  );
  const noGps = useMemo(
    () => photos.filter((p) => p.matchStatus === "no_fix" || (p.lat == null && !p.siteId)),
    [photos],
  );

  const cluster = useMemo(() => buildClusters(unrouted)[0] ?? null, [unrouted]);

  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [resolving, setResolving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cluster) return;
    let cancelled = false;
    setResolving(true);

    reverseGeocodeAddress(cluster.centroidLat, cluster.centroidLng)
      .then((result) => {
        if (cancelled) return;
        setAddress(result.suggestion.label);
        if (!nameTouched) {
          const short = result.suggestion.shortLabel.split(",")[0]?.trim();
          if (short) setName(short);
        }
      })
      .catch(() => {
        if (!cancelled) setAddress("");
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cluster, nameTouched]);

  if (!unrouted.length && !noGps.length) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createSite({ name: name.trim(), address: address.trim() });
      setMessage(
        result.geocoded
          ? `Deployment online. ${result.matchedPhotos} asset${result.matchedPhotos === 1 ? "" : "s"} routed.`
          : `Deployment created — verify the address: ${result.geocodeError ?? "geocode failed"}`,
      );
      invalidate();
      onCreated?.();
      if (result.matchedPhotos > 0) {
        window.setTimeout(() => navigate(`${APP_BASE}/sites/${result.site.id}`), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create deployment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel window rounded-2xl border border-amber-400/20 p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="hud-label text-amber-300/85">Deployment recommendation</p>
          <h3 className="font-display mt-1 text-xl font-bold t-fg">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm t-subtle">
            {unrouted.length > 0
              ? `${unrouted.length} asset${unrouted.length === 1 ? "" : "s"} have GPS but no deployment within range. Create a site at this jobsite and they will auto-route.`
              : `${noGps.length} asset${noGps.length === 1 ? "" : "s"} lack GPS — register the client address manually so future captures can match.`}
          </p>
        </div>
        <TechStatusChip code="GEO" label="live search" tone="cyan" />
      </div>

      {cluster && (
        <div className="mt-4">
          <TechMetaRow>
            <TechMeta label="GPS centroid" value={formatCoords(cluster.centroidLat, cluster.centroidLng) ?? "—"} accent="cyan" />
            <TechMeta label="Assets" value={`${cluster.photoCount}`} accent="amber" />
            <TechMeta label="Lookup" value={resolving ? "resolving…" : "photon + osm"} accent="muted" />
          </TechMetaRow>
          {formatCoords(cluster.centroidLat, cluster.centroidLng) && (
            <a
              href={mapsUrl(cluster.centroidLat, cluster.centroidLng)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] text-cyan-400/80 transition hover:text-cyan-300"
            >
              <Satellite size={11} />
              Preview capture area on map
            </a>
          )}
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="hud-label mb-1.5 block">Client / project</span>
          <input
            value={name}
            onChange={(e) => {
              setNameTouched(true);
              setName(e.target.value);
            }}
            placeholder="Acme Corp — Boardroom AV"
            className="input-field w-full rounded-xl px-4 py-3 text-sm"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="hud-label mb-1.5 block">Jobsite address</span>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={(suggestion: AddressSuggestion) => {
              if (!name.trim() && suggestion.shortLabel) {
                setName(suggestion.shortLabel.split(",")[0]?.trim() ?? name);
              }
            }}
            placeholder="Search street, city, state…"
            disabled={resolving}
          />
          <p className="mt-1.5 font-mono text-[10px] t-faint">
            Live search via Photon + OpenStreetMap — no API key required.
          </p>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving || resolving || !name.trim() || !address.trim()}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {saving ? "Provisioning deployment…" : "Create deployment & route assets"}
          </button>
        </div>
      </form>

      {message && (
        <p className="mt-4 inline-flex items-center gap-2 font-mono text-xs text-emerald-400">
          <MapPinned size={12} />
          {message}
        </p>
      )}
      {error && <p className="mt-4 font-mono text-xs text-rose-400">{error}</p>}
    </motion.section>
  );
}