"use client";

import { useId, useMemo, useState } from "react";
import { useApi } from "@/lib/api";
import { count, inr } from "@/lib/format";
import { DEBOUNCE_MS, displacementPath, groupErrors } from "@/lib/proViews";
import type { GroupInput } from "@/lib/proViews";
import { useDebounced } from "@/lib/useDebounced";
import type { Displacement } from "@/lib/types-pro";
import { ErrorState, Loading } from "@/components/States";
import s from "./proCalc.module.css";

/** Until the hotel's room count loads, the sample hotel's 22 rooms. */
const FALLBACK_ROOMS = 22;

function Field({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className={s.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p className={s.fieldError} id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Group displacement: a direct group's net against the regular rooms it pushes out. */
export function DisplacementView() {
  const id = useId();
  const [input, setInput] = useState<GroupInput>({ rooms: "10", rate: "3000", nights: "2" });
  const hotel = useApi<{ rooms_count: number }>("property");
  const limits = useMemo(() => ({ maxRooms: hotel.data?.rooms_count ?? FALLBACK_ROOMS }), [hotel.data]);
  const settled = useDebounced(input, DEBOUNCE_MS);
  const errors = useMemo(() => groupErrors(input, limits), [input, limits]);
  const path = displacementPath(settled, limits);
  const { data, error, loading, reload } = useApi<Displacement>(path);
  const set = (key: keyof GroupInput) => (next: string) => setInput((prev) => ({ ...prev, [key]: next }));
  const stale = loading || settled !== input;
  return (
    <div className={s.view}>
      <div className={s.head}>
        <p className={s.lead}>
          A group fills rooms you might have sold anyway. This compares what the group leaves you with what
          the rooms it pushes out would have kept, from your last 7 nights.
        </p>
      </div>
      <div className={s.fields}>
        <Field
          id={`${id}-rooms`}
          label="Group rooms"
          value={input.rooms}
          error={errors.rooms}
          onChange={set("rooms")}
        />
        <Field
          id={`${id}-rate`}
          label="Group rate per room night, in rupees"
          value={input.rate}
          error={errors.rate}
          onChange={set("rate")}
        />
        <Field
          id={`${id}-nights`}
          label="Nights"
          value={input.nights}
          error={errors.nights}
          onChange={set("nights")}
        />
      </div>
      {error ? <ErrorState message={error.message} code={error.code} onRetry={reload} /> : null}
      {!data && !error ? <Loading rows={2} label="Working out the group" /> : null}
      {data ? (
        <div className={stale ? s.busy : undefined} aria-busy={stale} aria-live="polite">
          <dl className={s.result}>
            <div>
              <dt>
                Group, booked direct: {count(data.group_rooms)} rooms x {count(data.nights)} nights at{" "}
                {inr(data.group_rate)}
              </dt>
              <dd className={s.num}>{inr(data.group_net)}</dd>
            </div>
            <div>
              <dt>
                Rooms pushed out: {count(data.rooms_pushed_out)} a night ({count(data.free_rooms)} of{" "}
                {count(data.rooms_count)} were free on an average night)
              </dt>
              <dd className={s.num}>{inr(-data.displaced_net)}</dd>
            </div>
            <div>
              <dt>
                {data.difference >= 0 ? "The group leaves you more by" : "The group leaves you less by"}
              </dt>
              <dd className={`${s.num} ${data.difference >= 0 ? s.yes : s.no}`}>
                {inr(Math.abs(data.difference))}
              </dd>
            </div>
          </dl>
          <p className={s.note}>
            Pushed-out rooms use your average of {inr(data.average_net_per_room_night)} kept per room night
            over the last {count(data.nights_sampled)} nights.
          </p>
        </div>
      ) : null}
    </div>
  );
}
