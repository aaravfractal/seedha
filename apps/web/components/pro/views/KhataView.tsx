"use client";

import { useApi } from "@/lib/api";
import { count, inr } from "@/lib/format";
import type { AgentRow, Khata } from "@/lib/types-pro";
import { ErrorState, Loading } from "@/components/States";
import s from "./proCalc.module.css";

function Cells({ row }: { row: AgentRow }) {
  return (
    <>
      <td>{count(row.bookings)}</td>
      <td>{count(row.room_nights)}</td>
      <td>{inr(row.lines.list_amount)}</td>
      <td>{inr(row.lines.commission)}</td>
      <td>{inr(row.lines.net_kept)}</td>
    </>
  );
}

/** Agent khata: travel-agent rows from the register, grouped under sample agent names. */
export function KhataView() {
  const { data, error, loading, reload } = useApi<Khata>("pro/khata");
  if (error) return <ErrorState message={error.message} code={error.code} onRetry={reload} />;
  if (loading || !data) return <Loading rows={4} label="Loading the agent khata" />;
  return (
    <div className={s.view}>
      <div className={s.head}>
        <p className={s.lead}>
          Every travel-agent booking in your register, with the commission each agent took. Your register has
          no agent names, so the names are samples.
        </p>
      </div>
      <div className={s.tableWrap}>
        <table className={s.table}>
          <caption>Travel agents, April to September 2026</caption>
          <thead>
            <tr>
              <th scope="col">Agent</th>
              <th scope="col">Bookings</th>
              <th scope="col">Room nights</th>
              <th scope="col">List</th>
              <th scope="col">Commission</th>
              <th scope="col">You kept</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.agent}>
                <th scope="row">{row.agent}</th>
                <Cells row={row} />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">{data.totals.agent}</th>
              <Cells row={data.totals} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
