"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import { count } from "@/lib/format";
import type { OwnerProof, ProofEntry } from "@/lib/types-owner";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { ProofDialog } from "@/components/ProofDialog";
import { useToast } from "@/components/Toast";
import { Chip, Screen, ui } from "@/components/owner/ui";
import { istStamp, proofStatus, shortHash } from "@/components/owner/proofStatus";
import p from "./proof.module.css";

const TITLE = "Consent proof.";
const SUB =
  "Every night at 9 PM, Seedha seals the day's Desk consents into one bundle. Anyone can later check a consent was given and not changed. No guest names or numbers leave Seedha.";

export default function ProofPage() {
  const proof = useApi<OwnerProof>("proof");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  async function bundle() {
    setBusy(true);
    try {
      const result = await postJson<OwnerProof>("proof/bundle");
      proof.setData(result);
      toast(`Tonight's bundle written. ${count(result.bundles[0]?.item_count ?? 0)} consents sealed.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not write the bundle");
    } finally {
      setBusy(false);
    }
  }

  if (proof.error) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <ErrorState message={proof.error.message} code={proof.error.code} onRetry={proof.reload} />
      </Screen>
    );
  }
  if (!proof.data) {
    return (
      <Screen title={TITLE} sub={SUB}>
        <Loading rows={3} label="Checking every sealed consent" />
      </Screen>
    );
  }
  const data = proof.data;
  const pending = data.entries.filter((e) => e.bundle_id === null);
  const byBundle = new Map<number, ProofEntry[]>();
  for (const e of data.entries) {
    if (e.bundle_id === null) continue;
    byBundle.set(e.bundle_id, [...(byBundle.get(e.bundle_id) ?? []), e]);
  }

  return (
    <Screen title={TITLE} sub={SUB}>
      <div className={`${ui.tiles} ${ui.quad}`}>
        <div className={ui.tile}>
          <b className={ui.value}>{count(data.sealed)}</b>
          <span className={ui.label}>consents sealed</span>
        </div>
        <div className={ui.tile}>
          <b className={ui.value}>{count(data.bundles.length)}</b>
          <span className={ui.label}>nightly bundles</span>
        </div>
        <div className={ui.tile}>
          <b className={ui.value}>0</b>
          <span className={ui.label}>guest names stored outside Seedha</span>
        </div>
        <div className={ui.tile}>
          <b className={`${ui.value}${data.mismatches ? ` ${ui.loss}` : ""}`}>{count(data.mismatches)}</b>
          <span className={ui.label}>records to check</span>
        </div>
      </div>

      {data.entries.length === 0 ? (
        <div className={ui.section}>
          <EmptyState
            title="No consents yet"
            action={
              <Link className="btn small" href="/desk">
                Open Seedha Desk
              </Link>
            }
          >
            Guests say yes on their phone at check-in. Each yes is sealed here that night.
          </EmptyState>
        </div>
      ) : (
        <div className={p.bundles}>
          {pending.length ? (
            <section className={ui.card} aria-labelledby="tonight">
              <div className={p.bundleHead}>
                <div>
                  <h2 className={p.when} id="tonight">
                    Tonight, 9:00 PM
                  </h2>
                  <p className={p.fp}>Fingerprint: not sealed yet</p>
                </div>
                <Chip>Opens at 9 PM</Chip>
              </div>
              <Entries entries={pending} onOpen={setOpen} />
              <div className={p.write}>
                <button type="button" className="btn small" disabled={busy} onClick={() => void bundle()}>
                  Write tonight&apos;s bundle now
                </button>
                <span className={ui.muted}>The 9 PM job does the same.</span>
              </div>
            </section>
          ) : null}
          {data.bundles.map((b) => (
            <section className={ui.card} key={b.id} aria-labelledby={`bundle-${b.id}`}>
              <div className={p.bundleHead}>
                <div>
                  <h2 className={p.when} id={`bundle-${b.id}`}>
                    {istStamp(b.created_at)}
                  </h2>
                  <p className={p.fp}>
                    Fingerprint <span className={p.mono}>{shortHash(b.merkle_root)}</span> ·{" "}
                    {count(b.item_count)} consent{b.item_count === 1 ? "" : "s"}
                  </p>
                </div>
                <Chip tone={b.chain_tx ? "ok" : "plain"}>
                  {b.chain_tx ? "On public chain" : "Stored by Seedha"}
                </Chip>
              </div>
              <Entries entries={byBundle.get(b.id) ?? []} onOpen={setOpen} />
            </section>
          ))}
        </div>
      )}

      <p className={`${ui.calc} ${p.chainNote}`}>
        {data.chain_live
          ? "Bundle fingerprints are written to a public test chain. Only fingerprints are public: no name, phone or booking detail."
          : "Bundle fingerprints are stored by Seedha on this server and are not yet written to a public chain. Only fingerprints would ever be published: no name, phone or booking detail."}
      </p>
      {open !== null ? <ProofDialog consentId={open} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}

function Entries({ entries, onOpen }: { entries: ProofEntry[]; onOpen: (id: number) => void }) {
  return (
    <ul className={p.entries}>
      {entries.map((e, i) => {
        const s = proofStatus(e.status);
        const inner = (
          <>
            <span className={p.entryName}>{e.guest_name ?? "Deleted at the guest's request"}</span>
            <span className={p.entryWhen}>
              {e.given_at ? `Said yes ${istStamp(e.given_at)}` : "Leaf kept, link removed"}
            </span>
            <span className={p.entryChip}>
              <Chip tone={s.tone} dot>
                {s.label}
              </Chip>
            </span>
          </>
        );
        return (
          <li key={e.consent_id ?? `deleted-${i}`}>
            {e.consent_id !== null ? (
              <button type="button" className={p.entry} onClick={() => onOpen(e.consent_id as number)}>
                {inner}
              </button>
            ) : (
              <div className={p.entry}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
