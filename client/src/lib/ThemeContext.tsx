import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  DEFAULT_THEME_ID,
  getTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemeId,
  type ThemeSpec,
} from "./themes";

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeSpec;
  setThemeId: (id: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => readStoredTheme());

  const setThemeId = useCallback((id: ThemeId) => {
    setThemeIdState(id);
    applyTheme(id);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  const value = useMemo(
    () => ({ themeId, theme: getTheme(themeId), setThemeId }),
    [themeId, setThemeId],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      themeId: DEFAULT_THEME_ID,
      theme: getTheme(DEFAULT_THEME_ID),
      setThemeId: () => {},
    };
  }
  return ctx;
}