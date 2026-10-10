"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Notifications, SettingsData } from "@/lib/types-settings";
import { useToast } from "@/components/Toast";
import { Modal } from "./Modal";
import { Switch } from "./Switch";
import s from "./settings.module.css";

const SWITCHES: { key: keyof Notifications; label: string; hint: string }[] = [
  {
    key: "morning_line",
    label: "8 AM line",
    hint: "One Hindi line on WhatsApp with yesterday's money kept.",
  },
  { key: "close_slip", label: "9 PM close slip", hint: "The day's close, printed on the Desk at 9 PM." },
  { key: "approvals", label: "Approvals", hint: "A nudge when a win-back message waits for your approval." },
];

/** Notifications: three switches, stored per account (and for the demo session). */
export function NotificationsTab({
  data,
  onSaved,
}: {
  data: SettingsData;
  onSaved: (n: Notifications) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<keyof Notifications | null>(null);
  const n = data.notifications;

  async function flip(key: keyof Notifications, next: boolean) {
    setBusy(key);
    onSaved({ ...n, [key]: next });
    try {
      onSaved(
        await api<Notifications>("settings/notifications", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ [key]: next }),
        }),
      );
    } catch (err) {
      onSaved(n);
      toast(err instanceof ApiError ? err.message : "That did not save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className={s.list}>
        {SWITCHES.map((sw) => (
          <Switch
            key={sw.key}
            label={sw.label}
            hint={sw.hint}
            checked={n[sw.key]}
            disabled={busy === sw.key}
            onChange={(next) => void flip(sw.key, next)}
          />
        ))}
      </div>
      <p className={s.help} style={{ marginTop: 8 }}>
        {data.kind === "demo"
          ? "Saved for this demo session. WhatsApp sends are simulated for the sample hotel."
          : "Saved to your account. WhatsApp sends are simulated until a WhatsApp key is added."}
      </p>
    </>
  );
}

function dateTime(iso: string | null): string {
  if (!iso) return "Not recorded";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function endSession(push: (href: string) => void): Promise<void> {
  try {
    await fetch("/api/session", { method: "DELETE" });
  } finally {
    push("/login");
  }
}

/** Security: only what is true in this build; the rest says Planned (D8). */
export function SecurityTab({ data }: { data: SettingsData }) {
  const router = useRouter();
  const sec = data.security;
  const demo = sec.sign_in === "demo";
  return (
    <>
      <div className={s.list}>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Sign-in</span>
            <span className={s.rowHint}>
              {demo
                ? "Direct beta login into the sample hotel."
                : `A one-time code on WhatsApp to ${sec.mobile ?? "your number"}.`}
            </span>
          </span>
          <span className={s.on}>On</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Two-step sign-in</span>
            <span className={s.rowHint}>A second check after the WhatsApp code.</span>
          </span>
          <span className={s.planned}>Planned</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Idle check</span>
            <span className={s.rowHint}>
              After {sec.idle_minutes} minutes without input Seedha asks if you are still there.
            </span>
          </span>
          <span className={s.on}>On</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Encrypted at rest</span>
            <span className={s.rowHint}>Database encryption on the server.</span>
          </span>
          <span className={s.planned}>Planned</span>
        </div>
      </div>

      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>Sessions</h2>
      </div>
      <div className={s.list}>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>This browser</span>
            <span className={s.rowHint}>
              {demo ? "Sample hotel session" : "Signed in with your WhatsApp number"}
            </span>
          </span>
          <button type="button" className="btn ghost small" onClick={() => void endSession(router.push)}>
            Sign out
          </button>
        </div>
        {!demo ? (
          <>
            <div className={`${s.row} ${s.stackPhone}`}>
              <span className={s.rowLabel}>Account created</span>
              <span className={`${s.rowValue} ${s.plain}`}>{dateTime(sec.account_created_at)}</span>
            </div>
            <div className={`${s.row} ${s.stackPhone}`}>
              <span className={s.rowLabel}>First sign-in</span>
              <span className={`${s.rowValue} ${s.plain}`}>{dateTime(sec.first_verified_at)}</span>
            </div>
          </>
        ) : null}
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Sign out on other devices</span>
            <span className={s.rowHint}>Signing out here ends this browser only.</span>
          </span>
          <span className={s.planned}>Planned</span>
        </div>
      </div>
    </>
  );
}

/** Privacy and data: cookies, consent log, download, delete account. */
export function PrivacyTab({ data }: { data: SettingsData }) {
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const demo = data.kind === "demo";

  async function download() {
    setDownloading(true);
    try {
      const body = await api<unknown>("settings/export");
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "seedha-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("Your data is downloading.");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not download. Try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api("settings/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      await endSession(router.push);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not delete. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className={s.list}>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Cookies</span>
            <span className={s.rowHint}>
              Necessary only: your sign-in cookie, and a theme cookie if you pick light or dark. No tracking.
            </span>
          </span>
          <span className={s.on}>Necessary only</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Guest consent logged</span>
            <span className={s.rowHint}>Every Desk consent, sealed each night.</span>
          </span>
          <Link className={s.textBtn} href="/proof">
            Consent log
          </Link>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>No OTA scraping</span>
            <span className={s.rowHint}>Seedha reads only the statements you upload.</span>
          </span>
          <span className={s.on}>True</span>
        </div>
        <div className={s.row}>
          <span className={s.rowText}>
            <span className={s.rowLabel}>Download my data</span>
            <span className={s.rowHint}>Your account, settings and staff invites as a JSON file.</span>
          </span>
          <button
            type="button"
            className="btn ghost small"
            disabled={downloading}
            onClick={() => void download()}
          >
            {downloading ? "Preparing" : "Download"}
          </button>
        </div>
      </div>

      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>Delete account</h2>
      </div>
      <div className={s.list} style={{ padding: 22 }}>
        <p className={s.sheetBody}>
          {demo
            ? "The sample hotel has no account to delete. Sign in with your own number to manage your account."
            : "Deletes your Seedha login, business details and staff invites. The hotel's statements and guest consents stay as they are."}
        </p>
        <div className={s.sheetActions}>
          <button
            type="button"
            className={`btn ghost ${s.danger}`}
            disabled={demo}
            onClick={() => setConfirm(true)}
          >
            Delete account
          </button>
        </div>
      </div>
      {confirm ? (
        <Modal title="Delete your account?" alert onClose={() => setConfirm(false)}>
          <p className={s.sheetBody}>
            You will be signed out. Your login, business details and staff invites are deleted and cannot be
            brought back.
          </p>
          <div className={s.sheetActions}>
            <button
              type="button"
              className={`btn ${s.dangerSolid}`}
              disabled={busy}
              onClick={() => void remove()}
            >
              {busy ? "Deleting" : "Yes, delete my account"}
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>
              Keep my account
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
