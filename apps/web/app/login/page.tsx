"use client";

import { useState } from "react";
import type { FormEvent } from "react";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/home";
}

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        const next = safeNext(new URLSearchParams(window.location.search).get("next"));
        window.location.assign(next);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not log in");
    } catch {
      setError("No connection. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="view" style={{ maxWidth: 440, margin: "40px auto" }}>
      <h2 className="title">Owner login</h2>
      <p className="sub">Enter the passcode for your hotel.</p>
      <form className="card" onSubmit={submit} noValidate>
        <label className="fl" htmlFor="passcode">
          Passcode
        </label>
        <input
          id="passcode"
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "login-error" : "login-hint"}
        />
        <p id="login-hint" className="calc">
          Sample hotel: the passcode is OWNER_PASSCODE in your .env (deodar-demo in .env.example).
        </p>
        {error ? (
          <p id="login-error" role="alert" style={{ color: "var(--loss)", fontSize: 15, margin: "8px 0 0" }}>
            {error}
          </p>
        ) : null}
        <button
          className="btn"
          type="submit"
          style={{ width: "100%", marginTop: 16 }}
          disabled={busy || !passcode}
        >
          {busy ? "Checking" : "Log in"}
        </button>
      </form>
    </section>
  );
}
