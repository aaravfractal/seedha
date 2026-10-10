"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { PLANS, yearlyPrice } from "@/lib/plans";
import type { SettingsData } from "@/lib/types-settings";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { SampleChip, Screen, ui } from "@/components/owner/ui";
import { LaunchSheet } from "@/components/settings/Modal";
import s from "@/components/settings/settings.module.css";

const PAISE = 100;
/** Sample billing history for the sample hotel only (D10, rule 11). */
const SAMPLE_NEXT_CHARGE = "3 Nov 2026";
const SAMPLE_INVOICES = [
  { number: "SDH-SAMPLE-0003", date: "3 Oct 2026", period: "October 2026" },
  { number: "SDH-SAMPLE-0002", date: "3 Sep 2026", period: "September 2026" },
  { number: "SDH-SAMPLE-0001", date: "3 Aug 2026", period: "August 2026" },
];

type SheetFor = "pay" | "method" | null;

export default function BillingPage() {
  const settings = useApi<SettingsData>("settings");
  const [sheet, setSheet] = useState<SheetFor>(null);
  const base = PLANS.find((p) => p.name === "Base") ?? PLANS[0]!;
  const price = inr(base.monthly * PAISE);
  const yearly = yearlyPrice(base.monthly);
  const demo = settings.data?.kind === "demo";

  return (
    <Screen title="Billing." sub="Your plan, next charge and invoices.">
      {settings.error && !settings.data ? (
        <ErrorState message={settings.error.message} code={settings.error.code} onRetry={settings.reload} />
      ) : !settings.data ? (
        <Loading rows={3} label="Loading billing" />
      ) : (
        <>
          <div className={s.billTop}>
            <section className={s.planCard} aria-label="Current plan">
              <span className={s.small}>Current plan</span>
              <h2 className={s.planName}>Seedha {base.name}</h2>
              <span className={s.small}>
                {price} a month, or {inr(yearly.perYear * PAISE)} a year
              </span>
              <div className={s.planActions}>
                <button type="button" className={s.payBtn} onClick={() => setSheet("pay")}>
                  Pay {price} now
                </button>
                <Link className={s.outlineBtn} href="/plans">
                  Change plan
                </Link>
              </div>
            </section>
            <section className={s.chargeCard} aria-label="Next charge">
              <div className={s.titleRow}>
                <span className={s.small}>Next charge</span>
                {demo ? <SampleChip /> : null}
              </div>
              {demo ? (
                <>
                  <p className={s.bigText}>{SAMPLE_NEXT_CHARGE}</p>
                  <span className={s.small}>{price} for Seedha Base.</span>
                </>
              ) : (
                <>
                  <p className={s.bigText}>No charge yet</p>
                  <span className={s.small}>Nothing is charged before payments open.</span>
                </>
              )}
              <p className={ui.calc}>
                Prices are early estimates. A GST invoice will come on WhatsApp after each payment once
                payments open.
              </p>
            </section>
          </div>

          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Payment methods</h2>
            <button type="button" className={s.textBtn} onClick={() => setSheet("method")}>
              Add payment method
            </button>
          </div>
          <div className={s.list}>
            <div className={s.row}>
              <span className={s.rowText}>
                <span className={s.rowLabel}>No payment method yet</span>
                <span className={s.rowHint}>
                  Payments open after launch. Seedha stores no card or bank details.
                </span>
              </span>
            </div>
            <div className={s.row}>
              <span className={s.rowText}>
                <span className={s.rowLabel}>UPI AutoPay</span>
                <span className={s.rowHint}>Pay each month from your UPI app.</span>
              </span>
              <span className={s.planned}>Planned</span>
            </div>
            <div className={s.row}>
              <span className={s.rowText}>
                <span className={s.rowLabel}>Cards through a PCI DSS gateway</span>
                <span className={s.rowHint}>Card details would stay with the payment gateway.</span>
              </span>
              <span className={s.planned}>Planned</span>
            </div>
          </div>

          <div className={s.sectionHead}>
            <div className={s.titleRow}>
              <h2 className={s.sectionTitle}>Invoices</h2>
              {demo ? <SampleChip /> : null}
            </div>
            <Link className={s.textBtn} href="/plans">
              Compare plans
            </Link>
          </div>
          {demo ? (
            <ul className={s.list} aria-label="Sample invoices">
              {SAMPLE_INVOICES.map((inv) => (
                <li className={s.row} key={inv.number}>
                  <span className={s.rowText}>
                    <span className={s.rowLabel}>Seedha Base, {inv.period}</span>
                    <span className={s.rowHint}>
                      {inv.number} · {inv.date}
                    </span>
                  </span>
                  <span className={s.rowValue}>{price}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No invoices yet.">
              Your first invoice appears here after your first payment, once payments open.
            </EmptyState>
          )}
          {demo ? (
            <p className={ui.calc}>Sample invoices for the sample hotel. No money was charged.</p>
          ) : null}
        </>
      )}
      {sheet ? (
        <LaunchSheet
          what={
            sheet === "pay"
              ? `Paying ${price} for Seedha Base is not open yet.`
              : "Adding a payment method is not open yet."
          }
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}
