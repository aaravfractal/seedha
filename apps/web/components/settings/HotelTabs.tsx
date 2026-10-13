"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { hostName, isLoopbackHost, showResetButton } from "@/lib/requestOrigin";
import { bpsPct } from "@/lib/settingsRules";
import type { Health } from "@/lib/types";
import type { ContractsData, SettingsData } from "@/lib/types-settings";
import { ErrorState, Loading } from "@/components/States";
import { useShell } from "@/components/shell/ShellData";
import { useToast } from "@/components/Toast";
import { CalcNote, Chip, SampleChip } from "@/components/owner/ui";
import { Modal } from "./Modal";
import s from "./settings.module.css";

const CONNECTIONS: [keyof Health, string][] = [
  ["llm", "Claude (statement reading, wording)"],
  ["whatsapp", "WhatsApp messages"],
  ["payments", "UPI payments"],
  ["proof_chain", "Proof on Polygon Amoy testnet"],
];

const noSubscribe = () => () => {};
/** True when this page is open on the machine running Seedha (not a phone or a tunnel visitor). */
function useOnThisMachine(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => isLoopbackHost(hostName(window.location.host)),
    () => false,
  );
}

/** Hotel: property facts (read-only for the sample hotel), connections, demo reset. */
export function HotelTab({ data, beforeReset }: { data: SettingsData; beforeReset?: ReactNode }) {
  const health = useApi<Health>("health");
  const toast = useToast();
  // Reset changes the 8-step loop: reload the shared Overview so no step
  // from before the reset stays ticked in the header, sidebar or Overview.
  const shell = useShell(usePathname());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const h = data.hotel;
  // Reset shows on the laptop running Seedha (make demo-live refuses it through
  // the tunnel too) and, with SEEDHA_HOSTED=1, on the hosted site.
  const onThisMachine = useOnThisMachine();
  const mode = useApi<{ hosted: boolean }>("auth/mode");
  const canReset = showResetButton({
    sample: h.is_sample,
    onThisMachine,
    hosted: mode.data?.hosted === true,
  });

  async function reset() {
    setBusy(true);
    try {
      const result = await postJson<{ ok: boolean; demo_date: string }>("demo/reset");
      toast(`Sample hotel reset. Desk date ${result.demo_date}.`);
      shell.reload();
      setConfirming(false);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {h.is_sample ? (
        <p className={s.note}>
          <SampleChip />
          <span>Sample hotel: these details are fixed so its locked numbers never change.</span>
        </p>
      ) : null}
      <div className={s.list}>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Property</span>
            <span className={s.rowHint}>{`${h.name}, ${h.address}`}</span>
          </span>
          <span className={s.rowValue}>{h.town}</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Rooms</span>
            <span className={s.rowHint}>Used for occupancy and RevPAR</span>
          </span>
          <span className={s.rowValue}>{h.rooms}</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Owner WhatsApp</span>
            <span className={s.rowHint}>8 AM line and 9 PM close</span>
          </span>
          <span className={`${s.rowValue} ${data.security.mobile ? "" : s.plain}`}>
            {data.security.mobile ?? "Not set for the sample hotel"}
          </span>
        </div>
      </div>

      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>Connections</h2>
      </div>
      <div className={s.list}>
        {CONNECTIONS.map(([key, label]) => (
          <div className={s.row} key={key}>
            <span className={s.rowLabel}>{label}</span>
            {health.error ? (
              <span className={s.small}>Not known</span>
            ) : !health.data ? (
              <span className={s.small}>Checking</span>
            ) : (
              <Chip tone={health.data[key] === "live" ? "ok" : "plain"}>
                {health.data[key] === "live" ? "Live" : "Simulated"}
              </Chip>
            )}
          </div>
        ))}
      </div>
      <p className={s.help} style={{ marginTop: 8 }}>
        Add keys in .env (or the host&rsquo;s variables) to switch a connection from simulated to live.
      </p>

      {beforeReset}
      {canReset ? (
        <>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>Reset the sample hotel</h2>
          </div>
          <div className={s.list} style={{ padding: 22 }}>
            <p className={s.sheetBody}>
              Clears uploads, consents, messages, bookings from Seedha Link and proofs, and reloads Hotel
              Deodar View as it was before the demo.
            </p>
            <div className={s.sheetActions}>
              <button type="button" className="btn ghost" onClick={() => setConfirming(true)}>
                Reset demo data
              </button>
            </div>
          </div>
        </>
      ) : null}
      {confirming ? (
        <Modal title="Reset the sample hotel?" alert onClose={() => setConfirming(false)}>
          <p className={s.sheetBody}>Everything done in the demo is cleared. Owner accounts stay.</p>
          <div className={s.sheetActions}>
            <button type="button" className="btn" disabled={busy} onClick={() => void reset()}>
              {busy ? "Resetting" : "Yes, reset everything"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
              Keep my data
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/** Plan and billing: the current plan and where to change it. */
export function PlanTab() {
  const base = PLANS.find((p) => p.name === "Base") ?? PLANS[0]!;
  return (
    <div className={s.list}>
      <div className={s.row}>
        <span className={s.rowText}>
          <span className={s.rowLabel}>Seedha {base.name}</span>
          <span className={s.rowHint}>{inr(base.monthly * 100)} a month. Prices are early estimates.</span>
        </span>
        <Link className={s.textBtn} href="/billing">
          Open Billing
        </Link>
      </div>
      <div className={s.row}>
        <span className={s.rowText}>
          <span className={s.rowLabel}>Change plan</span>
          <span className={s.rowHint}>Base, Pro and Max, monthly or yearly.</span>
        </span>
        <Link className={s.textBtn} href="/plans">
          Compare plans
        </Link>
      </div>
    </div>
  );
}

const D_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayMonth(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${D_MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** Contracts: contracted commission per channel versus what statements show. */
export function ContractsTab() {
  const res = useApi<ContractsData>("settings/contracts");
  if (res.error && !res.data)
    return <ErrorState message={res.error.message} code={res.error.code} onRetry={res.reload} />;
  if (!res.data) return <Loading rows={3} label="Loading contracts" />;
  const rows = res.data.channels;
  const anyStays = rows.some((r) => r.stays > 0);
  return (
    <>
      <ul className={s.list} aria-label="Contracted commission and the rate in your statements">
        {rows.map((r) => {
          const free = !r.contracted_bps;
          const over =
            r.contracted_bps !== null && r.effective_bps !== null && r.effective_bps > r.contracted_bps + 5;
          return (
            <li className={`${s.row} ${s.stackPhone}`} key={r.key}>
              <span className={s.rowText}>
                <span className={s.rowLabel}>{r.name}</span>
                <span className={s.rowHint}>
                  {r.stays} stay{r.stays === 1 ? "" : "s"} in statements
                </span>
              </span>
              <span className={s.rateCell}>
                {free ? (
                  <span className={s.small}>
                    {r.effective_bps ? `No contract, ${bpsPct(r.effective_bps)} charged` : "No commission"}
                  </span>
                ) : (
                  <span className={s.rates}>
                    <span>
                      <span className={s.small}>Contract </span>
                      <b>{bpsPct(r.contracted_bps ?? 0)}</b>
                    </span>
                    <span>
                      <span className={s.small}>Statements </span>
                      <b>{r.effective_bps === null ? "None" : bpsPct(r.effective_bps)}</b>
                    </span>
                  </span>
                )}
                {free || r.effective_bps === null ? null : over ? (
                  <Chip tone="bad">Higher than contract</Chip>
                ) : (
                  <Chip tone="ok">Matches</Chip>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {anyStays ? (
        <CalcNote>
          Commission divided by list price after discount, on counted stays from {dayMonth(res.data.start)} to{" "}
          {dayMonth(res.data.end)}. Flagged rows stay out until you review them.
        </CalcNote>
      ) : (
        <p className={s.help} style={{ marginTop: 10 }}>
          Upload your statements to compare your contracts with what each channel charged.
        </p>
      )}
    </>
  );
}
