"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { count, inr, monthYear } from "@/lib/format";
import type { RepeatMatch, Repeats } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { CalcNote, Chip, Screen, ui } from "@/components/owner/ui";
import r from "./repeat.module.css";

/** Below this, the owner decides each match one by one (Confirm / Not same). */
const SURE = 80;
const TITLE = "Guests you paid for twice.";
const SUB = "They came back through an OTA. You had already won them.";

export default function RepeatPage() {
  const repeats = useApi<Repeats>("repeat");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = repeats.data;

  async function decide(match: RepeatMatch, decision: "confirm" | "dismiss") {
    setBusy(true);
    try {
      repeats.setData(await postJson<Repeats>(`repeat/${match.id}`, { decision }));
      toast(decision === "confirm" ? "Match confirmed" : "Removed. Not the same guest.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  /** The owner's tap confirms every match shown at 80% or more (ruling 7). */
  async function confirmSure(list: RepeatMatch[]) {
    setBusy(true);
    let latest: Repeats | null = null;
    try {
      for (const m of list) latest = await postJson<Repeats>(`repeat/${m.id}`, { decision: "confirm" });
      if (latest) repeats.setData(latest);
      toast(`${count(list.length)} match${list.length === 1 ? "" : "es"} confirmed`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save that");
      repeats.reload();
    } finally {
      setBusy(false);
    }
  }

  if (repeats.error) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <ErrorState message={repeats.error.message} code={repeats.error.code} onRetry={repeats.reload} />
      </Screen>
    );
  }
  if (repeats.loading && !data) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <Loading rows={3} label="Looking for guests who came back" />
      </Screen>
    );
  }
  if (!data || data.count === 0) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <EmptyState
          title="No repeat guests found yet"
          action={
            <Link className="btn small" href="/upload">
              Upload statements
            </Link>
          }
        >
          Seedha compares every OTA booking with your earlier stays once your statements are in.
        </EmptyState>
      </Screen>
    );
  }

  const sure = data.matches.filter((m) => m.status === "suggested" && m.confidence >= SURE);
  return (
    <Screen title={TITLE} sub={SUB}>
      <div className={`${ui.tiles} ${ui.two}`}>
        <div className={`stat ${ui.tile} ${ui.dark}`}>
          <b className={ui.value}>{count(data.count)}</b>
          <span className={ui.label}>repeat guests via OTA</span>
          <span className={ui.note}>
            {data.confirmed
              ? `${count(data.confirmed)} confirmed by you`
              : "Each one needs your confirmation"}
          </span>
        </div>
        <div className={`stat ${ui.tile}`}>
          <b className={`${ui.value} ${ui.loss}`}>−{inr(data.paid_twice_total)}</b>
          <span className={ui.label}>commission paid twice</span>
          <span className={ui.note}>Commission plus GST on their return booking</span>
        </div>
      </div>
      <CalcNote>A match is a suggestion until you confirm it.</CalcNote>

      <div className={r.list}>
        {data.matches.map((m) => (
          <GuestCard key={m.id} match={m} busy={busy} onDecide={decide} />
        ))}
      </div>

      <div className={`${ui.card} ${r.privacy}`}>
        <span className={r.lock} aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </span>
        <p style={{ margin: 0 }}>This list is for your eyes only. We never message these guests.</p>
      </div>

      <div className={r.footer}>
        <button
          type="button"
          className="btn"
          disabled={busy || sure.length === 0}
          onClick={() => void confirmSure(sure)}
          aria-describedby="confirm-note"
        >
          Confirm matches
        </button>
        <span id="confirm-note" className={r.decideNote}>
          {sure.length
            ? `Confirms the ${count(sure.length)} match${sure.length === 1 ? "" : "es"} at ${SURE}% or more. Decide the others one by one.`
            : "Every match at 80% or more is confirmed."}
        </span>
      </div>
    </Screen>
  );
}

function GuestCard({
  match: m,
  busy,
  onDecide,
}: {
  match: RepeatMatch;
  busy: boolean;
  onDecide: (m: RepeatMatch, d: "confirm" | "dismiss") => void;
}) {
  const sure = m.confidence >= SURE;
  const alias = m.first.guest_name !== m.guest_name || m.first.city !== m.city;
  return (
    <article className={`${ui.card} ${r.guest}`} aria-label={m.guest_name}>
      <div>
        <h2 className={r.name}>
          {m.guest_name}
          {m.city ? `, ${m.city}` : ""}
        </h2>
        <p className={r.trip}>
          {m.first.channel}, {monthYear(m.first.check_in)} → {m.returned.channel},{" "}
          {monthYear(m.returned.check_in)}
        </p>
        {alias ? (
          <p className={r.alias}>
            First stay as {m.first.guest_name}
            {m.first.city ? `, ${m.first.city}` : ""}
          </p>
        ) : null}
      </div>
      <div className={r.amount}>
        <b>−{inr(m.paid_twice)}</b>
        <span>paid twice</span>
      </div>
      <div className={r.chips}>
        <Chip tone={sure ? "ok" : "plain"}>Same guest? {m.confidence}% sure</Chip>
        {m.not_new_demand ? <Chip>Not new demand</Chip> : null}
        {m.llm_opinion ? <Chip>Claude: {m.llm_opinion}</Chip> : null}
        {m.status === "confirmed" ? (
          <Chip tone="ok">
            <span aria-hidden="true">✓</span> Confirmed
          </Chip>
        ) : null}
      </div>
      {m.status !== "confirmed" && !sure ? (
        <div className={r.decide}>
          <button type="button" className="btn small" disabled={busy} onClick={() => onDecide(m, "confirm")}>
            Confirm
          </button>
          <button
            type="button"
            className="btn small ghost"
            disabled={busy}
            onClick={() => onDecide(m, "dismiss")}
          >
            Not same
          </button>
          <span className={r.decideNote}>Below {SURE}%: please check</span>
        </div>
      ) : null}
    </article>
  );
}
