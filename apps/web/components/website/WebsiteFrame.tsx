import { Suspense } from "react";
import type { ReactNode } from "react";
import { CookieConsent } from "./CookieConsent";
import { SITE_ROOT_ID, SITE_THEME_SCRIPT } from "./SiteTheme";
import { WebsiteFooter } from "./WebsiteFooter";
import { WebsiteHeader } from "./WebsiteHeader";
import styles from "./site.module.css";

/** Website chrome: theme scope, header, main landmark for the skip link, footer, cookie banner. */
export function WebsiteFrame({ children }: { children: ReactNode }) {
  return (
    <div id={SITE_ROOT_ID} className={styles.site} data-site-theme="dark" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: SITE_THEME_SCRIPT }} />
      <WebsiteHeader />
      <main id="main" className={styles.main} tabIndex={-1}>
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <WebsiteFooter />
      <CookieConsent />
    </div>
  );
}
