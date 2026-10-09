"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { Health, PropertyInfo } from "@/lib/types";
import { useToast } from "@/components/Toast";

const LABELS: [keyof Health, string][] = [
  ["llm", "Claude (statement reading, wording)"],
  ["whatsapp", "WhatsApp messages"],
  ["payments", "UPI payments"],
  ["proof_chain", "Public proof chain"],
];

export default function SettingsPage() {
  const health = useApi<Health>("health");
  const property = useApi<PropertyInfo>("property");
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function reset() {
    setBusy(true);
    try {
      const result = await postJson<{ ok: boolean; demo_date: string }>("demo/reset");
      toast(`Sample hotel reset. Desk date ${result.demo_date}.`);
      setConfirming(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <>
      <h2 className="title">Settings.</h2>
      <p className="sub">{property.data ? `${property.data.name}, ${property.data.city}` : " "}</p>
      <div className="card">
        <h3 className="sub-title">Connections</h3>
        {LABELS.map(([key, label]) => (
          <div className="item" key={key}>
            <span>{label}</span>
            <span className={`tag ${health.data?.[key] === "live" ? "ok" : "sim"}`}>
              {health.data ? (health.data[key] === "live" ? "Live" : "Simulated") : "…"}
            </span>
          </div>
        ))}
        <p className="calc">Add keys in .env to switch a connection from simulated to live.</p>
      </div>
      {property.data?.is_sample ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="sub-title">Reset the sample hotel</h3>
          <p className="sub" style={{ margin: "6px 0 14px" }}>
            Clears uploads, consents, messages, bookings from Seedha Link and proofs, and reloads Hotel Deodar
            View as it was before the demo.
          </p>
          {confirming ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" disabled={busy} onClick={reset}>
                {busy ? "Resetting" : "Yes, reset everything"}
              </button>
              <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
                Keep my data
              </button>
            </div>
          ) : (
            <button type="button" className="btn ghost" onClick={() => setConfirming(true)}>
              Reset demo data
            </button>
          )}
        </div>
      ) : null}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="sub-title">Session</h3>
        <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={logout}>
          Log out
        </button>
      </div>
    </>
  );
}
