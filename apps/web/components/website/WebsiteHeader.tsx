"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteThemeSwitch } from "./SiteTheme";
import styles from "./site.module.css";

export const NAV: ReadonlyArray<readonly [string, string]> = [
  ["/#product", "Product"],
  ["/#growth", "Growth"],
  ["/#pulse", "Pulse"],
  ["/#desk", "Desk"],
  ["/#pricing", "Pricing"],
  ["/#careers", "Careers"],
];

export function Logo() {
  return (
    <Link href="/" className={styles.brand} aria-label="Seedha home">
      <span className={styles.brandMark} aria-hidden="true">
        <span />
        <span />
      </span>
      Seedha
      <span className={styles.deva} lang="hi" aria-hidden="true">
        सीधा
      </span>
    </Link>
  );
}

/** Glass header: links, theme switch, Sign in and Get started. */
export function WebsiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className={`${styles.header}${scrolled || open ? ` ${styles.headerScrolled}` : ""}`}>
      <div className={`${styles.container} ${styles.headerInner}`}>
        <Logo />
        <nav className={styles.navLinks} aria-label="Website">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className={styles.navLink}>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <SiteThemeSwitch />
          <Link href="/login" className={styles.signIn}>
            Sign in
          </Link>
          <Link href="/signup" className={styles.pill}>
            Get started
          </Link>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.menuBtn}`}
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="site-menu" className={`${styles.container} ${styles.mobileMenu}`} aria-label="Website menu">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
          <Link href="/login" onClick={() => setOpen(false)}>
            Sign in
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
