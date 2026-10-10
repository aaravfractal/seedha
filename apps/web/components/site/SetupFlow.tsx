"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { inr } from "@/lib/format";
import type { OwnerSite } from "@/lib/types-site";
import o from "./owner.module.css";

const STEPS = ["Photos", "Hindi voice note", "Rooms and prices", "Nearby places", "Contact and UPI"];
const THUMBS = [
  "linear-gradient(160deg,#8fa8bc,#5e7566)",
  "linear-gradient(160deg,#a89a86,#7e6e5c)",
  "linear-gradient(160deg,#dcc08e,#b5834a)",
  "linear-gradient(160deg,#9a938c,#6e665e)",
  "linear-gradient(160deg,#6f9a72,#3b5a40)",
  "linear-gradient(160deg,#d9a38e,#8a5e6e)",
  "linear-gradient(160deg,#b7c4cf,#7d8f9e)",
  "linear-gradient(160deg,#c9b99a,#8c7a5f)",
];
const BUILD_MS = 2400;

type Ask = "photos" | "record" | "voice" | "rooms" | "nearby" | "contact" | null;
type Item = { me: boolean; body: ReactNode };

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Thumbs({ from, count }: { from: number; count: number }) {
  return (
    <div className={o.thumbs} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ background: THUMBS[(from + i) % THUMBS.length] }} />
      ))}
    </div>
  );
}

/**
 * The WhatsApp setup, five questions one at a time. These are the sample
 * hotel's answers (rule 11); room prices come from the API. Nothing is
 * published here: the owner reviews and taps Publish site later (rule 9).
 */
