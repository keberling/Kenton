import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { rematchAllPhotos, type RescanMatchesResult } from "../lib/api";
import { useLiveData } from "../lib/LiveDataContext";
import { TechMeta, TechMetaRow, TechStatusChip } from "./TechMeta";

type RescanPhase = "idle" | "scanning" | "done" | "error";

interface RescanMatchesButtonProps {
  variant?: "primary" | "ghost";
  compact?: boolean;
  className?: string;
  onMessage?: (message: string) => void;
}

function formatRescanSummary(result: RescanMatchesResult): string {
  const parts: string[] = [];
  if (result.matched > 0) parts.push(`${result.matched} newly routed`);
  if (result.reassigned > 0) parts.push(`${result.reassigned} rerouted`);
  if (result.unassigned > 0) parts.push(`${result.unassigned} sent to queue`);

  if (parts.length === 0) {
    return `${result.scanned} asset${result.scanned === 1 ? "" : "s"} checked — all routes valid.`;
  }

  return parts.join(" · ");
}

function milesFromMeters(meters: number): string {
  return (meters / 1609.344).toFixed(1);
}

function RescanStatusModal({
  phase,
  result,
  error,
  onClose,
}: {
  phase: Exclude<RescanPhase, "idle">;
  result: RescanMatchesResult | null;
  error: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "scanning") onClose();
    };
    document.body.style.overflow = phase === "scanning" ? "hidden" : "";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose, phase]);

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rescan-status-title"
        onClick={phase === "scanning" ? undefined : onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="panel window w-full max-w-md rounded-2xl p-5 sm:p-6"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="hud-label text-cyan-400/70">Match rescan</p>
              <h3 id="rescan-status-title" className="font-display mt-1 text-xl font-bold text-white">
                {phase === "scanning"
                  ? "Scanning library…"
                  : phase === "error"
                    ? "Rescan failed"
                    : "Rescan complete"}
              </h3>
            </div>
            {phase !== "scanning" && (
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost rounded-xl p-2"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {phase === "scanning" && (
            <div className="mt-6 flex flex-col items-center py-4 text-center">
              <div className="neu-inset flex h-16 w-16 items-center justify-center rounded-2xl">
                <RefreshCw size={28} className="animate-spin text-cyan-300" />
              </div>
              <p className="mt-4 text-sm text-white/55">
                Checking every GPS asset against current deployments…
              </p>
              <p className="mt-2 font-mono text-[10px] text-white/30">
                Fixing distant routes · rerouting within ~2 mi · queueing the rest
              </p>
            </div>
          )}

          {phase === "error" && (
            <p className="mt-4 rounded-xl bg-rose-500/10 px-4 py-3 font-mono text-sm text-rose-300 ring-1 ring-rose-400/20">
              {error}
            </p>
          )}

          {phase === "done" && result && (
            <>
              <div className="mt-4 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" />
                <p className="text-sm text-white/70">{formatRescanSummary(result)}</p>
              </div>

              <div className="mt-5">
                <TechMetaRow>
                  <TechMeta label="Scanned" value={String(result.scanned)} accent="cyan" />
                  <TechMeta label="New routes" value={String(result.matched)} accent="emerald" />
                  <TechMeta label="Rerouted" value={String(result.reassigned)} accent="violet" />
                  <TechMeta label="To queue" value={String(result.unassigned)} accent="amber" />
                  <TechMeta label="Unchanged" value={String(result.unchanged)} accent="muted" />
                </TechMetaRow>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <TechStatusChip
                  code="MAX"
                  label={`${milesFromMeters(result.maxMatchDistanceM)} mi`}
                  tone="muted"
                />
                <TechStatusChip
                  code="RAD"
                  label={`${result.matchRadiusM}m strict`}
                  tone="muted"
                />
              </div>
            </>
          )}

          {phase !== "scanning" && (
            <button
              type="button"
              onClick={onClose}
              className="btn-primary mt-6 w-full rounded-xl px-4 py-3 text-sm"
            >
              Done
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

export function RescanMatchesButton({
  variant = "primary",
  compact = false,
  className = "",
  onMessage,
}: RescanMatchesButtonProps) {
  const { invalidate } = useLiveData();
  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState<RescanPhase>("idle");
  const [result, setResult] = useState<RescanMatchesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closeModal = useCallback(() => {
    setPhase("idle");
    setResult(null);
    setError(null);
  }, []);

  const handleRescan = async () => {
    setScanning(true);
    setPhase("scanning");
    setResult(null);
    setError(null);

    try {
      const nextResult = await rematchAllPhotos();
      setResult(nextResult);
      setPhase("done");
      onMessage?.(formatRescanSummary(nextResult));
      invalidate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rescan failed";
      setError(message);
      setPhase("error");
      onMessage?.(message);
    } finally {
      setScanning(false);
    }
  };

  const baseClass = variant === "primary" ? "btn-primary" : "btn-ghost";

  return (
    <>
      <button
        type="button"
        disabled={scanning}
        onClick={() => void handleRescan()}
        className={`${baseClass} inline-flex items-center justify-center gap-2 rounded-xl font-mono text-xs uppercase tracking-wider disabled:opacity-50 ${compact ? "px-3 py-2" : "px-4 py-2.5"} ${className}`}
        title="Rescan all photos — fix bad routes and match to the nearest site within ~2 mi"
      >
        <RefreshCw size={compact ? 12 : 14} className={scanning ? "animate-spin" : ""} />
        {scanning ? "Scanning…" : compact ? "Rescan" : "Rescan all"}
      </button>

      {phase !== "idle" && (
        <RescanStatusModal
          phase={phase}
          result={result}
          error={error}
          onClose={closeModal}
        />
      )}
    </>
  );
}