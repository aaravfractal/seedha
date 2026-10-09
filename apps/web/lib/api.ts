"use client";

import { useCallback, useEffect, useState } from "react";

/** An error returned by the Seedha API in its {error: {code, message}} shape. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

/** Call the API through the same-origin /api proxy and parse JSON. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, { cache: "no-store", ...init });
  } catch {
    throw new ApiError(0, "offline", "No connection. Check the network and try again.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const err = (body as ErrorBody | null)?.error;
    throw new ApiError(response.status, err?.code ?? "error", err?.message ?? "Something went wrong");
  }
  return body as T;
}

/** POST JSON to the API. */
export function postJson<T>(path: string, data?: unknown): Promise<T> {
  return api<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
}

export type Loadable<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  reload: () => void;
  setData: (value: T) => void;
};

/** Fetch a resource on mount; expose loading, error and reload. */
export function useApi<T>(path: string | null): Loadable<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start of an async load
    setLoading(true);
    api<T>(path)
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "error", "Something went wrong"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload, setData };
}
