"use client";

import { WorldGlobe } from "./globe/WorldGlobe";
import site from "./site.module.css";
import styles from "./upgrade.module.css";
import { useReveal } from "./useReveal";

/**
 * Pulse Event Radar (docs/WEBSITE_UPGRADE.md 3B). A planned Pro feature shown
 * inside the Pulse section with one sample WhatsApp line. Seedha never sets a price.
 */
export function EventRadar() {
  const [ref, hidden] = useReveal<HTMLDivElement>();
  return (
    <section id="event-radar" className={styles.radar} aria-labelledby="event-radar-title">
      <div ref={ref} className={styles.grid}>
        <div className={styles.copy}>
          <p className={site.kicker}>Event Radar</p>
          <ul className={styles.tags} aria-label="Status">
            <li className={styles.tag}>Pro</li>
            <li className={styles.tagPlanned}>Planned</li>
          </ul>
          <h3 id="event-radar-title" className={styles.title}>
            Know about every event near you, not just Diwali.
          </h3>
          <p className={site.lede}>
            Seedha will gather upcoming local events from official sources. One WhatsApp line each morning
            will tell you what&apos;s coming. You decide rates, room holds and packages, and Seedha never sets
            a price.
          </p>
          <figure
            className={`${styles.bubbleWrap} ${styles.reveal} ${hidden ? styles.hidden : ""}`}
            aria-labelledby="event-radar-bubble-label"
          >
            <figcaption id="event-radar-bubble-label" className={styles.bubbleHead}>
              <span className={styles.bubbleFrom}>Seedha on WhatsApp</span>
              <span className={styles.tag}>Sample</span>
            </figcaption>
            <p className={styles.bubble}>
              Winter Line Carnival in Mussoorie, 25 to 30 Dec. Keep rooms for direct guests and check your
              rates.
            </p>
          </figure>
          <p className={styles.consent}>Official event sources only. No scraping.</p>
        </div>
        <div className={styles.globe}>
          <WorldGlobe initialLayer="radar" label="Event Radar sample events" />
        </div>
      </div>
    </section>
  );
}
