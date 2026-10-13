import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "About · Seedha",
  description:
    "Seedha shows small hill hotels what each booking channel really leaves them. Built by a small team for the TBI GEU AI-Tourism Hackathon, Track D6.",
};

/** The team by role only. No names or personal profiles on the public site. */
const TEAM: [string, string][] = [
  ["Founder", "Sets the product direction and the rules Seedha never breaks."],
  ["Product", "Designs the screens hotel owners and guests see, and checks every number they show."],
  ["Engineering", "Builds the ledger, the front desk screen and the guest booking pages."],
];

export default function AboutPage() {
  return (
    <LegalPage
      legal={false}
      title="About Seedha"
      lede="Seedha shows small hill hotels what each booking channel really leaves them, and helps them win guests back to book direct."
    >
      <h2 className="section">The problem</h2>
      <p>
        A small hotel in Mussoorie can sell most of its rooms through MakeMyTrip, Booking.com and Agoda, and
        still not know which channel actually pays. After the hotel-funded discount, commission, GST on
        commission and payment fees, the busiest channel can leave the least per room. And guests who loved
        their stay often come back through an OTA, so the hotel pays commission twice for a guest it already
        won.
      </p>

      <h2 className="section">What Seedha does</h2>
      <ul>
        <li>Reads OTA payout statements and the hotel register, and checks every row adds up.</li>
        <li>
          Shows gross against net by channel: the flip from &quot;by bookings&quot; to &quot;by money
          kept&quot;.
        </li>
        <li>Finds guests who came back through an OTA, for the owner&apos;s eyes only.</li>
        <li>Asks guests at the front desk, with an unticked box, if they want direct-booking offers.</li>
        <li>Drafts a thank-you with a perk, sent only when the owner approves, with STOP always working.</li>
        <li>Lets the guest book directly at the hotel&apos;s own rate and counts the commission saved.</li>
      </ul>

      <h2 className="section">Hackathon</h2>
      <p>
        Built for the TBI GEU AI-Tourism Hackathon, 13 to 14 October 2026, problem D6: Channel Mix and
        Distribution Cost Optimisation. D6 is computation, not prediction, so every rupee Seedha shows is
        calculated by code from the hotel&apos;s own statements. AI only reads unusual statement layouts and
        words messages.
      </p>

      <h2 className="section">The team</h2>
      <p>
        The Seedha team is a small group building for the TBI GEU AI-Tourism Hackathon, Track D6. We describe
        ourselves by role.
      </p>
      <ul>
        {TEAM.map(([role, work]) => (
          <li key={role}>
            <b>{role}.</b> {work}
          </li>
        ))}
      </ul>

      <p className="calc">
        All hotel and guest data in this prototype is fictional sample data, including the sample hotel, its
        owner Rajesh ji and guests such as Rahul S. and Neha Gupta. See the <Link href="/faq">FAQ</Link> or{" "}
        <Link href="/contact">contact us</Link>.
      </p>
    </LegalPage>
  );
}
