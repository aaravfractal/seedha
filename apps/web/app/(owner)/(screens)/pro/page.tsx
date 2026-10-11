"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { useApi } from "@/lib/api";
import { count, inr } from "@/lib/format";
import { RATE_WATCH_SAMPLE, rateWatchHeadline } from "@/lib/proSample";
import { PULSE_EVENTS } from "@/lib/pulse";
import type { ProData } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { Chip, Screen } from "@/components/owner/ui";
import { ExpandCard } from "@/components/pro/ExpandCard";
import type { ProCardId } from "@/components/pro/registry";
import o from "./pro.module.css";

/** One quiet label per card where the data is sample or illustrative (rule 11). */
type Tag = "Sample" | "Illustration" | null;

type BigCard = { id: ProCardId; name: string; headline: string; detail: string; foot: string; tag: Tag };
type SmallCard = { id: ProCardId; name: string; text: string; tag: Tag };

/** "Commission on 1 cancelled stay and ..." naming only the problems found (design QA PR1). */
function auditDetail(cancelled: number, over: number): string {
  const parts = [
    cancelled ? `commission on ${count(cancelled)} cancelled stay${cancelled === 1 ? "" : "s"}` : "",
    over ? `a higher rate than your contract on ${count(over)} row${over === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "No overcharges found in your statements.";
  const text = parts.join(" and ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/** The Pulse card summary repeats the view's own Winter Line Carnival decision (lib/pulse.ts). */
function carnivalDetail(): string {
  const e = PULSE_EVENTS.find((x) => x.id === "winter-line-carnival");
  return e ? `${e.date}. ${e.decision}` : "";
}

function bigCards(p: ProData): BigCard[] {
  return [
    {
      id: "audit",
      name: "Seedha Audit",
      headline: p.audit_claim ? `${inr(p.audit_claim)} to claim back` : "Nothing to claim back yet",
      detail: auditDetail(p.audit_cancelled_lines, p.audit_over_rate_lines),
      foot: "Calculated from your statements.",
      tag: p.audit_sample ? "Sample" : null,
    },
    {
      id: "pulse",
      name: "Seedha Pulse",
      headline: "Winter Line Carnival",
      detail: carnivalDetail(),
      foot: "Town events, not a demand forecast.",
      tag: p.pulse_sample ? "Sample" : null,
    },
    {
      id: "rate-watch",
      name: "Rate Watch",
      headline: rateWatchHeadline(RATE_WATCH_SAMPLE),
      detail: "From a sample screenshot. No scraping.",
      foot: "Guests who compare see the lower price.",
      tag: p.rate_watch_sample ? "Sample" : null,
    },
  ];
}

function smallCards(p: ProData): SmallCard[] {
  return [
    {
      id: "tonight",
      name: "Tonight Card",
      text: "One evening card: rooms free at the last close and the channel that keeps the most for them.",
      tag: null,
    },
    {
      id: "discount-split",
      name: "Who Paid the Discount",
      text: "Splits every OTA promotion into the part you funded and the part the OTA funded.",
      tag: "Sample",
    },
    {
      id: "floor",
      name: "Floor by Channel",
      text: "The lowest rate worth taking on each channel after commission and GST.",
      tag: "Illustration",
    },
    {
      id: "displacement",
      name: "Group Displacement",
      text: "Shows whether a group keeps you more than the rooms it pushes out.",
      tag: "Illustration",
    },
    {
      id: "khata",
      name: "Agent Khata",
      text: "Each travel agent's bookings, commission and payments in one ledger.",
      tag: "Sample",
    },
    {
      id: "rollup",
      name: "Two-Property Rollup",
      text: "Both your hotels on one screen, channel by channel.",
      tag: "Sample",
    },
    {
      id: "proof",
      name: "Seedha Proof",
      text: `${count(p.consents)} active consent${p.consents === 1 ? "" : "s"}. Show when any guest said yes, unchanged.`,
      tag: null,
    },
  ];
}

export default function ProPage() {
  const pro = useApi<ProData>("pro");
  const [openId, setOpenId] = useState<ProCardId | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  return (
    <Screen
      title="Seedha Pro."
      sub="For owners who want Seedha to find more money. Coming soon. Open any card to see it working."
    >
      {pro.error ? (
        <ErrorState message={pro.error.message} code={pro.error.code} onRetry={pro.reload} />
      ) : !pro.data ? (
        <Loading rows={3} label="Loading Pro" />
      ) : (
        <LayoutGroup>
          <div className={o.dark}>
            {bigCards(pro.data).map((c) => (
              <ExpandCard
                key={c.id}
                id={c.id}
                name={c.name}
                variant="big"
                open={openId === c.id}
                onOpen={setOpenId}
                onClose={close}
                summary={
                  <>
                    <span className={o.cardTop}>
                      <span className={o.cardName}>{c.name}</span>
                      <span className={o.tags}>
                        {c.tag ? <span className={o.sampleTag}>{c.tag}</span> : null}
                        <span className={o.proTag}>Pro</span>
                      </span>
                    </span>
                    <span className={o.headline}>{c.headline}</span>
                    <span className={o.detail}>{c.detail}</span>
                    <span className={o.bigFoot}>{c.foot}</span>
                  </>
                }
              />
            ))}
          </div>
          <div className={o.small}>
            {smallCards(pro.data).map((c) => (
              <ExpandCard
                key={c.id}
                id={c.id}
                name={c.name}
                variant="small"
                open={openId === c.id}
                onOpen={setOpenId}
                onClose={close}
                summary={
                  <>
                    <span className={o.cardTop}>
                      <span className={o.cardName}>{c.name}</span>
                      <span className={o.tags}>
                        {c.tag ? <Chip tone="sample">{c.tag}</Chip> : null}
                        <Chip>Pro</Chip>
                      </span>
                    </span>
                    <span className={o.smallText}>{c.text}</span>
                  </>
                }
              />
            ))}
          </div>
          <div className={o.pageActions}>
            <Link className="btn" href="/plans">
              See Pro
            </Link>
          </div>
        </LayoutGroup>
      )}
    </Screen>
  );
}
