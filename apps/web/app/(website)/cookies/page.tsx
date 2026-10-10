import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookie policy · Seedha" };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie policy" lede="Seedha uses three small cookies, all strictly necessary.">
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
        <div className="item">
          <div>
            <b>seedha_cookies</b>
            <div className="meta">
              Remembers your answer to the cookie banner on the Seedha website, so it is not shown again.
              Expires after six months. Set only when you answer the banner.
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

      <h2 className="section">About the cookie banner</h2>
      <p>
        The website shows a short banner so you can see this for yourself. Whatever you choose, Accept all,
        Necessary only or your own settings, the same necessary cookies are used and nothing else loads. There
        is no analytics or advertising cookie to switch on. Open Cookie settings in the website footer to see
        it again.
      </p>

      <h2 className="section">Removing them</h2>
      <p>
        You can delete these cookies in your browser settings at any time. Deleting seedha_owner logs you out;
        deleting seedha_theme returns the app to automatic and the website to dark; deleting seedha_cookies
        shows the banner again.
      </p>
    </LegalPage>
  );
}
