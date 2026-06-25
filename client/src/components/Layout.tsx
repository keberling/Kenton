import { motion } from "framer-motion";
import { Activity, Cpu, Images, MapPinned, Radio, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AmbientBackground } from "./AmbientBackground";
import { getStats } from "../lib/api";
import type { Stats } from "../types";

const links = [
  { to: "/", label: "Ingest", icon: Upload, code: "ING" },
  { to: "/sites", label: "Deployments", icon: MapPinned, code: "DEP" },
  { to: "/photos", label: "Archive", icon: Images, code: "ARC" },
];

export function Layout() {
  const location = useLocation();
  const [stats, setStats] = useState<Stats | null>(null);

  const refreshStats = useCallback(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
  }, [location.pathname, refreshStats]);

  return (
    <div className="relative min-h-dvh text-white">
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="panel safe-bottom fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-white/5 lg:flex">
          <div className="border-b border-white/5 px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400/20 to-violet-500/20 ring-1 ring-cyan-400/30">
                <Cpu size={20} className="text-cyan-300" />
                <span className="status-dot status-dot-live absolute -right-0.5 -top-0.5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  <span className="text-gradient">Kenton</span>
                </h1>
                <p className="font-mono text-[10px] tracking-widest text-white/35">INSTALL OPS v1</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {links.map(({ to, label, icon: Icon, code }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                    isActive
                      ? "bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-400/25"
                      : "text-white/50 hover:bg-white/5 hover:text-white/90"
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="font-medium">{label}</span>
                <span className="font-mono ml-auto text-[10px] tracking-wider opacity-40 group-hover:opacity-70">
                  {code}
                </span>
              </NavLink>
            ))}
          </nav>

          {stats && (
            <div className="border-t border-white/5 p-4">
              <p className="hud-label mb-3 flex items-center gap-2">
                <Activity size={12} />
                Live telemetry
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Assets", value: stats.totalPhotos },
                  { label: "Queued", value: stats.unassignedPhotos },
                  { label: "Sites", value: stats.sites },
                  { label: "GPS", value: stats.photosWithGps },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-black/30 px-2.5 py-2 ring-1 ring-white/5">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-white/35">{item.label}</p>
                    <p className="font-display text-lg font-bold tabular-nums text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex min-h-dvh flex-1 flex-col lg:pl-64">
          <header className="sticky top-0 z-10 border-b border-white/5 bg-[#07080d]/80 px-4 py-4 backdrop-blur-xl sm:px-6 lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400/15 ring-1 ring-cyan-400/30">
                  <Cpu size={16} className="text-cyan-300" />
                </div>
                <div>
                  <p className="font-display text-base font-bold">
                    <span className="text-gradient">Kenton</span>
                  </p>
                  <p className="font-mono text-[9px] tracking-widest text-white/35">AV · IT INSTALL OPS</p>
                </div>
              </div>
              {stats && (
                <div className="flex items-center gap-2 rounded-full bg-black/40 px-3 py-1.5 ring-1 ring-white/10">
                  <Radio size={12} className="text-emerald-400" />
                  <span className="font-mono text-xs tabular-nums text-white/70">{stats.totalPhotos} assets</span>
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Mobile dock */}
      <nav className="panel safe-bottom fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 gap-1 rounded-2xl p-1.5 lg:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-2 text-[10px] font-medium transition ${
                isActive ? "text-cyan-300" : "text-white/40"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.div
                    layoutId="dock-pill"
                    className="absolute inset-0 rounded-xl bg-cyan-400/10 ring-1 ring-cyan-400/25"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <Icon size={20} className="relative z-10" />
                <span className="relative z-10 mt-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}