"use client";

import { useState } from "react";
import {
  CHANNELS,
  PULSE_EVENTS,
  PULSE_FOOTER,
  SEASON_LABEL,
  SEASON_MONTHS,
  railOrder,
  stateLabel,
} from "@/lib/pulse";
import o from "@/app/(owner)/(screens)/pro/pro.module.css";

const NAMES = new Map(CHANNELS.map((c) => [c.key, c.name]));

/**
 * Pro card "pulse": a mini season timeline of sample town events. Picking an
 * event shows its channel decision. No rupee figures and no demand forecast.
 */
export function PulseView() {
  const [picked, setPicked] = useState(PULSE_EVENTS[3]?.id ?? PULSE_EVENTS[0]?.id);
  const event = PULSE_EVENTS.find((e) => e.id === picked) ?? PULSE_EVENTS[0];
  if (!event) return null;
  return (
    <div className={o.view}>
      <p className={o.vNote}>{SEASON_LABEL}. Pick a date to see its channel decision.</p>
      <ol className={o.months} aria-label="Season timeline">
        {SEASON_MONTHS.map((month) => (
          <li className={o.month} key={month}>
            <span className={o.monthName}>{month}</span>
            {PULSE_EVENTS.filter((e) => e.month === month).map((e) => (
              <button
                type="button"
                key={e.id}
                className={o.event}
                aria-pressed={e.id === event.id}
                onClick={() => setPicked(e.id)}
              >
                {e.name}
              </button>
            ))}
          </li>
        ))}
      </ol>
      <div className={o.decision} aria-live="polite">
        <div className={o.decisionHead}>
          <h3 className={o.decisionName}>{event.name}</h3>
          <span className={o.decisionDate}>{event.date}</span>
        </div>
        <p className={o.vText}>{event.decision}</p>
        <ul className={o.states} aria-label="Channels for these dates">
          {railOrder(event).map((key) => (
            <li className={o.state} key={key} data-state={event.channels[key]}>
              {NAMES.get(key)}: {stateLabel(event.channels[key]).toLowerCase()}
              {event.channels[key] === "held" && event.heldNote ? ` ${event.heldNote}` : ""}
            </li>
          ))}
        </ul>
      </div>
      <p className={o.vNote}>It is a channel decision. It does not predict demand. {PULSE_FOOTER}</p>
    </div>
  );
}
