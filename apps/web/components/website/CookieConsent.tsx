"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDialogFocus } from "@/components/useDialogFocus";
import { COOKIE_CHOICE, readCookieChoice } from "@/lib/website";
import type { CookieChoice } from "@/lib/website";
import styles from "./site.module.css";

const OPEN_EVENT = "seedha:cookie-settings";

/** Open the cookie settings dialog from anywhere on the website (footer link). */
export function openCookieSettings(): void {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

function store(choice: CookieChoice): void {
  document.cookie = `${COOKIE_CHOICE}=${choice}; Path=/; Max-Age=15552000; SameSite=Lax`;
}

/**
 * Cookie banner and settings. Seedha sets no analytics or advertising cookies
 * (D-070), so every choice loads the same thing; the banner says so and only
 * stores the answer in a first-party cookie.
 */
export function CookieConsent() {
  const [banner, setBanner] = useState(false);
  const [dialog, setDialog] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(ref, dialog, () => setDialog(false));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a cookie after mount
    setBanner(readCookieChoice(document.cookie) === null);
    const open = () => setDialog(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  function choose(choice: CookieChoice) {
    store(choice);
    setBanner(false);
    setDialog(false);
  }

  return (
    <>
      {banner ? (
        // Hidden, not unmounted, while the dialog is open, so focus can return
        // to "Choose" when the dialog closes (accessibility review A11).
        <section className={styles.cookieBanner} aria-labelledby="cookie-title" hidden={dialog}>
          <h2 id="cookie-title">Cookies</h2>
          <p>
            Seedha uses only necessary cookies: to keep you signed in, to remember light or dark, and to
            remember this answer. No analytics or advertising cookies, whatever you choose.{" "}
            <Link href="/cookies">Cookie policy</Link>
          </p>
          <div className={styles.cookieBtns}>
            <button type="button" onClick={() => choose("all")}>
              Accept all
            </button>
            <button type="button" onClick={() => choose("necessary")}>
              Necessary only
            </button>
            <button type="button" onClick={() => setDialog(true)}>
              Choose
            </button>
          </div>
        </section>
      ) : null}
      {dialog ? (
        <div className={styles.backdrop} onClick={() => setDialog(false)}>
          <div
            ref={ref}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="cookie-dialog-title">Cookie settings</h2>
            <p>Your choice is kept in one small first-party cookie, seedha_cookies, for six months.</p>
            <div className={styles.switchRow}>
              <div>
                <h3>Necessary</h3>
                <p>Sign-in session and your light or dark choice. Always on.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked="true"
                aria-label="Necessary cookies, always on"
                className={styles.switch}
                disabled
              />
            </div>
            <div className={styles.switchRow}>
              <div>
                <h3>Analytics</h3>
                <p>No analytics in this version. Nothing to switch on.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked="false"
                aria-label="Analytics cookies, not used in this version"
                className={styles.switch}
                disabled
              />
            </div>
            <div className={styles.dialogBtns}>
              <button type="button" className={styles.pillOutline} onClick={() => setDialog(false)}>
                Cancel
              </button>
              <button type="button" className={styles.pill} onClick={() => choose("necessary")}>
                Save choice
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
