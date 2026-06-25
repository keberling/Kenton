import type { ReactNode } from "react";

interface TechMetaProps {
  label: string;
  value: string;
  accent?: "cyan" | "violet" | "emerald" | "amber" | "rose" | "muted";
  mono?: boolean;
}

const accentClass: Record<NonNullable<TechMetaProps["accent"]>, string> = {
  cyan: "text-cyan-400/85",
  violet: "text-violet-400/85",
  emerald: "text-emerald-400/85",
  amber: "text-amber-400/85",
  rose: "text-rose-400/85",
  muted: "text-white/45",
};

export function TechMeta({ label, value, accent = "muted", mono = true }: TechMetaProps) {
  return (
    <div className="min-w-0">
      <p className="hud-label">{label}</p>
      <p className={`mt-0.5 truncate text-[11px] ${mono ? "font-mono" : ""} ${accentClass[accent]}`}>
        {value}
      </p>
    </div>
  );
}

export function TechMetaRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {children}
    </div>
  );
}

export function TechStatusChip({
  code,
  label,
  tone = "muted",
}: {
  code: string;
  label: string;
  tone?: TechMetaProps["accent"];
}) {
  return (
    <span
      className={`glass-badge inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-mono text-[10px] ${accentClass[tone]}`}
    >
      <span className="opacity-50">{code}</span>
      <span>{label}</span>
    </span>
  );
}