"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OWNER_SCREENS, isCurrent } from "@/lib/screens";
import { timeLabel } from "@/lib/format-overview";
import type { OverviewItem } from "@/lib/types-overview";
import { useDialogFocus } from "@/components/useDialogFocus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Icon } from "./Icons";
import type { IconName } from "./Icons";
import { useShell } from "./ShellData";
import { useReadIds } from "./readState";
import { CommandPalette } from "./CommandPalette";
import { IdleDialog, SessionEnded } from "./SessionDialogs";
import { signOut } from "./signOut";
import styles from "./Shell.module.css";

const MODES = [
  { label: "Owner", href: "/home", match: (p: string) => OWNER_SCREENS.some((s) => isCurrent(p, s.href)) },
  { label: "Front desk", href: "/desk", match: (p: string) => isCurrent(p, "/desk") },
  { label: "Guest", href: "/link", match: (p: string) => p === "/link" },
];

type Pos = { top: number; right: number };

/** Where a popover opens: under its button, right edges aligned. */
function below(button: HTMLElement): Pos {
  const rect = button.getBoundingClientRect();
  return { top: rect.bottom + 10, right: Math.max(12, window.innerWidth - rect.right) };
}

/**
 * Close a popover on a click outside its button and panel, or on resize.
 * Popovers render in a portal on <body>: the header's own backdrop blur would
 * otherwise stop the popover's glass from blurring the page behind it.
 */
function useOutsideClose(refs: React.RefObject<HTMLElement | null>[], open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) return;
      if (refs.every((r) => !r.current?.contains(target))) close();
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", close);
    };
  }, [refs, open, close]);
}

