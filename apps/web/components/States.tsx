import Link from "next/link";
import type { ReactNode } from "react";

/** Shimmer placeholder while data loads. */
export function Loading({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="grid gap-3">
      <span className="sr-only-text">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 64 }} />
      ))}
    </div>
  );
}

/** A clear error with a retry button, or a login link when the session ended. */
export function ErrorState({
  message,
  onRetry,
  code,
}: {
  message: string;
  onRetry?: () => void;
  code?: string;
}) {
  if (code === "login_required") {
    return (
      <div className="card" role="alert">
        <h3 className="sub-title">Your session ended</h3>
        <p className="sub" style={{ margin: "6px 0 14px" }}>
          {message}
        </p>
        <Link className="btn small" href="/login">
          Log in
        </Link>
      </div>
    );
  }
  return (
    <div className="card" role="alert">
      <h3 className="sub-title">That did not load</h3>
      <p className="sub" style={{ margin: "6px 0 14px" }}>
        {message}
      </p>
      {onRetry ? (
        <button type="button" className="btn small" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Empty state with a heading, a line and an optional action. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card">
      <h3 className="sub-title">{title}</h3>
      <p className="sub" style={{ margin: "6px 0 14px" }}>
        {children}
      </p>
      {action}
    </div>
  );
}

/** Marks a feature that is not live yet so no button is ever dead. */
export function ComingIn({ milestone, what }: { milestone: string; what: string }) {
  return (
    <EmptyState title={`${what} is being built`}>
      This screen arrives in milestone {milestone}. Everything here will run on your own statements.
    </EmptyState>
  );
}
