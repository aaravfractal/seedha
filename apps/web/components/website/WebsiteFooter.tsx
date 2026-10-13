"use client";

import Link from "next/link";
import { openCookieSettings } from "./CookieConsent";
import { Logo } from "./WebsiteHeader";
import styles from "./site.module.css";

const COLUMNS: ReadonlyArray<readonly [string, ReadonlyArray<readonly [string, string]>]> = [
  [
    "Product",
    [
      ["/#product", "The flip"],
      ["/#growth", "Growth"],
      ["/#pulse", "Seedha Pulse"],
      ["/#desk", "Front desk screen"],
    ],
  ],
  [
    "Account",
    [
      ["/login", "Sign in"],
      ["/signup", "Create account"],
      ["/demo", "Demo hotel"],
      ["/#pricing", "Pricing"],
    ],
  ],
  [
    "Company",
    [
      ["/about", "About"],
      ["/careers", "Careers"],
      ["/#guest-map", "Guest map"],
      ["/contact", "Contact"],
    ],
  ],
  [
    "Seedha Site",
    [
      ["/h/deodar-view", "Sample hotel site"],
      ["/rate-card", "Rate card"],
      ["/agent-deck", "Agent deck"],
    ],
  ],
  [
    "Support",
    [
      ["/faq", "Questions"],
      ["/contact", "Get help"],
      ["/data-deletion", "Delete my data"],
    ],
  ],
  [
    "Legal",
    [
      ["/privacy", "Privacy"],
      ["/terms", "Terms"],
      ["/cookies", "Cookies"],
      ["/security", "Security"],
    ],
  ],
];

/** True today. */
const BUILT = ["Guest consent logged", "No OTA scraping"];
/** Not built yet, so only shown as planned (FRONTEND_MASTER D8). */
const PLANNED = ["Two-step sign-in", "Encrypted at rest", "PCI DSS payment gateway"];

/** Dark footer with six link columns, the badge row and cookie settings. */
export function WebsiteFooter() {
  return (
    <footer className={styles.footer} data-dark="true">
      <div className={styles.container}>
        <div className={styles.footTop}>
          <div className={styles.footBrand}>
            <Logo />
            <p>The revenue desk for owner-run hotels and homestays.</p>
          </div>
          {COLUMNS.map(([title, links]) => (
            <nav key={title} className={styles.footCol} aria-label={title}>
              <h2>{title}</h2>
              <ul>
                {links.map(([href, label]) => (
                  <li key={label}>
                    <Link href={href}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <ul className={styles.badges} aria-label="Safeguards">
          {BUILT.map((b) => (
            <li key={b}>
              <span className={styles.badgeOk} aria-hidden="true">
                ✓
              </span>
              {b}
            </li>
          ))}
          {PLANNED.map((b) => (
            <li key={b}>
              {b} <span className={styles.planned}>Planned</span>
            </li>
          ))}
        </ul>
        <div className={styles.bottomBar}>
          <span>© 2026 The Seedha team. All sample data is fictional.</span>
          <div className={styles.bottomLinks}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/security">Security</Link>
            <button type="button" className={styles.linkBtn} onClick={openCookieSettings}>
              Cookie settings
            </button>
            <span>India · English</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
