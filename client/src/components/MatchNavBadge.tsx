import { useLiveData } from "../lib/LiveDataContext";

export function MatchNavBadge({
  active,
  compact,
  fallbackCode = "MTCH",
}: {
  active: boolean;
  compact?: boolean;
  fallbackCode?: string;
}) {
  const { stats } = useLiveData();
  const queued = stats?.unassignedPhotos ?? 0;
  if (queued === 0) {
    if (compact) return null;
    return (
      <span className="font-mono ml-auto text-[10px] tracking-wider opacity-60">{fallbackCode}</span>
    );
  }

  if (compact) {
    return (
      <span className="mt-0.5 inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-amber-300/90">
        <span className="status-dot status-dot-warn shrink-0" />
        {queued}
      </span>
    );
  }

  return (
    <span
      className={`ml-auto flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider ${
        active ? "text-amber-200" : "text-amber-300/80"
      }`}
    >
      <span className="status-dot status-dot-warn shrink-0" />
      {queued}
    </span>
  );
}