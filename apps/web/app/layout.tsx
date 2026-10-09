import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import { TopNav } from "@/components/TopNav";
import { SiteFooter } from "@/components/SiteFooter";
import { ToastProvider } from "@/components/Toast";
import { THEME_BOOT_SCRIPT } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Seedha · Know what you really keep",
  description:
    "Seedha reads your OTA statements, shows what each channel actually leaves you, and stops you paying commission twice for guests you already won.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFBFD" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ToastProvider>
          <Suspense fallback={<header className="site-header" style={{ height: 61 }} />}>
            <TopNav />
          </Suspense>
          <main id="main" className="page" tabIndex={-1}>
            <Suspense fallback={null}>{children}</Suspense>
          </main>
          <SiteFooter />
        </ToastProvider>
      </body>
    </html>
  );
}
