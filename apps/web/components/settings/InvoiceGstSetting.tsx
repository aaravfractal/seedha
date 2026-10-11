"use client";

import { useState } from "react";
import { ApiError, api, useApi } from "@/lib/api";
import { bpsLabel } from "@/lib/invoice";
import type { InvoiceSettings } from "@/lib/types-invoice";
import { useToast } from "@/components/Toast";
import s from "./settings.module.css";

/** Common GST rates on room tariff. The API accepts any rate from 0% to 28%. */
const PRESETS: { bps: number; hint: string }[] = [
  { bps: 500, hint: "rooms up to ₹7,500 a night" },
  { bps: 1200, hint: "only if your accountant advises it" },
  { bps: 1800, hint: "rooms above ₹7,500 a night" },
  { bps: 0, hint: "rooms under ₹1,000 a night" },
];

/** Settings, Hotel tab: the GST rate stay invoices back out of what the guest paid. */
export function InvoiceGstSetting() {
  const loaded = useApi<InvoiceSettings>("settings/invoice");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const data = loaded.data;

  async function save(bps: number) {
    setBusy(true);
    try {
      loaded.setData(
        await api<InvoiceSettings>("settings/invoice", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ room_gst_bps: bps }),
        }),
      );
      toast(`Stay invoices now use GST at ${bpsLabel(bps)}.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not save the GST rate");
    } finally {
      setBusy(false);
    }
  }

  const options =
    data && !PRESETS.some((p) => p.bps === data.room_gst_bps)
      ? [...PRESETS, { bps: data.room_gst_bps, hint: "saved rate" }]
      : PRESETS;

  return (
    <>
      <div className={s.sectionHead}>
        <h2 className={s.sectionTitle}>Stay invoices</h2>
      </div>
      <div className={s.list} style={{ padding: 22 }}>
        <div className={s.field}>
          <label className={s.label} htmlFor="room-gst">
            GST on room tariff
          </label>
          <select
            id="room-gst"
            className={s.select}
            value={data ? String(data.room_gst_bps) : ""}
            disabled={!data || busy}
            aria-describedby="room-gst-help"
            onChange={(e) => void save(Number(e.target.value))}
          >
            {!data ? <option value="">{loaded.error ? "Not loaded" : "Loading"}</option> : null}
            {options.map((p) => (
              <option key={p.bps} value={String(p.bps)}>
                {`${bpsLabel(p.bps)}, ${p.hint}`}
              </option>
            ))}
          </select>
          <p className={s.help} id="room-gst-help">
            Invoices treat GST as included in what the guest paid and split it into CGST and SGST.
            {data?.is_default ? " Using the 5% default." : ""} Confirm the rate with your accountant.
          </p>
          {loaded.error && !data ? <p className={s.error}>{loaded.error.message}</p> : null}
        </div>
      </div>
    </>
  );
}
