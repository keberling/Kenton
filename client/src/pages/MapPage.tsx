import { motion } from "framer-motion";
import { MapPin, Satellite } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
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
    <div className="space-y-8">
      <PageHeader
        eyebrow="Capture telemetry"
        title="Origin map"
        description="Lower-48 origin map — each dot is where a field photo locked GPS on ingest. Cluster size reflects capture density."
        action={
          <div className="flex flex-wrap gap-1.5">
            <TechStatusChip code="VIEW" label="albers" tone="muted" />
            <TechStatusChip code="GPS" label={`${onMap} plotted`} tone="cyan" />
            <TechStatusChip code="LIVE" label="polling" tone="emerald" />
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "GPS fixes", value: total, icon: Satellite },
          { label: "Origin clusters", value: clusters.length, icon: MapPin },
          {
            label: "Largest cluster",
            value: clusters[0]?.count ?? 0,
            icon: MapPin,
          },
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="panel window rounded-2xl p-4"
            >
              <div className="flex items-start justify-between">
                <p className="hud-label">{stat.label}</p>
                <Icon size={15} className="t-accent" />
              </div>
              <p className="font-display mt-3 text-3xl font-bold tabular-nums t-accent">
                {stat.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="panel window overflow-hidden rounded-2xl p-4 sm:p-6"
      >
        {onMap === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <Satellite size={32} className="t-faint" />
            <p className="mt-4 max-w-md text-sm t-muted">
              No continental US GPS origins yet. Capture photos on-site — EXIF coordinates will
              appear here on the origin map.
            </p>
          </div>
        ) : (
          <UsSketchMap points={points} />
        )}

        <div className="mt-5 border-t border-theme pt-4">
          <TechMetaRow>
            <TechMeta label="Projection" value="Albers USA" accent="muted" />
            <TechMeta label="Clusters" value={`${clusters.length} nodes`} accent="cyan" />
            <TechMeta label="Assets plotted" value={`${onMap}/${total}`} accent="emerald" />
            <TechMeta label="States" value="lower-48" accent="violet" />
          </TechMetaRow>
          <p className="mt-3 font-mono text-[10px] t-faint">
            Alaska, Hawaii, and international captures are excluded from this map.
            Dots aggregate captures within ~11 km.
          </p>
        </div>
      </motion.section>
    </div>
  );
}