"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { AuthFrame, errorMessage, styles } from "../login/AuthFrame";

type Onboarding = {
  sample: boolean;
  saved: boolean;
  note: string;
  property_name: string;
  town: string;
  rooms: number | null;
  contracts: Record<ContractKey, number>;
  cost_per_room: number | null;
  whatsapp_connected: boolean;
  whatsapp_mode: "simulated";
  done: boolean;
};

type ContractKey = "mmt" | "bcom" | "agoda" | "ta";

const CHANNELS: ReadonlyArray<{ key: ContractKey; label: string }> = [
  { key: "mmt", label: "MakeMyTrip" },
  { key: "bcom", label: "Booking.com" },
  { key: "agoda", label: "Agoda" },
  { key: "ta", label: "Travel agents" },
];

const STEPS = ["Property", "Commission contracts", "Cost per occupied room", "Connect WhatsApp"] as const;

function percentOk(text: string): boolean {
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(text.trim())) return false;
  const value = Number(text);
  return value >= 0 && value <= 50;
}

export default function OnboardPage() {
  const [state, setState] = useState<Onboarding | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [town, setTown] = useState("");
  const [rooms, setRooms] = useState("");
  const [rates, setRates] = useState<Record<ContractKey, string>>({
    mmt: "22",
    bcom: "18",
    agoda: "20",
    ta: "10",
  });
  const [cost, setCost] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const heading = useRef<HTMLParagraphElement>(null);
  const router = useRouter();

  useEffect(() => {
    let live = true;
    fetch("/api/auth/onboarding", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/login?next=/onboard");
          return;
        }
        if (!res.ok) throw new Error(await errorMessage(res));
        const body = (await res.json()) as Onboarding;
        if (!live) return;
        setState(body);
        setName(body.property_name);
        setTown(body.town);
        setRooms(body.rooms === null ? "" : String(body.rooms));
        setRates({
          mmt: String(body.contracts.mmt),
          bcom: String(body.contracts.bcom),
          agoda: String(body.contracts.agoda),
          ta: String(body.contracts.ta),
        });
        setCost(body.cost_per_room === null ? "" : String(body.cost_per_room));
      })
      .catch((e: unknown) => {
        if (live) setLoadError(e instanceof Error ? e.message : "Could not load your setup. Try again.");
      });
    return () => {
      live = false;
    };
  }, [router]);

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const roomsNumber = Number(rooms);
  const stepValid = [
    name.trim().length >= 2 &&
      town.trim().length >= 2 &&
      Number.isInteger(roomsNumber) &&
      roomsNumber >= 1 &&
      roomsNumber <= 500,
    CHANNELS.every((c) => percentOk(rates[c.key])),
    cost.trim() === "" || (/^\d{1,6}$/.test(cost.trim()) && Number(cost) <= 100000),
    true,
  ][step];

  async function save(body: Record<string, unknown>): Promise<Onboarding | null> {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        router.replace("/login?next=/onboard");
        return null;
      }
      if (!res.ok) {
        setError(await errorMessage(res));
        return null;
      }
      const next = (await res.json()) as Onboarding;
      setState(next);
      return next;
    } catch {
      setError("No connection. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function bodyForStep(): Record<string, unknown> {
    if (step === 0) return { property_name: name.trim(), town: town.trim(), rooms: roomsNumber };
    if (step === 1) {
      return { contracts: Object.fromEntries(CHANNELS.map((c) => [c.key, Number(rates[c.key])])) };
    }
    if (step === 2) return cost.trim() === "" ? { clear_cost: true } : { cost_per_room: Number(cost) };
    return {};
  }

  async function next(event: FormEvent) {
    event.preventDefault();
    if (!stepValid) return;
    if (step < STEPS.length - 1) {
      if (await save(bodyForStep())) setStep(step + 1);
      return;
    }
    if (await save({ finish: true })) {
      setOpening(true);
      router.push("/upload");
    }
  }

  if (loadError) {
    return (
      <AuthFrame title="Set up Seedha" backHref="/home" backLabel="Back to Overview">
        <p className={styles.error} role="alert">
          {loadError}
        </p>
        <button type="button" className={styles.primary} onClick={() => window.location.reload()}>
          Try again
        </button>
      </AuthFrame>
    );
  }

  if (!state || opening) {
    return (
      <AuthFrame title={opening ? "All set" : "Set up Seedha"} backHref="/home" backLabel="Back to Overview">
        <div className={styles.loading} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          {opening ? "Opening your dashboard" : "Loading your setup"}
        </div>
      </AuthFrame>
    );
  }

  const readOnly = state.sample;

  return (
    <AuthFrame
      title="Set up Seedha"
      sub="Four short steps. You can change these later in Settings."
      backHref="/home"
      backLabel="Back to Overview"
    >
      <div
        className={styles.progress}
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-valuenow={step + 1}
        aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
      >
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <p className={styles.stepLabel} ref={heading} tabIndex={-1} id="onboard-step">
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </p>
      {readOnly ? <p className={styles.notice}>{state.note}</p> : null}

      <form onSubmit={next} noValidate>
        {step === 0 ? (
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className={styles.label} htmlFor="ob-name">
              Property name
            </label>
            <input
              id="ob-name"
              className={styles.input}
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
            <div className={styles.grid2}>
              <div>
                <label className={styles.label} htmlFor="ob-town">
                  Town
                </label>
                <input
                  id="ob-town"
                  className={styles.input}
                  value={town}
                  maxLength={80}
                  placeholder="e.g. Mussoorie"
                  onChange={(e) => setTown(e.target.value)}
                />
              </div>
              <div>
                <label className={styles.label} htmlFor="ob-rooms">
                  Rooms
                </label>
                <input
                  id="ob-rooms"
                  className={styles.input}
                  inputMode="numeric"
                  value={rooms}
                  maxLength={3}
                  placeholder="10 to 40"
                  onChange={(e) => setRooms(e.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        {step === 1 ? (
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className={styles.hint} style={{ margin: 0 }}>
              Commission in your contract with each channel, before GST.
            </legend>
            <div className={styles.grid2}>
              {CHANNELS.map((c) => (
                <div key={c.key}>
                  <label className={styles.label} htmlFor={`ob-${c.key}`}>
                    {c.label}
                  </label>
                  <div className={styles.phone} data-invalid={percentOk(rates[c.key]) ? undefined : "true"}>
                    <input
                      id={`ob-${c.key}`}
                      className={styles.input}
                      inputMode="decimal"
                      value={rates[c.key]}
                      maxLength={5}
                      onChange={(e) => setRates({ ...rates, [c.key]: e.target.value })}
                      aria-invalid={percentOk(rates[c.key]) ? undefined : true}
                    />
                    <span className={styles.suffix} aria-hidden="true">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ) : null}

        {step === 2 ? (
          <fieldset disabled={readOnly} style={{ border: 0, margin: 0, padding: 0 }}>
            <label className={styles.label} htmlFor="ob-cost">
              Cost per occupied room <span className={styles.optional}>(optional)</span>
            </label>
            <div className={styles.phone}>
              <span className={styles.prefix} aria-hidden="true">
                ₹
              </span>
              <input
                id="ob-cost"
                className={styles.input}
                inputMode="numeric"
                value={cost}
                maxLength={6}
                placeholder="Leave empty to skip"
                onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
                aria-describedby="ob-cost-hint"
              />
            </div>
            <p id="ob-cost-hint" className={styles.hint}>
              Linen, power and breakfast for one occupied night. Used later to show what each booking leaves
              after costs.
            </p>
          </fieldset>
        ) : null}

        {step === 3 ? (
          <div>
            <p className={styles.hint} style={{ marginTop: 0 }}>
              Seedha sends you a morning line and the 9 PM close on WhatsApp. Guests get messages only after
              they say yes at your desk and you approve each one.
            </p>
            {state.whatsapp_connected ? (
              <p className={styles.connected} id="ob-wa-connected">
                ✓ WhatsApp connected (simulated)
              </p>
            ) : (
              <button
                type="button"
                className={styles.secondary}
                style={{ marginTop: 12 }}
                disabled={busy || readOnly}
                onClick={() => void save({ connect_whatsapp: true })}
              >
                Connect WhatsApp
              </button>
            )}
            <p className={styles.hint}>
              Simulated in this build: no WhatsApp account is linked and no message is sent.
            </p>
          </div>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert" id="onboard-error">
            {error}
          </p>
        ) : null}

        <div className={styles.row}>
          {step > 0 ? (
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setStep(step - 1)}
              disabled={busy}
            >
              Back
            </button>
          ) : null}
          <button id="onboard-next" type="submit" className={styles.primary} disabled={busy || !stepValid}>
            {step === STEPS.length - 1
              ? "Continue to upload"
              : step === 2 && cost.trim() === ""
                ? "Skip"
                : "Continue"}
          </button>
        </div>
      </form>
    </AuthFrame>
  );
}
