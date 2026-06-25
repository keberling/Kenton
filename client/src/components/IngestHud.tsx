import { motion } from "framer-motion";
import { Link, useLocation } from "react-router-dom";
import { Radio, Upload } from "lucide-react";
import { useIngest } from "../lib/IngestContext";
import { TechStatusChip } from "./TechMeta";

export function IngestHud() {
  const location = useLocation();
  const { uploading, overallPercent, doneCount, totalCount, batchId } = useIngest();

  if (!uploading || location.pathname === "/") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8 }}
      className="pointer-events-auto fixed bottom-4 right-4 z-50 w-[min(100vw-2rem,20rem)]"
    >
      <Link
        to="/"
        className="panel window block overflow-hidden rounded-2xl ring-1 ring-cyan-400/20 transition hover:ring-cyan-400/35"
      >
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Radio size={14} className="animate-pulse text-cyan-400" />
              <p className="hud-label text-cyan-400/80">Background ingest</p>
            </div>
            <TechStatusChip code="UPL" label={`${overallPercent}%`} tone="cyan" />
          </div>
          <p className="mt-1 font-mono text-[10px] text-white/40">
            {doneCount}/{totalCount} committed · pipeline continues off-tab
          </p>
          {batchId && (
            <p className="mt-0.5 font-mono text-[9px] text-white/25">BATCH::{batchId}</p>
          )}
        </div>
        <div className="px-4 py-3">
          <div className="upload-track">
            <motion.div
              className="upload-fill"
              animate={{ width: `${overallPercent}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
            <div className="upload-shimmer" style={{ width: `${overallPercent}%` }} />
          </div>
          <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] text-cyan-300/80">
            <Upload size={11} />
            Tap to open ingest telemetry
          </p>
        </div>
      </Link>
    </motion.div>
  );
}

/** Sidebar / mobile nav ingest pulse when pipeline is active. */
export function IngestNavBadge({ active, compact }: { active: boolean; compact?: boolean }) {
  const { uploading, overallPercent } = useIngest();
  if (!uploading) return null;

  if (compact) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-cyan-400/80">
        <span className="status-dot status-dot-live shrink-0" />
        {overallPercent}%
      </span>
    );
  }

  return (
    <span
      className={`ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider ${
        active ? "text-cyan-300" : "text-cyan-400/70"
      }`}
    >
      <span className="status-dot status-dot-live shrink-0" />
      {overallPercent}%
    </span>
  );
}