"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { SaturdayMove } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";

export default function ScenarioPage() {
  const [rooms, setRooms] = useState<number | null>(null);
  const move = useApi<SaturdayMove>(
    rooms === null ? "scenario/saturday" : `scenario/saturday?rooms=${rooms}`,
  );
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = move.data;
  const current = rooms ?? data?.rooms ?? 6;

  async function decide(decision: "accepted" | "later") {
    setBusy(true);
    try {
      const result = await postJson<SaturdayMove>("scenario/saturday", { decision, rooms: current });
      move.setData(result);
      toast(
        decision === "accepted"
          ? `${current} Saturday rooms held for direct guests`
          : "Okay. It stays here for later.",
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  const title = <h2 className="title">One move for Saturday.</h2>;
  if (move.data && !move.data.available) {
    return (
      <>
        {title}
        <EmptyState
          title="Nothing to compare yet"
          action={
            <Link className="btn small" href="/upload">
              Upload statements
            </Link>
          }
        >
          {move.data.reason}. The move compares what an OTA and a direct guest leave you per room.
        </EmptyState>
      </>
    );
  }
  if (move.error) {
    return (
      <>
        {title}
        <ErrorState message={move.error.message} code={move.error.code} onRetry={move.reload} />
      </>
    );
  }
  if (!data || data.channel_net_adr === null || data.direct_net_adr === null) {
    return (
      <>
        {title}
        <Loading rows={2} label="Working out the Saturday move" />
      </>
    );
  }

  const accepted = data.decision === "accepted" && data.rooms === current;
  return (
    <>
      {title}
      <p className="sub">
        {data.channel_name} leaves you the least per room. Keep a few Saturday rooms for guests who book you
        directly.
      </p>
      <div className="card">
        <h3 className="sub-title">
          Hold {current} Saturday rooms off {data.channel_name}
        </h3>
        <p className="sub" style={{ margin: "6px 0 12px" }}>
          Keep them for direct and walk-in guests. The other rooms stay on OTAs so you are never empty.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span className="meta" id="rooms-label">
            Rooms to hold
          </span>
          <div className="toggle" role="group" aria-labelledby="rooms-label" style={{ margin: 0 }}>
            <button
              type="button"
              aria-label="One room fewer"
              disabled={current <= 1 || move.loading}
              onClick={() => setRooms(current - 1)}
            >
              &minus;
            </button>
            <span className="num" style={{ padding: "9px 14px", fontWeight: 700 }} aria-live="polite">
              {current}
            </span>
            <button
              type="button"
              aria-label="One room more"
              disabled={current >= data.max_rooms || move.loading}
              onClick={() => setRooms(current + 1)}
            >
              +
            </button>
          </div>
        </div>
        <div className="stats" style={{ margin: "0 0 18px" }}>
          <div className="stat">
            <b className="num">{inr(data.channel_net_adr)}</b>
            <span>kept per room on {data.channel_name}</span>
          </div>
          <div className="stat">
            <b className="num">{inr(data.direct_net_adr)}</b>
            <span>kept per room direct</span>
          </div>
          <div className="stat">
            <b className="num" style={{ color: "var(--gain)" }}>
              +{inr(data.extra_per_saturday ?? 0)}
            </b>
            <span>extra kept per Saturday if they sell direct</span>
            <small>
              {current} rooms × {inr(data.extra_per_room ?? 0)}
            </small>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn"
            disabled={busy || accepted}
            onClick={() => decide("accepted")}
          >
            {accepted ? "Accepted" : "Accept"}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => decide("later")}>
            Not now
          </button>
        </div>
        {accepted ? (
          <p className="calc">
            Seedha does not change your OTA settings. Close these {current} rooms for Saturdays in your{" "}
            {data.channel_name} extranet.
          </p>
        ) : null}
      </div>
      <p className="calc">
        Computed from what each channel left you per room in your statements. It assumes the held rooms sell
        direct; a held room that stays empty earns nothing.
      </p>
    </>
  );
}
