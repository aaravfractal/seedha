import {
  CHANNELS,
  railOrder,
  stateLabel,
  stateText,
  type ChannelKey,
  type ChannelState,
  type PulseEvent,
} from "@/lib/pulse";
import styles from "./pulse-card.module.css";

const SWATCH: Record<ChannelKey, string | undefined> = {
  mmt: styles.swMmt,
  bcom: styles.swBcom,
  agoda: styles.swAgoda,
  ta: styles.swTa,
  walkin: styles.swWalkin,
  direct: styles.swDirect,
};

/** Lock for "Held back". Decorative: the row text says the state. */
function Lock() {
  return (
    <svg className={styles.stateIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Upward chevron for "First". */
function Up() {
  return (
    <svg className={styles.stateIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M3.5 10 8 5.5l4.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Calendar for "Open weekdays". */
function Weekdays() {
  return (
    <svg className={styles.stateIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect
        x="2.5"
        y="3.5"
        width="11"
        height="10"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path d="M2.5 6.5h11M5 2v3M11 2v3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/** Open circle for "Open". */
function Open() {
  return (
    <svg className={styles.stateIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Icon for a channel state (decorative; always paired with a text label). */
export function StateIcon({ state }: { state: ChannelState }) {
  if (state === "held") return <Lock />;
  if (state === "favoured") return <Up />;
  if (state === "weekdays") return <Weekdays />;
  return <Open />;
}

/**
 * Six channel rows. DOM order stays fixed; each row moves to its rank with
 * translateY (the same flip motion as Money kept), never a fade.
 * Reduced motion: the global .site rule and `reducedMotion` make it instant.
 */
export function ChannelRail({
  event,
  reducedMotion,
  compact,
}: {
  event: PulseEvent;
  reducedMotion: boolean;
  compact?: boolean;
}) {
  const order = railOrder(event);
  const step = compact ? 48 : 54;
  return (
    <ul
      className={`${styles.rail}${reducedMotion ? ` ${styles.still}` : ""}`}
      style={{ height: CHANNELS.length * step - 8 }}
      aria-label="Channels for this event, sample"
    >
      {CHANNELS.map((c) => {
        const state = event.channels[c.key];
        const rank = order.indexOf(c.key);
        return (
          <li
            key={c.key}
            className={`${styles.railRow} ${styles[`row_${state}`] ?? ""}`}
            style={{ transform: `translateY(${rank * step}px)`, height: step - 8 }}
            data-state={state}
          >
            <span className={`${styles.swatch} ${SWATCH[c.key] ?? ""}`} aria-hidden="true" />
            <span className={styles.railName} aria-hidden="true">
              {c.name}
            </span>
            <span className={styles.railState} aria-hidden="true">
              <StateIcon state={state} />
              {stateLabel(state)}
            </span>
            <span className={styles.srOnly}>
              {stateText(c.name, state, state === "held" ? event.heldNote : undefined)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
