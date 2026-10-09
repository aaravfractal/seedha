import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookie policy · Seedha" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy" lede="Seedha uses two small cookies, both strictly necessary.">
      <h2 className="section">The cookies we use</h2>
      <div className="card">
        <div className="item">
          <div>
            <b>seedha_owner</b>
            <div className="meta">
              Keeps a hotel owner logged in. Signed, httpOnly, expires after 12 hours. Set only after an owner
              logs in.
            </div>
          </div>
          <span className="tag ok">Necessary</span>
        </div>
        <div className="item">
          <div>
            <b>seedha_theme</b>
            <div className="meta">
              Remembers whether you chose light or dark mode. Expires after a year. Set only if you change the
              theme.
            </div>
          </div>
          <span className="tag ok">Necessary</span>
        </div>
      </div>

      <h2 className="section">What we do not use</h2>
      <p>
        No analytics cookies, no advertising cookies, no tracking pixels and no third-party cookies. Guest
        pages (the consent page and Seedha Link) set no cookies at all unless you change the theme.
      </p>

      <h2 className="section">Why there is no cookie banner</h2>
      <p>
        Both cookies are strictly necessary for something you asked for: staying logged in, or keeping the
        theme you chose. Because we use no optional cookies, there is nothing to accept or reject, so we do
        not show a cookie banner.
      </p>

      <h2 className="section">Removing them</h2>
      <p>
        You can delete both cookies in your browser settings at any time. Deleting seedha_owner logs you out;
        deleting seedha_theme returns the theme to automatic.
      </p>
    </LegalPage>
  );
}
