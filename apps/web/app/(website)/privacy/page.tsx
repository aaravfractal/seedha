import Link from "next/link";
import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy · Seedha" };

const P = ({ children }: { children: string }) => <span className="placeholder">{children}</span>;

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      lede="How Seedha handles personal data, written for India's Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025."
      points={{
        en: [
          "Guests get WhatsApp offers only if they tick yes at the hotel's Desk. The box starts unticked.",
          "Contacts that come from OTAs (MakeMyTrip, Booking.com, Agoda) are never used for marketing.",
          "Reply STOP to any message and the messages stop.",
          "Only a salted fingerprint of each consent is ever made public. No name, phone or booking detail.",
          "You can ask for your consent record to be erased on the Delete my data page.",
        ],
        hi: [
          "Guest ko WhatsApp offer tabhi milte hain jab woh Desk par khud tick karke haan kehte hain. Box pehle se khaali hota hai.",
          "OTA (MakeMyTrip, Booking.com, Agoda) se aaye contact kabhi marketing ke liye use nahi hote.",
          "Kisi bhi message par STOP likhiye, message band ho jayenge.",
          "Public record mein sirf ek salted fingerprint jaata hai. Naam, phone ya booking ki koi jaankari nahi.",
          "Apna consent record mitaane ke liye Delete my data page par request bhejiye.",
        ],
      }}
    >
      <h2 className="section">1. Who is responsible</h2>
      <p>
        Seedha is a hackathon prototype that helps small hotels see what each booking channel leaves them and
        invite past guests to book directly. For guest data collected at a hotel&apos;s front desk, the hotel
        decides why and how it is used, so the hotel is the Data Fiduciary and Seedha processes the data on
        the hotel&apos;s behalf. For hotel owner account data, Seedha is the Data Fiduciary. The roles must be
        confirmed by a lawyer before launch.
      </p>

      <h2 className="section">2. What we collect</h2>
      <ul>
        <li>
          <b>Hotel owner account data:</b> the hotel&apos;s name and address, the owner&apos;s name, room
          types and prices, and login details.
        </li>
        <li>
          <b>Uploaded statements:</b> OTA payout statements and hotel registers. These contain booking
          references, stay dates, guest names and cities, and amounts. They are used to calculate what each
          channel leaves the hotel and to spot guests who came back through an OTA.
        </li>
        <li>
          <b>Desk consent records:</b> when a guest scans the Desk QR and ticks yes, we store their WhatsApp
          number (typed by the guest), the time, the version of the wording they agreed to, a random salt and
          a fingerprint.
        </li>
        <li>
          <b>Direct bookings through Seedha Link:</b> dates, room, amount, perk code and a payment reference.
        </li>
      </ul>

      <h2 className="section">3. Why we use it</h2>
      <ul>
        <li>To show the hotel what each channel really leaves after commission, GST and fees.</li>
        <li>
          To show the hotel which guests came back through an OTA. This list is for the hotel&apos;s eyes
          only.
        </li>
        <li>
          To send a guest who said yes a thank-you with a perk, and only after the owner approves each
          message.
        </li>
        <li>To let a returning guest book directly and to count the commission the hotel saved.</li>
        <li>To prove, if asked, when a guest said yes, without making the guest identifiable.</li>
      </ul>

      <h2 className="section">4. Legal basis</h2>
      <p>
        Marketing messages to guests rely on consent under the DPDP Act: free, specific, informed and given by
        a clear action. The consent box is never pre-ticked, the guest types their own number, and the wording
        names WhatsApp and how to stop. Processing of statements is limited to what the hotel needs to
        understand its own bookings. The legal basis for each activity must be confirmed by a lawyer before
        launch.
      </p>

      <h2 className="section">5. What we never do</h2>
      <ul>
        <li>
          We never use guest contacts received from OTAs for messages. Matching a guest in OTA data never
          makes them messageable.
        </li>
        <li>We never send a message without the owner approving it, and never after a guest replies STOP.</li>
        <li>We never scrape OTA websites.</li>
        <li>We never sell personal data or use it for advertising.</li>
        <li>We never put a name, phone number or booking detail on a public blockchain.</li>
      </ul>

      <h2 className="section">6. Public proof</h2>
      <p>
        Each consent becomes a fingerprint: a SHA-256 hash of a random salt and the consent facts. Each night
        the fingerprints are combined into one Merkle root. In the prototype the root is stored by Seedha; it
        may later be written to a public blockchain. A fingerprint cannot be turned back into a person, and
        after erasure the salt is deleted so nobody, including Seedha, can link it to anyone.
      </p>

      <h2 className="section">7. How long we keep it</h2>
      <ul>
        <li>
          Consent records: while the consent is active. After STOP or an erasure request, the number and salt
          are removed.
        </li>
        <li>
          Statements and bookings: while the hotel&apos;s account is active, then deleted unless the hotel
          must keep them for tax law.
        </li>
        <li>Fingerprints in a proof bundle: kept, because they identify no one.</li>
      </ul>
      <p>Exact retention periods are to be set with a lawyer before launch.</p>

      <h2 className="section">8. Your rights as a guest</h2>
      <ul>
        <li>
          <b>Withdraw consent:</b> reply STOP to any message. It is as easy as giving consent.
        </li>
        <li>
          <b>Erasure:</b> use <Link href="/data-deletion">Delete my data</Link> with your booking reference
          and number.
        </li>
        <li>
          <b>Access and correction:</b> write to the grievance contact below.
        </li>
        <li>
          <b>Nomination:</b> you may nominate someone to exercise these rights for you, as the DPDP Act
          allows.
        </li>
        <li>
          <b>Grievance:</b> if you are not satisfied with our answer, you may complain to the Data Protection
          Board of India.
        </li>
      </ul>

      <h2 className="section">9. Children</h2>
      <p>
        Seedha is not meant for children. The Desk consent is for adult guests; we do not knowingly collect a
        child&apos;s data for messages.
      </p>

      <h2 className="section">10. Who processes data for us</h2>
      <ul>
        <li>A hosting provider that runs Seedha&apos;s servers and database.</li>
        <li>Meta&apos;s WhatsApp Cloud API, to deliver messages the owner approved.</li>
        <li>A payment gateway, to take UPI payments for direct bookings (simulated in the prototype).</li>
        <li>
          Anthropic&apos;s Claude API, to read statements in layouts Seedha does not recognise and to word
          messages. Amounts are always checked against the file by Seedha&apos;s own code.
        </li>
      </ul>

      <h2 className="section">11. Security</h2>
      <p>
        Owner screens need a login, the Desk box needs its own key, consent links work once and expire in 10
        minutes, secrets are kept out of the code, and guest numbers are never written to logs. See also our{" "}
        <Link href="/security">security page</Link>.
      </p>

      <h2 className="section">12. Contact and grievances</h2>
      <p>
        Grievance officer: <P>[grievance officer name]</P>. Email: <P>[contact email]</P>. We answer within
        the time the DPDP Rules require.
      </p>

      <h2 className="section">13. Changes</h2>
      <p>
        If this policy changes, the date at the top changes too, and material changes are announced in the
        app.
      </p>
    </LegalPage>
  );
}
