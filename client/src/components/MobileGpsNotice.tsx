import { FolderOpen, Share2, ShieldAlert } from "lucide-react";
import { isLikelyMobileBrowser } from "../lib/pwa";

interface MobileGpsNoticeProps {
  canOpenOriginals: boolean;
}

export function MobileGpsNotice({ canOpenOriginals }: MobileGpsNoticeProps) {
  const mobile = isLikelyMobileBrowser();
  if (!mobile) return null;

  return (
    <div className="panel window rounded-2xl border border-cyan-400/15 px-5 py-4">
      <div className="flex items-start gap-3">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-cyan-300" />
        <div className="min-w-0 space-y-3">
          <div>
            <p className="hud-label text-cyan-300/80">Android keeps photo GPS — Chrome does not</p>
            <p className="mt-2 text-sm leading-relaxed t-subtle">
              Google Photos shows Naperville because the original file has embedded coordinates. Android&apos;s
              photo library picker strips that data before Chrome can read it, even for uploads days later at
              the office. Use one of the options below to pass the real file bytes.
            </p>
          </div>

          <div className="space-y-2 text-sm t-subtle">
            <p className="inline-flex items-start gap-2">
              <Share2 size={14} className="mt-0.5 shrink-0 text-emerald-300" />
              <span>
                <strong className="text-white/80">Share from Google Photos</strong> — Add Kenton to your home
                screen, open a photo in Google Photos, tap Share, choose Kenton. This keeps embedded GPS.
              </span>
            </p>
            {canOpenOriginals && (
              <p className="inline-flex items-start gap-2">
                <FolderOpen size={14} className="mt-0.5 shrink-0 text-cyan-300" />
                <span>
                  <strong className="text-white/80">Open original file</strong> — Uses Android&apos;s document
                  picker, which retains EXIF location (unlike Photo library).
                </span>
              </p>
            )}
          </div>

          <p className="font-mono text-[10px] text-amber-300/80">
            Avoid &quot;Photo library&quot; on Android for GPS-tagged field photos.
          </p>
        </div>
      </div>
    </div>
  );
}