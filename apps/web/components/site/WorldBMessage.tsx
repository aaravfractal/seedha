import s from "./worldb.module.css";

/** Loading, missing and error states on the hotel's own pages. */
export function WorldBMessage({
  title,
  body,
  loading = false,
  onRetry,
}: {
  title: string;
  body?: string;
  loading?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className={s.wb} data-mood="pine" lang="en" style={{ minHeight: "100svh" }}>
      <div
        className={s.section}
        role={loading ? "status" : "alert"}
        aria-live="polite"
        aria-busy={loading || undefined}
      >
        <h1 className={`${s.display} ${s.h2}`}>{title}</h1>
        {body ? <p className={s.muted}>{body}</p> : null}
        {onRetry ? (
          <button type="button" className={s.pill} style={{ marginTop: 20 }} onClick={onRetry}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
