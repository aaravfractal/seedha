"use client";

import { useApi } from "@/lib/api";
import { count, timeLabel } from "@/lib/format";
import type { GenUsage } from "@/lib/types-site-build";
import { ErrorState, Loading } from "@/components/States";
import s from "./settings.module.css";

const STATUS: Record<string, string> = {
  generated: "Written",
  offline: "AI unavailable",
  limit_reached: "Limit reached",
  sample: "Sample",
};

/**
 * Seedha Site text generation: tokens this month (input includes cache
 * tokens), runs, the monthly cap and today's count, from GET /site/gen/usage.
 * Only the site writer is counted here.
 */
export function AiUsage() {
  const usage = useApi<GenUsage>("site/gen/usage");
  const u = usage.data;
  return (
    <>
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>AI usage</h2>
      </div>
      {usage.error && !u ? (
        <ErrorState message={usage.error.message} code={usage.error.code} onRetry={usage.reload} />
      ) : !u ? (
        <Loading rows={2} label="Loading AI usage" />
      ) : (
        <div className={s.list}>
          <div className={s.row}>
            <span className={s.rowText}>
              <span className={s.rowLabel}>Site text generation (Claude)</span>
              <span className={s.rowHint}>
                Writes your website text from your photos and words. This month so far.
              </span>
            </span>
          </div>
          <div className={`${s.row} ${s.stackPhone}`}>
            <span className={s.rowText}>
              <span className={s.rowLabel}>Tokens this month</span>
              <span className={s.rowHint}>Input includes cached photo tokens</span>
            </span>
            <span className={s.rowValue}>
              <span className={s.nowrap}>{count(u.month_input_tokens)} in</span> ·{" "}
              <span className={s.nowrap}>{count(u.month_output_tokens)} out</span>
            </span>
          </div>
          <div className={`${s.row} ${s.stackPhone}`}>
            <span className={s.rowText}>
              <span className={s.rowLabel}>Monthly cap</span>
              <span className={s.rowHint}>Generation stops for the month at the cap</span>
            </span>
            <span className={s.rowValue}>
              <span className={s.nowrap}>{count(u.month_input_tokens + u.month_output_tokens)}</span> of{" "}
              <span className={s.nowrap}>{count(u.monthly_token_cap)}</span>
            </span>
          </div>
          <div className={s.row}>
            <span className={s.rowLabel}>Runs this month</span>
            <span className={s.rowValue}>{count(u.month_runs)}</span>
          </div>
          <div className={s.row}>
            <span className={s.rowLabel}>Today</span>
            <span className={s.rowValue}>
              {u.generations_today} of {u.daily_limit}
            </span>
          </div>
          {u.runs.length === 0 ? (
            <div className={s.row}>
              <span className={s.rowHint}>
                No runs yet. Without an AI key the site uses Sample text and no tokens.
              </span>
            </div>
          ) : (
            u.runs.slice(0, 5).map((run) => (
              <div key={run.at} className={`${s.row} ${s.stackPhone}`}>
                <span className={s.rowText}>
                  <span className={s.rowLabel}>{timeLabel(run.at)}</span>
                  <span className={s.rowHint}>
                    {STATUS[run.status] ?? run.status}
                    {run.model ? ` · ${run.model}` : ""}
                  </span>
                </span>
                <span className={`${s.rowValue} ${s.plain}`}>
                  {count(run.input_tokens + run.cache_creation_tokens + run.cache_read_tokens)} in ·{" "}
                  {count(run.output_tokens)} out
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </>
  );
}
