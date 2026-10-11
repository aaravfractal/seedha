"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useApi } from "@/lib/api";
import type { SettingsData } from "@/lib/types-settings";
import { ErrorState, Loading } from "@/components/States";
import { Screen } from "@/components/owner/ui";
import { NotificationsTab, PrivacyTab, SecurityTab } from "@/components/settings/AccountTabs";
import { ContractsTab, HotelTab, PlanTab } from "@/components/settings/HotelTabs";
import { PersonalTab } from "@/components/settings/PersonalTab";
import { ProofWalletNotice } from "@/components/settings/ProofWalletNotice";
import { StaffTab } from "@/components/settings/StaffTab";
import s from "@/components/settings/settings.module.css";

const TABS = [
  { key: "personal", label: "Personal details" },
  { key: "hotel", label: "Hotel" },
  { key: "plan", label: "Plan and billing" },
  { key: "contracts", label: "Contracts" },
  { key: "staff", label: "Staff logins" },
  { key: "notifications", label: "Notifications" },
  { key: "security", label: "Security" },
  { key: "privacy", label: "Privacy and data" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsPage() {
  const settings = useApi<SettingsData>("settings");
  const [tab, setTab] = useState<TabKey>("personal");
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const i = TABS.findIndex((t) => t.key === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const key = TABS[next]!.key;
    setTab(key);
    refs.current[key]?.focus();
  }

  const data = settings.data;
  return (
    <Screen title="Settings." sub={data ? `${data.hotel.name}, ${data.hotel.town}` : undefined}>
      <ProofWalletNotice />
      <div className={s.tabs} role="tablist" aria-label="Settings sections" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[t.key] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            className={s.tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0}>
        {settings.error && !data ? (
          <ErrorState message={settings.error.message} code={settings.error.code} onRetry={settings.reload} />
        ) : !data ? (
          <Loading rows={3} label="Loading settings" />
        ) : tab === "personal" ? (
          <PersonalTab key={data.kind} data={data} onSaved={settings.setData} />
        ) : tab === "hotel" ? (
          <HotelTab data={data} />
        ) : tab === "plan" ? (
          <PlanTab />
        ) : tab === "contracts" ? (
          <ContractsTab />
        ) : tab === "staff" ? (
          <StaffTab />
        ) : tab === "notifications" ? (
          <NotificationsTab data={data} onSaved={(n) => settings.setData({ ...data, notifications: n })} />
        ) : tab === "security" ? (
          <SecurityTab data={data} />
        ) : (
          <PrivacyTab data={data} />
        )}
      </div>
    </Screen>
  );
}