function Notifications({ items }: { items: OverviewItem[] }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const open = pos !== null;
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [refs] = useState(() => [button, panel]);
  const { read, markRead } = useReadIds();
  const close = useCallback(() => setPos(null), []);
  useOutsideClose(refs, open, close);
  useDialogFocus(panel, open, close);
  const unread = items.filter((n) => !read.has(n.id)).length;

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.round}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => setPos(open ? null : below(e.currentTarget))}
      >
        <Icon name="bell" size={20} />
        {unread ? (
          <span className={styles.badge} aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>
      {pos
        ? createPortal(
            <div
              className={styles.popover}
              style={pos}
              ref={panel}
              role="dialog"
              aria-label="Notifications"
              tabIndex={-1}
            >
              <div className={styles.popHead}>
                <h2>Notifications</h2>
                <button
                  type="button"
                  className={styles.textBtn}
                  disabled={unread === 0}
                  onClick={() => markRead(items.map((n) => n.id))}
                >
                  Mark all read
                </button>
              </div>
              {items.length === 0 ? (
                <p className={styles.empty}>
                  Nothing new. Updates from your statements and the Desk show here.
                </p>
              ) : (
                <ul className={styles.list}>
                  {items.map((n) => {
                    const isUnread = !read.has(n.id);
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href}
                          className={styles.note}
                          onClick={() => {
                            markRead([n.id]);
                            close();
                          }}
                        >
                          <span className={isUnread ? styles.unread : undefined} aria-hidden="true" />
                          <span>
                            <span className={styles.noteTitle}>
                              {isUnread ? <span className="sr-only-text">Unread: </span> : null}
                              {n.title}
                            </span>
                            <span className={styles.noteMeta}>
                              {n.at ? `${timeLabel(n.at)} · ` : ""}
                              {n.detail}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

const MENU: { label: string; href: string; icon: IconName }[] = [
  { label: "Front desk mode", href: "/desk", icon: "desk" },
  { label: "Guest mode", href: "/link", icon: "guest" },
  { label: "Settings", href: "/settings", icon: "gear" },
  { label: "Security", href: "/security", icon: "diamond" },
  { label: "Plans", href: "/plans", icon: "card" },
  { label: "Help", href: "/faq", icon: "sparkle" },
];

function AccountMenu({ initials, name, hotel }: { initials: string; name: string; hotel: string }) {
  const [pos, setPos] = useState<Pos | null>(null);
  const open = pos !== null;
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [refs] = useState(() => [button, panel]);
  const router = useRouter();
  const close = useCallback(() => setPos(null), []);
  useOutsideClose(refs, open, close);
  useDialogFocus(panel, open, close);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={styles.avatar}
        aria-label={name ? `Account menu for ${name}` : "Account menu"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => setPos(open ? null : below(e.currentTarget))}
      >
        <span aria-hidden="true">{initials || "·"}</span>
      </button>
      {pos
        ? createPortal(
            <div
              className={`${styles.popover} ${styles.menu}`}
              style={pos}
              ref={panel}
              role="dialog"
              aria-label="Account"
              tabIndex={-1}
            >
              <div className={styles.menuWho}>
                <b>{name ? `${name} ji` : "Owner"}</b>
                <span>{hotel}</span>
              </div>
              <div className={styles.menuSep} />
              {MENU.map((m) => (
                <Link key={m.label} href={m.href} className={styles.menuItem} onClick={close}>
                  <Icon name={m.icon} />
                  {m.label}
                </Link>
              ))}
              <div className={styles.menuItem}>
                <span style={{ flex: 1 }}>Theme</span>
                <ThemeToggle />
              </div>
              <div className={styles.menuSep} />
              <button
                type="button"
                className={`${styles.menuItem} ${styles.signOut}`}
                onClick={() => {
                  close();
                  void signOut(router.push);
                }}
              >
                Sign out
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/**
 * The owner app header (SCREENS "Shared shell"): back, window dots, logo,
 * hotel chip, Owner | Front desk | Guest, ⌘K search, notifications, account.
 * Hotel, owner and notifications all come from GET /overview.
 */
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const shell = useShell(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const data = shell.data;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function back() {
    if (window.history.length > 1) router.back();
    else router.push("/home");
  }

  const hotel = data ? `${data.hotel.name} · ${data.hotel.rooms_count} rooms` : "";

  return (
    <>
      <header className={styles.header}>
        <div className={styles.bar}>
          <span className={styles.dots} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <button type="button" className={styles.round} onClick={back} aria-label="Back">
            <Icon name="back" size={20} />
          </button>
          <Link href="/home" className={styles.brand} aria-label="Seedha overview">
            <span className={styles.logo} aria-hidden="true">
              <i />
              <i />
            </span>
            <span className={styles.wordmark}>Seedha</span>
          </Link>
          {data ? (
            <span className={styles.chip} title={hotel}>
              <span>
                {hotel}
                {data.hotel.is_sample ? <span className="sr-only-text"> (sample data)</span> : null}
              </span>
            </span>
          ) : null}
          <span className={styles.spacer} />
          <nav className={styles.modes} aria-label="Mode">
            {MODES.map((m) => (
              <Link key={m.label} href={m.href} aria-current={m.match(pathname) ? "page" : undefined}>
                {m.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            className={styles.search}
            onClick={() => setPaletteOpen(true)}
            aria-label="Search Seedha"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Icon name="search" />
            <span>Search Seedha</span>
            <kbd>⌘K</kbd>
          </button>
          <button
            type="button"
            className={`${styles.round} ${styles.searchIcon}`}
            onClick={() => setPaletteOpen(true)}
            aria-label="Search Seedha"
          >
            <Icon name="search" size={18} />
          </button>
          <Notifications items={data?.notifications ?? []} />
          <AccountMenu
            initials={data?.owner.initials ?? ""}
            name={data?.owner.short_name ?? ""}
            hotel={data?.hotel.name ?? ""}
          />
        </div>
      </header>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <IdleDialog onStay={shell.reload} />
      {shell.error?.code === "login_required" ? <SessionEnded /> : null}
    </>
  );
}
