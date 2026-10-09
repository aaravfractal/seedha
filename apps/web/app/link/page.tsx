"use client";

import { LinkBooking } from "@/components/LinkBooking";
import { useToast } from "@/components/Toast";

export default function LinkDemoPage() {
  const toast = useToast();
  return (
    <section className="view two">
      <div>
        <h2 className="title">Seedha Link.</h2>
        <p className="sub">
          The page a returning guest opens from the WhatsApp message. Dates, room, perk, UPI. Booked directly
          with the hotel.
        </p>
        <p className="sub">Approve a message in Owner, or type a code from a checkout slip.</p>
      </div>
      <div className="phone" style={{ position: "relative" }}>
        <div className="notch" />
        <div className="in">
          <LinkBooking
            initialCode=""
            onBooked={(r) =>
              toast(
                r.perk_applied
                  ? "Booked with a perk code. See Savings for the commission avoided."
                  : "Booked directly. No perk code, so no saving is claimed.",
              )
            }
          />
        </div>
      </div>
    </section>
  );
}
