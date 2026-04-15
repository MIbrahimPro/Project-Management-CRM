"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();
  const labelMap: Record<string, string> = {
    "neutral-dark": "Neutral Dark",
    "neutral-light": "Neutral Light",
    pink: "Pink",
    pale: "Pale",
    devrolin: "DevRolin",
    light: "Light",
    corporate: "Corporate",
    retro: "Retro",
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className="dropdown dropdown-end">
        <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-sm gap-2">
          {theme === "neutral-dark" ? (
            <Moon className="w-4 h-4" />
          ) : (
            <Sun className="w-4 h-4" />
          )}
        </div>
        <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box z-50 w-40 p-2 shadow-lg border border-base-300 mt-2">
          {themes.map((t) => (
            <li key={t}>
              <button
                onClick={() => setTheme(t as Parameters<typeof setTheme>[0])}
                className={theme === t ? "active font-bold" : ""}
              >
                {labelMap[t] ?? t}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
