"use client";

import { useState } from "react";
import { ApiError, api, useApi } from "@/lib/api";
import type { GuestRewardSettings } from "@/lib/types-site-v2-owner";
import { useToast } from "@/components/Toast";
import { Switch } from "./Switch";
import s from "./settings.module.css";

const REWARDS: { key: keyof GuestRewardSettings; label: string; hint: string }[] = [
  { key: "breakfast", label: "Free breakfast", hint: "Any guest who leaves feedback can choose it" },
  { key: "pct5", label: "5% off your next direct stay", hint: "Verified guests only, one-time private code" },
  {
    key: "flat100",
    label: "₹100 off your next direct stay",
    hint: "Verified guests only, one-time private code",
  },
];

/** Settings, Hotel tab: which rewards guests may pick when they leave feedback on the card page. */
export function GuestRewardsSetting() {
  const loaded = useApi<GuestRewardSettings>("settings/rewards");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = loaded.data;

  async function save(key: keyof GuestRewardSettings, on: boolean) {
    if (!data) return;
    setBusy(true);
    try {
      loaded.setData(
        await api<GuestRewardSettings>("settings/rewards", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...data, [key]: on }),
        }),
      );
      const label = REWARDS.find((r) => r.key === key)?.label ?? "Reward";
      toast(`${label} is now ${on ? "on" : "off"}.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save guest rewards");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="guest-rewards-title">
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle} id="guest-rewards-title">
          Guest rewards
        </h2>
      </div>
      <div className={s.list}>
        {REWARDS.map((r) => (
          <Switch
            key={r.key}
            label={r.label}
            hint={r.hint}
            checked={data ? data[r.key] : false}
            disabled={!data || busy}
            onChange={(next) => void save(r.key, next)}
          />
        ))}
      </div>
      <p className={s.help} style={{ marginTop: 8 }}>
        Check your OTA contracts before offering direct discounts.
      </p>
      {loaded.error && !data ? <p className={s.error}>{loaded.error.message}</p> : null}
    </section>
  );
}
