"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError, api, postJson, useApi } from "@/lib/api";
import { fieldForCode, mobileDigits } from "@/lib/settingsRules";
import type { StaffData, StaffMember, StaffRole } from "@/lib/types-settings";
import { EmptyState, ErrorState, Loading } from "@/components/States";
import { useToast } from "@/components/Toast";
import { Chip, SampleChip } from "@/components/owner/ui";
import { Modal } from "./Modal";
import s from "./settings.module.css";

const ROLES: { value: StaffRole; label: string }[] = [
  { value: "front_desk", label: "Front desk" },
  { value: "manager", label: "Manager" },
  { value: "accounts", label: "Accounts" },
];
const roleLabel = (r: StaffRole) => ROLES.find((x) => x.value === r)?.label ?? r;

type Errors = { name?: string; mobile?: string; role?: string };

/** Staff logins: list, invite (recorded only, nothing is sent) and remove. */
export function StaffTab() {
  const res = useApi<StaffData>("settings/staff");
  const toast = useToast();
  const [name, setName] = useState("");
  const [role, setRole] = useState<StaffRole>("front_desk");
  const [mobile, setMobile] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<StaffMember | null>(null);

  if (res.error && !res.data)
    return <ErrorState message={res.error.message} code={res.error.code} onRetry={res.reload} />;
  if (!res.data) return <Loading rows={2} label="Loading staff" />;
  const data = res.data;

  async function invite(e: FormEvent) {
    e.preventDefault();
    const found: Errors = {};
    if (name.trim().length < 2) found.name = "Enter the staff member's name.";
    const digits = mobileDigits(mobile);
    if (!digits) found.mobile = "Enter a 10 digit Indian mobile number.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      res.setData(await postJson<StaffData>("settings/staff", { name: name.trim(), role, mobile: digits }));
      toast(`Invite recorded for ${name.trim()}. Nothing was sent.`);
      setName("");
      setMobile("");
    } catch (err) {
      if (err instanceof ApiError) {
        const field = fieldForCode(err.code);
        if (field === "name" || field === "mobile" || field === "role") setErrors({ [field]: err.message });
        else toast(err.message);
      } else toast("That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(member: StaffMember) {
    if (member.id === null) return;
    setBusy(true);
    try {
      res.setData(await api<StaffData>(`settings/staff/${member.id}`, { method: "DELETE" }));
      toast(`${member.name} removed.`);
      setRemoving(null);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p className={s.note}>
        {data.read_only ? <SampleChip /> : null}
        <span>{data.note}</span>
      </p>
      {data.staff.length === 0 ? (
        <EmptyState title="No staff logins yet.">
          Invite your front desk so they can run check-in and checkout.
        </EmptyState>
      ) : (
        <div className={s.list}>
          {data.staff.map((m) => (
            <div className={s.row} key={m.id ?? m.name}>
              <span className={s.rowText}>
                <span className={s.rowLabel}>{m.name}</span>
                <span className={s.rowHint}>
                  {roleLabel(m.role)} · {m.mobile}
                </span>
              </span>
              {m.status === "sample" ? (
                <SampleChip />
              ) : (
                <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <Chip>Invite recorded</Chip>
                  <button type="button" className={s.textBtn} onClick={() => setRemoving(m)}>
                    Remove
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>Invite staff</h2>
      </div>
      <form className={`${s.list} ${s.form}`} style={{ padding: 22 }} onSubmit={invite} noValidate>
        <fieldset disabled={data.read_only || busy} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
          <div className={s.grid2}>
            <div className={s.field}>
              <label className={s.label} htmlFor="staff-name">
                Name
              </label>
              <input
                id="staff-name"
                className={s.input}
                value={name}
                maxLength={80}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
                aria-invalid={errors.name ? true : undefined}
                aria-describedby={errors.name ? "staff-name-e" : undefined}
              />
              {errors.name ? (
                <p className={s.error} id="staff-name-e">
                  {errors.name}
                </p>
              ) : null}
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="staff-role">
                Role
              </label>
              <select
                id="staff-role"
                className={s.select}
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                aria-invalid={errors.role ? true : undefined}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              {errors.role ? <p className={s.error}>{errors.role}</p> : null}
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="staff-mobile">
                Mobile
              </label>
              <input
                id="staff-mobile"
                className={s.input}
                value={mobile}
                inputMode="tel"
                autoComplete="off"
                maxLength={16}
                onChange={(e) => setMobile(e.target.value)}
                aria-invalid={errors.mobile ? true : undefined}
                aria-describedby={errors.mobile ? "staff-mobile-e" : "staff-mobile-h"}
              />
              {errors.mobile ? (
                <p className={s.error} id="staff-mobile-e">
                  {errors.mobile}
                </p>
              ) : (
                <p className={s.help} id="staff-mobile-h">
                  10 digits, starting with 6, 7, 8 or 9.
                </p>
              )}
            </div>
          </div>
          <div className={s.sheetActions}>
            <button type="submit" className="btn">
              {busy ? "Saving" : "Record invite"}
            </button>
          </div>
        </fieldset>
        <p className={s.help}>Staff sign-in is planned. Recording an invite sends no SMS or WhatsApp.</p>
      </form>
      {removing ? (
        <Modal title={`Remove ${removing.name}?`} alert onClose={() => setRemoving(null)}>
          <p className={s.sheetBody}>Their invite is deleted from your staff list.</p>
          <div className={s.sheetActions}>
            <button type="button" className="btn" disabled={busy} onClick={() => void remove(removing)}>
              Remove
            </button>
            <button type="button" className="btn ghost" onClick={() => setRemoving(null)}>
              Keep
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
