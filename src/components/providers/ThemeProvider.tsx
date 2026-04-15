"use client";

import { createContext, useContext, useEffect, useState } from "react";

const THEMES = [
  "neutral-dark",
  "neutral-light",
  "pink",
  "pale",
  "devrolin",
  "light",
  "corporate",
  "retro",
] as const;
type Theme = (typeof THEMES)[number];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  themes: readonly string[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "neutral-dark",
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("neutral-dark");

  useEffect(() => {
    const saved = localStorage.getItem("devrolin-theme") as Theme | null;
    if (saved && (THEMES as readonly string[]).includes(saved)) {
      applyTheme(saved);
    }
  }, []);

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("devrolin-theme", t);
    setThemeState(t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: applyTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
