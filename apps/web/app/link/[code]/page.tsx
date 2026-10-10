"use client";

import { use } from "react";
import { LinkBooking } from "@/components/LinkBooking";
import { usePrefill } from "@/components/guest/usePrefill";
import { cleanCode } from "@/lib/linkPrefill";

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
  return (
    <section className="view">
      <LinkBooking initialCode={fromPath(code)} prefill={prefill} />
    </section>
  );
}
