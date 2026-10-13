"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, SITE_SETUP_RUPEES, STATEMENT_CLEANUP_RUPEES, yearlyPrice } from "@/lib/plans";
import { inr } from "@/lib/format";
import styles from "./site.module.css";

const rupees = (n: number) => inr(n * 100);

/** Plans with a Yearly (default, 2 months free) or Monthly toggle. Prices from lib/plans.ts. */
export function Pricing() {
  const [yearly, setYearly] = useState(true);
  return (
    <section id="pricing" className={styles.section} aria-labelledby="pricing-title">
      <div className={styles.container}>
        <div className={styles.priceHead}>
          <div>
            <p className={styles.kicker}>Pricing</p>
            <h2 id="pricing-title" className={styles.h2}>
              One price a month. No commission on bookings.
            </h2>
          </div>
          <div className={styles.seg} role="group" aria-label="Billing period">
            <span
              className={styles.segPill}
              aria-hidden="true"
              style={{ transform: yearly ? "none" : "translateX(100%)" }}
            />
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={yearly}
              onClick={() => setYearly(true)}
            >
              Yearly · 2 months free
            </button>
            <button
              type="button"
              className={styles.segBtn}
              aria-pressed={!yearly}
              onClick={() => setYearly(false)}
            >
              Monthly
            </button>
          </div>
        </div>
        <div className={styles.plans}>
          {PLANS.map((plan) => {
            const y = yearlyPrice(plan.monthly);
            return (
              <article
                key={plan.name}
                className={`${styles.plan}${plan.recommended ? ` ${styles.planPro}` : ""}`}
              >
                <h3 className={styles.planName}>
                  {plan.name}
                  {plan.recommended ? <span className={styles.recommended}>Recommended</span> : null}
                </h3>
                <p className={`${styles.price} ${styles.money}`}>
                  {rupees(yearly ? y.perMonth : plan.monthly)}
                  <small> a month</small>
                </p>
                <p className={styles.priceNote}>
                  {yearly ? `${rupees(y.perYear)} billed yearly` : "Billed monthly"}
                </p>
                <ul className={styles.planFeatures}>
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`${plan.recommended ? styles.pill : styles.pillOutline} ${styles.planBtn}`}
                >
                  Start with {plan.name}
                </Link>
              </article>
            );
          })}
        </div>
        <p className={styles.footnote} style={{ textAlign: "center" }}>
          Only need a website? Seedha Site setup {rupees(SITE_SETUP_RUPEES)}, one time. Optional{" "}
          {rupees(STATEMENT_CLEANUP_RUPEES)} to clean six months of old statements. Prices are early
          estimates.
        </p>
      </div>
    </section>
  );
}

const ROLES = [
  ["Founding engineer, full stack", "Python and TypeScript. Statements, ledgers and the Desk API."],
  [
    "Hotel success lead, Uttarakhand",
    "Visit owners in Mussoorie, Nainital and Rishikesh. Hindi and English.",
  ],
  ["Hardware engineer, Seedha Desk", "ESP32, thermal printers and small runs of reception boxes."],
  ["Product designer", "Owner app, guest pages and hotel sites, in Hindi and English."],
] as const;

/** Four planned roles. Applications open before launch; no address is shown until then. */
export function Careers({ page = false }: { page?: boolean }) {
  const Title = page ? "h1" : "h2";
  const RoleTitle = page ? "h2" : "h3";
  return (
    <section
      id="careers"
      className={styles.section}
      style={page ? { paddingTop: 64, paddingBottom: 120 } : undefined}
      aria-labelledby="careers-title"
    >
      <div className={styles.container}>
        <p className={styles.kicker}>Careers</p>
        <Title id="careers-title" className={styles.h2}>
          Help small hotels keep more.
        </Title>
        <p className={styles.lede}>Planned roles for after the hackathon. Applications open before launch.</p>
        <div className={styles.roles}>
          {ROLES.map(([title, meta]) => (
            <article key={title} className={styles.role}>
              <div>
                <RoleTitle className={styles.roleTitle}>{title}</RoleTitle>
                <p className={styles.roleMeta}>{meta} Dehradun or remote.</p>
              </div>
              <span className={styles.planned}>Planned</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  [
    "Where do the numbers come from?",
    "From the statements you upload. Seedha reads each line and does plain arithmetic: list price minus hotel-funded discount, commission, GST on commission and payment fees. Rows that do not add up are flagged and left out until you review them.",
  ],
  [
    "Is TDS counted as a cost?",
    "No. TDS and GST TCS are tax credits you can claim, so Seedha never subtracts them from what you keep.",
  ],
  [
    "Will Seedha message my OTA guests?",
    "Never. Guests found in OTA statements stay on a list for your eyes only. Seedha messages only guests who said yes at your Desk, and only after you approve each message.",
  ],
  [
    "Do I have to lower my public rate?",
    "No. Returning guests get a perk, such as free breakfast, at your usual rate.",
  ],
  [
    "Does direct booking cost nothing?",
    "It costs less. UPI payments carry a small fee that the hotel pays, and Seedha subtracts it in every direct figure.",
  ],
  [
    "What is the Seedha Desk?",
    "A small box at reception with a screen, a light ring and a slip printer. The guest scans a QR code and ticks consent on their own phone, the ring turns green, and the slip prints at checkout.",
  ],
  [
    "Is this allowed under OTA rules and DPDP?",
    "Seedha does not scrape OTA sites, does not contact guests from OTA data and offers perks instead of lower rates. Consent is opt-in, logged and easy to withdraw. Read your own OTA contracts too; this page is not legal advice.",
  ],
  [
    "What does the AI do, and not do?",
    "It reads statement layouts it has not seen before, helps decide when two guest names look alike, explains a figure in one line of Hindi or English, drafts win-back messages, writes your hotel site's text from your own photos and words, and reads event notices you paste. It never writes a rupee figure or a price and never sends anything on its own; every amount comes from code.",
  ],
  [
    "Do I need a computer?",
    "No. Seedha works on a phone, and the six questions owners ask most are answered in the app. Answers on WhatsApp are planned.",
  ],
] as const;

export function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className={styles.section} aria-labelledby="faq-title">
      <div className={styles.container}>
        <h2 id="faq-title" className={styles.h2} style={{ margin: "0 auto", textAlign: "center" }}>
          Questions owners ask.
        </h2>
        <div className={styles.faq}>
          {FAQ.map(([q, a], i) => (
            <div key={q} className={styles.faqItem}>
              <h3 className={styles.faqQ}>
                <button
                  type="button"
                  className={styles.faqBtn}
                  aria-expanded={open === i}
                  aria-controls={`faq-${i}`}
                  id={`faq-q-${i}`}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  {q}
                  <span className={styles.faqIcon} aria-hidden="true">
                    +
                  </span>
                </button>
              </h3>
              <p
                id={`faq-${i}`}
                className={styles.faqA}
                role="region"
                aria-labelledby={`faq-q-${i}`}
                hidden={open !== i}
              >
                {a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className={`${styles.section} ${styles.finalCta}`} aria-labelledby="cta-title">
      <div className={styles.container}>
        <h2 id="cta-title" className={styles.h2}>
          Stop paying commission twice.
        </h2>
        <div className={styles.ctaRow}>
          <Link href="/demo" className={`${styles.pill} ${styles.pillLg}`}>
            Try the live demo
          </Link>
          <Link href="/signup" className={`${styles.pillOutline} ${styles.pillLg}`}>
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}
