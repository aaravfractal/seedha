"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import { count } from "@/lib/format";
import type { FlaggedRow, IngestOutcome, SampleFile, StatementsSummary } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";

type FileState = { name: string; state: "waiting" | "reading" | "done" | "error"; note: string };

const MAX_BYTES = 10 * 1024 * 1024;

function outcomeNote(outcome: IngestOutcome): string {
  if (outcome.status === "already_imported") return "Already read";
  const via = outcome.method === "claude" ? " · read by Claude" : "";
  const dup = outcome.duplicates ? ` · ${count(outcome.duplicates)} already counted` : "";
  return `${count(outcome.rows)} rows${via}${dup}`;
}

function errorNote(err: unknown): string {
  if (err instanceof ApiError) {
    return err.code === "needs_claude" ? `${err.message}` : err.message;
  }
  return "Could not read this file";
}

export default function UploadPage() {
  const summary = useApi<StatementsSummary>("statements");
  const toast = useToast();
  const [files, setFiles] = useState<FileState[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const setState = (i: number, patch: Partial<FileState>) =>
    setFiles((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  async function runAll(names: string[], read: (i: number) => Promise<IngestOutcome>) {
    setBusy(true);
    setFiles(names.map((name) => ({ name, state: "waiting", note: "Waiting" })));
    for (let i = 0; i < names.length; i += 1) {
      setState(i, { state: "reading", note: "Reading" });
      try {
        const outcome = await read(i);
        setState(i, { state: "done", note: outcomeNote(outcome) });
      } catch (err) {
        setState(i, { state: "error", note: errorNote(err) });
      }
    }
    setBusy(false);
    summary.reload();
  }

  async function useSamples() {
    try {
      const samples = await api<SampleFile[]>("statements/samples");
      await runAll(
        samples.map((s) => s.filename),
        (i) => postJson<IngestOutcome>(`statements/samples/${samples[i]?.index ?? 0}`),
      );
    } catch (err) {
      toast(errorNote(err));
    }
  }

  async function uploadFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const chosen = Array.from(list);
    await runAll(
      chosen.map((f) => f.name),
      async (i) => {
        const file = chosen[i];
        if (!file) throw new ApiError(0, "missing", "File missing");
        if (file.size > MAX_BYTES)
          throw new ApiError(413, "file_too_large", "Files must be 10 MB or smaller");
        const form = new FormData();
        form.append("file", file);
        return api<IngestOutcome>("statements", { method: "POST", body: form });
      },
    );
    if (input.current) input.current.value = "";
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setOver(false);
    if (!busy) void uploadFiles(event.dataTransfer.files);
  }

  const data = summary.data;
  const hasStatements = (data?.files.length ?? 0) > 0;
  const shownFiles: FileState[] =
    files.length > 0
      ? files
      : (data?.files ?? []).map((f) => ({
          name: f.filename,
          state: "done",
          note: `${count(f.row_count)} rows${f.parse_method.startsWith("claude") ? " · read by Claude" : ""}`,
        }));

  return (
    <>
      <h2 className="title">Bring your statements.</h2>
      <p className="sub">
        Drop MakeMyTrip, Booking.com and Agoda payouts with your hotel register. Seedha reads every format and
        checks that each row adds up.
      </p>
      <div
        className={`drop${over ? " over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <h3 className="sub-title">Drop files here</h3>
        <p className="sub" style={{ margin: "4px auto 18px" }}>
          PDF, Excel or CSV, up to 10 MB each
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn" onClick={useSamples} disabled={busy}>
            {busy ? "Reading files" : hasStatements ? "Use sample statements again" : "Use sample statements"}
          </button>
          <label className="btn ghost" aria-disabled={busy}>
            Choose files
            <input
              ref={input}
              type="file"
              multiple
              accept=".pdf,.xlsx,.csv,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only-text"
              disabled={busy}
              onChange={(e) => void uploadFiles(e.target.files)}
            />
          </label>
        </div>
        <p className="calc">Sample statements are fictional data for Hotel Deodar View.</p>
      </div>

      {summary.error ? (
        <div style={{ marginTop: 16 }}>
          <ErrorState message={summary.error.message} code={summary.error.code} onRetry={summary.reload} />
        </div>
      ) : summary.loading && !data ? (
        <div style={{ marginTop: 16 }}>
          <Loading rows={2} label="Loading your statements" />
        </div>
      ) : null}

      {shownFiles.length > 0 ? (
        <div className="card" style={{ marginTop: 16 }} aria-live="polite">
          {shownFiles.map((f) => (
            <div className="file" key={f.name}>
              <span>{f.name}</span>
              <span
                className="num meta"
                style={{ color: f.state === "error" ? "var(--loss)" : "var(--ink2)", textAlign: "right" }}
              >
                {f.note}
              </span>
              <div className="progress" style={{ gridColumn: "1 / -1" }} aria-hidden="true">
                <i
                  className={f.state === "reading" ? "busy" : undefined}
                  style={f.state === "done" || f.state === "error" ? { width: "100%" } : undefined}
                />
              </div>
            </div>
          ))}
          {!busy && data && data.rows > 0 ? <Summary data={data} onChange={summary.setData} /> : null}
        </div>
      ) : null}
    </>
  );
}

function Summary({ data, onChange }: { data: StatementsSummary; onChange: (s: StatementsSummary) => void }) {
  const toast = useToast();
  const need = data.pending_review;
  async function review(row: FlaggedRow, decision: "accept" | "exclude") {
    try {
      onChange(await postJson<StatementsSummary>(`statements/rows/${row.id}/review`, { decision }));
      toast(decision === "accept" ? "Row counted in your numbers" : "Row kept out of your numbers");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save that");
    }
  }
  return (
    <div style={{ paddingTop: 16 }}>
      <h3 className="sub-title">
        {count(data.rows)} rows matched.{" "}
        {need ? `${need} need${need === 1 ? "s" : ""} a look.` : "All checked."}
      </h3>
      {data.flagged_rows.map((row) => (
        <div className="item" key={row.id}>
          <div>
            <b>
              {row.channel} #{row.external_ref}
            </b>
            <div className="meta">{row.detail}</div>
            {row.review_status === "pending" ? (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn small ghost" onClick={() => review(row, "exclude")}>
                  Keep it out
                </button>
                <button type="button" className="btn small ghost" onClick={() => review(row, "accept")}>
                  Count it anyway
                </button>
              </div>
            ) : null}
          </div>
          <span className={`tag ${row.review_status === "pending" ? "bad" : "ok"}`}>
            {row.review_status === "pending"
              ? "Check"
              : row.review_status === "accepted"
                ? "Counted"
                : "Kept out"}
          </span>
        </div>
      ))}
      <p className="calc">Flagged rows stay out of your numbers until you decide.</p>
      <Link className="btn" href="/flip" style={{ marginTop: 14 }}>
        See my real money
      </Link>
    </div>
  );
}
