import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Loader2,
  MapPin,
  Radio,
  Satellite,
  Scan,
} from "lucide-react";
import type { Photo } from "../types";
import {
  formatBytes,
  formatCoords,
  formatDate,
  formatDuration,
  formatMimeShort,
  formatResolution,
  formatThroughput,
  formatUploaderDetail,
  shortId,
} from "../lib/format";
import { TechMeta, TechMetaRow, TechStatusChip } from "./TechMeta";

export type UploadPhase = "queued" | "uplink" | "processing" | "done" | "error";

export interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  phase: UploadPhase;
  progress: number;
  bytesLoaded: number;
  startedAt: number | null;
  completedAt: number | null;
  result?: Photo;
  error?: string;
}

interface UploadPipelineProps {
  batchId: string;
  items: UploadQueueItem[];
  sessionStartedAt: number;
  active: boolean;
}

function phaseLabel(phase: UploadPhase): string {
  switch (phase) {
    case "queued": return "QUE";
    case "uplink": return "UPL";
    case "processing": return "PRC";
    case "done": return "ACK";
    case "error": return "ERR";
  }
}

function phaseTone(phase: UploadPhase): "muted" | "cyan" | "amber" | "emerald" | "rose" {
  switch (phase) {
    case "queued": return "muted";
    case "uplink": return "cyan";
    case "processing": return "amber";
    case "done": return "emerald";
    case "error": return "rose";
  }
}

function processingStep(item: UploadQueueItem): string {
  if (item.phase !== "processing") return "";
  const elapsed = item.startedAt ? Date.now() - item.startedAt : 0;
  if (elapsed < 400) return "EXIF::PARSE";
  if (elapsed < 800) return "GPS::SCAN";
  return "RT::MATCH";
}

