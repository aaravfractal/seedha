import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ContactEmail, LegalPage } from "@/components/LegalPage";
import { PlanNote } from "./PlanNote";

export const metadata: Metadata = {
  title: "Contact · Seedha",
  description:
    "How to reach the Seedha team about plans, privacy, security or erasing a guest consent record.",
};

export default function ContactPage() {
  return (
    <LegalPage legal={false} title="Contact" lede="Talk to the Seedha team.">
      <Suspense fallback={null}>
        <PlanNote />
      </Suspense>
      <div className="card">
        <div className="item">
          <span>Email</span>
          <ContactEmail kind="contact" />
        </div>
        <div className="item">
          <span>Privacy and grievances</span>
          <Link className="link" href="/privacy">
            Grievance Officer
          </Link>
        </div>
        <div className="item">
          <span>Security reports</span>
          <Link className="link" href="/security">
            Report a problem
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
        Seedha is a pre-launch product built for the TBI GEU AI-Tourism Hackathon. During the prototype,
        nothing is charged. <Link href="/plans">See plans</Link>.
      </p>
    </LegalPage>
  );
}
