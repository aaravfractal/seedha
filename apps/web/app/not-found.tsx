import type { Metadata } from "next";
import Link from "next/link";
import { WebsiteFrame } from "@/components/website/WebsiteFrame";
import styles from "@/components/website/site.module.css";

export const metadata: Metadata = { title: "Page not found · Seedha" };

/** 404 for any unknown address, in the website frame (the root layout has no chrome). */
export default function NotFound() {
  return (
    <WebsiteFrame>
      <section className={styles.notFound} aria-labelledby="nf-title">
        <div className={styles.glow} aria-hidden="true" />
        <div className={`${styles.container} ${styles.notFoundInner}`}>
          <p className={styles.notFoundCode}>404</p>
          <h1 id="nf-title" className={styles.h2}>
            This page is not here.
          </h1>
          <p className={styles.lede}>The link may be old, or the code may be mistyped.</p>
          <div className={styles.ctaRow}>
            <Link className={`${styles.pill} ${styles.pillLg}`} href="/">
              Go to Seedha
            </Link>
            <Link className={`${styles.pillOutline} ${styles.pillLg}`} href="/link">
              Book a stay
            </Link>
          </div>
        </div>
      </section>
    </WebsiteFrame>
  );
}
