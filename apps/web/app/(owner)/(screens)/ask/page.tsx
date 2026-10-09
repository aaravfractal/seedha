"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, postJson, useApi } from "@/lib/api";
import type { AskAnswer, AskQuestion, PropertyInfo } from "@/lib/types";
import { ErrorState, Loading } from "@/components/States";

type Bubble = { id: number; who: "me" | "bot"; text: string; foot?: string };

export default function AskPage() {
  const questions = useApi<AskQuestion[]>("ask");
  const property = useApi<PropertyInfo>("property");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [english, setEnglish] = useState(false);
  const chat = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: "smooth" });
  }, [bubbles]);

  function push(bubble: Omit<Bubble, "id">) {
    const id = nextId.current;
    nextId.current += 1;
    setBubbles((list) => [...list, { ...bubble, id }]);
  }

  async function ask(q: AskQuestion) {
    setBusy(true);
    push({ who: "me", text: english ? q.en : q.hi });
    try {
      const a = await postJson<AskAnswer>(`ask/${q.key}`);
      push({ who: "bot", text: english ? a.answer_en : a.answer, foot: a.source });
    } catch (err) {
      push({
        who: "bot",
        text: err instanceof ApiError ? err.message : "No connection. Try again.",
        foot: "Seedha",
      });
    } finally {
      setBusy(false);
    }
  }

  const owner = property.data?.owner_name ?? "";
  return (
    <>
      <h2 className="title">Ask on WhatsApp.</h2>
      <p className="sub">Six questions, exact answers from your statements.</p>
      <button
        type="button"
        className="link"
        style={{ fontSize: 14, marginBottom: 12 }}
        onClick={() => setEnglish(!english)}
      >
        {english ? "Hindi mein dikhao" : "Show in English"}
      </button>
      <div className="wa" ref={chat} aria-live="polite" aria-label="Chat with Seedha">
        <div className="bub bot">
          {english
            ? `Namaste ${owner} ji. What would you like to know?`
            : `Namaste ${owner} ji. Kya jaanna hai?`}
          <span className="foot">Seedha</span>
        </div>
        {bubbles.map((b) => (
          <div key={b.id} className={`bub ${b.who}`}>
            {b.text}
            {b.foot ? <span className="foot">{b.foot}</span> : null}
          </div>
        ))}
      </div>
      {questions.error ? (
        <ErrorState
          message={questions.error.message}
          code={questions.error.code}
          onRetry={questions.reload}
        />
      ) : !questions.data ? (
        <Loading rows={1} label="Loading questions" />
      ) : (
        <div className="chips">
          {questions.data.map((q) => (
            <button key={q.key} type="button" className="chip" disabled={busy} onClick={() => ask(q)}>
              {english ? q.en : q.hi}
            </button>
          ))}
        </div>
      )}
      <p className="calc">
        Every number is calculated from your own statements and bookings. The wording never changes a number.
      </p>
    </>
  );
}
