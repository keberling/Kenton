import { HardHat, Images, MapPin, Upload } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Upload", icon: Upload },
  { to: "/sites", label: "Sites", icon: MapPin },
  { to: "/photos", label: "Photos", icon: Images },
];

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-24 pt-4 sm:px-6 lg:pb-8">
      <header className="glass mb-6 flex items-center justify-between rounded-3xl px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
            <HardHat size={22} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-stone-900 sm:text-2xl">Kenton</h1>
            <p className="text-sm text-stone-500">Job site photo manager</p>
          </div>
        </div>
        <nav className="hidden gap-1 md:flex">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <nav className="glass safe-bottom fixed inset-x-4 bottom-4 grid grid-cols-3 gap-1 rounded-2xl p-1 md:hidden">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex min-h-12 flex-col items-center justify-center rounded-xl px-2 py-2 text-xs font-medium transition ${
                isActive ? "bg-stone-900 text-white" : "text-stone-500"
              }`
            }
          >
            <Icon size={18} />
            <span className="mt-1">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}