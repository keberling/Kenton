import { motion } from "framer-motion";
import { FolderOpen, ImagePlus, Loader2, RefreshCw, Share2, Upload, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileGpsNotice } from "../components/MobileGpsNotice";
import { PageHeader } from "../components/PageHeader";
import { StatCards } from "../components/StatCards";
import { TechMeta, TechMetaRow, TechStatusChip } from "../components/TechMeta";
import { DeploymentRecommendationPanel } from "../components/DeploymentRecommendationPanel";
import { UploadPipeline } from "../components/UploadPipeline";
import { useAuth } from "../lib/AuthContext";
import { useIngest } from "../lib/IngestContext";
import { useLiveData } from "../lib/LiveDataContext";
import { formatBytes } from "../lib/format";
import { canOpenOriginalFiles, pickOriginalImageFiles } from "../lib/openFiles";
import { isLikelyMobileBrowser } from "../lib/pwa";
import { drainShareInbox } from "../lib/shareInbox";

/** Explicit image types — avoids mobile browsers treating `image/*` as camera capture. */
const GALLERY_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif";

export function UploadPage() {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openingFiles, setOpeningFiles] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { stats } = useLiveData();
  const { config, user, login, signingIn } = useAuth();
  const {
    queue,
    batchId,
    sessionStartedAt,
    uploading,
    error,
    startIngest,
    clearError,
    retryFailed,
  } = useIngest();
  const failedCount = queue.filter((item) => item.phase === "error").length;
  const mobile = isLikelyMobileBrowser();
  const supportsOriginalPicker = canOpenOriginalFiles();

  const ingestIncomingFiles = (files: FileList | File[]) => {
    clearError();
    void startIngest(files);
  };

  useEffect(() => {
    if (!searchParams.get("share")) return;
    void drainShareInbox().then((files) => {
      if (files.length) ingestIncomingFiles(files);
    });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) ingestIncomingFiles(event.target.files);
    event.target.value = "";
  };

  const handleOpenOriginalFiles = async () => {
    clearError();
    setOpeningFiles(true);
    try {
      const files = await pickOriginalImageFiles();
      if (files.length) ingestIncomingFiles(files);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error(err);
    } finally {
      setOpeningFiles(false);
    }
  };

  const totalQueuedBytes = queue.reduce((s, i) => s + i.file.size, 0);
  const showPipeline = queue.length > 0;
  const completedPhotos = useMemo(
    () => queue.filter((item) => item.phase === "done" && item.result).map((item) => item.result!),
    [queue],
  );
  const needsDeployment = useMemo(
    () =>
      !uploading &&
      completedPhotos.some(
        (photo) =>
          photo.matchStatus === "queued" ||
          photo.matchStatus === "no_fix" ||
          (!photo.siteId && photo.lat != null),
      ),
    [completedPhotos, uploading],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Asset ingest"
        title="Field capture"
        description="Drop install photos from the jobsite. Per-asset uplink telemetry, EXIF GPS extraction, and deployment routing in real time. Pipeline keeps running if you switch tabs."
        action={
          <div className="flex flex-wrap gap-1.5">
            <TechStatusChip code="PIPE" label={uploading ? "ACTIVE" : "IDLE"} tone={uploading ? "cyan" : "muted"} />
            <TechStatusChip code="BG" label="persistent" tone="emerald" />
            <TechStatusChip code="RES" label="chunk·retry·idb" tone="violet" />
            <TechStatusChip code="MAX" label="30MB/asset" tone="muted" />
            <TechStatusChip code="FMT" label="JPEG·PNG·HEIC" tone="muted" />
          </div>
        }
      />

      {stats && <StatCards stats={stats} />}

      <MobileGpsNotice canOpenOriginals={supportsOriginalPicker} />

      {config.enabled && config.required && !user && (
        <div className="panel window rounded-2xl border border-amber-400/20 px-5 py-4">
          <p className="hud-label text-amber-300/80">Identity required</p>
          <p className="mt-2 text-sm t-subtle">
            Field ingest is tied to your Microsoft account. Sign in so every upload records who captured it,
            with email, role, and department when available from Entra ID.
          </p>
          <button
            onClick={() => void login()}
            disabled={signingIn}
            className="btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {signingIn ? "Redirecting to Microsoft…" : "Sign in with Microsoft"}
          </button>
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`panel window relative overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center sm:p-12 ${
          dragOver ? "border-cyan-400/40" : "border-white/[0.08]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) ingestIncomingFiles(e.dataTransfer.files);
        }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-400/5 via-transparent to-violet-500/5" />

        <input
          ref={galleryInputRef}
          type="file"
          accept={GALLERY_ACCEPT}
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="neu-raised-sm relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl">
          {uploading ? (
            <Loader2 size={32} className="animate-spin text-cyan-300" />
          ) : (
            <ImagePlus size={32} className="text-cyan-300" />
          )}
        </div>

        <h3 className="font-display relative mt-6 text-2xl font-bold text-white sm:text-3xl">
          {dragOver ? "Release to ingest" : uploading ? "Ingest in progress…" : "Ingest field photos"}
        </h3>
        <p className="relative mx-auto mt-3 max-w-lg text-sm leading-relaxed text-white/45">
          Rack shots, cable runs, display mounts, rack elevations — sequential uplink with live segment
          telemetry per asset. Images compress before uplink, large files ship in 256KB chunks with auto-retry,
          and pending uploads persist offline until they commit.
        </p>

        <div className="relative mx-auto mt-5 max-w-md">
          <TechMetaRow>
            <TechMeta label="Protocol" value="HTTP POST" accent="muted" />
            <TechMeta label="Encoder" value="multipart" accent="muted" />
            <TechMeta label="Pipeline" value="EXIF→GPS→RT" accent="cyan" />
            <TechMeta label="Concurrency" value="1× sequential" accent="muted" />
          </TechMetaRow>
        </div>

        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          {supportsOriginalPicker && (
            <button
              type="button"
              onClick={() => void handleOpenOriginalFiles()}
              disabled={openingFiles}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm"
            >
              {openingFiles ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              Open original file
            </button>
          )}
          {mobile ? (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className={`${supportsOriginalPicker ? "btn-ghost" : "btn-primary"} inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm`}
            >
              <Upload size={16} />
              Photo library
            </button>
          ) : (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className={`${supportsOriginalPicker ? "btn-ghost" : "btn-primary"} inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm`}
            >
              <Upload size={16} />
              {uploading ? "Add to queue" : "Photo library"}
            </button>
          )}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn-ghost inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm"
          >
            <Zap size={16} />
            Take photo
          </button>
        </div>

        {mobile && (
          <p className="relative mx-auto mt-4 max-w-md text-xs leading-relaxed text-white/35">
            <Share2 size={12} className="mr-1 inline text-emerald-300/80" />
            Best GPS path: add Kenton to your home screen, then share photos from Google Photos into Kenton.
          </p>
        )}

        {showPipeline && !uploading && (
          <p className="relative mt-4 font-mono text-[10px] text-white/30">
            Last batch · {queue.length} files · {formatBytes(totalQueuedBytes)}
          </p>
        )}
      </motion.section>

      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-3 font-mono text-sm text-rose-300 ring-1 ring-rose-400/25">
          {error}
        </div>
      )}

      {failedCount > 0 && (
        <div className="panel window rounded-2xl px-5 py-4">
          <p className="hud-label text-rose-300/80">Uplink interrupted</p>
          <p className="mt-2 text-sm t-subtle">
            {failedCount} asset{failedCount === 1 ? "" : "s"} saved locally and ready to resume when your connection stabilizes.
          </p>
          <button
            onClick={() => retryFailed()}
            className="btn-primary mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
          >
            <RefreshCw size={14} />
            Retry failed uploads
          </button>
        </div>
      )}

      {showPipeline && batchId && (
        <UploadPipeline
          batchId={batchId}
          items={queue}
          sessionStartedAt={sessionStartedAt}
          active={uploading}
        />
      )}

      {needsDeployment && (
        <DeploymentRecommendationPanel
          photos={completedPhotos}
          title="No deployment matched these captures"
          onCreated={() => clearError()}
        />
      )}
    </div>
  );
}