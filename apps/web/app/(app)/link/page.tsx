"use client";

import { LinkBooking } from "@/components/LinkBooking";
import { usePrefill } from "@/components/guest/usePrefill";
import { useToast } from "@/components/Toast";
import { useState } from "react";
import { RatingNote } from "./[code]/RatingNote";
import type { BookedWithRating } from "./[code]/RatingNote";
import styles from "./link.module.css";

export default function LinkDemoPage() {
  const toast = useToast();
  const prefill = usePrefill();
  const [booked, setBooked] = useState<BookedWithRating | null>(null);
  return (
    <section className={`view ${styles.layout}`}>
      <div>
        <h1 className={styles.h1}>Seedha Link.</h1>
        <p className={styles.lede}>
          The page a returning guest opens from the WhatsApp message. Dates, room, perk, UPI. Booked directly
          with the hotel.
        </p>
        <p className={styles.lede}>Approve a message in Owner, or type a code from a checkout slip.</p>
      </div>
      <div className={styles.phone} role="region" aria-label="Guest phone">
        <div className={styles.island} aria-hidden="true" />
        <div className={styles.screen}>
          <LinkBooking
            initialCode={prefill.code ?? ""}
            prefill={prefill}
            contained
            onBooked={(r) => {
              setBooked(r);
              toast(
                r.perk_applied
                  ? "Booked with a perk code. See Savings for the commission avoided."
                  : "Booked directly. No perk code, so no saving is claimed.",
              );
            }}
          />
          <RatingNote result={booked} />
        </div>
      </div>
    </section>
  );
}
