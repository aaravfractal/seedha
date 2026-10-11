import { roomStates, type PulseEvent, type RoomState } from "@/lib/pulse";
import { roomSummary } from "@/lib/pulseCard";
import styles from "./pulse-card.module.css";

const TILE: Record<RoomState, string | undefined> = {
  plain: styles.tile,
  direct: `${styles.tile} ${styles.tileDirect}`,
  otaWeekdays: `${styles.tile} ${styles.tileWeekdays}`,
};

function Check() {
  return (
    <svg className={styles.tileIcon} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path
        d="m2.5 6.2 2.3 2.3 4.7-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Dot() {
  return (
    <svg className={styles.tileIcon} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <circle cx="6" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}

function Gift() {
  return (
    <svg className={styles.tagIcon} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <rect
        x="2.5"
        y="6"
        width="11"
        height="7.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M2 6h12M8 6v7.5M8 6C6.5 3 4.5 3.5 5 5s3 1 3 1Zm0 0c1.5-3 3.5-2.5 3-1s-3 1-3 1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/**
 * The 22-room "mini hotel". Purely an illustration, labelled as one; the
 * tiles are decorative and a single sentence carries the meaning.
 */
export function RoomGrid({ event, reducedMotion }: { event: PulseEvent; reducedMotion: boolean }) {
  const states = roomStates(event);
  const litOrder = new Map(event.rooms.map((r, i) => [r, i]));
  const weekdays = event.kind === "weekdays";
  const perk = event.kind === "perk";
  const lit = event.kind === "hold" || weekdays;
  return (
    <figure className={`${styles.rooms}${reducedMotion ? ` ${styles.still}` : ""}`}>
      <div className={styles.roomsHead}>
        <span className={styles.illustration}>Illustration</span>
        <span className={styles.srOnly}>{roomSummary(event)}</span>
      </div>
      <div className={styles.gridWrap}>
        <div className={styles.grid} aria-hidden="true">
          {states.map((s, i) => (
            <span
              key={i}
              className={TILE[s]}
              style={{ transitionDelay: s === "plain" ? "0ms" : `${(litOrder.get(i) ?? 0) * 40}ms` }}
            >
              {s === "direct" ? <Check /> : s === "otaWeekdays" ? <Dot /> : null}
            </span>
          ))}
        </div>
        {event.tag ? (
          <span className={styles.packageTag} aria-hidden="true">
            <Gift />
            {event.tag}
          </span>
        ) : null}
      </div>
      <ul className={styles.legend} aria-hidden="true">
        {!lit ? null : weekdays ? (
          <li>
            <span className={`${styles.legendKey} ${styles.tileWeekdays}`}>
              <Dot />
            </span>
            OTA weekdays
          </li>
        ) : (
          <li>
            <span className={`${styles.legendKey} ${styles.tileDirect}`}>
              <Check />
            </span>
            For direct
          </li>
        )}
        {lit ? (
          <li>
            <span className={styles.legendKey} />
            Other rooms
          </li>
        ) : null}
      </ul>
      <figcaption className={`${styles.caption}${perk ? ` ${styles.captionPerk}` : ""}`}>
        {perk ? <span className={styles.perkTag}>Perk</span> : null}
        {event.caption}
      </figcaption>
    </figure>
  );
}
