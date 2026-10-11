import type { Metadata } from "next";
import Link from "next/link";
import { ContactEmail, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Security · Seedha",
  description:
    "How to report a security problem in Seedha, and which safeguards are built today and which are planned.",
};

export default function SecurityPage() {
  return (
    <LegalPage
      title="Report a security problem"
      lede="We welcome reports from security researchers and hotel owners."
    >
      <h2 className="section">How to report</h2>
      <p>
        Write to the Seedha team with what you found, how to reproduce it, and what an attacker could do.
        Include your name or handle if you would like to be thanked. Email: <ContactEmail kind="security" />
      </p>

      <h2 className="section">What we ask</h2>
      <ul>
        <li>
          Use only your own accounts, the sample hotel, or test data. Never access or change a real
          guest&apos;s data.
        </li>
        <li>
          Do not send messages to guests, run denial-of-service tests, or use automated scanners against
          production.
        </li>
        <li>Give us reasonable time to fix the problem before you tell anyone else.</li>
      </ul>

      <h2 className="section">What we promise</h2>
      <ul>
        <li>We will reply to confirm we received your report.</li>
        <li>We will keep you informed while we fix it and tell you when it is fixed.</li>
        <li>We will not take legal action against good-faith research that follows these rules.</li>
      </ul>

      <h2 className="section">What is built and what is planned</h2>
      <p>We only claim what this prototype does today.</p>
      <ul>
        <li>
          Built: guest consent logged. Each yes is stored with the wording the guest saw and sealed nightly.
        </li>
        <li>Built: no OTA scraping. Seedha reads only the statements the owner uploads.</li>
        <li>Built: owner sign-in with a one-time code, limits on tries, and rate limits on public pages.</li>
        <li>Built: consent links and Desk device keys stored only as hashes. Guest numbers never logged.</li>
        <li>
          Built: consent fingerprints are salted SHA-256 hashes. The nightly Merkle root is stored by Seedha
          and is not yet on a public chain.
        </li>
        <li>Planned: two-step sign-in.</li>
        <li>Planned: encryption at rest for the database.</li>
        <li>Planned: a PCI DSS payment gateway. Payments in this prototype run in simulated test mode.</li>
        <li>Planned: data stored in India before launch.</li>
      </ul>
      <p>
        Seedha holds no security certification and does not claim one. How we handle a data breach is in the{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2 className="section">Especially interesting to us</h2>
      <ul>
        <li>Any way to message a guest who did not consent, or after they replied STOP.</li>
        <li>Any way to redeem a perk code twice, or change a rupee figure Seedha shows.</li>
        <li>
          Any way to reach owner screens or the Desk connection without the right session or device key.
        </li>
        <li>Any way to link a published consent fingerprint back to a person.</li>
      </ul>
    </LegalPage>
  );
}
