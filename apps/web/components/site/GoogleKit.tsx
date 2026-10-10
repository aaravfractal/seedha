import type { OwnerSite } from "@/lib/types-site";
import o from "./owner.module.css";

const PHOTOS = [
  "linear-gradient(160deg,#6f9a8e,#3b5a50)",
  "linear-gradient(160deg,#a89a86,#7e6e5c)",
  "linear-gradient(160deg,#dcc08e,#b5834a)",
  "linear-gradient(160deg,#9a8f84,#6e645a)",
  "linear-gradient(160deg,#bcd0e0,#8fa8bc)",
];
const STEPS = [
  "Open your Google Business Profile on your phone.",
  "Paste the description.",
  "Upload the 5 photos in this order.",
  "Add your website link.",
];

/** Everything to paste into Google Business Profile. Seedha never signs in to Google. */
export function GoogleKit({
  site,
  onCopy,
}: {
  site: OwnerSite;
  onCopy: (text: string, note: string) => void;
}) {
  const { google } = site;
  return (
    <div className={o.stack}>
      <div>
        <h2 className={o.h2}>Get found on Google.</h2>
        <p className={o.sub}>
          Everything ready to paste into your Google Business Profile. Seedha never asks for your Google
          password.
        </p>
      </div>
      <div className={o.grid2}>
        <div className={o.stack} style={{ gap: 20 }}>
          <section className={o.card} aria-labelledby="kit-en">
            <div className={o.kitTop}>
              <h3 id="kit-en" className={o.cardTitle}>
                English description
              </h3>
              <button
                type="button"
                className="btn ghost small"
                onClick={() => onCopy(google.description.en, "English description copied")}
              >
                Copy description
              </button>
            </div>
            <p style={{ margin: 0 }}>{google.description.en}</p>
          </section>
          <section className={o.card} aria-labelledby="kit-hi">
            <div className={o.kitTop}>
              <h3 id="kit-hi" className={`${o.cardTitle} ${o.deva}`} lang="hi">
                हिंदी विवरण
              </h3>
              <button
                type="button"
                className="btn ghost small"
                aria-label="Copy Hindi description"
                onClick={() => onCopy(google.description.hi, "Hindi description copied")}
              >
                Copy description
              </button>
            </div>
            <p className={o.deva} lang="hi" style={{ margin: 0 }}>
              {google.description.hi}
            </p>
          </section>
          <section className={o.card} aria-labelledby="kit-cat">
            <h3 id="kit-cat" className={o.cardTitle}>
              Suggested categories
            </h3>
            <ul className={o.chips}>
              {google.categories.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p style={{ margin: 0 }}>
              Website link: <b style={{ color: "var(--accent)" }}>{site.address}</b>{" "}
              <span className={o.muted}>(sample address)</span>
            </p>
          </section>
        </div>
        <div className={o.stack} style={{ gap: 20 }}>
          <section className={o.card} aria-labelledby="kit-photos">
            <div className={o.kitTop}>
              <h3 id="kit-photos" className={o.cardTitle}>
                Best 5 photos, in this order
              </h3>
              <button type="button" className="btn small" disabled aria-describedby="kit-photos-note">
                Download photos
              </button>
            </div>
            <ol className={o.photos}>
              {google.photos.map((label, i) => (
                <li key={label}>
                  <i style={{ background: PHOTOS[i % PHOTOS.length] }} aria-hidden="true" />
                  <span>
                    {i + 1}. {label}
                  </span>
                </li>
              ))}
            </ol>
            <p id="kit-photos-note" className={o.muted} style={{ margin: "14px 0 0", fontSize: 14 }}>
              Sample photos. Your own photos from the WhatsApp setup download here.
            </p>
          </section>
          <section className={o.card} aria-labelledby="kit-steps">
            <h3 id="kit-steps" className={o.cardTitle}>
              Four steps
            </h3>
            <ol className={o.steps}>
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className={o.muted} style={{ margin: "14px 0 0", fontSize: 14 }}>
              Guidance only. You stay signed in to your own Google account.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
