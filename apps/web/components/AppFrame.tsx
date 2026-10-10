import { Suspense } from "react";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * The app's header, main landmark and footer, used by the (app) and (owner)
 * route-group layouts. The public website and World B pages have their own
 * frames. Landmarks stay outside Suspense so streaming never leaves a second,
 * hidden <main id="main"> behind (D-084).
 */
export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<header className="site-header" style={{ height: 61 }} />}>
        <TopNav />
      </Suspense>
      <main id="main" className="page" tabIndex={-1}>
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
