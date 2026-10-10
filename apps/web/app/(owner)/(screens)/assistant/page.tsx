"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { AssistantIntro, AssistantReply } from "@/lib/types-inbox";
import { ErrorState, Loading } from "@/components/States";
import styles from "./assistant.module.css";

type Turn =
  | { id: number; who: "me"; text: string }
  | { id: number; who: "bot"; reply: AssistantReply }
  | { id: number; who: "error"; text: string };

/** Seedha Assistant: owner questions answered only from computed ledger figures. */
export default function AssistantPage() {
  const intro = useApi<AssistantIntro>("assistant");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [chips, setChips] = useState<string[] | null>(null);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    end.current?.scrollIntoView({ block: "end", behavior: reduce ? "auto" : "smooth" });
  }, [turns, busy]);

  function newId(): number {
    const id = nextId.current;
    nextId.current += 1;
    return id;
  }

  function push(turn: Turn) {
    setTurns((list) => [...list, turn]);
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setText("");
    push({ id: newId(), who: "me", text: q });
    try {
      const reply = await postJson<AssistantReply>("assistant", { question: q });
      push({ id: newId(), who: "bot", reply });
      setChips(reply.suggestions);
    } catch (err) {
      push({
        id: newId(),
        who: "error",
        text: err instanceof ApiError ? err.message : "No connection. Try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void ask(text);
  }

  const header = (
    <>
      <h2 className="title">Seedha Assistant.</h2>
      <p className="sub">
        Ask about any number on your dashboard. Answers use only figures calculated from your statements.
      </p>
    </>
  );
  if (intro.error) {
    return (
      <>
        {header}
        <ErrorState message={intro.error.message} code={intro.error.code} onRetry={intro.reload} />
      </>
    );
  }
  if (!intro.data) {
    return (
      <>
        {header}
        <Loading rows={3} label="Loading the Assistant" />
      </>
    );
  }
  const suggestions = chips ?? intro.data.suggestions;

  return (
    <>
      {header}
      <div className={styles.card}>
        <div className={styles.reading}>
          <span>Reading:</span>
          {intro.data.reading.map((r) => (
            <span key={r} className={styles.pill}>
              {r}
            </span>
          ))}
        </div>
        <div className={styles.chat} role="log" aria-live="polite" aria-label="Chat with Seedha Assistant">
          <div className={`${styles.msg} ${styles.bot}`}>
            <span className={styles.avatar} aria-hidden="true">
              S
            </span>
            <div className={styles.bubble}>{intro.data.greeting}</div>
          </div>
          {turns.map((t) =>
            t.who === "me" ? (
              <div key={t.id} className={`${styles.msg} ${styles.me}`}>
                <div className={styles.bubble}>
                  <span className="sr-only-text">You asked: </span>
                  {t.text}
                </div>
              </div>
            ) : t.who === "error" ? (
              <div key={t.id} className={`${styles.msg} ${styles.bot}`} role="alert">
                <span className={styles.avatar} aria-hidden="true">
                  S
                </span>
                <div className={styles.bubble}>{t.text}</div>
              </div>
            ) : (
              <div key={t.id} className={`${styles.msg} ${styles.bot}`}>
                <span className={styles.avatar} aria-hidden="true">
                  S
                </span>
                <div className={styles.bubble}>
                  {t.reply.answer}
                  {t.reply.sources.length ? (
                    <div className={styles.sources}>
                      <span>Sources:</span>
                      {t.reply.sources.map((s) => (
                        <Link key={s.label} href={s.href} className={styles.source}>
                          {s.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {t.reply.figures.length ? (
                    <span className={styles.foot}>
                      Calculated from your statements
                      {t.reply.worded_by === "claude" ? " · worded by AI, numbers by Seedha" : ""}
                    </span>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {busy ? (
            <div className={`${styles.msg} ${styles.bot}`}>
              <span className={styles.avatar} aria-hidden="true">
                S
              </span>
              <span className={styles.typing} role="status" aria-label="Seedha is working it out">
                <i />
                <i />
                <i />
              </span>
            </div>
          ) : null}
          <div ref={end} />
        </div>
        <div className={styles.bottom}>
          <div className={styles.chips} role="group" aria-label="Suggested questions">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.chip}
                disabled={busy}
                onClick={() => void ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <form className={styles.form} onSubmit={submit}>
            <label htmlFor="askField" className="sr-only-text">
              Your question
            </label>
            <input
              id="askField"
              className={styles.input}
              value={text}
              maxLength={300}
              autoComplete="off"
              placeholder="Ask about your money"
              onChange={(e) => setText(e.target.value)}
            />
            <button type="submit" className={styles.send} aria-label="Ask" disabled={busy || !text.trim()}>
              ↑
            </button>
          </form>
        </div>
      </div>
      <p className={styles.footer}>
        From your statements. Every number is calculated by Seedha from your own rows. AI may reword a
        sentence, never a number.
      </p>
    </>
  );
}
