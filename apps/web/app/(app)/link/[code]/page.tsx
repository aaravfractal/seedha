"use client";

import { use, useState } from "react";
import { LinkBooking } from "@/components/LinkBooking";
import { usePrefill } from "@/components/guest/usePrefill";
import { cleanCode } from "@/lib/linkPrefill";
import { RatingNote } from "./RatingNote";
import type { BookedWithRating } from "./RatingNote";

function fromPath(raw: string): string {
  try {
    return cleanCode(decodeURIComponent(raw)) ?? "";
  } catch {
    return "";
  }
}

export default function GuestLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const prefill = usePrefill();
  const [booked, setBooked] = useState<BookedWithRating | null>(null);
  return (
    <section className="view">
      <LinkBooking initialCode={fromPath(code)} prefill={prefill} onBooked={setBooked} />
      <RatingNote result={booked} />
    </section>
  );
}
