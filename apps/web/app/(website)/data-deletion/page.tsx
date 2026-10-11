import Link from "next/link";
import type { Metadata } from "next";
import { ContactEmail, LegalPage } from "@/components/LegalPage";
import { DeletionForm } from "./DeletionForm";

export const metadata: Metadata = {
  title: "Delete my data · Seedha",
  description:
    "Guests can ask a hotel using Seedha to erase the consent they gave at its Desk, with a booking reference and WhatsApp number.",
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      title="Delete my data"
      lede="Ask the hotel to erase the consent you gave at its Desk."
      points={{
        en: [
          "Give the booking reference from your bill or slip and the WhatsApp number you entered.",
          "Your number, the random salt and every link to you are erased. Messages stop.",
          "The anonymous fingerprint stays in the proof record but can no longer be linked to you.",
        ],
        hi: [
          "Apne bill ya slip ka booking reference aur woh WhatsApp number dijiye jo aapne diya tha.",
          "Aapka number, random salt aur aap tak pahunchne wala har link mita diya jaata hai. Message band.",
          "Proof record mein anonymous fingerprint rehta hai, par woh aap se joda nahi ja sakta.",
        ],
      }}
    >
      <DeletionForm />

      <h2 className="section">What is deleted</h2>
      <ul>
        <li>Your WhatsApp number.</li>
        <li>The random salt that made your consent fingerprint.</li>
        <li>Every link between you and the published fingerprint.</li>
        <li>The text of messages prepared for you. Unsent drafts are cancelled and nothing more is sent.</li>
      </ul>

      <h2 className="section">What is kept, and why</h2>
      <ul>
        <li>
          The anonymous fingerprint in the nightly proof record. It is a hash that identifies no one, and
          removing it would break the proof for every other guest in that night&apos;s bundle. Without the
          salt it can no longer be linked to you.
        </li>
        <li>
          The hotel&apos;s own booking record of your stay (dates, room, amount), which the hotel may need to
          keep for tax. Ask the hotel directly if you want that reviewed.
        </li>
        <li>
          A note that a deletion request arrived and whether it matched, with no number or reference stored.
        </li>
      </ul>

      <h2 className="section">Your other rights</h2>
      <p>
        To withdraw consent without erasing it, reply STOP to any message. For access, correction, a
        nomination or a complaint, see the <Link href="/privacy">privacy policy</Link> or write to the
        Grievance Officer. Email: <ContactEmail kind="privacy" />
      </p>

      <p className="calc">
        For privacy, the answer is the same whether or not a record matched, so nobody can use this page to
        find out who stayed at a hotel.
      </p>
    </LegalPage>
  );
}
