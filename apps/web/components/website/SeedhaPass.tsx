"use client";

import { WorldGlobe } from "./globe/WorldGlobe";
import site from "./site.module.css";
import styles from "./upgrade.module.css";
import { useReveal } from "./useReveal";

/** Planned feature (docs/WEBSITE_UPGRADE.md 3A). Future tense, sample content only. */
const POINTS = [
  ["Perks everywhere", "Guests will get perks at every Seedha hotel, never lower prices."],
  ["Faster check-in", "Check-in will be faster from a profile the guest controls."],
  ["Referrals with no commission", "Hotels will refer guests to each other with no commission."],
] as const;

export function SeedhaPass() {
  const [ref, hidden] = useReveal<HTMLDivElement>();
  return (
    <section id="seedha-pass" className={site.section} aria-labelledby="seedha-pass-title">
      <div ref={ref} className={`${site.container} ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={site.kicker}>Seedha Pass</p>
          <ul className={styles.tags} aria-label="Status">
            <li className={styles.tagPlanned}>Planned</li>
            <li className={styles.tag}>Phase 3</li>
          </ul>
          <h2 id="seedha-pass-title" className={styles.title}>
            Seedha Pass. One network of <span className={styles.nowrap}>owner-run</span> hill hotels.
          </h2>
          <ul className={`${styles.points} ${styles.reveal} ${hidden ? styles.hidden : ""}`}>
            {POINTS.map(([title, body]) => (
              <li key={title} className={styles.point}>
                <span className={styles.pointDot} aria-hidden="true" />
                <span>
                  <strong className={styles.pointTitle}>{title}</strong>
                  <span className={styles.pointBody}>{body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className={styles.consent}>Shared between hotels only with the guest&apos;s separate consent.</p>
          <p className={site.footnote}>A planned feature shown with sample towns.</p>
        </div>
        <div className={styles.globe}>
          <WorldGlobe initialLayer="pass" label="Seedha Pass planned towns" />
        </div>
      </div>
    </section>
  );
}
