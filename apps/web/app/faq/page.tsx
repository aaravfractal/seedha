import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "FAQ · Seedha" };

const FAQ: [string, string][] = [
  [
    "What does Seedha actually show me?",
    "What each booking channel leaves you after the hotel-funded discount, commission, GST on commission and payment fees, per channel and per room night. Sort by bookings, then by money kept, and see which channel really pays.",
  ],
  [
    "Where do the numbers come from?",
    "From the statements you upload: OTA payouts and your hotel register. Every rupee is calculated by code from those rows. AI never produces a figure you see.",
  ],
  [
    "What if a statement row does not add up?",
    "Seedha checks that list price minus deductions equals the payout within one rupee. Rows that fail, like a missing GST line or commission on a cancelled stay, are flagged and kept out of your numbers until you decide.",
  ],
  [
    "Is TDS counted as a cost?",
    "No. TDS and GST TCS withheld by OTAs are tax credits you can claim, so Seedha never subtracts them from what you keep.",
  ],
  [
    "Will Seedha message guests on its own?",
    "Never. Seedha drafts a thank-you with a perk, and nothing is sent until you approve that exact message.",
  ],
  [
    "Can I message guests I found in OTA statements?",
    "No. Guest contacts from OTAs are never used for messages. Only guests who tick yes at your Desk can be messaged, and they can reply STOP at any time.",
  ],
  [
    "Does Seedha make me drop my prices?",
    "No. Returning guests get a perk, like free breakfast, never a lower public rate. Seedha Link and your Seedha Site sell at your own rates.",
  ],
  [
    "How is the saving from a direct booking counted?",
    "Only when a perk code is used. Seedha takes the commission rate of the channel the guest first came through, adds 18% GST on it, and subtracts the UPI fee you paid. No code, no saving claimed.",
  ],
  [
    "What is the Seedha Desk?",
    "A small box on your reception counter. It shows a QR at check-in for the guest's consent, lights green when they say yes, and prints a slip at checkout with what the hotel kept and the guest's perk code.",
  ],
  [
    "What goes on the blockchain?",
    "Only a fingerprint of each consent: a salted hash that identifies no one. No name, phone or booking detail is ever stored there.",
  ],
];

export default function FaqPage() {
  return (
    <LegalPage legal={false} title="Questions hotel owners ask" lede="Short answers about how Seedha works.">
      {FAQ.map(([q, a]) => (
        <details key={q} className="card" style={{ marginBottom: 10 }}>
          <summary style={{ fontWeight: 600, cursor: "pointer" }}>{q}</summary>
          <p style={{ margin: "10px 0 0" }}>{a}</p>
        </details>
      ))}
    </LegalPage>
  );
}
