import { ratingHref } from "@/lib/hotelSiteV2";
import type { BookResult } from "@/lib/types";

/** The booking response, with the optional one-time rating link the API may add. */
export type BookedWithRating = BookResult & { rating_url?: string | null };

/**
 * After a direct booking: the guest's own one-time rating link, shown as a
 * plain link to open after checkout. Nothing is sent; nothing shows when the
 * API gave no link.
 */
export function RatingNote({ result }: { result: BookedWithRating | null }) {
  const href = ratingHref(result?.rating_url);
  if (!href) return null;
  return (
    <p
      className="rating-note"
      data-testid="rating-note"
      style={{ margin: "16px auto 0", maxWidth: 560, padding: "0 16px" }}
    >
      Rate your stay after checkout:{" "}
      <a href={href} style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontWeight: 600 }}>
        {href}
      </a>
    </p>
  );
}
