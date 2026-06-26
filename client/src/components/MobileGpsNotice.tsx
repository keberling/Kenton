import { MapPin, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  captureLocationOnGesture,
  getGeolocationPermissionState,
  isLikelyMobileBrowser,
  type GeolocationPermissionState,
} from "../lib/deviceLocation";

export function MobileGpsNotice() {
  const [permission, setPermission] = useState<GeolocationPermissionState>("prompt");
  const mobile = isLikelyMobileBrowser();

  useEffect(() => {
    if (!mobile) return;
    void getGeolocationPermissionState().then(setPermission);
  }, [mobile]);

  if (!mobile) return null;

  const denied = permission === "denied";

  return (
    <div
      className={`panel window rounded-2xl px-5 py-4 ${
        denied ? "border border-amber-400/25" : "border border-cyan-400/15"
      }`}
    >
      <div className="flex items-start gap-3">
        {denied ? (
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-300" />
        ) : (
          <MapPin size={18} className="mt-0.5 shrink-0 text-cyan-300" />
        )}
        <div className="min-w-0">
          <p className="hud-label text-cyan-300/80">Android photo picker note</p>
          <p className="mt-2 text-sm leading-relaxed t-subtle">
            Your phone may show Naperville (or other location) in Google Photos, but Android strips GPS
            from photos before Chrome can read them. Kenton uses your phone&apos;s live location instead
            when photo EXIF is missing.
          </p>
          {denied ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-amber-200/90">
                Location permission is blocked for this site. Enable it in Chrome → Site settings → Location.
              </p>
              <button
                type="button"
                onClick={() => {
                  captureLocationOnGesture();
                  void getGeolocationPermissionState().then(setPermission);
                }}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm"
              >
                <MapPin size={14} />
                Retry location access
              </button>
            </div>
          ) : (
            <p className="mt-2 font-mono text-[10px] text-white/35">
              Allow location when prompted · uploads tag as DEVICE FIX in the pipeline
            </p>
          )}
        </div>
      </div>
    </div>
  );
}