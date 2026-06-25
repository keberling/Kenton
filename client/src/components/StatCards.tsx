import { motion } from "framer-motion";
import { Camera, MapPinned, Radio, Satellite } from "lucide-react";
import type { Stats } from "../types";

interface StatCardsProps {
  stats: Stats;
}

const config = [
  { key: "totalPhotos" as const, label: "Total assets", icon: Camera, accent: "text-cyan-300", glow: "shadow-cyan-500/20" },
  { key: "unassignedPhotos" as const, label: "Awaiting match", icon: Radio, accent: "text-amber-300", glow: "shadow-amber-500/20" },
  { key: "sites" as const, label: "Deployments", icon: MapPinned, accent: "text-violet-300", glow: "shadow-violet-500/20" },
  { key: "photosWithGps" as const, label: "GPS locked", icon: Satellite, accent: "text-emerald-300", glow: "shadow-emerald-500/20" },
];

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {config.map((item, index) => {
        const Icon = item.icon;
        const value = stats[item.key];
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="panel panel-interactive window rounded-2xl p-4"
          >
            <div className="flex items-start justify-between">
              <p className="hud-label">{item.label}</p>
              <Icon size={16} className={item.accent} />
            </div>
            <p className={`font-display mt-3 text-3xl font-bold tabular-nums ${item.accent}`}>
              {value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}