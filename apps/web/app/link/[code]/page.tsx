"use client";

import { use } from "react";
import { LinkBooking } from "@/components/LinkBooking";

export default function GuestLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return (
    <section className="view guest-shell">
      <LinkBooking initialCode={decodeURIComponent(code)} />
    </section>
  );
}
