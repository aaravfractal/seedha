"use client";

import "./globals.css";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main className="page" style={{ textAlign: "center", padding: "80px 20px" }} role="alert">
          <p className="tag">500</p>
          <h1 className="display">Seedha could not load.</h1>
          <p className="lede" style={{ margin: "0 auto 24px" }}>
            Please try again in a moment.
          </p>
          <button type="button" className="btn" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
