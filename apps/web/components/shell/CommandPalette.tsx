"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { OWNER_SCREENS } from "@/lib/screens";
import { useDialogFocus } from "@/components/useDialogFocus";
import { Icon } from "./Icons";
import type { IconName } from "./Icons";
import styles from "./Shell.module.css";

type Entry = { label: string; href: string; icon: IconName; hint?: string };

const ENTRIES: Entry[] = [
  ...OWNER_SCREENS.map((s) => ({
    label: s.label,
    href: s.href,
    icon: s.icon as IconName,
    hint: s.built === false ? "Not built yet" : undefined,
  })),
  { label: "Front desk", href: "/desk", icon: "desk" },
  { label: "Guest mode", href: "/link", icon: "guest" },
  { label: "Plans", href: "/plans", icon: "card" },
];

/** Screens whose label contains every word typed, in sidebar order. */
export function filterEntries(query: string): Entry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return ENTRIES.filter((e) => words.every((w) => e.label.toLowerCase().includes(w)));
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const listId = useId();
  const matches = useMemo(() => filterEntries(query), [query]);
  useDialogFocus(ref, true, onClose);

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div className={styles.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.palette} ref={ref} role="dialog" aria-modal="true" aria-label="Search Seedha">
        <div className={styles.paletteInput}>
          <Icon name="search" size={18} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) {
                e.preventDefault();
                go(matches[0].href);
              }
            }}
            placeholder="Search screens"
            aria-label="Search screens"
            aria-controls={listId}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul className={styles.paletteList} id={listId} aria-label="Screens">
          {matches.length === 0 ? (
            <li className={styles.empty}>No screen matches “{query}”.</li>
          ) : (
            matches.map((m, i) => (
              <li key={m.href + m.label}>
                <a
                  href={m.href}
                  className={styles.paletteItem}
                  data-active={i === 0}
                  onClick={(e) => {
                    e.preventDefault();
                    go(m.href);
                  }}
                >
                  <span className={styles.tile}>
                    <Icon name={m.icon} />
                  </span>
                  <span className={styles.label}>{m.label}</span>
                  {m.hint ? <span className={styles.noteMeta}>{m.hint}</span> : null}
                </a>
              </li>
            ))
          )}
        </ul>
        <p className={styles.paletteHint}>
          <kbd>Enter</kbd> opens the first match. <kbd>Esc</kbd> closes.
        </p>
      </div>
    </div>
  );
}

/** ⌘K command palette: a glass dialog that filters screens. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return open ? <Palette onClose={onClose} /> : null;
}
