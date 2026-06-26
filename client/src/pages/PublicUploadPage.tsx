import { motion } from "framer-motion";
import { FolderOpen, ImagePlus, Loader2, LogIn, Share2, Upload, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileGpsNotice } from "../components/MobileGpsNotice";
import { UploadPipeline } from "../components/UploadPipeline";
import { useAuth } from "../lib/AuthContext";
import { useIngest } from "../lib/IngestContext";
import { formatBytes } from "../lib/format";
import { canOpenOriginalFiles, pickOriginalImageFiles } from "../lib/openFiles";
import { isLikelyMobileBrowser } from "../lib/pwa";
import { APP_BASE } from "../lib/routes";
import { drainShareInbox } from "../lib/shareInbox";

const GALLERY_ACCEPT =
  "image/jpeg,image/jpg,image/png,image/heic,image/heif,image/webp,image/gif";

export function PublicUploadPage() {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openingFiles, setOpeningFiles] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { config, user, login, signingIn } = useAuth();
  const { queue, batchId, sessionStartedAt, uploading, error, startIngest, clearError, retryFailed } =
    useIngest();
  const mobile = isLikelyMobileBrowser();
  const supportsOriginalPicker = canOpenOriginalFiles();
  const failedCount = queue.filter((item) => item.phase === "error").length;
  const showPipeline = queue.length > 0;

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

  return (
    <div className="space-y-6">
      <MobileGpsNotice canOpenOriginals={supportsOriginalPicker} />

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`panel window rounded-2xl border-2 border-dashed p-6 text-center sm:p-8 ${
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
        <input
          ref={galleryInputRef}
          type="file"
          accept={GALLERY_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) ingestIncomingFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) ingestIncomingFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="neu-raised-sm mx-auto flex h-16 w-16 items-center justify-center rounded-2xl">
          {uploading ? (
            <Loader2 size={28} className="animate-spin text-cyan-300" />
          ) : (
            <ImagePlus size={28} className="text-cyan-300" />
          )}
        </div>

        <h2 className="font-display mt-5 text-2xl font-bold text-white">
          {dragOver ? "Release to upload" : "Upload field photos"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          No login needed. Photos upload with GPS metadata when available and route to deployments
          automatically.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {supportsOriginalPicker && (
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  setOpeningFiles(true);
                  try {
                    const files = await pickOriginalImageFiles();
                    if (files.length) ingestIncomingFiles(files);
                  } finally {
                    setOpeningFiles(false);
                  }
                })();
              }}
              disabled={openingFiles}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
            >
              <FolderOpen size={16} />
              Open original
            </button>
          )}
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className={`${supportsOriginalPicker ? "btn-ghost" : "btn-primary"} inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm`}
          >
            <Upload size={16} />
            Photo library
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm"
          >
            <Zap size={16} />
            Camera
          </button>
        </div>

        {mobile && (
          <p className="mx-auto mt-4 max-w-sm text-xs text-white/35">
            <Share2 size={12} className="mr-1 inline text-emerald-300/80" />
            Share from Google Photos into Kenton for embedded GPS on Android.
          </p>
        )}
      </motion.section>

      {error && (
        <div className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {showPipeline && batchId && (
        <UploadPipeline
          batchId={batchId}
          items={queue}
          sessionStartedAt={sessionStartedAt}
          active={uploading}
        />
      )}

      {failedCount > 0 && (
        <button onClick={() => retryFailed()} className="btn-primary rounded-xl px-4 py-2 text-sm">
          Retry failed uploads
        </button>
      )}

      <section className="panel window rounded-2xl border border-white/10 px-5 py-5">
        <p className="hud-label text-cyan-300/80">Staff access</p>
        <p className="mt-2 text-sm text-white/45">
          Sign in to manage deployments, review the match queue, browse the archive, and run backups.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {user && config.viewRequired ? (
            <Link to={`${APP_BASE}/sites`} className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm">
              Open staff dashboard
            </Link>
          ) : config.enabled && config.viewRequired ? (
            <button
              type="button"
              onClick={() => void login()}
              disabled={signingIn}
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm disabled:opacity-50"
            >
              <LogIn size={16} />
              {signingIn ? "Redirecting…" : "Sign in with Microsoft"}
            </button>
          ) : (
            <Link to={`${APP_BASE}/sites`} className="btn-primary rounded-xl px-5 py-2.5 text-sm">
              Open dashboard
            </Link>
          )}
        </div>
      </section>

      {showPipeline && !uploading && (
        <p className="text-center font-mono text-[10px] text-white/30">
          {queue.length} files · {formatBytes(queue.reduce((s, i) => s + i.file.size, 0))}
        </p>
      )}
    </div>
  );
}