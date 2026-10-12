"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import b from "./build.module.css";
import o from "./owner.module.css";

/** The parts of the Web Speech API this button uses (not in every TypeScript DOM lib). */
type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative };
type ResultEvent = { resultIndex: number; results: { length: number; [index: number]: Result } };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

type SpeechLang = "hi-IN" | "en-IN";
const LANGS: ReadonlyArray<[SpeechLang, string, string]> = [
  ["hi-IN", "हिंदी", "hi"],
  ["en-IN", "English", "en"],
];

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

function errorMessage(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed") {
    return "The microphone is blocked for this page. Allow it in the browser, or type instead.";
  }
  if (code === "no-speech") return "We did not hear anything. Tap Speak and try again.";
  if (code === "audio-capture") return "No microphone found. You can type instead.";
  if (code === "network") return "Speech needs an internet connection here. You can type instead.";
  return "Speech did not work this time. You can type instead.";
}

/**
 * Speak instead of typing, in Hindi or English. The browser's own speech
 * recognition turns speech into text and `onText` appends it to the box.
 * Seedha never receives or keeps audio; it only gets the text in the box.
 * Hidden, with a typed-fallback note, where the browser has no recognition.
 */
export function MicButton({
  onText,
  disabled = false,
}: {
  onText: (text: string) => void;
  disabled?: boolean;
}) {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [lang, setLang] = useState<SpeechLang>("hi-IN");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const emit = useRef(onText);
  useEffect(() => {
    emit.current = onText;
  }, [onText]);
  useEffect(() => () => recognition.current?.abort(), []);

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result) continue;
        const text = result[0].transcript.trim();
        if (result.isFinal) {
          if (text) emit.current(text);
        } else interim += `${text} `;
      }
      setHeard(interim.trim());
    };
    r.onerror = (event) => {
      if (event.error !== "aborted") setError(errorMessage(event.error));
    };
    r.onend = () => {
      setListening(false);
      setHeard("");
      recognition.current = null;
    };
    setError("");
    try {
      r.start();
      recognition.current = r;
      setListening(true);
    } catch {
      setError(errorMessage("start"));
    }
  }

  function stop() {
    recognition.current?.stop();
  }

  if (!supported) {
    return (
      <p className={b.hint}>
        Speaking is not available in this browser, so please type. Chrome on Android or a computer lets you
        speak in Hindi or English.
      </p>
    );
  }
  return (
    <div className={b.field}>
      <div className={b.mic}>
        <button
          type="button"
          className={`btn ghost ${b.micBtn}`}
          aria-pressed={listening}
          disabled={disabled}
          onClick={listening ? stop : start}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
          </svg>
          {listening ? "Stop" : "Speak"}
        </button>
        <div className={o.seg} role="group" aria-label="Speaking language">
          {LANGS.map(([key, label, htmlLang]) => (
            <button
              key={key}
              type="button"
              lang={htmlLang}
              aria-pressed={lang === key}
              disabled={listening || disabled}
              onClick={() => setLang(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className={b.heard} aria-live="polite">
        {listening ? heard || "Listening… speak now." : ""}
      </p>
      {error ? (
        <p className={b.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={b.hint}>
        Your browser turns speech into text (Chrome may use Google&apos;s speech service). Seedha gets only
        the text, never the audio.
      </p>
    </div>
  );
}
