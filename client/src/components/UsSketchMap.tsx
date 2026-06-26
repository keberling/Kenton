import { motion } from "framer-motion";
import { useMemo } from "react";
import {
  MAP_STATES,
  clusterGeoPoints,
  createUsMapContext,
  projectUS,
} from "../lib/usProjection";

interface UsSketchMapProps {
  points: Array<{ lat: number; lng: number }>;
  fullscreen?: boolean;
}

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 620;
const MAP_PADDING = 28;

function dotRadius(count: number): number {
  if (count >= 20) return 11;
  if (count >= 8) return 8;
  if (count >= 3) return 6;
  return 4.5;
}

export function UsSketchMap({ points, fullscreen = false }: UsSketchMapProps) {
  const map = useMemo(
    () => createUsMapContext({ width: MAP_WIDTH, height: MAP_HEIGHT, padding: MAP_PADDING }),
    [],
  );
  const clusters = clusterGeoPoints(points);
  const maxCount = clusters[0]?.count ?? 1;

  return (
    <div
      className={`us-origin-map relative h-full w-full ${fullscreen ? "" : "mx-auto max-w-5xl"}`}
    >
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        className={fullscreen ? "h-full w-full" : "h-auto w-full"}
        role="img"
        aria-label="Map of the United States including Alaska and Hawaii showing field photo GPS origins"
      >
        <defs>
          <radialGradient id="origin-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="65%" stopColor="var(--accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <filter id="origin-dot-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {fullscreen ? (
          <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} className="us-map-canvas-full" />
        ) : (
          <rect
            x={12}
            y={12}
            width={MAP_WIDTH - 24}
            height={MAP_HEIGHT - 24}
            rx={16}
            className="us-map-canvas"
          />
        )}

        <g className="us-map-states">
          {MAP_STATES.map((state) => {
            const d = map.path(state);
            if (!d) return null;
            return (
              <path
                key={state.properties?.name ?? state.id}
                d={d}
                className="us-map-state"
              />
            );
          })}
        </g>

        {/* Subtle latitude guides */}
        {[30, 38, 45].map((lat) => {
          const projected = projectUS(lat, -98, map);
          if (!projected) return null;
          return (
            <line
              key={`lat-${lat}`}
              x1={MAP_PADDING}
              x2={MAP_WIDTH - MAP_PADDING}
              y1={projected.y}
              y2={projected.y}
              className="us-map-grid"
            />
          );
        })}

        {clusters.map((cluster, index) => {
          const projected = projectUS(cluster.lat, cluster.lng, map);
          if (!projected) return null;
          const { x, y } = projected;
          const r = dotRadius(cluster.count);

          return (
            <g key={`${cluster.lat}-${cluster.lng}`} filter="url(#origin-dot-glow)">
              <motion.circle
                cx={x}
                cy={y}
                r={r + 6}
                fill="url(#origin-glow)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 0.25 + (cluster.count / maxCount) * 0.45, scale: 1 }}
                transition={{ delay: 0.15 + index * 0.025, duration: 0.4 }}
              />
              <motion.circle
                cx={x}
                cy={y}
                r={r}
                className="us-map-dot"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + index * 0.025, duration: 0.35 }}
              />
              {cluster.count > 1 && (
                <text x={x} y={y + 3.5} textAnchor="middle" className="us-map-dot-label">
                  {cluster.count}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}