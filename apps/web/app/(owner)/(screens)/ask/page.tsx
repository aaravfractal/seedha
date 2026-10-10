"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { AskAnswer, AskQuestion } from "@/lib/types";
import type { MorningLine } from "@/lib/types-owner";
import { ErrorState, Loading } from "@/components/States";
import { CalcNote, Screen, ui } from "@/components/owner/ui";
import { useReducedMotion } from "@/components/owner/motion";
import k from "./ask.module.css";

type Bubble = { id: number; who: "me" | "bot"; hi: string; en: string; foot?: string };

export default function AskPage() {
  const questions = useApi<AskQuestion[]>("ask");
  const morning = useApi<MorningLine>("ask/morning");
  const reduced = useReducedMotion();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [english, setEnglish] = useState(false);
  const chat = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [bubbles, reduced]);

  function push(bubble: Omit<Bubble, "id">) {
    const id = nextId.current;
    nextId.current += 1;
    setBubbles((list) => [...list, { ...bubble, id }]);
  }

  async function ask(q: AskQuestion) {
    setBusy(true);
    push({ who: "me", hi: q.hi, en: q.en });
    try {
      const a = await postJson<AskAnswer>(`ask/${q.key}`);
      push({ who: "bot", hi: a.answer, en: a.answer_en, foot: a.source });
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "No connection. Try again.";
      push({ who: "bot", hi: text, en: text });
    } finally {
      setBusy(false);
    }
  }

  const lang = english ? "en" : "hi-Latn";
  return (
    <Screen title="Ask on WhatsApp." sub="Six questions. Exact answers from your statements.">
      <div className={k.top}>
        <button type="button" className={ui.linkBtn} onClick={() => setEnglish(!english)}>
          {english ? "Hindi mein dikhao" : "Show in English"}
        </button>
      </div>
      <div className={k.phone}>
        <div className={k.bar}>
          <span className={k.avatar} aria-hidden="true">
            S
          </span>
          <span className={k.who}>
            <b>Seedha</b>
            <span>Business account</span>
          </span>
        </div>
        <div
          className={k.chat}
          ref={chat}
          role="log"
          aria-live="polite"
          aria-label="Chat with Seedha"
          lang={lang}
        >
          <span className={k.day}>Today, 8:00 AM</span>
          {morning.error ? (
            <div className={`${k.msg} ${k.bot}`}>The 8 AM line did not load. {morning.error.message}</div>
          ) : morning.data ? (
            <div className={`${k.msg} ${k.bot}`}>
              {english ? morning.data.en : morning.data.hi}
              <span className={k.foot}>{morning.data.source}</span>
            </div>
          ) : (
            <span className={k.typing}>Seedha is typing</span>
          )}
          {bubbles.map((b) => (
            <div key={b.id} className={`${k.msg} ${b.who === "me" ? k.me : k.bot}`}>
              {english ? b.en : b.hi}
              {b.foot ? <span className={k.foot}>{b.foot}</span> : null}
            </div>
          ))}
          {busy ? <span className={k.typing}>Seedha is typing</span> : null}
        </div>
        {questions.error ? (
          <div className={k.replies}>
            <ErrorState
              message={questions.error.message}
              code={questions.error.code}
              onRetry={questions.reload}
            />
          </div>
        ) : !questions.data ? (
          <div className={k.replies}>
            <Loading rows={1} label="Loading questions" />
          </div>
        ) : (
          <div className={k.replies} role="group" aria-label="Quick replies" lang={lang}>
            {questions.data.map((q) => (
              <button
                key={q.key}
                type="button"
                className={k.reply}
                disabled={busy}
                onClick={() => void ask(q)}
              >
                {english ? q.en : q.hi}
              </button>
            ))}
          </div>
        )}
      </div>
      <CalcNote>
        Every number comes from your own statements and bookings. The wording never changes a number.
      </CalcNote>
    </Screen>
  );
}
