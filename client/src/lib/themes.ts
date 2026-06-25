export type ThemeId =
  | "photon-dark"
  | "lumen-light"
  | "verdant-stack"
  | "coral-uplink"
  | "sapphire-ledger"
  | "sage-archive";

export interface ThemeSpec {
  id: ThemeId;
  code: string;
  name: string;
  tagline: string;
  primary: string;
  secondary: string;
  mode: "dark" | "light";
  specs: string[];
}

export const THEMES: ThemeSpec[] = [
  {
    id: "photon-dark",
    code: "DRK-00",
    name: "Photon Dark",
    tagline: "General dark · ops console",
    primary: "#22D3EE",
    secondary: "#A78BFA",
    mode: "dark",
    specs: ["LUM::4%", "CONTRAST::AAA", "PIPE::full-telemetry", "SURFACE::neu-glass"],
  },
  {
    id: "lumen-light",
    code: "LGT-00",
    name: "Lumen Light",
    tagline: "General light · daylight UI",
    primary: "#2563EB",
    secondary: "#7C3AED",
    mode: "light",
    specs: ["LUM::96%", "CONTRAST::AA+", "PIPE::high-readability", "SURFACE::soft-neu"],
  },
  {
    id: "verdant-stack",
    code: "VRD-01",
    name: "Verdant Stack",
    tagline: "Calm · eco / wellness",
    primary: "#568203",
    secondary: "#FFF8B9",
    mode: "dark",
    specs: ["LUM::8%", "TONE::low-noise", "GPS::soft-lock", "MOOD::field-calm"],
  },
  {
    id: "coral-uplink",
    code: "CRL-02",
    name: "Coral Uplink",
    tagline: "Warm · friendly",
    primary: "#F88363",
    secondary: "#FAEFCA",
    mode: "dark",
    specs: ["LUM::10%", "TONE::approachable", "INGEST::handoff-ready", "MOOD::crew-warm"],
  },
  {
    id: "sapphire-ledger",
    code: "SAP-03",
    name: "Sapphire Ledger",
    tagline: "Bold · SaaS / fintech",
    primary: "#0F52BA",
    secondary: "#FFFF99",
    mode: "dark",
    specs: ["LUM::6%", "CONTRAST::AAA", "ACCENT::high-signal", "MOOD::ledger-bold"],
  },
  {
    id: "sage-archive",
    code: "SAG-04",
    name: "Sage Archive",
    tagline: "Muted · premium",
    primary: "#618A7F",
    secondary: "#F3DDC2",
    mode: "dark",
    specs: ["LUM::9%", "TONE::editorial", "GALLERY::archival", "MOOD::premium-quiet"],
  },
];

export const DEFAULT_THEME_ID: ThemeId = "photon-dark";
export const THEME_STORAGE_KEY = "kenton-theme";

export function getTheme(id: ThemeId): ThemeSpec {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function readStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && isThemeId(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_THEME_ID;
}

export function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  const theme = getTheme(id);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme.mode === "light" ? "#EEF1F8" : theme.primary);
  }
}