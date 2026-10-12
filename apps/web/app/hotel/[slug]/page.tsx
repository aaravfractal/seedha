import { permanentRedirect } from "next/navigation";

/** /hotel/<slug> moved to /h/<slug> (the proxy redirects first; this covers anything it misses). */
export default async function OldHotelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/h/${encodeURIComponent(slug)}`);
}
