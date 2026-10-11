"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import { count } from "@/lib/format";
import { bundleStatus, linkHost, readChain } from "@/lib/proofChain";
import type { ProofBundle } from "@/lib/types";
import type { OwnerProof, ProofEntry } from "@/lib/types-owner";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { ProofDialog } from "@/components/ProofDialog";
import { ProofChainCard } from "@/components/owner/ProofChainCard";
import { useToast } from "@/components/Toast";
import { Chip, Screen, ui } from "@/components/owner/ui";
import { istStamp, proofStatus, shortHash } from "@/components/owner/proofStatus";
import c from "@/components/owner/proofChain.module.css";
import p from "./proof.module.css";

const TITLE = "Consent proof.";
const SUB =
  "Every night at 9 PM, Seedha seals the day's Desk consents into one bundle. Anyone can later check a consent was given and not changed. No guest names or numbers leave Seedha.";

export default function ProofPage() {
  const proof = useApi<OwnerProof>("proof");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  // After a write the button turns disabled: focus moves to the new bundle instead of the page body.
  const focusBundle = useRef<number | null>(null);
  useEffect(() => {
    if (focusBundle.current === null) return;
    document.getElementById(`bundle-${focusBundle.current}`)?.focus();
    focusBundle.current = null;
  }, [proof.data]);

  async function bundle() {
    setBusy(true);
    try {
      const result = await postJson<OwnerProof>("proof/bundle");
      proof.setData(result);
      const newest = result.bundles[0];
      focusBundle.current = newest?.id ?? null;
      const sealed = newest?.item_count ?? 0;
      toast(
        `Tonight's proof written. ${count(sealed)} consent${sealed === 1 ? "" : "s"} sealed. ${
          newest ? bundleStatus(newest).label : "Stored on Seedha"
        }.`,
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not write tonight's proof");
    } finally {
      setBusy(false);
    }
  }

  /** Re-read GET /proof to see whether a sent bundle is confirmed yet. */
  async function refresh(id: number) {
    setRefreshing(id);
    try {
      const result = await api<OwnerProof>("proof");
      proof.setData(result);
      const now = result.bundles.find((b) => b.id === id);
      toast(now ? `${bundleStatus(now).label}.` : "Checked again");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not check the network");
    } finally {
      setRefreshing(null);
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
  const chain = readChain(data);
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

      <div className={p.write}>
        <button
          type="button"
          className="btn small"
          disabled={busy || pending.length === 0}
          aria-busy={busy}
          onClick={() => void bundle()}
        >
          {busy ? "Writing tonight's proof…" : "Write tonight's proof"}
        </button>
        <span className={ui.muted}>
          {pending.length
            ? `${count(pending.length)} consent${pending.length === 1 ? "" : "s"} waiting. The 9 PM job does the same.`
            : "Nothing new to prove tonight. The 9 PM job does the same."}
        </span>
      </div>

      <div className={p.chain}>
        <ProofChainCard chain={chain} />
      </div>

      {data.entries.length === 0 && data.bundles.length === 0 ? (
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
            </section>
          ) : null}
          {data.bundles.map((b) => (
            <section className={ui.card} key={b.id} aria-labelledby={`bundle-${b.id}`}>
              <div className={p.bundleHead}>
                <div>
                  <h2 className={p.when} id={`bundle-${b.id}`} tabIndex={-1}>
                    {istStamp(b.created_at)}
                  </h2>
                  <p className={p.fp}>
                    Fingerprint <span className={p.mono}>{shortHash(b.merkle_root)}</span> ·{" "}
                    {count(b.item_count)} consent{b.item_count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <BundleChain bundle={b} refreshing={refreshing === b.id} onRefresh={() => void refresh(b.id)} />
              <Entries entries={byBundle.get(b.id) ?? []} onOpen={setOpen} />
            </section>
          ))}
        </div>
      )}

      {open !== null ? <ProofDialog consentId={open} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}

/** Where one bundle's root is: stored, sent, verified or not confirmed. */
function BundleChain({
  bundle,
  refreshing,
  onRefresh,
}: {
  bundle: ProofBundle;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const s = bundleStatus(bundle);
  const host = linkHost(bundle.explorer_url);
  return (
    <div className={c.statusRow}>
      <p className={`${c.status}${s.tone === "plain" ? "" : ` ${c[s.tone]}`}`}>{s.label}</p>
      {s.status === "sent" ? (
        <button
          type="button"
          className="btn small ghost"
          disabled={refreshing}
          aria-busy={refreshing}
          onClick={onRefresh}
        >
          {refreshing ? "Checking…" : "Refresh"}
        </button>
      ) : null}
      {bundle.explorer_url && host && s.status !== "stored" ? (
        <a className={c.link} href={bundle.explorer_url} target="_blank" rel="noopener noreferrer">
          View on Amoy explorer <span className={c.host}>({host})</span>
        </a>
      ) : null}
    </div>
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
