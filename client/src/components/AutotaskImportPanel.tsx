import { motion } from "framer-motion";
import { Building2, Download, Plug, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getAutotaskCompanies,
  getAutotaskStatus,
  importAutotaskCompanies,
  testAutotaskConnection,
  type AutotaskCompanyListItem,
} from "../lib/api";
import { TechStatusChip } from "./TechMeta";

interface AutotaskImportPanelProps {
  onImported?: (message: string) => void;
  onError?: (message: string) => void;
}

export function AutotaskImportPanel({ onImported, onError }: AutotaskImportPanelProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<AutotaskCompanyListItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getAutotaskStatus();
      setConfigured(status.configured);
      setUsername(status.configured ? status.username ?? null : null);
    } catch {
      setConfigured(false);
    }
  }, []);

  const loadCompanies = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const result = await getAutotaskCompanies(query);
      setCompanies(result.companies);
      setSelected(new Set());
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Could not load Autotask clients");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!configured) return;
    const timer = window.setTimeout(() => {
      void loadCompanies(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [configured, search, loadCompanies]);

  const toggleSelected = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testAutotaskConnection();
      if (!result.ok) throw new Error(result.error ?? "Connection failed");
      setZoneName(result.zoneName ?? null);
      onImported?.(`Autotask connected — ${result.zoneName ?? "zone resolved"}.`);
      await loadCompanies(search);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Autotask connection failed");
    } finally {
      setTesting(false);
    }
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      const result = await importAutotaskCompanies([...selected]);
      const parts = [];
      if (result.created > 0) parts.push(`${result.created} created`);
      if (result.updated > 0) parts.push(`${result.updated} updated`);
      if (result.matchedPhotos > 0) parts.push(`${result.matchedPhotos} photos routed`);
      if (result.skipped > 0) parts.push(`${result.skipped} skipped`);
      onImported?.(
        parts.length
          ? `Autotask import complete — ${parts.join(", ")}.`
          : "Autotask import complete.",
      );
      await loadCompanies(search);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (configured === null) {
    return (
      <section className="panel window rounded-2xl p-5">
        <p className="font-mono text-xs text-white/35">Checking Autotask integration…</p>
      </section>
    );
  }

  if (!configured) {
    return (
      <section className="panel window rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="neu-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
            <Plug size={18} className="text-amber-300" />
          </div>
          <div>
            <p className="hud-label text-amber-300/80">Autotask PSA</p>
            <h3 className="font-display mt-1 text-lg font-bold text-white">Connect client directory</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/45">
              Add your Autotask API credentials to the server environment, then redeploy. Kenton will
              pull active customer organizations and their addresses into deployments.
            </p>
            <ul className="mt-3 space-y-1 font-mono text-[10px] text-white/35">
              <li>AUTOTASK_API_USERNAME</li>
              <li>AUTOTASK_API_SECRET</li>
              <li>AUTOTASK_INTEGRATION_CODE</li>
              <li>AUTOTASK_ZONE_URL (optional)</li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  const withAddress = companies.filter((company) => company.address);
  const importable = [...selected].filter((id) => {
    const company = companies.find((item) => item.id === id);
    return company?.address;
  });

  return (
    <section className="panel window rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="hud-label text-violet-300/80">Autotask PSA</p>
          <h3 className="font-display mt-1 text-lg font-bold text-white">Import clients</h3>
          <p className="mt-2 text-sm text-white/45">
            Pull active Autotask customers and register them as deployments with geocoded addresses.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {username && <TechStatusChip code="API" label={username} tone="muted" />}
            {zoneName && <TechStatusChip code="ZONE" label={zoneName} tone="cyan" />}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleTest()}
          disabled={testing}
          className="btn-ghost inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={testing ? "animate-spin" : ""} />
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>

      <div className="relative mt-5">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search Autotask clients…"
          className="input-field w-full rounded-xl py-3 pl-9 pr-4 text-sm"
        />
      </div>

      <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="font-mono text-xs text-white/35">Loading Autotask clients…</p>
        ) : withAddress.length === 0 ? (
          <p className="font-mono text-xs text-white/35">
            No active customers with addresses found{search ? ` for “${search}”` : ""}.
          </p>
        ) : (
          withAddress.map((company, index) => (
            <motion.label
              key={company.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.02, 0.2) }}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                selected.has(company.id)
                  ? "border-cyan-400/30 bg-cyan-400/5"
                  : "border-white/[0.06] bg-black/20 hover:border-white/10"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(company.id)}
                onChange={() => toggleSelected(company.id)}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 size={12} className="text-violet-300/80" />
                  <p className="truncate font-medium text-white">{company.companyName}</p>
                  {company.alreadyImported && (
                    <TechStatusChip code="SYNC" label="imported" tone="emerald" />
                  )}
                </div>
                <p className="mt-1 text-xs text-white/45">{company.address}</p>
              </div>
            </motion.label>
          ))
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[10px] text-white/35">
          {selected.size} selected · {withAddress.length} with addresses
        </p>
        <button
          type="button"
          disabled={importing || importable.length === 0}
          onClick={() => void handleImport()}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
        >
          <Download size={14} />
          {importing
            ? "Importing…"
            : `Import ${importable.length || ""} deployment${importable.length === 1 ? "" : "s"}`.trim()}
        </button>
      </div>
    </section>
  );
}