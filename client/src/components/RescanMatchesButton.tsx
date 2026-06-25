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

function formatRescanMessage(result: {
  scanned: number;
  matched: number;
  reassigned: number;
  unassigned: number;
}): string {
  const parts: string[] = [];
  if (result.matched > 0) {
    parts.push(`${result.matched} newly routed`);
  }
  if (result.reassigned > 0) {
    parts.push(`${result.reassigned} rerouted to nearest site`);
  }
  if (result.unassigned > 0) {
    parts.push(`${result.unassigned} sent to queue (nothing within ~2 mi)`);
  }

  if (parts.length === 0) {
    return `Rescan complete — ${result.scanned} asset${result.scanned === 1 ? "" : "s"} checked, all routes valid.`;
  }

  return `Rescan complete — ${parts.join(", ")}.`;
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
      onMessage?.(formatRescanMessage(result));
      invalidate();
    } catch (err) {
      onMessage?.(err instanceof Error ? err.message : "Rescan failed");
    } finally {
      setScanning(false);
    }
  };

  const baseClass = variant === "primary" ? "btn-primary" : "btn-ghost";

  return (
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
  );
}