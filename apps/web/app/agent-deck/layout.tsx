import type { Metadata } from "next";
import { worldBFonts } from "@/lib/fonts-worldb";

export const metadata: Metadata = { title: "Agent deck · Made with Seedha" };

/** World B frame for the agent deck (owner only, see proxy.ts). */
export default function AgentDeckLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className={worldBFonts} style={{ outline: "none" }}>
      {children}
    </main>
  );
}
