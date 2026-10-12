"use client";

import { fallbackLabels } from "@/lib/siteBuild";
import type { BuildState, GenerateResult } from "@/lib/types-site-build";
import { Modal } from "@/components/settings/Modal";
import ms from "@/components/settings/settings.module.css";
import b from "./build.module.css";

/** True when another AI run today would be refused. */
export function atDailyLimit(build: BuildState): boolean {
  return build.key_configured && build.generations_today >= build.daily_limit;
}

/** The honest allowance line: AI runs used today, or that only Sample text is written. */
export function allowanceText(build: BuildState): string {
  if (!build.key_configured)
    return "No AI key is set up here, so this writes Sample text. It uses no AI credit.";
  return `AI writing: ${build.generations_today} of ${build.daily_limit} used today.`;
}

/** Where the site text came from, as a small label. */
export function SourceTag({ source }: { source: BuildState["source"] }) {
  if (source === "sample") return <span className="tag sim">Sample</span>;
  if (source === "claude") return <span className="tag ok">Written with Claude · check every line</span>;
  if (source === "edited") return <span className="tag">Edited by you</span>;
  return null;
}

/** What one generation did: written, Sample, daily or monthly limit, or AI offline. */
export function GenerateNote({ result }: { result: GenerateResult }) {
  const labels = fallbackLabels(result.fallback_fields);
  const warn = result.status === "limit_reached" || result.status === "offline";
  return (
    <div className={b.status} data-tone={warn ? "warn" : "ok"} role="status">
      {result.status === "generated" ? (
        <p>
          <b>Your site text is ready.</b> Read every line before you publish; you can change any of it.
        </p>
      ) : result.status === "sample" ? (
        <p>
          <span className="tag sim">Sample</span> {result.message}
        </p>
      ) : (
        <p>{result.message}</p>
      )}
      {labels.length > 0 ? (
        <p>
          Some lines were written from your own words: {labels.join(", ")}. You can change them before you
          publish.
        </p>
      ) : null}
    </div>
  );
}

/** The confirm before a run that counts toward today's limit. */
export function ConfirmGenerate({
  build,
  onConfirm,
  onClose,
}: {
  build: BuildState;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const left = Math.max(0, build.daily_limit - build.generations_today);
  return (
    <Modal
      alert
      title={build.key_configured ? "This uses AI credit" : "Write Sample text again?"}
      onClose={onClose}
    >
      <p className={ms.sheetBody}>
        {build.key_configured
          ? `Claude writes all the site text again from your photos, words and rooms. It counts as 1 of ${build.daily_limit} runs today (${left} left).`
          : "No AI key is set up, so this writes Sample text again. It uses no AI credit."}
      </p>
      <p className={ms.sheetNote}>
        It replaces the descriptions, points, room lines, captions and photo order, including your edits.
        Prices stay exactly as you typed them.
      </p>
      <div className={ms.sheetActions}>
        <button type="button" className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn" onClick={onConfirm}>
          {build.key_configured ? "Use 1 run" : "Write again"}
        </button>
      </div>
    </Modal>
  );
}