export function SetupFlow({
  site,
  onReview,
  busy,
}: {
  site: OwnerSite;
  onReview: () => void;
  busy: boolean;
}) {
  const { setup } = site;
  const item = (me: boolean, body: ReactNode): Item => ({ me, body });
  const [items, setItems] = useState<Item[]>(() => [
    item(
      false,
      <>
        Namaste {site.owner_name} ji. Let us build your website. 1 of 5: please send 8 to 10 photos of rooms,
        view, food and the building.
      </>,
    ),
    item(
      true,
      <>
        <Thumbs from={0} count={setup.photos_sent} />
        <small>
          {setup.photos_sent} of {setup.photos_wanted} photos
        </small>
      </>,
    ),
    item(false, setup.photo_tip),
  ]);
  const [ask, setAsk] = useState<Ask>("photos");
  const [done, setDone] = useState(0);
  const [rooms, setRooms] = useState(() => new Set(site.rooms.map((r) => r.room_type)));
  const [nearby, setNearby] = useState(() => new Set(site.nearby.map((n) => n.place.en)));
  const [built, setBuilt] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const chat = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = timers.current;
    return () => list.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    const el = chat.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [items]);

  /** The owner answers; Seedha replies after a short pause. */
  function answer(mine: ReactNode, replies: ReactNode[], next: Ask, stepsDone: number) {
    setAsk(null);
    setItems((list) => [...list, item(true, mine)]);
    const t = setTimeout(
      () => {
        setItems((list) => [...list, ...replies.map((r) => item(false, r))]);
        setAsk(next);
        setDone(stepsDone);
        if (stepsDone === STEPS.length) build();
      },
      reducedMotion() ? 0 : 500,
    );
    timers.current.push(t);
  }

  function build() {
    if (reducedMotion()) {
      setBuilt(100);
      return;
    }
    const started = Date.now();
    const tick = () => {
      const pct = Math.min(100, Math.round(((Date.now() - started) / BUILD_MS) * 100));
      setBuilt(pct);
      if (pct < 100) timers.current.push(setTimeout(tick, 80));
    };
    tick();
  }

  const roomLine = site.rooms
    .filter((r) => rooms.has(r.room_type))
    .map((r) => `${r.room_type} ${inr(r.nightly_rate)}`)
    .join(" · ");
  const placeLine = site.nearby
    .filter((n) => nearby.has(n.place.en))
    .map((n) => `${n.place.en} ${n.distance.en}`)
    .join(" · ");
  const current = Math.min(done, STEPS.length - 1);

  function toggle(set: Set<string>, key: string, update: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key) && next.size > 1) next.delete(key);
    else next.add(key);
    update(next);
  }

  return (
    <div className={o.setup}>
      <div>
        <h2 className={o.h2}>Setup on WhatsApp</h2>
        <p className={o.sub}>Five questions, one at a time. About 5 minutes.</p>
        <ol className={o.stepper} aria-label="Setup steps">
          {STEPS.map((label, i) => {
            const state = i < done ? "done" : i === current ? "now" : "todo";
            return (
              <li
                key={label}
                className={state === "done" ? o.stepDone : state === "now" ? o.stepNow : undefined}
                aria-current={state === "now" ? "step" : undefined}
              >
                <span className={o.stepNum} aria-hidden="true">
                  {state === "done" ? "✓" : i + 1}
                </span>
                {label}
                <span className="sr-only-text">{state === "done" ? ", done" : ""}</span>
              </li>
            );
          })}
        </ol>
        {done === STEPS.length ? (
          <div className={o.card} style={{ marginTop: 24 }} role="status" aria-live="polite">
            <h3 className={o.cardTitle}>
              {built < 100 ? "Building your site" : "Your site is ready to check"}
            </h3>
            <div className={o.progress} aria-hidden="true">
              <i style={{ width: `${built}%` }} />
            </div>
            <p className={o.muted} style={{ margin: "0 0 16px", fontSize: 15 }}>
              {built < 100
                ? "Rooms, prices, photos and nearby places go into your pages."
                : "Nothing is online yet. You check it first."}
            </p>
            <button type="button" className="btn" disabled={built < 100 || busy} onClick={onReview}>
              Review my site
            </button>
          </div>
        ) : null}
      </div>

      <div className={o.phone}>
        <div className={o.waHead}>
          <span className={o.avatar} aria-hidden="true">
            S
          </span>
          <div>
            <b>Seedha</b>
            <small>
              Step {Math.min(done + 1, STEPS.length)} of {STEPS.length}
            </small>
          </div>
          <span className={o.dots} aria-hidden="true">
            {STEPS.map((label, i) => (
              <i key={label} data-on={i <= current || done === STEPS.length} />
            ))}
          </span>
        </div>
        <div ref={chat} className={o.chat} role="log" aria-live="polite" aria-label="Setup chat with Seedha">
          {items.map((it, i) => (
            // The chat only ever grows, so the position is a stable key.
            <div key={i} className={`${o.bub} ${it.me ? o.me : ""}`}>
              <span className="sr-only-text">{it.me ? "You: " : "Seedha: "}</span>
              {it.body}
            </div>
          ))}
        </div>
        {ask ? (
          <div className={o.quick} role="group" aria-label="Your reply">
            {ask === "photos" ? (
              <button
                type="button"
                className={o.send}
                onClick={() =>
                  answer(
                    <>
                      <Thumbs from={setup.photos_sent} count={setup.photos_wanted - setup.photos_sent} />
                      <small>
                        {setup.photos_wanted} of {setup.photos_wanted} photos
                      </small>
                    </>,
                    [
                      "Photos done. 2 of 5: send a short voice note in Hindi about your hotel. What should guests know?",
                    ],
                    "record",
                    1,
                  )
                }
              >
                Send {setup.photos_wanted - setup.photos_sent} more photos
              </button>
            ) : null}
            {ask === "record" ? (
              <button
                type="button"
                className={o.send}
                onClick={() =>
                  answer(
                    <span className={o.voice}>
                      <span aria-hidden="true">▶</span>
                      <span className={o.wave} aria-hidden="true" />
                      <span>Voice note, {setup.voice_length}</span>
                    </span>,
                    [<>Here is what I heard: {setup.voice_summary} Is that right?</>],
                    "voice",
                    1,
                  )
                }
              >
                Send voice note
              </button>
            ) : null}
            {ask === "voice" ? (
              <>
                <button
                  type="button"
                  className={o.send}
                  onClick={() =>
                    answer(
                      "Theek hai",
                      [
                        "3 of 5: which rooms do you have, and the normal price for one night? Tap a room to leave it out.",
                      ],
                      "rooms",
                      2,
                    )
                  }
                >
                  Theek hai
                </button>
                <button
                  type="button"
                  onClick={() =>
                    answer("Change", ["No problem. Send a new voice note when you are ready."], "record", 1)
                  }
                >
                  Change
                </button>
              </>
            ) : null}
            {ask === "rooms" ? (
              <>
                {site.rooms.map((r) => (
                  <button
                    key={r.room_type}
                    type="button"
                    aria-pressed={rooms.has(r.room_type)}
                    onClick={() => toggle(rooms, r.room_type, setRooms)}
                  >
                    {r.room_type} {inr(r.nightly_rate)}
                  </button>
                ))}
                <button
                  type="button"
                  className={o.send}
                  onClick={() =>
                    answer(roomLine, ["4 of 5: what is nearby? Tap a place to leave it out."], "nearby", 3)
                  }
                >
                  Send
                </button>
              </>
            ) : null}
            {ask === "nearby" ? (
              <>
                {site.nearby.map((n) => (
                  <button
                    key={n.place.en}
                    type="button"
                    aria-pressed={nearby.has(n.place.en)}
                    onClick={() => toggle(nearby, n.place.en, setNearby)}
                  >
                    {n.place.en}
                  </button>
                ))}
                <button
                  type="button"
                  className={o.send}
                  onClick={() =>
                    answer(
                      placeLine,
                      ["5 of 5: your WhatsApp number and UPI ID, for guests who pay an advance."],
                      "contact",
                      4,
                    )
                  }
                >
                  Send
                </button>
              </>
            ) : null}
            {ask === "contact" ? (
              <button
                type="button"
                className={o.send}
                onClick={() =>
                  answer(
                    `${site.contact.phone} · ${site.contact.upi}`,
                    ["Theek hai. Building your site now."],
                    null,
                    STEPS.length,
                  )
                }
              >
                Send {site.contact.phone} · {site.contact.upi}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
