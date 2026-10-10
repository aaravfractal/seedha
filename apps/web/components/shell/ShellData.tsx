"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, api } from "@/lib/api";
import type { Overview } from "@/lib/types-overview";

type ShellState = { data: Overview | null; error: ApiError | null; loading: boolean };

type ShellContext = ShellState & {
  /** Load once per key (the pathname); a new key reloads. */
  sync: (key: string) => void;
  reload: () => void;
};

const Ctx = createContext<ShellContext | null>(null);

/**
 * One GET /overview shared by the header, the sidebar and the Overview
 * screen. Nothing loads until an app-shell component asks for it, so guest
 * pages never call owner routes.
 */
export function ShellProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShellState>({ data: null, error: null, loading: false });
  const lastKey = useRef<string | null>(null);
  const request = useRef(0);

  const reload = useCallback(() => {
    const id = ++request.current;
    setState((s) => ({ ...s, loading: true }));
    api<Overview>("overview")
      .then((data) => {
        if (id === request.current) setState({ data, error: null, loading: false });
      })
      .catch((err: unknown) => {
        if (id !== request.current) return;
        const error = err instanceof ApiError ? err : new ApiError(0, "error", "Something went wrong");
        setState((s) => ({ data: s.data, error, loading: false }));
      });
  }, []);

  const sync = useCallback(
    (key: string) => {
      if (lastKey.current === key) return;
      lastKey.current = key;
      reload();
    },
    [reload],
  );

  const value = useMemo(() => ({ ...state, sync, reload }), [state, sync, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** The shared Overview data; loads (or reloads) when `key` changes. */
export function useShell(key: string): ShellContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useShell must be used inside ShellProvider");
  const { sync } = ctx;
  useEffect(() => {
    sync(key);
  }, [sync, key]);
  return ctx;
}
