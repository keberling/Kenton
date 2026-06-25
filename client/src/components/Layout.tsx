import { Activity, Cpu, Images, MapPinned, Radio, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { AmbientBackground } from "./AmbientBackground";
import { ThemePicker } from "./ThemePicker";
import { useTheme } from "../lib/ThemeContext";
import { getStats } from "../lib/api";
import type { Stats } from "../types";

const links = [
  { to: "/", label: "Ingest", icon: Upload, code: "ING" },
  { to: "/sites", label: "Deployments", icon: MapPinned, code: "DEP" },
  { to: "/photos", label: "Archive", icon: Images, code: "ARC" },
];

export function Layout() {
  const location = useLocation();
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);

  const refreshStats = useCallback(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    refreshStats();
  }, [location.pathname, refreshStats]);

  return (
    <div className="theme-root relative min-h-dvh">
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-[1600px]">
        <aside className="panel safe-bottom fixed inset-y-0 left-0 z-20 hidden w-64 flex-col lg:flex">
          <div className="border-b border-theme px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="neu-raised-sm relative flex h-11 w-11 items-center justify-center rounded-xl">
                <Cpu size={20} className="t-accent" />
                <span className="status-dot status-dot-live absolute -right-0.5 -top-0.5" />
              </div>
              <div>
                <h1 className="font-display text-lg font-bold tracking-tight">
                  <span className="text-gradient">Kenton</span>
                </h1>
                <p className="font-mono text-[10px] tracking-widest t-faint">INSTALL OPS v1</p>
              </div>
            </div>
            <p className="mt-2 font-mono text-[9px] t-faint">
              {theme.code} · {theme.name}
            </p>
          </div>

          <nav className="flex-1 space-y-1.5 p-3">
            {links.map(({ to, label, icon: Icon, code }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-3 transition ${
                    isActive
                      ? "neu-inset t-accent"
                      : "t-subtle hover-shake hover-lift hover:t-fg"
                  }`
                }
              >
                <Icon size={18} className="shrink-0" />
                <span className="font-medium">{label}</span>
                <span className="font-mono ml-auto text-[10px] tracking-wider opacity-60 group-hover:opacity-90">
                  {code}
                </span>
              </NavLink>
            ))}
          </nav>

          {stats && (
            <div className="border-t border-theme p-4">
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
                  <div
                    key={item.label}
                    className="neu-inset hover-shake rounded-xl px-2.5 py-2 transition"
                  >
                    <p className="font-mono text-[9px] uppercase tracking-wider t-faint">{item.label}</p>
                    <p className="font-display text-lg font-bold tabular-nums t-fg">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <ThemePicker />
        </aside>

        <div className="flex min-h-dvh flex-1 flex-col lg:pl-64">
          <header className="panel mobile-header-bg sticky top-0 z-10 rounded-none border-x-0 border-t-0 px-4 py-4 sm:px-6 lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="neu-raised-sm flex h-9 w-9 items-center justify-center rounded-lg">
                  <Cpu size={16} className="t-accent" />
                </div>
                <div>
                  <p className="font-display text-base font-bold">
                    <span className="text-gradient">Kenton</span>
                  </p>
                  <p className="font-mono text-[9px] tracking-widest t-faint">AV · IT INSTALL OPS</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {stats && (
                  <div className="glass-badge flex items-center gap-2 rounded-full px-3 py-1.5">
                    <Radio size={12} className="t-success" />
                    <span className="font-mono text-xs tabular-nums t-muted">{stats.totalPhotos} assets</span>
                  </div>
                )}
                <ThemePicker compact />
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      <nav className="panel window safe-bottom fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 gap-1.5 rounded-2xl p-1.5 lg:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `relative flex min-h-14 flex-col items-center justify-center rounded-xl px-2 py-2 text-[10px] font-medium transition ${
                isActive ? "neu-inset t-accent" : "t-subtle hover-shake"
              }`
            }
          >
            <Icon size={20} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}