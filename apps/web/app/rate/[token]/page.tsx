import { Suspense } from "react";
import type { Metadata } from "next";
import { RateForm } from "./RateForm";

export const metadata: Metadata = {
  title: "Rate your stay · Seedha",
  description: "A one-time rating link for a guest who stayed.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * A verified guest's one-time rating page (from the Seedha Link confirmation
 * or the Desk checkout slip): 1 to 5 stars and an optional short comment,
 * sent once. Never indexed, never calls AI.
 */
export default function RatePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={null}>
      <Rate params={params} />
    </Suspense>
  );
}

/** The token is per guest, so the page reads it at request time, inside Suspense. */
async function Rate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RateForm token={token} />;
}
