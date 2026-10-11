import Link from "next/link";
import type { Metadata } from "next";
import { ContactEmail, LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy policy · Seedha",
  description:
    "How Seedha handles hotel owner and guest data, written with India's DPDP Act 2023 and DPDP Rules 2025 in mind.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      lede="How Seedha handles personal data, written with India's Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 in mind."
      points={{
        en: [
          "Guests get WhatsApp offers only if they tick yes at the hotel's Desk. The box starts unticked.",
          "Contacts that come from OTAs (MakeMyTrip, Booking.com, Agoda) are never used for messages.",
          "Reply STOP to any message and the messages stop.",
          "No name, phone number or booking detail goes on a public blockchain. The prototype keeps its consent proof on Seedha's server.",
          "You can ask for your consent record to be erased on the Delete my data page.",
        ],
        hi: [
          "Guest ko WhatsApp offer tabhi milte hain jab woh Desk par khud tick karke haan kehte hain. Box pehle se khaali hota hai.",
          "OTA (MakeMyTrip, Booking.com, Agoda) se aaye contact kabhi message ke liye use nahi hote.",
          "Kisi bhi message par STOP likhiye, message band ho jayenge.",
          "Public blockchain par naam, phone ya booking ki koi jaankari nahi jaati. Prototype mein consent proof Seedha ke server par hi rehta hai.",
          "Apna consent record mitaane ke liye Delete my data page par request bhejiye.",
        ],
      }}
    >
      <h2 className="section">1. Who we are</h2>
      <p>
        Seedha is a pre-launch product built by the Seedha team for the TBI GEU AI-Tourism Hackathon. It helps
        small hotels see what each booking channel leaves them and invite past guests to book directly. Seedha
        is not yet a registered company, and this policy does not claim one. All hotel and guest data in the
        current prototype is fictional sample data.
      </p>

      <h2 className="section">2. Who is responsible for what</h2>
      <ul>
        <li>
          <b>Guest data.</b> The hotel decides why and how its guests&apos; data is used, so the hotel is the
          Data Fiduciary. Seedha acts as the hotel&apos;s Data Processor and uses guest data only on the
          hotel&apos;s instructions.
        </li>
        <li>
          <b>Hotel owner account data.</b> Seedha is the Data Fiduciary for the accounts that owners and their
          staff use to sign in.
        </li>
      </ul>
      <p>
        This policy is written with the DPDP Act 2023 and the DPDP Rules 2025 in mind. We do not claim full
        compliance yet. A lawyer will review it before launch.
      </p>

      <h2 className="section">3. What we collect, why, and on what basis</h2>
      <ul>
        <li>
          <b>Owner account.</b> The owner&apos;s name and WhatsApp number, the hotel&apos;s name, town and
          rooms, and setup answers. Used to sign in with a one-time code and to run the hotel&apos;s account.
          Basis: our contract with the hotel.
        </li>
        <li>
          <b>Business details.</b> If the owner adds them in Settings, an email, business name, GSTIN, PAN,
          address and PIN code. Used for invoices and account notices. Basis: our contract with the hotel.
        </li>
        <li>
          <b>Staff the owner invites.</b> Each person&apos;s name, role and mobile number. Used to let them
          sign in to the hotel&apos;s account. Basis: our contract with the hotel.
        </li>
        <li>
          <b>Uploaded statements and registers.</b> Booking references, stay dates, guest names and cities,
          and amounts. Used to work out what each channel leaves the hotel and to show the owner guests who
          came back through an OTA. Basis: processing on the hotel&apos;s behalf, under its contract with us.
        </li>
        <li>
          <b>Desk consent records.</b> The WhatsApp number the guest types, the time, the wording version they
          agreed to, a random salt and a fingerprint. Used to send that guest offers the owner approves.
          Basis: the guest&apos;s consent, given by ticking an unticked box.
        </li>
        <li>
          <b>Messages.</b> Drafts the owner approves, and the text of messages the guest and the hotel send
          each other in the guest inbox, including STOP. Used to deliver offers, keep the conversation and
          honour opt-outs. Basis: the guest&apos;s consent.
        </li>
        <li>
          <b>Direct bookings through Seedha Link.</b> Dates, room, amount, perk code and a payment reference.
          Used to confirm the booking and count the commission the hotel saved. Basis: the booking the guest
          makes with the hotel.
        </li>
      </ul>

      <h2 className="section">4. What we never do</h2>
      <ul>
        <li>
          We never message guests found through OTA statements. Matching a guest in OTA data never makes them
          messageable.
        </li>
        <li>We never send a message without the owner approving it, and never after a guest replies STOP.</li>
        <li>We never sell personal data or use it for advertising.</li>
        <li>
          We never put personal data on a public blockchain. At most a single fingerprint of the night&apos;s
          salted consent fingerprints would go there, and in the prototype it stays on Seedha&apos;s server.
        </li>
        <li>We never scrape OTA websites.</li>
      </ul>

      <h2 className="section">5. Consent proof</h2>
      <p>
        Each consent becomes a fingerprint: a SHA-256 hash of a random salt and the consent facts. Each night
        the fingerprints are combined into one Merkle root. Today the root is stored by Seedha and is not yet
        on a public chain. Writing it to a public test network is planned. A fingerprint cannot be turned back
        into a person, and after erasure the salt is deleted so nobody, including Seedha, can link it to
        anyone.
      </p>

      <h2 className="section">6. How long we keep it</h2>
      <p>The periods below are proposed. Final periods will be set before launch.</p>
      <ul>
        <li>
          Consent records: proposed, while the consent is active. After STOP no more messages are sent; the
          withdrawn record stays so the number is not messaged again, until the guest asks for erasure.
          Erasure removes the number and the salt at once.
        </li>
        <li>
          Statements and bookings: proposed, while the hotel&apos;s account is active and for 90 days after it
          closes, unless the hotel must keep them longer for tax law.
        </li>
        <li>Owner accounts: proposed, deleted 90 days after the account is closed.</li>
        <li>Fingerprints in a consent proof: kept, because they identify no one.</li>
      </ul>

      <h2 className="section">7. Your rights and how to use them</h2>
      <ul>
        <li>
          <b>Withdraw consent.</b> Reply STOP to any message. It is as easy as giving consent.
        </li>
        <li>
          <b>Erasure.</b> Use <Link href="/data-deletion">Delete my data</Link> with your booking reference
          and WhatsApp number, or ask the hotel.
        </li>
        <li>
          <b>Access and correction.</b> Ask the hotel, or write to the Grievance Officer below. We will help
          the hotel answer.
        </li>
        <li>
          <b>Grievance.</b> Write to the Grievance Officer below. If you are not satisfied with the answer,
          you may complain to the Data Protection Board of India.
        </li>
        <li>
          <b>Nominate a person.</b> You may nominate someone to use these rights for you if you die or cannot
          act. Tell the Grievance Officer who it is.
        </li>
      </ul>

      <h2 className="section" id="grievance">
        8. Grievance Officer
      </h2>
      <p>
        The Grievance Officer is a role on the Seedha team, not a named person.{" "}
        <ContactEmail kind="privacy" lead="Write to the Grievance Officer at" /> We will answer within the
        time the DPDP Rules set.
      </p>

      <h2 className="section">9. Who processes data for us</h2>
      <p>Seedha will use service providers in these categories only, and only for this work.</p>
      <ul>
        <li>Hosting, for Seedha&apos;s servers and database.</li>
        <li>WhatsApp Business messaging, to deliver messages the owner approved.</li>
        <li>A payment gateway, for direct-booking payments. Payments are in simulated test mode today.</li>
        <li>
          An AI service, sent only what each task needs. Statements in layouts Seedha does not recognise, to
          read their rows. Two guest names and their cities, when Seedha cannot tell on its own whether they
          are the same person. A guest&apos;s first name and latest inbox message, to suggest a reply the
          owner edits before sending. A guest&apos;s first name with the hotel, perk and booking link, to word
          win-back drafts. Every amount is checked by Seedha&apos;s own code.
        </li>
      </ul>
      <p>
        Some of these providers may process data outside India. Before launch we will name each provider, say
        where it processes data, and follow any transfer limits the DPDP Rules set.
      </p>

      <h2 className="section">10. How we protect it</h2>
      <ul>
        <li>
          Built: owner sign-in with a one-time code on WhatsApp, with limits on tries. The code sender is
          simulated in the prototype.
        </li>
        <li>Built: consent links that work once and expire in 10 minutes, stored only as hashes.</li>
        <li>Built: Desk device keys stored only as hashes, and rate limits on public pages.</li>
        <li>Built: guest numbers are never written to logs, and secrets are kept out of the code.</li>
        <li>Planned: encryption at rest for the database.</li>
        <li>Planned: two-step sign-in for owners.</li>
      </ul>
      <p>
        We hold no security certification and do not claim one. See our{" "}
        <Link href="/security">security page</Link>.
      </p>

      <h2 className="section">11. Where data is stored</h2>
      <p>Planned: stored in India before launch.</p>

      <h2 className="section">12. If something goes wrong</h2>
      <p>
        If personal data is exposed, we will tell the affected hotels without delay. With the hotel, we will
        inform the Data Protection Board of India and the people affected as the DPDP Rules require: what
        happened, what it means for them and what they can do.
      </p>

      <h2 className="section">13. Children</h2>
      <p>
        Seedha is not intended for anyone under 18. The Desk consent is for adult guests, and we do not
        knowingly collect a child&apos;s data for messages.
      </p>

      <h2 className="section">14. Cookies</h2>
      <p>
        We use strictly necessary cookies only. No analytics or advertising cookies. See the{" "}
        <Link href="/cookies">cookie policy</Link>.
      </p>

      <h2 className="section">15. Changes to this policy</h2>
      <p>
        When this policy changes, the date at the top changes too. Material changes will be announced to
        owners in the app before they apply.
      </p>
    </LegalPage>
  );
}
