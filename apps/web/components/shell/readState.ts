"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Which notifications the owner has read. Kept on this device only
 * (localStorage, every access guarded) because it is a convenience, not a
 * record; the notifications themselves come from the API.
 */
const KEY = "seedha-notifications-read";
const MAX_IDS = 200;
const listeners = new Set<() => void>();
let cache: string | null = null;

function read(): string {
  if (cache !== null) return cache;
  try {
    cache = window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    cache = "[]";
  }
  return cache;
}

function write(ids: string[]): void {
  cache = JSON.stringify(ids.slice(-MAX_IDS));
  try {
    window.localStorage.setItem(KEY, cache);
  } catch {
    // Private mode or storage blocked: read state lasts for this page only.
  }
  listeners.forEach((l) => l());
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Read ids plus helpers to mark one or many as read. */
export function useReadIds(): {
  read: ReadonlySet<string>;
  markRead: (ids: string[]) => void;
} {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const ids = new Set(parse(raw));
  const markRead = useCallback((more: string[]) => {
    const current = parse(read());
    const next = [...current, ...more.filter((id) => !current.includes(id))];
    if (next.length !== current.length) write(next);
  }, []);
  return { read: ids, markRead };
}
