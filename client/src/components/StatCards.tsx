import { motion } from "framer-motion";
import { Camera, MapPinned, Radio, Satellite } from "lucide-react";
import type { Stats } from "../types";

interface StatCardsProps {
  stats: Stats;
}

const config = [
  { key: "totalPhotos" as const, label: "Total assets", icon: Camera, accent: "t-accent" },
  { key: "unassignedPhotos" as const, label: "Awaiting match", icon: Radio, accent: "t-warn" },
  { key: "sites" as const, label: "Deployments", icon: MapPinned, accent: "t-accent-2" },
  { key: "photosWithGps" as const, label: "GPS locked", icon: Satellite, accent: "t-success" },
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
            <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-white/25">
              SYS::{item.key.replace(/([A-Z])/g, "_$1").toUpperCase()}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}