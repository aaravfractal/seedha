"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api } from "@/lib/api";
import { checkDetails, fieldForCode, taxId } from "@/lib/settingsRules";
import type { DetailsErrors, DetailsForm } from "@/lib/settingsRules";
import type { SettingsData } from "@/lib/types-settings";
import { useToast } from "@/components/Toast";
import { SampleChip } from "@/components/owner/ui";
import s from "./settings.module.css";

const LABELS: { key: keyof DetailsForm; label: string; optional?: boolean; hint?: string }[] = [
  { key: "name", label: "Your name" },
  { key: "email", label: "Email", optional: true },
  { key: "business_name", label: "Business name", optional: true },
  { key: "gstin", label: "GSTIN", optional: true, hint: "15 characters, like 05ABCDE1234F1Z5." },
  { key: "pan", label: "PAN", optional: true, hint: "10 characters, like ABCDE1234F." },
  { key: "address", label: "Business address", optional: true },
  { key: "pin", label: "PIN code", optional: true, hint: "6 digits." },
];

function formOf(data: SettingsData): DetailsForm {
  const p = data.personal;
  return {
    name: p.name,
    email: p.email ?? "",
    business_name: p.business_name ?? "",
    gstin: p.gstin ?? "",
    pan: p.pan ?? "",
    address: p.address ?? "",
    pin: p.pin ?? "",
  };
}

function ReadOnly({ data }: { data: SettingsData }) {
  const p = data.personal;
  const rows: [string, string | null][] = [
    ["Name", p.name],
    ["Mobile", p.mobile ?? "Not set for the sample hotel"],
    ["Email", p.email],
    ["Business name", p.business_name],
    ["GSTIN", p.gstin],
    ["PAN", p.pan],
    ["Address", p.address],
    ["PIN code", p.pin],
  ];
  return (
    <>
      <p className={s.note}>
        {p.sample ? <SampleChip /> : null}
        <span>{data.note}</span>
      </p>
      <div className={s.list}>
        {rows.map(([label, value]) => (
          <div className={`${s.row} ${s.stackPhone}`} key={label}>
            <span className={s.rowLabel}>{label}</span>
            <span className={s.rowValue}>{value ?? "Not given"}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Personal details: read-only sample values for the demo, a form for accounts. */
export function PersonalTab({
  data,
  onSaved,
}: {
  data: SettingsData;
  onSaved: (next: SettingsData) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<DetailsForm>(() => formOf(data));
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  if (data.read_only) return <ReadOnly data={data} />;

  function set(key: keyof DetailsForm, value: string) {
    setForm((f) => ({ ...f, [key]: key === "gstin" || key === "pan" ? taxId(value) : value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const found = checkDetails(form);
    setErrors(found);
    if (Object.keys(found).length) {
      setStatus("Some fields need a look.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const next = await api<SettingsData>("settings/personal", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, name: form.name.trim() }),
      });
      onSaved(next);
      setForm(formOf(next));
      setStatus("Details saved.");
      toast("Details saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        const field = fieldForCode(err.code);
        if (field && field !== "mobile" && field !== "role") setErrors({ [field]: err.message });
        setStatus(err.message);
      } else setStatus("That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`${s.list} ${s.form}`} style={{ padding: 22 }} onSubmit={save} noValidate>
      <p className={s.help}>{data.note} GSTIN and PAN are optional.</p>
      <div className={s.grid2}>
        {LABELS.slice(0, 1).map((f) => (
          <Field key={f.key} f={f} value={form[f.key]} error={errors[f.key]} onChange={set} />
        ))}
        <div className={s.field}>
          <label className={s.label} htmlFor="set-mobile">
            Mobile
          </label>
          <input
            id="set-mobile"
            className={s.input}
            value={data.personal.mobile ?? ""}
            readOnly
            aria-describedby="set-mobile-h"
          />
          <p className={s.help} id="set-mobile-h">
            Your sign-in number. Changing it is planned.
          </p>
        </div>
        {LABELS.slice(1).map((f) => (
          <Field key={f.key} f={f} value={form[f.key]} error={errors[f.key]} onChange={set} />
        ))}
      </div>
      <div className={s.sheetActions} style={{ marginTop: 4 }}>
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "Saving" : "Save details"}
        </button>
        <span className={s.small} role="status" aria-live="polite" style={{ alignSelf: "center" }}>
          {status}
        </span>
      </div>
    </form>
  );
}

function Field({
  f,
  value,
  error,
  onChange,
}: {
  f: (typeof LABELS)[number];
  value: string;
  error?: string;
  onChange: (key: keyof DetailsForm, value: string) => void;
}) {
  const id = `set-${f.key}`;
  const described = error ? `${id}-e` : f.hint ? `${id}-h` : undefined;
  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {f.label} {f.optional ? <span className={s.opt}>(optional)</span> : null}
      </label>
      <input
        id={id}
        className={s.input}
        value={value}
        onChange={(e) => onChange(f.key, e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        autoComplete={
          f.key === "name" ? "name" : f.key === "email" ? "email" : f.key === "pin" ? "postal-code" : "off"
        }
        inputMode={f.key === "pin" ? "numeric" : f.key === "email" ? "email" : undefined}
        maxLength={
          f.key === "address"
            ? 240
            : f.key === "gstin"
              ? 15
              : f.key === "pan"
                ? 10
                : f.key === "pin"
                  ? 6
                  : 120
        }
        spellCheck={false}
      />
      {error ? (
        <p className={s.error} id={`${id}-e`}>
          {error}
        </p>
      ) : f.hint ? (
        <p className={s.help} id={`${id}-h`}>
          {f.hint}
        </p>
      ) : null}
    </div>
  );
}
