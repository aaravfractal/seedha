"use client";

// stub: replaced by B3 (slug picker, live preview link, Publish, then the
// address with Copy, Share on WhatsApp and QR download). Do not build on this.

/** Publish the owner's site under an address they pick. */
export default function PublishPanel({ hotelName }: { hotelName: string }) {
  return (
    <section aria-label="Publish">
      <p>Publishing for {hotelName} is being added.</p>
    </section>
  );
}
