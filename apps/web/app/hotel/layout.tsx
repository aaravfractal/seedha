import type { Metadata } from "next";
import { worldBFonts } from "@/lib/fonts-worldb";

export const metadata: Metadata = {
  title: "Hotel site · Made with Seedha",
  description: "The hotel's own website with direct booking.",
};

/** World B frame: the hotel's own page, no Seedha app chrome. */
export default function HotelLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={worldBFonts} style={{ outline: "none" }}>
      {children}
    </main>
  );
}
