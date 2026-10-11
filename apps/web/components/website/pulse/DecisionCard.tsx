"use client";

import { motion } from "framer-motion";
import type { PulseEvent } from "@/lib/pulse";
import { cardSummary, progressText } from "@/lib/pulseCard";
import { ChannelRail } from "./ChannelRail";
import { RoomGrid } from "./RoomGrid";
import styles from "./pulse-card.module.css";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Decision card for one sample event: name, date, Sample pill, the
 * decision line, the channel rail and the 22-room illustration.
 * No live region here: the parent section announces changes, and can
 * rely on the visually hidden summary sentence (data-pulse-summary).
 */
export function DecisionCard({
  event,
  index,
  total,
  reducedMotion,
  compact,
}: {
  event: PulseEvent;
  index: number;
  total: number;
  reducedMotion: boolean;
  compact?: boolean;
}) {
  return (
    <article
      className={`${styles.card}${compact ? ` ${styles.compact}` : ""}`}
      aria-labelledby={`pulse-card-${event.id}`}
      data-event={event.id}
    >
      <p className={styles.srOnly} data-pulse-summary="">
        {cardSummary(event)}
      </p>
      <div className={styles.swap}>
        <motion.div
          key={event.id}
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.5, ease: EASE }}
        >
          <div className={styles.cardHead}>
            <h3 className={styles.eventName} id={`pulse-card-${event.id}`}>
              {event.name}
            </h3>
            <span className={styles.dateChip}>{event.date}</span>
            <span className={styles.samplePill}>Sample</span>
          </div>
          <p className={styles.decision}>{event.decision}</p>
        </motion.div>
      </div>
      <div className={styles.body}>
        <ChannelRail event={event} reducedMotion={reducedMotion} compact={compact} />
        <RoomGrid event={event} reducedMotion={reducedMotion} />
      </div>
      <div className={styles.progress}>
        <span className={styles.srOnly}>{progressText(index, total)}</span>
        <span className={styles.dots} aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`${styles.dot}${i === index ? ` ${styles.dotOn}` : ""}`} />
          ))}
        </span>
      </div>
    </article>
  );
}
