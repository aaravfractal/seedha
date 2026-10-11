import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/** The Desk kiosk: full screen, no site header or footer, one main landmark. */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1}>
      {children}
    </main>
  );
}
