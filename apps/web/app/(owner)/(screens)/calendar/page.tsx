"use client";

import { useMemo, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { CalendarData, PulseEvent, PulseFacts } from "@/lib/types-settings";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { CalcNote, SampleChip, Screen, ui } from "@/components/owner/ui";
import s from "@/components/settings/settings.module.css";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** The month the handoff opens on: the Winter Line Carnival. */
const START_MONTH = "2026-12";

type Ym = { y: number; m: number };

function parseYm(iso: string): Ym {
  const [y, m] = iso.split("-").map(Number);
  return { y: y ?? 2026, m: (m ?? 1) - 1 };
}
function ymKey({ y, m }: Ym): number {
  return y * 12 + m;
}
function fromKey(key: number): Ym {
  return { y: Math.floor(key / 12), m: key % 12 };
}
function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "2026-12-25".."2026-12-30" -> "25 to 30 Dec"; one day -> "31 Dec"; across months -> "31 Dec to 3 Jan". */
function dateRange(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  const sMon = SHORT[(sm ?? 1) - 1];
  const eMon = SHORT[(em ?? 1) - 1];
  if (start === end) return `${sd} ${sMon}`;
  if (sm === em) return `${sd} to ${ed} ${eMon}`;
  return `${sd} ${sMon} to ${ed} ${eMon}`;
}

function eventsIn(events: PulseEvent[], { y, m }: Ym): PulseEvent[] {
  const first = iso(y, m, 1);
  const last = iso(y, m, new Date(y, m + 1, 0).getDate());
  return events.filter((e) => e.start <= last && e.end >= first);
}

function MonthGrid({ month, events }: { month: Ym; events: PulseEvent[] }) {
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const lead = (new Date(month.y, month.m, 1).getDay() + 6) % 7; // Monday first
  const now = new Date();
  const today = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const cells: (number | null)[] = [...Array.from({ length: lead }, () => null)];
  for (let d = 1; d <= days; d += 1) cells.push(d);
  return (
    <div className={s.grid} aria-hidden="true">
      {DOW.map((d) => (
        <span className={s.dow} key={d}>
          {d}
        </span>
      ))}
      {cells.map((d, i) => {
        if (d === null) return <span key={`b${i}`} />;
        const day = iso(month.y, month.m, d);
        const hit = events.filter((e) => e.start <= day && e.end >= day);
        const cls = [
          s.day,
          hit.some((e) => e.in_plan) ? s.dayPlan : hit.length ? s.event : "",
          day === today ? s.today : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <span className={cls} key={day}>
            {d}
          </span>
        );
      })}
    </div>
  );
}

function EventCard({
  event,
  facts,
  busy,
  onToggle,
}: {
  event: PulseEvent;
  facts: PulseFacts | null;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <article className={s.eventCard} aria-labelledby={`ev-${event.key}`}>
      <div className={s.eventTop}>
        <span className={s.when}>
          <i aria-hidden="true" />
          {dateRange(event.start, event.end)}
        </span>
        <span className={ui.chips}>
          <span className={s.small}>{event.tag}</span>
          <SampleChip />
        </span>
      </div>
      <h3 className={s.eventTitle} id={`ev-${event.key}`}>
        {event.title}
      </h3>
      <p className={s.decision}>
        <b>Channel decision:</b> {event.decision}
      </p>
      {facts ? (
        <p className={s.money}>
          Each room night sold direct instead of on {facts.channel_name} keeps{" "}
          <b className={ui.num}>{inr(facts.extra_per_room_night)}</b> more (
          <span className={ui.num}>{inr(facts.direct_net_adr)}</span> against{" "}
          <span className={ui.num}>{inr(facts.channel_net_adr)}</span> net per room night).
        </p>
      ) : null}
      <div className={ui.actions}>
        <button
          type="button"
          className={event.in_plan ? "btn ghost small" : "btn small"}
          aria-pressed={event.in_plan}
          disabled={busy}
          onClick={onToggle}
        >
          {event.in_plan ? "In your plan" : "Add to plan"}
        </button>
        {event.in_plan ? <span className={s.small}>Tap again to take it off.</span> : null}
      </div>
    </article>
  );
}

export default function CalendarPage() {
  const cal = useApi<CalendarData>("calendar");
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [shown, setShown] = useState<number>(ymKey(parseYm(START_MONTH)));

  const bounds = useMemo(() => {
    if (!cal.data) return null;
    return { first: ymKey(parseYm(cal.data.first_month)), last: ymKey(parseYm(cal.data.last_month)) };
  }, [cal.data]);
  const key = bounds ? Math.min(Math.max(shown, bounds.first), bounds.last) : shown;
  const month = fromKey(key);

  async function toggle(event: PulseEvent) {
    setBusy(event.key);
    try {
      const next = event.in_plan
        ? await api<CalendarData>(`calendar/plan/${encodeURIComponent(event.key)}`, { method: "DELETE" })
        : await postJson<CalendarData>("calendar/plan", { event_key: event.key });
      cal.setData(next);
      toast(event.in_plan ? `${event.title} is off your plan.` : `${event.title} is in your plan.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const data = cal.data;
  const monthEvents = data ? eventsIn(data.events, month) : [];
  const planned = data ? data.events.filter((e) => e.in_plan).length : 0;

  return (
    <Screen
      title="Season calendar."
      sub="Each date becomes one channel decision. Seedha Pulse does not predict demand."
    >
      {cal.error && !data ? (
        <ErrorState message={cal.error.message} code={cal.error.code} onRetry={cal.reload} />
      ) : !data ? (
        <Loading rows={3} label="Loading the calendar" />
      ) : (
        <>
          <p className={s.note}>
            <SampleChip />
            <span>
              Sample events for the Mussoorie season. Dates other than the Winter Line Carnival are
              illustrations. {planned ? `${planned} in your plan.` : "Nothing in your plan yet."}
            </span>
          </p>
          <div className={s.calWrap}>
            <section className={ui.card} aria-label="Month">
              <div className={s.monthHead}>
                <button
                  type="button"
                  className={s.navBtn}
                  aria-label="Previous month"
                  disabled={!bounds || key <= bounds.first}
                  onClick={() => setShown(key - 1)}
                >
                  ‹
                </button>
                <h2 className={s.monthTitle} aria-live="polite">
                  {MONTHS[month.m]} {month.y}
                </h2>
                <button
                  type="button"
                  className={s.navBtn}
                  aria-label="Next month"
                  disabled={!bounds || key >= bounds.last}
                  onClick={() => setShown(key + 1)}
                >
                  ›
                </button>
              </div>
              <MonthGrid month={month} events={data.events} />
              <div className={s.legend}>
                <span>
                  <i className={s.swEvent} aria-hidden="true" />
                  Sample event
                </span>
                <span>
                  <i className={s.swPlan} aria-hidden="true" />
                  In your plan
                </span>
              </div>
            </section>
            <section className={s.events} aria-label={`Events in ${MONTHS[month.m]} ${month.y}`}>
              {monthEvents.length === 0 ? (
                <div className={ui.card}>
                  <h3 className={ui.sectionTitle}>No events this month.</h3>
                  <p className={ui.muted}>Move to another month to see its channel decisions.</p>
                </div>
              ) : (
                monthEvents.map((e) => (
                  <EventCard
                    key={e.key}
                    event={e}
                    facts={data.facts}
                    busy={busy === e.key}
                    onToggle={() => void toggle(e)}
                  />
                ))
              )}
              {data.facts ? (
                <CalcNote>Rupee figures use net per room night for Apr to Sep 2026.</CalcNote>
              ) : (
                <p className={ui.muted}>Upload your statements to see what each decision keeps in rupees.</p>
              )}
            </section>
          </div>
        </>
      )}
    </Screen>
  );
}
