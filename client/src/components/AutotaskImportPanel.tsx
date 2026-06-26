import { motion } from "framer-motion";
import { Building2, ChevronDown, Download, Plug, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getAutotaskCompanies,
  getAutotaskStatus,
  importAutotaskCompanies,
  testAutotaskConnection,
  type AutotaskCompanyListItem,
  type AutotaskEnvDiagnostics,
} from "../lib/api";
import { AutotaskCredentialsForm } from "./AutotaskCredentialsForm";
import { TechStatusChip } from "./TechMeta";

interface AutotaskImportPanelProps {
  onImported?: (message: string) => void;
  onError?: (message: string) => void;
  defaultCollapsed?: boolean;
}

export function AutotaskImportPanel({
  onImported,
  onError,
  defaultCollapsed = false,
}: AutotaskImportPanelProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [envDiagnostics, setEnvDiagnostics] = useState<AutotaskEnvDiagnostics | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [zoneName, setZoneName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<AutotaskCompanyListItem[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showCredentialForm, setShowCredentialForm] = useState(false);
  const [configSource, setConfigSource] = useState<"database" | "environment" | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const status = await getAutotaskStatus();
      setConfigured(status.configured);
      setEnvDiagnostics(status.env ?? null);
      setConfigSource(status.source ?? status.env?.activeSource ?? null);
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
      onImported?.(
        `Autotask connected — ${result.zoneName ?? "zone resolved"}${result.webUrl ? ` (${result.webUrl})` : ""}.`,
      );
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
      <section className="panel window rounded-2xl px-4 py-3">
        <p className="font-mono text-xs text-white/35">Checking Autotask integration…</p>
      </section>
    );
  }

  if (!configured) {
    return (
      <section className="panel window overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="neu-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Plug size={16} className="text-amber-300" />
            </div>
            <div className="min-w-0">
              <p className="hud-label text-amber-300/80">Autotask PSA</p>
              <p className="truncate text-sm text-white/50">Not configured — add API credentials</p>
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`shrink-0 text-white/30 transition ${collapsed ? "" : "rotate-180"}`}
          />
        </button>
        {!collapsed && (
          <div className="border-t border-white/5 px-4 pb-4 pt-3 sm:px-5">
            <AutotaskCredentialsForm
              onSaved={async (message) => {
                onImported?.(message);
                await loadStatus();
                void loadCompanies("");
              }}
              onError={(message) => onError?.(message)}
            />
            {envDiagnostics?.activeSource === "environment" && (
              <p className="mt-3 font-mono text-[10px] text-amber-400/80">
                Env vars detected — saving here stores credentials in Kenton and takes priority.
              </p>
            )}
          </div>
        )}
      </section>
    );
  }

  const withAddress = companies.filter((company) => company.address);
  const importable = [...selected].filter((id) => {
    const company = companies.find((item) => item.id === id);
    return company?.address;
  });

  return (
    <section className="panel window overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <div className="neu-inset flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <Building2 size={16} className="text-violet-300" />
          </div>
          <div className="min-w-0">
            <p className="hud-label text-violet-300/80">Autotask PSA</p>
            <p className="truncate text-sm text-white/50">
              Import clients · {withAddress.length} with addresses
              {selected.size > 0 ? ` · ${selected.size} selected` : ""}
            </p>
          </div>
          <div className="hidden flex-wrap gap-2 sm:flex">
            {username && <TechStatusChip code="API" label={username} tone="muted" />}
            {configSource && (
              <TechStatusChip
                code="CFG"
                label={configSource === "database" ? "saved" : "env"}
                tone={configSource === "database" ? "emerald" : "amber"}
              />
            )}
            {zoneName && <TechStatusChip code="ZONE" label={zoneName} tone="cyan" />}
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/30 transition ${collapsed ? "" : "rotate-180"}`}
        />
      </button>

      {!collapsed && (
        <div className="border-t border-white/5 px-4 pb-4 pt-3 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-sm text-white/45">
          Pull active Autotask customers and register them as deployments with geocoded addresses.
        </p>
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

      <div className="relative mt-4">
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

      <div className="mt-6 border-t border-white/5 pt-4">
        <button
          type="button"
          onClick={() => setShowCredentialForm((prev) => !prev)}
          className="font-mono text-[10px] uppercase tracking-wider text-white/35 transition hover:text-white/60"
        >
          {showCredentialForm ? "− Hide credentials" : "+ Update API credentials"}
        </button>
        {showCredentialForm && (
          <div className="mt-3">
            <AutotaskCredentialsForm
              initialUsername={username?.includes("***") ? "" : username ?? ""}
              compact
              onSaved={(message) => {
                onImported?.(message);
                void loadStatus();
                void loadCompanies(search);
              }}
              onError={(message) => onError?.(message)}
            />
          </div>
        )}
      </div>
        </div>
      )}
    </section>
  );
}