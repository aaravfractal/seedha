"use client";

import { useState } from "react";
import {
  CHANNELS,
  PULSE_EVENTS,
  PULSE_FOOTER,
  PULSE_KICKER,
  PULSE_SUB,
  PULSE_TITLE,
  stateText,
  type PulseEvent,
} from "@/lib/pulse";
import site from "../site.module.css";
import { MonthStrip } from "./MonthStrip";
import { PulseList } from "./PulseList";
import { ScrollStory } from "./ScrollStory";
import { REDUCE_QUERY, STORY_QUERY, useMedia } from "./storyHooks";
import css from "./pulse-story.module.css";

/** What the live region reads for an event: name, date, decision, channel states. */
export function announce(event: PulseEvent): string {
  const states = CHANNELS.filter((c) => event.channels[c.key] !== "open").map((c) => {
    const state = event.channels[c.key];
    return stateText(c.name, state, state === "held" ? event.heldNote : undefined);
  });
  const channels = states.length > 0 ? `${states.join(", ")}.` : "All channels open.";
  return `${event.name}, ${event.date}, sample event. ${event.decision} ${channels}`;
}

/**
 * Seedha Pulse on the public website (docs/PULSE_SECTION.md): every festival,
 * one channel decision. Sample events only, no rupee figures, no forecast.
 * Desktop with motion: pinned scroll story. Under 980px: month strip and card.
 * Reduced motion: a plain list of cards.
 */
export function PulseSection() {
  const reduce = useMedia(REDUCE_QUERY);
  const wide = useMedia(STORY_QUERY);
  const [index, setIndex] = useState(0);
  const event = PULSE_EVENTS[index] ?? PULSE_EVENTS[0];

  let story;
  if (reduce) story = <PulseList events={PULSE_EVENTS} />;
  else if (wide) story = <ScrollStory events={PULSE_EVENTS} index={index} onIndex={setIndex} />;
  else story = <MonthStrip events={PULSE_EVENTS} index={index} onIndex={setIndex} />;

  return (
    <section id="pulse" className={site.section} aria-labelledby="pulse-title">
      <div className={site.container}>
        <p className={site.kicker}>{PULSE_KICKER}</p>
        <h2 id="pulse-title" className={site.h2}>
          {PULSE_TITLE}
        </h2>
        <p className={site.lede}>{PULSE_SUB}</p>
        <div className={css.stage}>{story}</div>
        {!reduce && event ? (
          <p className={site.srOnly} aria-live="polite" aria-atomic="true" data-pulse-live="">
            {announce(event)}
          </p>
        ) : null}
        <p className={site.footnote}>{PULSE_FOOTER}</p>
        <p className={css.radarLinkRow}>
          <a href="#event-radar" className={css.radarLink}>
            See Event Radar (Beta)
          </a>
        </p>
      </div>
    </section>
  );
}
