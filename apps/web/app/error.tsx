"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="view" style={{ textAlign: "center", padding: "60px 0" }} role="alert">
      <p className="tag">500</p>
      <h1 className="display">Something went wrong on our side.</h1>
      <p className="lede" style={{ margin: "0 auto 24px" }}>
        Your data is safe. Try again, and if it keeps happening, tell us on the contact page.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={reset}>
          Try again
        </button>
        <Link className="btn ghost" href="/contact">
          Contact
        </Link>
      </div>
    </section>
  );
}
