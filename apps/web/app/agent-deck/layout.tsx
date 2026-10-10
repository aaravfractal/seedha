import { Suspense } from "react";
import type { Metadata } from "next";
import { worldBFonts } from "@/lib/fonts-worldb";

export const metadata: Metadata = { title: "Agent deck · Made with Seedha" };

/** World B frame for the agent deck (owner only, see proxy.ts). */
export default function AgentDeckLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={worldBFonts} style={{ outline: "none" }}>
      {/* The landmark stays outside Suspense (D-084); the page suspends inside it. */}
      <Suspense fallback={null}>{children}</Suspense>
    </main>
  );
}
