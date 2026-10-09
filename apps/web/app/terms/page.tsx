import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of use · Seedha" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      lede="The rules for hotel owners who use Seedha."
      points={{
        en: [
          "You approve every message before it is sent. Seedha never sends on its own.",
          "Message only guests who said yes at your Desk. Never guests found in OTA data.",
          "Use Seedha for perks for returning guests, not to sell rooms below your public rate.",
          "Seedha's numbers come from the statements you upload. Check them before you act.",
          "Indian law applies. Courts at Dehradun, Uttarakhand.",
        ],
        hi: [
          "Har message bhejne se pehle aap approve karte hain. Seedha khud kabhi nahi bhejta.",
          "Sirf unhi guests ko message kijiye jinhone Desk par haan kaha. OTA data wale guests ko kabhi nahi.",
          "Seedha wapas aane wale guests ko perk dene ke liye hai, public rate se kam mein room bechne ke liye nahi.",
          "Seedha ke numbers aapke upload kiye statements se bante hain. Faisla lene se pehle check kijiye.",
          "Bharat ka kanoon laagu hoga. Adalat: Dehradun, Uttarakhand.",
        ],
      }}
    >
      <h2 className="section">1. The service</h2>
      <p>
        Seedha reads your booking-channel statements, shows what each channel leaves you, finds guests who
        came back through an OTA, captures guest consent at your front desk, drafts win-back messages for your
        approval, and lets returning guests book with you directly. This is a hackathon prototype: it runs on
        fictional sample data and some connections are simulated and labelled as such.
      </p>

      <h2 className="section">2. Subscription</h2>
      <p>
        Plans and prices are on the <Link href="/plans">plans page</Link>. They are early estimates and may
        change before launch. A plan renews monthly or yearly as chosen, and you can stop renewal before the
        next period.
      </p>

      <h2 className="section">3. You approve every message</h2>
      <p>
        Seedha drafts messages; you decide. Nothing is sent to a guest until you approve that message. You are
        responsible for the messages you approve and for keeping your WhatsApp account in good standing.
      </p>

      <h2 className="section">4. Consent and guest data</h2>
      <ul>
        <li>
          Message only guests who gave consent through the Seedha Desk. The consent box must stay unticked
          until the guest ticks it.
        </li>
        <li>Do not use OTA-provided guest contacts for marketing, inside or outside Seedha.</li>
        <li>Honour STOP immediately. Seedha blocks further messages to that guest.</li>
        <li>Upload only statements and registers of your own hotel.</li>
      </ul>

      <h2 className="section">5. No lower public rates through Seedha</h2>
      <p>
        Seedha Link and Seedha Site sell at your own public room rates. Returning guests get a perk, such as
        breakfast, not a lower price. Do not use Seedha to undercut your published rates.
      </p>

      <h2 className="section">6. Acceptable use</h2>
      <ul>
        <li>No scraping of OTA websites and no attempts to break or overload Seedha.</li>
        <li>No spam, no messages to people who did not opt in, no misleading offers.</li>
        <li>Keep your passcode and Desk device key private. Tell us at once if you think they leaked.</li>
      </ul>

      <h2 className="section">7. Numbers and advice</h2>
      <p>
        Every rupee Seedha shows is calculated by code from the statements you upload; rows that do not add up
        are flagged for you to review. Seedha is not tax, legal or accounting advice. Check figures with your
        accountant before relying on them for tax or disputes with a channel.
      </p>

      <h2 className="section">8. Limitation of liability</h2>
      <p>
        Seedha is provided as it is during the prototype stage. To the extent the law allows, Seedha is not
        liable for indirect losses, lost bookings, or decisions made by OTAs or guests, and its total
        liability is limited to the fees you paid in the 12 months before the claim. Nothing here limits
        liability that cannot be limited under Indian law.
      </p>

      <h2 className="section">9. Ending the service</h2>
      <p>
        You can stop using Seedha at any time. We may suspend accounts that break these terms. On closure your
        data is deleted as described in the <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2 className="section">10. Law and courts</h2>
      <p>
        These terms are governed by the laws of India. Courts at Dehradun, Uttarakhand have jurisdiction over
        any dispute.
      </p>
    </LegalPage>
  );
}
