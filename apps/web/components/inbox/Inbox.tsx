"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import type {
  InboxDraft,
  InboxFilter,
  SimulatedIncoming,
  Thread,
  ThreadDetail,
  Threads,
  Away,
} from "@/lib/types-inbox";
import { sentNote, threadFromQuery } from "@/lib/inboxRules";
import { ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { useDialogFocus } from "@/components/useDialogFocus";
import { AwayDialog, ForgetDialog, SimulateDialog } from "./Dialogs";
import { Profile } from "./Profile";
import { ThreadView } from "./ThreadView";
import { avatarFill, initials, listTime } from "./format";
import styles from "./Inbox.module.css";

const FILTERS: ReadonlyArray<readonly [InboxFilter, string]> = [
  ["all", "All"],
  ["unread", "Unread"],
  ["auto", "Auto-replied"],
  ["open", "Window open"],
];
const POLL_MS = 6000;

function message(err: unknown): string {
  return err instanceof ApiError ? err.message : "That did not work. Try again.";
}

function preview(t: Thread): string {
  if (!t.last) return "No messages yet";
  const who = t.last.sent_by === "away" ? "Away: " : t.last.direction === "out" ? "You: " : "";
  return `${who}${t.last.body}`;
}

function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1180px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/** The away switch (role=switch) in the page header. */
function AwaySwitch({
  away,
  busy,
  onToggle,
  onEdit,
}: {
  away: Away;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={styles.awayRow}>
      <button
        type="button"
        role="switch"
        aria-checked={away.enabled}
        className={styles.away}
        disabled={busy}
        onClick={onToggle}
      >
        <span className={styles.awayDot} aria-hidden="true" />
        {away.enabled ? "Away · bot on" : "Away · bot off"}
      </button>
      <button type="button" className={styles.textBtn} onClick={onEdit}>
        {away.text ? "Edit away message" : "Write away message"}
      </button>
    </div>
  );
}

/** The header's overflow menu: demo tools for the sample hotel. */
function MoreMenu({ busy, onSimulate }: { busy: boolean; onSimulate: () => void }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);
  return (
    <div className={styles.moreWrap} ref={wrap}>
      <button
        ref={button}
        type="button"
        className={styles.more}
        aria-label="More inbox actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="inboxMore"
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open ? (
        <div className={styles.moreMenu} id="inboxMore" role="menu" aria-label="More inbox actions">
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              onSimulate();
            }}
          >
            Simulate incoming message
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Inbox() {
  const toast = useToast();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");
  const threads = useApi<Threads>(`inbox/threads?filter=${filter}`);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  const [detailError, setDetailError] = useState<ApiError | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dialog, setDialog] = useState<"away" | "forget" | "simulate" | null>(null);
  const [busy, setBusy] = useState(false);
  const wide = useWide();
  const profileRef = useRef<HTMLDivElement>(null);
  const reloadThreads = threads.reload;
  const setThreads = threads.setData;

  const opened = useRef(false);

  // Remember the open thread in the address bar, so /inbox?thread=<id> deep-links to it.
  const showInUrl = useCallback((id: number | null) => {
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete("thread");
    else url.searchParams.set("thread", String(id));
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const loadDetail = useCallback(
    async (id: number, markRead: boolean) => {
      try {
        const d = await api<ThreadDetail>(`inbox/threads/${id}/messages`);
        setDetail(d);
        setDetailError(null);
        if (markRead && d.thread.unread > 0) {
          await postJson(`inbox/threads/${id}/read`);
          reloadThreads();
        }
      } catch (err) {
        setDetailError(err instanceof ApiError ? err : new ApiError(0, "error", "That did not load"));
      }
    },
    [reloadThreads],
  );

  // Pick up new guest messages (webhook) while the page is open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      reloadThreads();
      if (selected !== null) void loadDetail(selected, true);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [selected, loadDetail, reloadThreads]);

  // Deep link: /inbox?thread=<consent id> opens that thread once on arrival.
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    const id = threadFromQuery(window.location.search);
    if (id === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    setSelected(id);
    void loadDetail(id, true);
  }, [loadDetail]);

  // Tablet: the profile slides over the thread; Escape closes it.
  useDialogFocus(profileRef, profileOpen && !wide, () => setProfileOpen(false));

  const visible = useMemo(() => {
    const list = threads.data?.threads ?? [];
    const needle = query.trim().toLowerCase();
    return needle ? list.filter((t) => t.guest_name.toLowerCase().includes(needle)) : list;
  }, [threads.data, query]);

  function choose(id: number) {
    setDetail(null);
    setDetailError(null);
    setProfileOpen(false);
    setSelected(id);
    showInUrl(id);
    void loadDetail(id, true);
  }

  function clearSelection() {
    setSelected(null);
    setDetail(null);
    setProfileOpen(false);
    showInUrl(null);
  }

  /** Sample hotel demo: one realistic guest text arrives through the webhook path. */
  async function simulateIncoming() {
    setBusy(true);
    try {
      const got = await postJson<SimulatedIncoming>("inbox/simulate");
      reloadThreads();
      toast(`New message from ${got.guest_name}`);
      choose(got.consent_id);
    } catch (err) {
      toast(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveAway(body: { text?: string; approved?: boolean; enabled?: boolean }, note: string) {
    setBusy(true);
    try {
      const away = await api<Away>("inbox/away", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (threads.data) setThreads({ ...threads.data, away });
      setDialog(null);
      toast(note);
    } catch (err) {
      toast(message(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleAway() {
    const away = threads.data?.away;
    if (!away) return;
    if (away.enabled) return void saveAway({ enabled: false }, "Away replies are off");
    if (!away.text) return setDialog("away");
    void saveAway({ enabled: true }, "Away replies are on");
  }

  async function send(body: string): Promise<boolean> {
    if (selected === null) return false;
    try {
      const d = await postJson<ThreadDetail>(`inbox/threads/${selected}/messages`, { body });
      setDetail(d);
      reloadThreads();
      toast(sentNote(threads.data?.simulated ?? true));
      return true;
    } catch (err) {
      toast(message(err));
      return false;
    }
  }

  async function draft(): Promise<InboxDraft | null> {
    if (selected === null) return null;
    try {
      return await postJson<InboxDraft>(`inbox/threads/${selected}/draft`);
    } catch (err) {
      toast(message(err));
      return null;
    }
  }

  async function simulate(text: string) {
    if (selected === null) return;
    setBusy(true);
    try {
      const d = await postJson<ThreadDetail | null>(`inbox/threads/${selected}/simulate`, { text });
      setDialog(null);
      if (d === null) {
        toast("The guest sent STOP and is opted out. The thread is closed.");
        clearSelection();
      } else {
        setDetail(d);
      }
      reloadThreads();
    } catch (err) {
      toast(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    if (selected === null) return;
    setBusy(true);
    try {
      await postJson(`inbox/threads/${selected}/forget`, { confirm: true });
      setDialog(null);
      clearSelection();
      reloadThreads();
      toast("Guest forgotten. Their number and messages are deleted.");
    } catch (err) {
      toast(message(err));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className={styles.head}>
      <div>
        <h2 className="title">Guest inbox.</h2>
        <p className="sub">WhatsApp with guests who said yes at the Desk. Bot drafts, you send.</p>
      </div>
      {threads.data ? (
        <div className={styles.headTools}>
          <AwaySwitch
            away={threads.data.away}
            busy={busy}
            onToggle={toggleAway}
            onEdit={() => setDialog("away")}
          />
          {threads.data.is_sample ? (
            <MoreMenu busy={busy} onSimulate={() => void simulateIncoming()} />
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (threads.error && !threads.data) {
    return (
      <>
        {header}
        <ErrorState message={threads.error.message} code={threads.error.code} onRetry={threads.reload} />
      </>
    );
  }
  if (!threads.data) {
    return (
      <>
        {header}
        <Loading rows={4} label="Loading guest conversations" />
      </>
    );
  }

  const data = threads.data;
  const none = data.counts.all === 0 && filter === "all" && !query;
  const view = selected !== null ? "thread" : "list";

  return (
    <>
      {header}
      <div className={styles.panel} data-view={view}>
        <section className={styles.list} aria-label="Guests">
          <div className={styles.listHead}>
            <div className={styles.listTitle}>
              <h3>Guests</h3>
              <span className={styles.listMeta}>{data.counts.all} consented</span>
            </div>
            <label className={styles.search}>
              <span aria-hidden="true">⌕</span>
              <span className="sr-only-text">Search guests</span>
              <input
                type="search"
                placeholder="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className={styles.filters} role="group" aria-label="Filter guests">
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={styles.filter}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                  <span>{data.counts[key]}</span>
                </button>
              ))}
            </div>
            <p className={styles.section}>Consented at Desk</p>
          </div>
          {visible.length === 0 ? (
            <div className={styles.empty}>
              {none ? (
                <>
                  <h4>No guest conversations yet.</h4>
                  <p>Guests appear here after they say yes at the Desk. Their WhatsApp replies land here.</p>
                  <Link className="btn small" href="/desk">
                    Open Seedha Desk
                  </Link>
                </>
              ) : (
                <p>No guests match.</p>
              )}
            </div>
          ) : (
            <ul className={styles.rows}>
              {visible.map((t) => (
                <li key={t.consent_id}>
                  <button
                    type="button"
                    className={styles.row}
                    aria-current={selected === t.consent_id}
                    onClick={() => choose(t.consent_id)}
                  >
                    <span
                      className={styles.avatar}
                      style={{ background: avatarFill(t.consent_id) }}
                      aria-hidden="true"
                    >
                      {initials(t.guest_name)}
                      <i className={`${styles.presence} ${t.window_open ? styles.open : ""}`} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className={styles.rowTop}>
                        <span className={styles.rowName}>{t.guest_name}</span>
                        {t.last ? <span className={styles.rowTime}>{listTime(t.last.at)}</span> : null}
                      </span>
                      <span className={styles.rowPrev}>
                        <span>{preview(t)}</span>
                        {t.unread ? (
                          <span className={styles.badge}>
                            {t.unread}
                            <span className="sr-only-text"> unread</span>
                          </span>
                        ) : null}
                      </span>
                      {t.auto_replied || t.window_open ? (
                        <span className={styles.rowTag} style={{ display: "flex", gap: 6 }}>
                          {t.auto_replied ? <span className="tag">Auto-replied</span> : null}
                          {t.window_open ? <span className="tag ok">Can reply</span> : null}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.listFoot}>Guests found through OTA statements never appear here.</p>
        </section>

        {selected === null ? (
          <section className={`${styles.thread}`} aria-label="Conversation">
            <div className={styles.empty}>
              <h4>{none ? "Nothing to read yet." : "Choose a guest."}</h4>
              <p>
                {none
                  ? "When a consented guest writes on WhatsApp, the conversation opens here."
                  : "Pick a conversation on the left to read and reply."}
              </p>
            </div>
          </section>
        ) : detailError ? (
          <section className={styles.thread} aria-label="Conversation">
            <div className={styles.empty}>
              <h4>That did not load</h4>
              <p>{detailError.message}</p>
              <button type="button" className="btn small" onClick={clearSelection}>
                Back to guests
              </button>
            </div>
          </section>
        ) : !detail ? (
          <section className={styles.thread} aria-label="Conversation" style={{ padding: 18 }}>
            <Loading rows={3} label="Loading the conversation" />
          </section>
        ) : (
          <ThreadView
            key={detail.thread.consent_id}
            detail={detail}
            rateCard={data.rate_card}
            onBack={clearSelection}
            onInfo={() => setProfileOpen(!profileOpen)}
            infoOpen={profileOpen}
            onSend={send}
            onDraft={draft}
            onSimulate={() => setDialog("simulate")}
          />
        )}

        {detail && selected !== null ? (
          <>
            <div className={styles.scrim} data-open={profileOpen} onClick={() => setProfileOpen(false)} />
            <div ref={profileRef} style={{ display: "contents" }}>
              <Profile
                detail={detail}
                open={profileOpen}
                onClose={() => setProfileOpen(false)}
                onForget={() => setDialog("forget")}
              />
            </div>
          </>
        ) : wide ? (
          <aside className={styles.profile} aria-label="Guest details">
            <p className={styles.note}>
              Guest details appear here: consent, what Seedha remembers and stays.
            </p>
          </aside>
        ) : null}
      </div>

      {dialog === "away" ? (
        <AwayDialog
          initial={data.away.text ?? ""}
          busy={busy}
          onSave={(text) =>
            void saveAway({ text, approved: true, enabled: true }, "Away message approved and on")
          }
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "forget" && detail ? (
        <ForgetDialog
          name={detail.thread.guest_name}
          busy={busy}
          onConfirm={() => void forget()}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog === "simulate" && detail ? (
        <SimulateDialog
          name={detail.thread.short_name}
          busy={busy}
          onSend={(text) => void simulate(text)}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
