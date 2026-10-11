"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { MorningPreviewData, MorningSendResult } from "@/lib/types-settings";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Chip, Segmented, ui } from "@/components/owner/ui";
import st from "@/components/settings/settings.module.css";
import c from "./calendar.module.css";

type Lang = "en" | "hi";

/**
 * The morning WhatsApp line about coming events, as the owner would read it.
 * Sending is always simulated here: it logs a send, nothing leaves Seedha.
 * `version` changes when events or the plan change, so the text reloads.
 */
export function MorningPreview({ version }: { version: string }) {
  const preview = useApi<MorningPreviewData>("events/morning-preview");
  const toast = useToast();
  const [lang, setLang] = useState<Lang>("en");
  const [busy, setBusy] = useState(false);
  const { reload } = preview;

  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    reload();
  }, [version, reload]);

  async function send() {
    setBusy(true);
    try {
      await postJson<MorningSendResult>("events/morning-preview/send");
      toast("Simulated send logged");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const data = preview.data;
  return (
    <section className={`${ui.card} ${c.preview}`} aria-labelledby="morningTitle">
      <div className={c.previewHead}>
        <h2 className={ui.sectionTitle} id="morningTitle">
          Morning WhatsApp preview
        </h2>
        <Chip tone="sample">Simulated send</Chip>
      </div>
      <p className={ui.muted}>
        The line you would get each morning about coming events. Sending here only logs a simulated send to
        you. No guest gets it.
      </p>
      {preview.error && !data ? (
        <ErrorState message={preview.error.message} code={preview.error.code} onRetry={preview.reload} />
      ) : !data ? (
        <Loading rows={1} label="Loading the morning preview" />
      ) : (
        <>
          <Segmented<Lang>
            label="Preview language"
            value={lang}
            onChange={setLang}
            options={[
              { value: "en", label: "English" },
              { value: "hi", label: "हिंदी" },
            ]}
          />
          <div className={c.chat} aria-live="polite">
            <div className={`${ui.bubble} ${c.waBubble}`} lang={lang}>
              {lang === "hi" ? data.hi : data.en}
              <span className={c.waMeta} lang="en">
                Simulated send · {data.count === 1 ? "1 event" : `${data.count} events`}
              </span>
            </div>
          </div>
          {data.count === 0 ? <p className={st.help}>Add events to see them in the morning line.</p> : null}
          <div className={ui.actions}>
            <button
              type="button"
              className="btn small"
              disabled={busy}
              aria-busy={busy}
              onClick={() => void send()}
            >
              {busy ? "Sending" : "Send to me (simulated)"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
