import { Cpu } from "lucide-react";
import { Outlet } from "react-router-dom";
import { AmbientBackground } from "./AmbientBackground";

export function PublicUploadLayout() {
  return (
    <div className="theme-root relative min-h-dvh">
      <AmbientBackground />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex items-center gap-3">
          <div className="neu-raised-sm flex h-11 w-11 items-center justify-center rounded-xl">
            <Cpu size={20} className="text-cyan-300" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">
              <span className="text-gradient">Kenton</span>
            </h1>
            <p className="font-mono text-[10px] tracking-widest text-white/35">FIELD PHOTO UPLOAD</p>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}