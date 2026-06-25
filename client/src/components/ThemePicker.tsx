import { Check, Palette } from "lucide-react";
import { useState } from "react";
import { useTheme } from "../lib/ThemeContext";
import { THEMES, type ThemeId } from "../lib/themes";

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { themeId, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);

  const active = THEMES.find((t) => t.id === themeId)!;

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="neu-raised-sm hover-shake flex h-9 w-9 items-center justify-center rounded-lg"
          aria-label="Color themes"
        >
          <Palette size={16} className="t-accent" />
        </button>
        {open && (
          <ThemePanel
            themeId={themeId}
            setThemeId={(id) => {
              setThemeId(id);
              setOpen(false);
            }}
            className="absolute right-0 top-11 z-50 w-72"
            onClose={() => setOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-theme px-4 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="hover-shake flex w-full items-center gap-2 text-left"
      >
        <Palette size={14} className="t-accent shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="hud-label">Color system</p>
          <p className="truncate font-mono text-[10px] t-muted">
            {active.code} · {active.name}
          </p>
        </div>
        <span className="font-mono text-[9px] t-faint">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <ThemePanel
          themeId={themeId}
          setThemeId={setThemeId}
          className="mt-3"
        />
      )}
    </div>
  );
}

function ThemePanel({
  themeId,
  setThemeId,
  className = "",
  onClose,
}: {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <>
      {onClose && (
        <button
          type="button"
          className="fixed inset-0 z-40"
          aria-label="Close themes"
          onClick={onClose}
        />
      )}
      <div className={`neu-inset z-50 max-h-80 space-y-2 overflow-y-auto rounded-xl p-2 ${className}`}>
        {THEMES.map((theme) => {
          const selected = theme.id === themeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setThemeId(theme.id)}
              className={`hover-shake w-full rounded-lg p-2.5 text-left transition ${
                selected ? "neu-raised-sm ring-1 ring-[color:var(--accent-glow)]" : "hover:bg-[color:var(--neu-highlight-soft)]"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="flex shrink-0 flex-col gap-1 pt-0.5">
                  <span
                    className="h-3 w-8 rounded-sm ring-1 ring-[color:var(--border)]"
                    style={{ background: theme.primary }}
                  />
                  <span
                    className="h-3 w-8 rounded-sm ring-1 ring-[color:var(--border)]"
                    style={{ background: theme.secondary }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="font-display text-sm font-semibold t-fg">{theme.name}</p>
                    {selected && <Check size={12} className="t-accent shrink-0" />}
                  </div>
                  <p className="font-mono text-[9px] t-subtle">
                    {theme.code} · {theme.tagline}
                  </p>
                  <p className="mt-1 font-mono text-[9px] t-faint">
                    {theme.primary} + {theme.secondary}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {theme.specs.map((spec) => (
                      <span
                        key={spec}
                        className="rounded bg-[color:var(--neu-highlight-soft)] px-1 py-0.5 font-mono text-[8px] t-faint"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}