"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ApiError, postJson } from "@/lib/api";
import {
  CLAUDE_NOTE,
  NOTICE_MAX,
  NO_FETCH_HELP,
  RATE_LINE,
  SAMPLE_NOTE,
  categoryText,
  dateRange,
  demandText,
  extractErrorText,
  noticeCounter,
  reasonText,
  rejectedName,
  sourceUrlError,
} from "@/lib/events";
import type { ExtractResult, OwnerEvent, RejectedEvent, SaveEventsResult } from "@/lib/types-settings";
import { Modal } from "@/components/settings/Modal";
import { Chip } from "@/components/owner/ui";
import st from "@/components/settings/settings.module.css";
import c from "./calendar.module.css";

function errorText(err: unknown): string {
  return err instanceof ApiError
    ? extractErrorText(err.status, err.code, err.message)
    : "That did not work. Try again.";
}

function Rejected({ rows, title }: { rows: RejectedEvent[]; title: string }) {
  if (rows.length === 0) return null;
  return (
    <>
      <h3 className={c.resultsTitle}>{title}</h3>
      <ul className={c.draftList}>
        {rows.map((r) => (
          <li key={`${r.index}-${r.name}`} className={`${c.draft} ${c.rejected}`}>
            <p className={c.draftName}>{rejectedName(r.name)}</p>
            <p className={c.reason}>{reasonText(r.reason)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Paste an event notice and its official link; Seedha reads the events
 * (Claude, or a labelled sample without a key), shows them, and saves only
 * when the owner taps Save. Never fetches the link, never takes a price.
 */
export function AddEventsSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (saved: OwnerEvent[]) => void;
}) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState<"read" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [saveRejected, setSaveRejected] = useState<RejectedEvent[]>([]);
  const ids = { text: useId(), url: useId(), count: useId(), help: useId(), urlErr: useId() };

  const resultsHead = useRef<HTMLHeadingElement>(null);
  const textBox = useRef<HTMLTextAreaElement>(null);
  const shown = result !== null;
  const firstRender = useRef(true);
  // The button that was focused goes away when the view switches: move focus to the new view.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    (shown ? resultsHead.current : textBox.current)?.focus();
  }, [shown]);

  const counter = noticeCounter(text);
  const urlError = sourceUrlError(url);
  const textMissing = text.trim().length === 0;
  const showUrlError = touched && urlError !== null;

  async function read() {
    setTouched(true);
    if (textMissing || counter.over || urlError) return;
    setBusy("read");
    setError(null);
    try {
      const out = await postJson<ExtractResult>("events/extract", { text, source_url: url.trim() });
      setResult(out);
      setSaveRejected([]);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!result || result.events.length === 0) return;
    setBusy("save");
    setError(null);
    try {
      const out = await postJson<SaveEventsResult>("events", {
        source_url: url.trim(),
        origin: result.mode === "claude" ? "owner_source" : "sample_extraction",
        events: result.events,
      });
      if (out.saved.length > 0) {
        onSaved(out.saved);
        return;
      }
      setSaveRejected(out.rejected);
      setError("None of these could be saved. They may already be on your calendar.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title="Add events from your source." onClose={onClose}>
      {!result ? (
        <form
          className={st.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void read();
          }}
        >
          <p className={st.sheetBody} id={ids.help}>
            {NO_FETCH_HELP}
          </p>
          <div className={st.field}>
            <label className={st.label} htmlFor={ids.text}>
              Paste the event notice
            </label>
            <textarea
              ref={textBox}
              id={ids.text}
              className={c.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby={`${ids.count} ${ids.help}`}
              aria-invalid={counter.over || (touched && textMissing) ? true : undefined}
              required
            />
            <div className={c.counterRow}>
              <div aria-live="polite">
                {counter.over ? (
                  <p className={st.error}>{counter.label}</p>
                ) : touched && textMissing ? (
                  <p className={st.error}>Paste the notice text first.</p>
                ) : null}
              </div>
              <p className={c.counter} id={ids.count} data-over={counter.over}>
                <span className="sr-only-text">{`${counter.count} of ${NOTICE_MAX} characters`}</span>
                <span aria-hidden="true">
                  {counter.count.toLocaleString("en-IN")} / {NOTICE_MAX.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
          </div>
          <div className={st.field}>
            <label className={st.label} htmlFor={ids.url}>
              Official source link
            </label>
            <input
              id={ids.url}
              className={st.input}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => url && setTouched(true)}
              aria-invalid={showUrlError ? true : undefined}
              aria-describedby={showUrlError ? ids.urlErr : undefined}
              required
            />
            {showUrlError ? (
              <p className={st.error} id={ids.urlErr}>
                {urlError}
              </p>
            ) : (
              <p className={st.help}>
                The page where you read the notice. Seedha keeps the link, not the page.
              </p>
            )}
          </div>
          <p className={c.rateLine}>{RATE_LINE}</p>
          <div role="alert">{error ? <p className={st.error}>{error}</p> : null}</div>
          <div className={st.sheetActions}>
            <button type="submit" className="btn" disabled={busy !== null} aria-busy={busy === "read"}>
              {busy === "read" ? "Reading the notice" : "Read events"}
            </button>
            <button type="button" className="btn ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className={c.results}>
          <div aria-live="polite" className={c.results}>
            <div className={c.resultsHead}>
              <h3 className={c.resultsTitle} ref={resultsHead} tabIndex={-1}>
                {result.events.length === 0
                  ? "No dated events found in this notice."
                  : result.events.length === 1
                    ? "1 event found."
                    : `${result.events.length} events found.`}
              </h3>
              {result.mode === "sample" ? <Chip tone="sample">Sample extraction</Chip> : null}
            </div>
            {result.mode === "sample" ? <p className={st.help}>{SAMPLE_NOTE}</p> : null}
            {result.events.length > 0 ? (
              <ul className={c.draftList}>
                {result.events.map((ev) => (
                  <li key={`${ev.name}-${ev.start_date}`} className={c.draft}>
                    <p className={c.draftName}>{ev.name}</p>
                    <p className={c.draftMeta}>
                      {dateRange(ev.start_date, ev.end_date)} · {ev.town} · {categoryText(ev.category)}
                    </p>
                    <p className={c.demand}>{demandText(ev.demand, result.mode === "sample")}</p>
                    <p className={st.help}>{result.mode === "claude" ? CLAUDE_NOTE : "Sample extraction."}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={st.help}>Check that the notice has dates, then try again.</p>
            )}
            <Rejected rows={result.rejected} title="Left out" />
            <Rejected rows={saveRejected} title="Not saved" />
          </div>
          <p className={c.rateLine}>{RATE_LINE}</p>
          <div role="alert">{error ? <p className={st.error}>{error}</p> : null}</div>
          <div className={st.sheetActions}>
            {result.events.length > 0 ? (
              <button
                type="button"
                className="btn"
                disabled={busy !== null}
                aria-busy={busy === "save"}
                onClick={() => void save()}
              >
                {busy === "save" ? "Saving" : "Save events"}
              </button>
            ) : null}
            <button
              type="button"
              className="btn ghost"
              disabled={busy !== null}
              onClick={() => {
                setResult(null);
                setError(null);
              }}
            >
              Edit notice
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
