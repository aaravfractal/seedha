"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { count, inr } from "@/lib/format";
import type { ProData } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { Chip, Screen, ui } from "@/components/owner/ui";
import o from "./pro.module.css";

type BigCard = { name: string; headline: string; detail: string; foot: string; sample: boolean };
type SmallCard = { name: string; text: string; href?: string };

function bigCards(p: ProData): BigCard[] {
  const cancelled = p.audit_cancelled_lines;
  const over = p.audit_over_rate_lines;
  return [
    {
      name: "Seedha Audit",
      headline: p.audit_claim ? `${inr(p.audit_claim)} to claim back` : "Nothing to claim back yet",
      detail: `Commission on ${count(cancelled)} cancelled stay${cancelled === 1 ? "" : "s"} and a higher rate than your contract on ${count(over)} row${over === 1 ? "" : "s"}.`,
      foot: "Calculated from your statements.",
      sample: false,
    },
    {
      name: "Seedha Pulse",
      headline: "Winter Line Carnival",
      detail: "25 to 30 Dec. Stop OTA discounts for these dates and keep 6 rooms for direct guests.",
      foot: "Town events, not a demand forecast.",
      sample: p.pulse_sample,
    },
    {
      name: "Rate Watch",
      headline: "Agoda ₹3,950 vs direct ₹4,300",
      detail: "From your screenshot today. No scraping.",
      foot: "Guests who compare book the lower price.",
      sample: p.rate_watch_sample,
    },
  ];
}

function smallCards(p: ProData): SmallCard[] {
  return [
    {
      name: "Tonight Card",
      text: "One evening card: rooms left tonight and the channel that keeps the most for them.",
    },
    {
      name: "Who Paid the Discount",
      text: "Splits every OTA promotion into the part you funded and the part the OTA funded.",
    },
    {
      name: "Floor by Channel",
      text: "The lowest rate worth taking on each channel after commission and GST.",
    },
    {
      name: "Group Displacement",
      text: "Shows whether a group keeps you more than the rooms it pushes out.",
    },
    { name: "Agent Khata", text: "Each travel agent's bookings, commission and payments in one ledger." },
    { name: "Two-Property Rollup", text: "Both your hotels on one screen, channel by channel." },
    {
      name: "Seedha Proof",
      text: `${count(p.consents)} active consent${p.consents === 1 ? "" : "s"}. Show when any guest said yes, unchanged.`,
      href: "/proof",
    },
  ];
}

export default function ProPage() {
  const pro = useApi<ProData>("pro");
  return (
    <Screen title="Seedha Pro." sub="For owners who want Seedha to find more money. Coming soon.">
      {pro.error ? (
        <ErrorState message={pro.error.message} code={pro.error.code} onRetry={pro.reload} />
      ) : !pro.data ? (
        <Loading rows={3} label="Loading Pro" />
      ) : (
        <>
          <div className={o.dark}>
            {bigCards(pro.data).map((c) => (
              <article className={o.big} key={c.name}>
                <div className={o.cardTop}>
                  <h2 className={o.cardName}>{c.name}</h2>
                  <span className={o.tags}>
                    {c.sample ? <span className={o.sampleTag}>Sample</span> : null}
                    <span className={o.proTag}>Pro</span>
                  </span>
                </div>
                <p className={o.headline}>{c.headline}</p>
                <p className={o.detail}>{c.detail}</p>
                <span className={o.bigFoot}>{c.foot}</span>
              </article>
            ))}
          </div>
          <div className={o.small}>
            {smallCards(pro.data).map((c) => (
              <article className={o.smallCard} key={c.name}>
                <div className={o.smallTop}>
                  <h2 className={o.smallName}>{c.name}</h2>
                  <Chip>Pro</Chip>
                </div>
                <p className={o.smallText}>{c.text}</p>
                {c.href ? (
                  <Link className={ui.linkBtn} href={c.href}>
                    Open
                  </Link>
                ) : null}
              </article>
            ))}
          </div>
          <div className={ui.actions}>
            <Link className="btn" href="/plans">
              See Pro
            </Link>
          </div>
        </>
      )}
    </Screen>
  );
}
