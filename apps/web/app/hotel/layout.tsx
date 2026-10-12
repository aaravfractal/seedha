import { Suspense } from "react";

/** The old hotel address. The proxy 308s /hotel/<slug> to /h/<slug>; the page is a fallback. */
export default function OldHotelLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
