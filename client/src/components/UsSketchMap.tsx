import { motion } from "framer-motion";
import { clusterGeoPoints, outlinePath, projectUS } from "../lib/usProjection";

interface UsSketchMapProps {
  points: Array<{ lat: number; lng: number }>;
}

const MAP_WIDTH = 1000;
const MAP_HEIGHT = 620;

function dotRadius(count: number): number {
  if (count >= 20) return 9;
  if (count >= 8) return 7;
  if (count >= 3) return 5.5;
  return 4;
}

export function UsSketchMap({ points }: UsSketchMapProps) {
  const clusters = clusterGeoPoints(points);
  const path = outlinePath({ width: MAP_WIDTH, height: MAP_HEIGHT, padding: 36 });
  const maxCount = clusters[0]?.count ?? 1;

  return (
    <div className="us-sketch-map relative mx-auto w-full max-w-4xl">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Sketch map of the United States showing field photo origins"
      >
        <defs>
          <filter id="pencil-grain" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.6" />
          </filter>
          <radialGradient id="origin-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.95" />
            <stop offset="70%" stopColor="var(--accent)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Paper wash */}
        <rect
          x="18"
          y="18"
          width={MAP_WIDTH - 36}
          height={MAP_HEIGHT - 36}
          rx="18"
          className="us-sketch-paper"
        />

        {/* Pencil outline — ghost stroke */}
        <path
          d={path}
          className="us-sketch-outline-ghost"
          transform="translate(0.6,0.8)"
        />

        {/* Pencil outline — primary */}
        <motion.path
          d={path}
          className="us-sketch-outline"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.6, ease: "easeInOut" }}
          filter="url(#pencil-grain)"
        />

        {/* Lat/lng grid ticks (subtle) */}
        {[30, 40, 50].map((lat) => {
          const { y } = projectUS(lat, -98, { width: MAP_WIDTH, height: MAP_HEIGHT, padding: 36 });
          return (
            <line
              key={`lat-${lat}`}
              x1={48}
              x2={MAP_WIDTH - 48}
              y1={y}
              y2={y}
              className="us-sketch-grid"
            />
          );
        })}

        {/* Origin clusters */}
        {clusters.map((cluster, index) => {
          const { x, y } = projectUS(cluster.lat, cluster.lng, {
            width: MAP_WIDTH,
            height: MAP_HEIGHT,
            padding: 36,
          });
          const r = dotRadius(cluster.count);

          return (
            <g key={`${cluster.lat}-${cluster.lng}`} filter="url(#dot-glow)">
              <motion.circle
                cx={x}
                cy={y}
                r={r + 4}
                fill="url(#origin-glow)"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 0.35 + (cluster.count / maxCount) * 0.35, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.03, duration: 0.45 }}
              />
              <motion.circle
                cx={x}
                cy={y}
                r={r}
                className="us-sketch-dot"
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45 + index * 0.03, duration: 0.4 }}
              />
              {cluster.count > 1 && (
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  className="us-sketch-dot-label"
                >
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