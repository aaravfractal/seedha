"use client";

import { useSyncExternalStore } from "react";

export const THEME_COOKIE = "seedha_theme";
type Theme = "light" | "dark" | "system";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Auto", light: "Light", dark: "Dark" };

/** Runs before first paint (see layout) so the theme never flashes. */
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(m)document.documentElement.setAttribute('data-theme',m[1]);}catch(e){}})();`;

function readTheme(): Theme {
  const value = document.documentElement.getAttribute("data-theme");
  return value === "light" || value === "dark" ? value : "system";
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } else {
    root.setAttribute("data-theme", theme);
    document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
  listeners.forEach((l) => l());
}

/** Cycles Auto, Light, Dark. Stored in a strictly necessary preference cookie. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as Theme);
  const next = NEXT[theme];
  return (
    <button
      type="button"
      className="iconbtn"
      onClick={() => applyTheme(next)}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <span aria-hidden="true">{theme === "dark" ? "☾" : theme === "light" ? "☀" : "A"}</span>
    </button>
  );
}
