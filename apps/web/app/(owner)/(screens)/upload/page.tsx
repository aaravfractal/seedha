"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import { count } from "@/lib/format";
import type { FlaggedRow, IngestOutcome, SampleFile, StatementsSummary } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Chip, Screen, ui } from "@/components/owner/ui";
import u from "./upload.module.css";

type FileStatus = "waiting" | "reading" | "done" | "error";
type FileRow = { name: string; status: FileStatus; note: string };
type Task = () => Promise<IngestOutcome>;

const MAX_BYTES = 10 * 1024 * 1024;

/** "MakeMyTrip Apr to Jun.pdf" -> ["PDF", "MakeMyTrip Apr to Jun"]. */
function splitName(filename: string): [string, string] {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return ["FILE", filename];
  return [filename.slice(dot + 1).toUpperCase(), filename.slice(0, dot)];
}

function outcomeNote(outcome: IngestOutcome): string {
  if (outcome.status === "already_imported") return "Already read";
  const via = outcome.method === "claude" ? " · read by Claude" : "";
  const dup = outcome.duplicates ? ` · ${count(outcome.duplicates)} already counted` : "";
  return `${count(outcome.rows)} rows${via}${dup}`;
}

function errorNote(err: unknown): string {
  return err instanceof ApiError ? err.message : "This file could not be read.";
}

export default function UploadPage() {
  const summary = useApi<StatementsSummary>("statements");
  const toast = useToast();
  const [rows, setRows] = useState<FileRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const tasks = useRef<Task[]>([]);

  const patch = (i: number, next: Partial<FileRow>) =>
    setRows((list) => list.map((f, j) => (j === i ? { ...f, ...next } : f)));

  async function runOne(i: number) {
    const task = tasks.current[i];
    if (!task) return;
    patch(i, { status: "reading", note: "Reading" });
    try {
      patch(i, { status: "done", note: outcomeNote(await task()) });
    } catch (err) {
      patch(i, { status: "error", note: errorNote(err) });
    }
  }

  async function runAll(names: string[], list: Task[]) {
    setBusy(true);
    tasks.current = list;
    setRows(names.map((name) => ({ name, status: "waiting", note: "Waiting" })));
    for (let i = 0; i < names.length; i += 1) await runOne(i);
    setBusy(false);
    summary.reload();
  }

  async function retry(i: number) {
    setBusy(true);
    await runOne(i);
    setBusy(false);
    summary.reload();
  }

  async function useSamples() {
    try {
      const samples = await api<SampleFile[]>("statements/samples");
      await runAll(
        samples.map((s) => s.filename),
        samples.map((s) => () => postJson<IngestOutcome>(`statements/samples/${s.index}`)),
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
      chosen.map((file) => async () => {
        if (file.size > MAX_BYTES)
          throw new ApiError(413, "file_too_large", "Files must be 10 MB or smaller.");
        const form = new FormData();
        form.append("file", file);
        return api<IngestOutcome>("statements", { method: "POST", body: form });
      }),
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
  const shown: FileRow[] =
    rows.length > 0
      ? rows
      : (data?.files ?? []).map((f) => ({
          name: f.filename,
          status: "done",
          note: `${count(f.row_count)} rows${f.parse_method.startsWith("claude") ? " · read by Claude" : ""}`,
        }));
  const reading = busy && rows.some((r) => r.status === "waiting" || r.status === "reading");
  const failed = shown.filter((r) => r.status === "error").length;
  const readOk = shown.length - failed;

  return (
    <Screen
      title="Bring your statements."
      sub="MakeMyTrip, Booking.com and Agoda payouts with your hotel register. Seedha checks that every row adds up."
    >
      <div
        className={`${u.drop}${over ? ` ${u.over}` : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
      >
        <h2 className={u.dropTitle}>Drop files here</h2>
        <p className={u.dropHint}>PDF, Excel or CSV, up to 10 MB each</p>
        <div className={u.dropActions}>
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
        <p className={u.sampleNote}>Sample statements are fictional data for Hotel Deodar View.</p>
      </div>

      {summary.error ? (
        <div className={u.files}>
          <ErrorState message={summary.error.message} code={summary.error.code} onRetry={summary.reload} />
        </div>
      ) : summary.loading && !data && rows.length === 0 ? (
        <div className={u.files}>
          <Loading rows={2} label="Loading your statements" />
        </div>
      ) : null}

      {shown.length > 0 ? (
        <div className={`${ui.card} ${u.files}`} aria-live="polite" aria-busy={reading}>
          <div className={u.filesHead}>
            <h2 className={u.filesTitle}>
              {reading
                ? `Reading ${count(shown.length)} file${shown.length === 1 ? "" : "s"}`
                : `${count(readOk)} file${readOk === 1 ? "" : "s"} read`}
            </h2>
            {failed ? <span className={u.filesCount}>{count(failed)} could not be read</span> : null}
          </div>
          {shown.map((f, i) => {
            const [type, name] = splitName(f.name);
            return (
              <div className={u.file} key={`${f.name}-${i}`}>
                <span className={u.type}>{type}</span>
                <span className={u.fileName}>{name}</span>
                <span className={`${u.fileNote} ${f.status === "done" ? u.done : ""}`}>
                  {f.status === "error" ? "Not read" : f.note}
                </span>
                {f.status === "error" ? (
                  <div className={u.fileError} role="alert">
                    <span>
                      {f.name} could not be read. {f.note}
                    </span>
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={busy}
                      onClick={() => void retry(i)}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                <span className={u.track} aria-hidden="true">
                  <i className={`${u.fill} ${f.status === "waiting" ? "" : u[f.status]}`} />
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {!reading && data && data.rows > 0 ? <Summary data={data} onChange={summary.setData} /> : null}
    </Screen>
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
    <div className={`${ui.card} ${u.summary}`}>
      <h2 className={u.summaryTitle}>
        <span className={u.tick} aria-hidden="true">
          ✓{" "}
        </span>
        {count(data.rows)} rows matched.{" "}
        {need ? `${need} need${need === 1 ? "s" : ""} a look.` : "All checked."}
      </h2>
      {data.flagged_rows.length ? (
        <p className={ui.sub}>These rows do not add up. They stay out of your numbers until you decide.</p>
      ) : null}
      {data.flagged_rows.map((row) => (
        <div className={u.flag} key={row.id}>
          <div>
            <div className={u.flagRef}>
              {row.channel} #{row.external_ref}
            </div>
            <div className={u.flagDetail}>{row.detail}</div>
            {row.review_status === "pending" ? (
              <div className={u.flagActions}>
                <button type="button" className="btn small ghost" onClick={() => review(row, "exclude")}>
                  Keep it out
                </button>
                <button type="button" className="btn small ghost" onClick={() => review(row, "accept")}>
                  Count it anyway
                </button>
              </div>
            ) : null}
          </div>
          {row.review_status === "pending" ? (
            <Chip tone="bad">
              <span aria-hidden="true">⚠</span> Check
            </Chip>
          ) : (
            <Chip tone={row.review_status === "accepted" ? "ok" : "plain"}>
              {row.review_status === "accepted" ? "Counted" : "Kept out"}
            </Chip>
          )}
        </div>
      ))}
      <div className={ui.actions}>
        <Link className="btn" href="/flip">
          See my real money
        </Link>
      </div>
    </div>
  );
}