export function UploadPipeline({ batchId, items, sessionStartedAt, active }: UploadPipelineProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active && !items.some((item) => item.phase === "processing")) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 200);
    return () => window.clearInterval(id);
  }, [active, items]);

  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  const uploadedBytes = items.reduce((sum, item) => {
    if (item.phase === "done") return sum + item.file.size;
    if (item.phase === "uplink" || item.phase === "processing") return sum + item.bytesLoaded;
    return sum;
  }, 0);
  const overallPercent = totalBytes > 0 ? Math.round((uploadedBytes / totalBytes) * 100) : 0;
  const doneCount = items.filter((i) => i.phase === "done").length;
  const errorCount = items.filter((i) => i.phase === "error").length;
  const routedCount = items.filter((i) => i.result?.matchStatus === "routed").length;
  const gpsCount = items.filter((i) => i.result?.hasGps).length;
  const elapsed = Date.now() - sessionStartedAt;
  const throughput = formatThroughput(uploadedBytes, Math.max(elapsed, 1));

  const activeItem = items.find((i) => i.phase === "uplink" || i.phase === "processing");

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="panel window overflow-hidden rounded-2xl"
    >
      {/* Header telemetry */}
      <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="hud-label text-cyan-400/70">
              {active ? "Ingest pipeline · active" : "Ingest pipeline · complete"}
            </p>
            <h3 className="font-display mt-1 text-xl font-bold text-white">
              {doneCount}/{items.length} assets committed
            </h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <TechStatusChip code="BATCH" label={batchId} tone="cyan" />
            {active && <TechStatusChip code="CH" label="multipart" tone="muted" />}
            {errorCount > 0 && <TechStatusChip code="ERR" label={`${errorCount}`} tone="rose" />}
          </div>
        </div>

        <TechMetaRow>
          <TechMeta label="Payload" value={formatBytes(totalBytes)} accent="muted" />
          <TechMeta label="Uplink" value={`${overallPercent}% · ${throughput}`} accent="cyan" />
          <TechMeta label="Elapsed" value={formatDuration(elapsed)} accent="muted" />
          <TechMeta
            label="GPS lock"
            value={active ? `${gpsCount}/${doneCount}` : `${gpsCount}/${items.length}`}
            accent="emerald"
          />
          <TechMeta
            label="Routed"
            value={active ? `${routedCount}/${doneCount}` : `${routedCount}/${items.length}`}
            accent="violet"
          />
          <TechMeta label="Queue depth" value={`${items.length - doneCount} pending`} accent="amber" />
        </TechMetaRow>
      </div>

      {/* Master progress bar */}
      <div className="px-4 py-3 sm:px-5">
        <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] text-white/35">
          <span>MASTER::UPLINK</span>
          <span>{overallPercent}%</span>
        </div>
        <div className="upload-track">
          <motion.div
            className="upload-fill"
            initial={{ width: 0 }}
            animate={{ width: `${overallPercent}%` }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          />
          {active && (
            <div className="upload-shimmer" style={{ width: `${overallPercent}%` }} />
          )}
        </div>
        {activeItem && (
          <p className="mt-2 font-mono text-[10px] text-cyan-400/70">
            → {activeItem.file.name}
            {activeItem.phase === "processing" ? ` · ${processingStep(activeItem)}` : ` · ${activeItem.progress}%`}
          </p>
        )}
      </div>

      {/* Per-file queue */}
      <ul className="max-h-[28rem] space-y-2 overflow-y-auto px-4 pb-4 sm:px-5">
        <AnimatePresence initial={false}>
          {items.map((item, index) => {
            const photo = item.result;
            const duration =
              item.startedAt && item.completedAt
                ? item.completedAt - item.startedAt
                : item.startedAt
                  ? Date.now() - item.startedAt
                  : 0;

            return (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className="neu-inset rounded-xl p-3"
              >
                <div className="flex gap-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                    {item.phase === "uplink" || item.phase === "processing" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 size={16} className="animate-spin text-cyan-300" />
                      </div>
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.file.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-white/35">
                          {formatMimeShort(item.file.type)} · {formatBytes(item.file.size)}
                          {photo?.ingestMs != null ? ` · srv ${photo.ingestMs}ms` : ""}
                        </p>
                      </div>
                      <TechStatusChip
                        code={phaseLabel(item.phase)}
                        label={
                          item.phase === "processing"
                            ? processingStep(item)
                            : item.phase === "done"
                              ? "COMMITTED"
                              : item.phase === "error"
                                ? "FAILED"
                                : item.phase.toUpperCase()
                        }
                        tone={phaseTone(item.phase)}
                      />
                    </div>

                    {(item.phase === "uplink" || item.phase === "queued") && (
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between font-mono text-[9px] text-white/30">
                          <span>SEGMENT::{String(index + 1).padStart(2, "0")}</span>
                          <span>{item.phase === "uplink" ? `${item.progress}%` : "—"}</span>
                        </div>
                        <div className="upload-track upload-track-sm">
                          <div
                            className="upload-fill"
                            style={{ width: `${item.phase === "uplink" ? item.progress : 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {item.phase === "processing" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <TechStatusChip code="EXIF" label="parsing" tone="amber" />
                        <TechStatusChip code="GPS" label="scanning" tone="amber" />
                        <TechStatusChip code="RT" label="matching" tone="amber" />
                      </div>
                    )}

                    {item.phase === "done" && photo && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                          {photo.hasGps ? (
                            <TechStatusChip code="GPS" label="LOCK" tone="emerald" />
                          ) : (
                            <TechStatusChip code="GPS" label="NO FIX" tone="amber" />
                          )}
                          {photo.matchStatus === "routed" ? (
                            <TechStatusChip code="RT" label="MATCHED" tone="violet" />
                          ) : (
                            <TechStatusChip code="RT" label="QUEUED" tone="muted" />
                          )}
                          <TechStatusChip code="ID" label={shortId(photo.id)} tone="muted" />
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[10px] text-white/40 sm:grid-cols-3">
                          {formatResolution(photo.width, photo.height) && (
                            <span className="inline-flex items-center gap-1">
                              <Scan size={10} />
                              {formatResolution(photo.width, photo.height)}
                            </span>
                          )}
                          {formatCoords(photo.lat, photo.lng) && (
                            <span className="inline-flex items-center gap-1 text-cyan-400/70">
                              <Satellite size={10} />
                              {formatCoords(photo.lat, photo.lng)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <HardDrive size={10} />
                            {formatDuration(duration)} total
                          </span>
                          {photo.takenAt && (
                            <span>CAP {formatDate(photo.takenAt)}</span>
                          )}
                          {photo.siteName && (
                            <span className="col-span-2 inline-flex items-center gap-1 text-violet-300/80">
                              <MapPin size={10} />
                              → {photo.siteName}
                            </span>
                          )}
                          {formatUploaderDetail(photo.uploader) && (
                            <span className="col-span-2 text-cyan-300/75">
                              OP::{formatUploaderDetail(photo.uploader)}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {item.phase === "error" && (
                      <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] text-rose-400">
                        <AlertCircle size={12} />
                        {item.error ?? "Upload failed"}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-center justify-center">
                    {item.phase === "done" && <CheckCircle2 size={18} className="text-emerald-400" />}
                    {item.phase === "error" && <AlertCircle size={18} className="text-rose-400" />}
                    {(item.phase === "uplink" || item.phase === "processing") && (
                      <Radio size={18} className="animate-pulse text-cyan-400" />
                    )}
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}