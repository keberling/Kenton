import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getStats } from "./api";
import { useAuth } from "./AuthContext";
import type { Stats } from "../types";

export const LIVE_POLL_MS = 4000;

interface LiveDataContextValue {
  stats: Stats | null;
  lastSyncAt: number | null;
  syncing: boolean;
  pollTick: number;
  dataVersion: number;
  invalidate: () => void;
  refreshStats: () => Promise<void>;
}

const LiveDataContext = createContext<LiveDataContextValue | null>(null);

export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const { ready, config, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pollTick, setPollTick] = useState(0);
  const [dataVersion, setDataVersion] = useState(0);

  const invalidate = useCallback(() => {
    setDataVersion((v) => v + 1);
  }, []);

  const canPollStats =
    ready && (!config.enabled || !config.viewRequired || Boolean(user));

  const refreshStats = useCallback(async () => {
    if (!canPollStats) return;
    setSyncing(true);
    try {
      const next = await getStats();
      setStats(next);
      setLastSyncAt(Date.now());
    } catch {
      // keep last known stats
    } finally {
      setSyncing(false);
    }
  }, [canPollStats, ready]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats, dataVersion]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPollTick((t) => t + 1);
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", invalidate);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", invalidate);
    };
  }, [invalidate]);

  const value = useMemo(
    () => ({
      stats,
      lastSyncAt,
      syncing,
      pollTick,
      dataVersion,
      invalidate,
      refreshStats,
    }),
    [stats, lastSyncAt, syncing, pollTick, dataVersion, invalidate, refreshStats],
  );

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>;
}

export function useLiveData() {
  const ctx = useContext(LiveDataContext);
  if (!ctx) {
    throw new Error("useLiveData must be used within LiveDataProvider");
  }
  return ctx;
}

/** Re-run fetcher on global poll ticks, invalidation, and local dependency changes. */
export function useLivePoll(
  fetcher: () => void | Promise<void>,
  deps: readonly unknown[],
  enabled = true,
) {
  const { pollTick, dataVersion } = useLiveData();

  useEffect(() => {
    if (!enabled) return;
    void fetcher();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps supplied by caller
  }, [enabled, pollTick, dataVersion, ...deps]);
}