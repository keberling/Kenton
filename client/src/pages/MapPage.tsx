import { motion } from "framer-motion";
import { MapPin, Satellite } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { TechMeta, TechMetaRow, TechStatusChip } from "../components/TechMeta";
import { UsSketchMap } from "../components/UsSketchMap";
import { useLivePoll } from "../lib/LiveDataContext";
import { getPhotoGeoPoints } from "../lib/api";
import { clusterGeoPoints } from "../lib/usProjection";

export function MapPage() {
  const [points, setPoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    getPhotoGeoPoints()
      .then((result) => {
        setPoints(result.points);
        setTotal(result.total);
      })
      .catch(() => {
        setPoints([]);
        setTotal(0);
      });
  }, []);

  useLivePoll(load, []);

  const clusters = useMemo(() => clusterGeoPoints(points), [points]);
  const onMap = useMemo(() => clusters.reduce((sum, c) => sum + c.count, 0), [clusters]);

  return (
    <div className="absolute inset-0">
      <div className="h-full w-full">
        {onMap === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <Satellite size={32} className="t-faint" />
            <p className="mt-4 max-w-md text-sm t-muted">
              No US GPS origins yet. Capture photos on-site — EXIF coordinates will appear here on
              the origin map.
            </p>
          </div>
        ) : (
          <UsSketchMap points={points} fullscreen />
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-3 sm:p-4">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel window pointer-events-auto rounded-2xl px-4 py-3"
        >
          <p className="hud-label">Capture telemetry</p>
          <h1 className="font-display mt-1 text-lg font-bold tracking-tight sm:text-xl">
            Origin map
          </h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TechStatusChip code="VIEW" label="albers" tone="muted" />
            <TechStatusChip code="GPS" label={`${onMap} plotted`} tone="cyan" />
            <TechStatusChip code="LIVE" label="polling" tone="emerald" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="pointer-events-auto flex flex-wrap gap-2"
        >
          {[
            { label: "GPS fixes", value: total, icon: Satellite },
            { label: "Clusters", value: clusters.length, icon: MapPin },
            { label: "Largest", value: clusters[0]?.count ?? 0, icon: MapPin },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="panel window flex min-w-[5.5rem] items-center gap-2.5 rounded-2xl px-3 py-2.5"
              >
                <Icon size={14} className="t-accent shrink-0" />
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-wider t-faint">
                    {stat.label}
                  </p>
                  <p className="font-display text-xl font-bold tabular-nums t-accent">{stat.value}</p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:p-4 lg:pb-4"
      >
        <div className="panel window pointer-events-auto rounded-2xl px-4 py-3">
          <TechMetaRow>
            <TechMeta label="Projection" value="Albers USA" accent="muted" />
            <TechMeta label="Clusters" value={`${clusters.length} nodes`} accent="cyan" />
            <TechMeta label="Assets plotted" value={`${onMap}/${total}`} accent="emerald" />
            <TechMeta label="States" value="50 + AK/HI" accent="violet" />
          </TechMetaRow>
          <p className="mt-2 font-mono text-[10px] t-faint">
            International captures outside the US are excluded. Dots aggregate captures within ~11
            km.
          </p>
        </div>
      </motion.div>
    </div>
  );
}