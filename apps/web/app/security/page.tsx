import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Security · Seedha" };

const P = ({ children }: { children: string }) => <span className="placeholder">{children}</span>;

export default function SecurityPage() {
  return (
    <LegalPage
      title="Report a security problem"
      lede="We welcome reports from security researchers and hotel owners."
    >
      <h2 className="section">How to report</h2>
      <p>
        Email <P>[security email]</P> with what you found, how to reproduce it, and what an attacker could do.
        Please include your name or handle if you would like to be thanked.
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

      <h2 className="section">Especially interesting to us</h2>
      <ul>
        <li>Any way to message a guest who did not consent, or after they replied STOP.</li>
        <li>Any way to redeem a perk code twice, or change a rupee figure Seedha shows.</li>
        <li>Any way to reach owner screens or the Desk API without the right session or device key.</li>
        <li>Any way to link a published consent fingerprint back to a person.</li>
      </ul>
    </LegalPage>
  );
}
