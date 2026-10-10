"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { hasOwnChrome } from "@/lib/chrome";

/** App header, main landmark and footer, except on pages with their own chrome (lib/chrome.ts). */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (hasOwnChrome(pathname)) return <>{children}</>;
  return (
    <>
      <Suspense fallback={<header className="site-header" style={{ height: 61 }} />}>
        <TopNav />
      </Suspense>
      <main id="main" className="page" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
