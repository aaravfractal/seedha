import { ImageResponse } from "next/og";
import { publicSlug } from "@/lib/siteHost";
import { SAMPLE_SLUG, tryLoadPublicSite } from "./data";

// Each hotel's own preview image for WhatsApp and search: the hotel's name,
// place and tagline on Pine. Text only (no guest data, no prices), from the
// same cached site payload as the page, so it refreshes when the page does.
// next/og's bundled font: Devanagari is not drawn, so the English name is used.
// A slug that cannot be a hotel, or one the API does not know, is a plain 404
// before anything is drawn or cached (the proxy answers those first; this is
// the second line, security review R1-1).
export const alt = "The hotel's name and place, with a link to book directly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return [{ slug: SAMPLE_SLUG }];
}

const PINE = "#1F4D3A";
const CREAM = "#F5F1E8";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = publicSlug((await params).slug);
  if (slug === null) return new Response(null, { status: 404 });
  const { status, site } = await tryLoadPublicSite(slug);
  if (status === 404) return new Response(null, { status: 404 });
  const name = site?.hotel ?? "Hotel";
  const place = site?.location.en ?? "";
  const tagline = site?.tagline.en || "Book directly with the hotel.";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: PINE,
        color: CREAM,
      }}
    >
      <div
        style={{ display: "flex", fontSize: 30, letterSpacing: 4, textTransform: "uppercase", opacity: 0.85 }}
      >
        {place}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 600, lineHeight: 1.05, maxWidth: 1040 }}>
          {name}
        </div>
        <div style={{ display: "flex", fontSize: 36, maxWidth: 1000, opacity: 0.92 }}>{tagline}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30 }}>
        <div style={{ width: 48, height: 6, borderRadius: 3, background: CREAM }} />
        <div style={{ display: "flex" }}>
          {site?.sample ? "Book directly · Sample hotel" : "Book directly"}
        </div>
      </div>
    </div>,
    { ...size },
  );
}
