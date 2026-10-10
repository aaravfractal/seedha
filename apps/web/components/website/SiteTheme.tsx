"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_COOKIE } from "@/components/ThemeToggle";
import styles from "./site.module.css";

export const SITE_ROOT_ID = "seedha-site";
type SiteTheme = "light" | "dark";

/**
 * Runs while the page is parsed, before first paint: the website is dark
 * unless the visitor chose light (same seedha_theme cookie as the app).
 */
export const SITE_THEME_SCRIPT = `(function(){try{var s=document.getElementById('${SITE_ROOT_ID}');var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(s)s.setAttribute('data-site-theme',m?m[1]:'dark');}catch(e){}})();`;

function cookieTheme(): SiteTheme {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
  return m?.[1] === "light" ? "light" : "dark";
}

function readTheme(): SiteTheme {
  const root = document.getElementById(SITE_ROOT_ID);
  return root?.getAttribute("data-site-theme") === "light" ? "light" : "dark";
}

const listeners = new Set<() => void>();
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function apply(theme: SiteTheme, persist: boolean): void {
  document.getElementById(SITE_ROOT_ID)?.setAttribute("data-site-theme", theme);
  if (persist) {
    // Same strictly necessary preference cookie the app uses, so the app follows the choice.
    document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.setAttribute("data-theme", theme);
  }
  listeners.forEach((l) => l());
}

/** Sun and moon switch for the website. Dark first; the choice is remembered. */
export function SiteThemeSwitch() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as SiteTheme);
  // After a client-side navigation the boot script does not run again.
  useEffect(() => {
    apply(cookieTheme(), false);
  }, []);
  const next: SiteTheme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={styles.iconBtn}
      onClick={() => apply(next, true)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </g>
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
