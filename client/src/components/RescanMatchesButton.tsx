import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { rematchAllPhotos } from "../lib/api";
import { useLiveData } from "../lib/LiveDataContext";

interface RescanMatchesButtonProps {
  variant?: "primary" | "ghost";
  compact?: boolean;
  className?: string;
  onMessage?: (message: string) => void;
}

export function RescanMatchesButton({
  variant = "primary",
  compact = false,
  className = "",
  onMessage,
}: RescanMatchesButtonProps) {
  const { invalidate } = useLiveData();
  const [scanning, setScanning] = useState(false);

  const handleRescan = async () => {
    setScanning(true);
    try {
      const result = await rematchAllPhotos();
      const message =
        result.matched > 0
          ? `Rescan routed ${result.matched} asset${result.matched === 1 ? "" : "s"}.`
          : "Rescan complete — no new matches within range.";
      onMessage?.(message);
      invalidate();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setScanning(false);
    }
  };

  const baseClass =
    variant === "primary"
      ? "btn-primary"
      : "btn-ghost";

  return (
    <button
      type="button"
      disabled={scanning}
      onClick={() => void handleRescan()}
      className={`${baseClass} inline-flex items-center justify-center gap-2 rounded-xl font-mono text-xs uppercase tracking-wider disabled:opacity-50 ${compact ? "px-3 py-2" : "px-4 py-2.5"} ${className}`}
      title="Release held assets and rerun GPS auto-matching"
    >
      <RefreshCw size={compact ? 12 : 14} className={scanning ? "animate-spin" : ""} />
      {scanning ? "Scanning…" : compact ? "Rescan" : "Rescan matches"}
    </button>
  );
}