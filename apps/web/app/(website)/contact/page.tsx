"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LegalPage } from "@/components/LegalPage";

const PLANS = new Set(["Base", "Pro", "Max"]);

export default function ContactPage() {
  const params = useSearchParams();
  const plan = params.get("plan");
  const chosen = plan && PLANS.has(plan) ? plan : null;
  return (
    <LegalPage legal={false} title="Contact" lede="Talk to the Seedha team.">
      {chosen ? (
        <div className="card" role="status" style={{ marginBottom: 16 }}>
          <h2 className="sub-title">You picked Seedha {chosen}</h2>
          <p className="sub" style={{ margin: "6px 0 0" }}>
            Write to us with your hotel&apos;s name, town and number of rooms, and we will set up {chosen}{" "}
            with you. During the prototype nothing is charged.
          </p>
        </div>
      ) : null}
      <div className="card">
        <div className="item">
          <span>Email</span>
          <span className="placeholder">[contact email]</span>
        </div>
        <div className="item">
          <span>Privacy and grievances</span>
          <Link className="link" href="/privacy">
            Privacy policy, section 12
          </Link>
        </div>
        <div className="item">
          <span>Security reports</span>
          <Link className="link" href="/security">
            Security page
          </Link>
        </div>
        <div className="item">
          <span>Guests: erase your consent</span>
          <Link className="link" href="/data-deletion">
            Delete my data
          </Link>
        </div>
      </div>
      <p className="calc">
        Seedha is a hackathon prototype. Contact details are placeholders until launch.{" "}
        <Link href="/plans">See plans</Link>.
      </p>
    </LegalPage>
  );
}
