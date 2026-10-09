"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { count, inr } from "@/lib/format";
import type { ProData } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";

type Card = { name: string; headline: string; detail: string; sample: boolean; href: string };

function cards(p: ProData): Card[] {
  const cancelled = p.audit_cancelled_lines;
  const over = p.audit_over_rate_lines;
  return [
    {
      name: "Seedha Audit",
      headline: p.audit_claim ? `${inr(p.audit_claim)} to claim back` : "Nothing to claim back yet",
      detail: `Commission on ${count(cancelled)} cancelled stay${cancelled === 1 ? "" : "s"} and a higher rate than your contract on ${count(over)} row${over === 1 ? "" : "s"}, from your own statements.`,
      sample: false,
      href: "/upload",
    },
    {
      name: "Seedha Pulse",
      headline: "Winter Line Carnival, 25 to 30 Dec",
      detail:
        "Mussoorie will fill without help. Stop OTA discounts for these dates and keep 6 rooms for direct guests.",
      sample: p.pulse_sample,
      href: "/plans",
    },
    {
      name: "Rate Watch",
      headline: "Agoda shows ₹3,950. You sell direct at ₹4,300.",
      detail: "From a screenshot of the OTA listing. Guests who compare will book Agoda.",
      sample: p.rate_watch_sample,
      href: "/plans",
    },
    {
      name: "Seedha Proof",
      headline: `${count(p.consents)} consent${p.consents === 1 ? "" : "s"}, all tamper-proof.`,
      detail:
        "If an OTA, guest or regulator asks when a guest said yes, you can show it, and nobody can change it.",
      sample: false,
      href: "/proof",
    },
    {
      name: "Seedha Site",
      headline: "Your hotel online in 10 minutes.",
      detail: "Website, packages and a rate card from a few photos and a voice note.",
      sample: false,
      href: "/site",
    },
  ];
}

export default function ProPage() {
  const pro = useApi<ProData>("pro");
  return (
    <>
      <h2 className="title">Seedha Pro.</h2>
      <p className="sub">For owners who want Seedha to find more money.</p>
      {pro.error ? (
        <ErrorState message={pro.error.message} code={pro.error.code} onRetry={pro.reload} />
      ) : !pro.data ? (
        <Loading rows={3} label="Loading Pro" />
      ) : (
        <div className="grid gap-4">
          {cards(pro.data).map((c) => (
            <div className="card" key={c.name}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <h3 className="sub-title">{c.name}</h3>
                <span style={{ display: "flex", gap: 6 }}>
                  {c.sample ? <span className="tag sim">Sample</span> : null}
                  <span className="tag pro">Pro</span>
                </span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>
                {c.headline}
              </p>
              <p className="sub" style={{ margin: "0 0 14px" }}>
                {c.detail}
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link className="btn small ghost" href={c.href}>
                  Open
                </Link>
                <Link className="btn small ghost" href="/plans">
                  See Pro
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
