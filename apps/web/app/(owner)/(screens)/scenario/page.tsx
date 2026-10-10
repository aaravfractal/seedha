"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { OwnerSaturday } from "@/lib/types-owner";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { CalcNote, Screen, ui } from "@/components/owner/ui";
import c from "./scenario.module.css";

const TITLE = "One move for Saturday.";

export default function ScenarioPage() {
  const [rooms, setRooms] = useState<number | null>(null);
  const move = useApi<OwnerSaturday>(
    rooms === null ? "scenario/saturday" : `scenario/saturday?rooms=${rooms}`,
  );
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = move.data;
  const current = rooms ?? data?.rooms ?? 6;

  async function send(path: string, body: unknown, note: string) {
    setBusy(true);
    try {
      move.setData(await postJson<OwnerSaturday>(path, body));
      toast(note);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  if (move.error) {
    return (
      <Screen title={TITLE}>
        <ErrorState message={move.error.message} code={move.error.code} onRetry={move.reload} />
      </Screen>
    );
  }
  if (data && !data.available) {
    return (
      <Screen title={TITLE}>
        <EmptyState
          title="Nothing to compare yet"
          action={
            <Link className="btn small" href="/upload">
              Upload statements
            </Link>
          }
        >
          {data.reason}. The move compares what an OTA and a direct guest leave you per room.
        </EmptyState>
      </Screen>
    );
  }
  if (
    !data ||
    data.channel_net_adr === null ||
    data.direct_net_adr === null ||
    data.before_per_saturday === null ||
    data.after_per_saturday === null
  ) {
    return (
      <Screen title={TITLE}>
        <Loading rows={2} label="Working out the Saturday move" />
      </Screen>
    );
  }

  const channel = data.channel_name ?? "the lowest OTA";
  const extra = data.extra_per_saturday ?? 0;
  const before = data.before_per_saturday;
  const after = data.after_per_saturday;
  const top = Math.max(before, after, 1);
  const decided = data.decision !== null && data.rooms === current ? data.decision : null;

  return (
    <Screen title={TITLE}>
      <div className={ui.card}>
        <p className={c.sentence}>
          Hold {current} Saturday rooms off {channel}. Keep them for direct and walk-in guests. Expected extra
          kept: <span className={c.money}>{inr(extra)}</span> per Saturday if they sell direct.
        </p>

        <div className={c.layout}>
          <div
            className={c.chart}
            role="img"
            aria-label={`Before ${inr(before)}, after ${inr(after)} per Saturday`}
          >
            <div className={c.col}>
              <span className={c.colLabel}>
                Before · {current} rooms on {channel}
              </span>
              <span className={c.colValue}>{inr(before)}</span>
              <div className={`${c.bar} ${c.before}`} style={{ height: `${(before / top) * 150}px` }} />
            </div>
            <div className={c.col}>
              <span className={c.colLabel}>After · {current} rooms direct</span>
              <span className={c.colValue}>{inr(after)}</span>
              <div className={`${c.bar} ${c.after}`} style={{ height: `${(after / top) * 150}px` }} />
            </div>
          </div>
          <div className={c.extra}>
            <span className={c.extraLabel}>Extra kept per Saturday</span>
            <b className={c.extraValue}>+{inr(extra)}</b>
            <span className={c.extraNote}>
              {current} rooms × ({inr(data.direct_net_adr)} direct − {inr(data.channel_net_adr)} on {channel})
            </span>
          </div>
        </div>

        <div className={c.rooms}>
          <span className={c.colLabel} id="rooms-label">
            Rooms to hold
          </span>
          <div className={c.stepper} role="group" aria-labelledby="rooms-label">
            <button
              type="button"
              aria-label="One room fewer"
              disabled={current <= 1 || move.loading || busy}
              onClick={() => setRooms(current - 1)}
            >
              −
            </button>
            <output aria-live="polite">{current}</output>
            <button
              type="button"
              aria-label="One room more"
              disabled={current >= data.max_rooms || move.loading || busy}
              onClick={() => setRooms(current + 1)}
            >
              +
            </button>
          </div>
        </div>

        {decided === null ? (
          <div className={ui.actions}>
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                send(
                  "scenario/saturday",
                  { decision: "accepted", rooms: current },
                  `${current} Saturday rooms held for direct guests`,
                )
              }
            >
              Accept
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={busy}
              onClick={() =>
                send(
                  "scenario/saturday",
                  { decision: "later", rooms: current },
                  "Okay. It stays here for later.",
                )
              }
            >
              Not now
            </button>
          </div>
        ) : (
          <div className={c.done} role="status">
            <span className={`${c.check}${decided === "later" ? ` ${c.later}` : ""}`} aria-hidden="true">
              {decided === "accepted" ? "✓" : "·"}
            </span>
            <div>
              <p className={c.doneTitle}>
                {decided === "accepted"
                  ? `Accepted. ${current} Saturday rooms are held for direct guests.`
                  : "Not now. This move stays here for later."}
              </p>
              <p className={c.doneText}>
                {decided === "accepted"
                  ? `Seedha does not change your OTA settings. Close these ${current} rooms for Saturdays in your ${channel} extranet.`
                  : "Nothing changes on your OTAs."}
              </p>
            </div>
            <div className={c.doneActions}>
              <button
                type="button"
                className="btn small ghost"
                disabled={busy}
                onClick={() => send("scenario/saturday/undo", undefined, "Undone")}
              >
                Undo
              </button>
            </div>
          </div>
        )}
      </div>
      <CalcNote>
        From what each channel left you per room night in your statements. It assumes the held rooms sell
        direct; a held room that stays empty earns nothing.
      </CalcNote>
    </Screen>
  );
}
