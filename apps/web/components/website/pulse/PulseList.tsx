import { CHANNELS, railOrder, stateLabel, stateText, type PulseEvent } from "@/lib/pulse";
import { StateIcon } from "./ChannelRail";
import styles from "./pulse-card.module.css";

/** Reduced-motion fallback: six plain cards, no pinning, no animation. */
export function PulseList({ events }: { events: readonly PulseEvent[] }) {
  const names = new Map(CHANNELS.map((c) => [c.key, c.name]));
  return (
    <ol className={styles.list}>
      {events.map((e) => (
        <li key={e.id} className={styles.listCard}>
          <div className={styles.cardHead}>
            <h3 className={styles.eventName}>{e.name}</h3>
            <span className={styles.dateChip}>{e.date}</span>
            <span className={styles.samplePill}>Sample</span>
          </div>
          <p className={styles.listDecision}>{e.decision}</p>
          <ul className={styles.listChannels} aria-label={`Channels for ${e.name}, sample`}>
            {railOrder(e).map((key) => {
              const state = e.channels[key];
              const name = names.get(key) ?? key;
              return (
                <li key={key} className={styles[`row_${state}`] ?? ""}>
                  <span className={styles.listMark} aria-hidden="true">
                    <StateIcon state={state} />
                  </span>
                  <span className={styles.srOnly}>
                    {stateText(name, state, state === "held" ? e.heldNote : undefined)}
                  </span>
                  <span aria-hidden="true">
                    {name}: {stateLabel(state)}
                    {state === "held" && e.heldNote ? ` ${e.heldNote}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className={styles.listCaption}>
            <span className={styles.illustration}>Illustration</span> {e.caption}
          </p>
        </li>
      ))}
    </ol>
  );
}
