import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { ShellProvider } from "@/components/shell/ShellData";
import { THEME_BOOT_SCRIPT } from "@/components/ThemeToggle";
import { mukta } from "@/lib/fonts";

const DESCRIPTION =
  "Seedha reads your OTA statements, shows what each channel actually leaves you, and stops you paying commission twice for guests you already won.";

/** Absolute base for Open Graph URLs: the public web origin, read when the app is built. */
function siteOrigin(): URL {
  try {
    return new URL(process.env.WEB_ORIGIN || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  title: "Seedha · Know what you really keep",
  description: DESCRIPTION,
  applicationName: "Seedha",
  openGraph: {
    type: "website",
    siteName: "Seedha",
    locale: "en_IN",
    title: "Seedha · Know what you really keep",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
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
    <html lang="en" className={mukta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <ToastProvider>
          <ShellProvider>{children}</ShellProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
