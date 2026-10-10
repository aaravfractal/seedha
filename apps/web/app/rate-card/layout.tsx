import type { Metadata } from "next";
import { worldBFonts } from "@/lib/fonts-worldb";

export const metadata: Metadata = { title: "Rate card · Made with Seedha" };

/** World B frame for the printable rate card (owner only, see proxy.ts). */
export default function RateCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={worldBFonts} style={{ outline: "none" }}>
      {children}
    </main>
  );
}
