"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { count, inr, monthYear } from "@/lib/format";
import type { RepeatMatch, Repeats } from "@/lib/types";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";

const PREVIEW = 3;

export default function RepeatPage() {
  const repeats = useApi<Repeats>("repeat");
  const toast = useToast();
  const [showAll, setShowAll] = useState(false);
  const data = repeats.data;

  async function decide(match: RepeatMatch, decision: "confirm" | "dismiss") {
    try {
      repeats.setData(await postJson<Repeats>(`repeat/${match.id}`, { decision }));
      toast(decision === "confirm" ? "Match confirmed" : "Removed. Not the same guest.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save that");
    }
  }

  const header = (
    <>
      <h2 className="title">Guests you paid for twice.</h2>
      <p className="sub">
        These guests came back through an OTA. You already won them, and paid commission again.
      </p>
    </>
  );

  if (repeats.error) {
    return (
      <>
        {header}
        <ErrorState message={repeats.error.message} code={repeats.error.code} onRetry={repeats.reload} />
      </>
    );
  }
  if (repeats.loading && !data) {
    return (
      <>
        {header}
        <Loading rows={3} label="Looking for guests who came back" />
      </>
    );
  }
  if (!data || data.count === 0) {
    return (
      <>
        {header}
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
      </>
    );
  }

  const shown = showAll ? data.matches : data.matches.slice(0, PREVIEW);
  return (
    <>
      {header}
      <div className="stats" style={{ margin: "0 0 16px" }}>
        <div className="stat">
          <b className="num">{count(data.count)}</b>
          <span>repeat guests</span>
          <small>
            {data.confirmed ? `${count(data.confirmed)} confirmed by you` : "Confirm each one you recognise"}
          </small>
        </div>
        <div className="stat">
          <b className="num" style={{ color: "var(--loss)" }}>
            {inr(data.paid_twice_total)}
          </b>
          <span>commission paid twice</span>
          <small>commission + GST on their return booking</small>
        </div>
      </div>
      <div className="card">
        {shown.map((m) => (
          <div className="item stack-s" key={m.id}>
            <div>
              <b>
                {m.guest_name}
                {m.city ? `, ${m.city}` : ""}
              </b>
              <div className="meta">
                {m.first.channel}, {monthYear(m.first.check_in)} · came back {m.returned.channel},{" "}
                {monthYear(m.returned.check_in)}
              </div>
              {m.first.guest_name !== m.guest_name || m.first.city !== m.city ? (
                <div className="meta">
                  First stay as {m.first.guest_name}
                  {m.first.city ? `, ${m.first.city}` : ""}
                </div>
              ) : null}
              <div className="meta" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                Same guest?{" "}
                <span className={`tag ${m.confidence >= 80 ? "ok" : ""}`}>{m.confidence}% sure</span>
                <span className="tag">Not new demand</span>
                {m.llm_opinion ? <span className="tag">Claude: {m.llm_opinion}</span> : null}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <b className="num" style={{ color: "var(--loss)" }}>
                {inr(m.paid_twice)}
              </b>
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  gap: 6,
                  justifyContent: "flex-end",
                  flexWrap: "wrap",
                }}
              >
                {m.status === "confirmed" ? (
                  <span className="tag ok">Confirmed</span>
                ) : (
                  <>
                    <button type="button" className="btn small ghost" onClick={() => decide(m, "dismiss")}>
                      Not them
                    </button>
                    <button type="button" className="btn small" onClick={() => decide(m, "confirm")}>
                      Confirm
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <p className="calc">
          Showing {count(shown.length)} of {count(data.count)}.{" "}
          {data.count > PREVIEW ? (
            <button type="button" className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Show fewer" : `Show all ${count(data.count)}`}
            </button>
          ) : null}
        </p>
      </div>
      <p className="calc">
        For your eyes only. Seedha never messages guests found through OTA data. A match is only a guess until
        you confirm it.
      </p>
    </>
  );
}
