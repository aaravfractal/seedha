"use client";

import Link from "next/link";
import { useState } from "react";
import { PLANS, SITE_SETUP_RUPEES, yearlyPrice } from "@/lib/plans";
import { inr } from "@/lib/format";

export default function PlansPage() {
  const [yearly, setYearly] = useState(true);
  return (
    <section className="view">
      <h1 className="display" style={{ textAlign: "center" }}>
        Pick a plan.
      </h1>
      <p className="lede" style={{ textAlign: "center", margin: "0 auto 18px" }}>
        One returning family booking direct usually covers a month of Seedha.
      </p>
      <div style={{ textAlign: "center" }}>
        <div className="toggle" role="group" aria-label="Billing">
          <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
            Yearly · 2 months free
          </button>
          <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
            Monthly
          </button>
        </div>
      </div>
      <div className="plans">
        {PLANS.map((plan) => {
          const price = yearly ? yearlyPrice(plan.monthly) : null;
          return (
            <div className={`plan${plan.recommended ? " rec" : ""}`} key={plan.name}>
              {plan.recommended ? (
                <span className="tag ok" style={{ alignSelf: "flex-start" }}>
                  Recommended
                </span>
              ) : null}
              <h3 className="sub-title" style={{ fontSize: 24 }}>
                Seedha {plan.name}
              </h3>
              <div className="price num">
                {inr((price ? price.perMonth : plan.monthly) * 100)}
                <small> a month</small>
              </div>
              <p className="calc" style={{ margin: 0 }}>
                {price ? `${inr(price.perYear * 100)} billed yearly` : "Billed monthly"}
              </p>
              <ul>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                className={`btn${plan.recommended ? "" : " ghost"}`}
                style={{ marginTop: "auto" }}
                href={`/contact?plan=${plan.name}`}
              >
                Start with {plan.name}
              </Link>
            </div>
          );
        })}
      </div>
      <p className="calc" style={{ textAlign: "center" }}>
        Prices are early estimates. Yearly plans get 2 months free.
      </p>
      <p className="sub" style={{ textAlign: "center", margin: "4px auto 0" }}>
        Only need a website? Seedha Site setup {inr(SITE_SETUP_RUPEES * 100)} one time.
      </p>
    </section>
  );
}
