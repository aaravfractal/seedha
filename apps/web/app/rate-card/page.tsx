"use client";

import Link from "next/link";
import { useApi } from "@/lib/api";
import { inr } from "@/lib/format";
import type { OwnerSite } from "@/lib/types-site";
import { Photo } from "@/components/site/HotelSite";
import { WorldBMessage } from "@/components/site/WorldBMessage";
import p from "@/components/site/print.module.css";
import s from "@/components/site/worldb.module.css";

/** A4 rate card for travel agents, from the same API prices as the site. One printed page. */
export default function RateCardPage() {
  const site = useApi<OwnerSite>("site");
  if (site.error)
    return (
      <WorldBMessage title="The rate card did not load." body={site.error.message} onRetry={site.reload} />
    );
  if (!site.data) return <WorldBMessage title="Preparing the rate card" loading />;
  const d = site.data;
  const packages = d.packages.filter((x) => x.approved);
  const year = Number((d.published_at ?? new Date().toISOString()).slice(0, 4));
  return (
    <div className={p.desk}>
      <div className={p.toolbar}>
        <Link href="/site">‹ Website</Link>
        <span className={p.hint}>Prices from your rooms and approved packages.</span>
        <button type="button" className={p.primary} onClick={() => window.print()}>
          Print or save as PDF
        </button>
      </div>
      <article
        className={`${s.wb} ${p.sheet}`}
        data-mood={d.mood}
        lang="en"
        aria-label={`${d.hotel} rate card`}
      >
        <div className={p.strip} aria-hidden="true">
          <Photo background="var(--wb-hero)" label="Sample photo · view" />
          <Photo background="linear-gradient(160deg,#BBA98A,#7E6E5C)" label="Deluxe room" />
          <Photo background="linear-gradient(160deg,#DCC08E,#B5834A)" label="Breakfast" />
        </div>
        <div className={p.sheetBody}>
          <div className={p.titleRow}>
            <div>
              <h1 className={`${s.display} ${p.title}`}>{d.hotel}</h1>
              <p className={s.muted}>
                {d.location.en}, Uttarakhand · {d.rooms_count} rooms
              </p>
            </div>
            <p className={p.right}>
              Rate card {year} to {String(year + 1).slice(2)}
              <br />
              Prices per night, in ₹
            </p>
          </div>

          <h2 className={s.display}>Rooms</h2>
          <table className={p.table}>
            <thead>
              <tr>
                <th scope="col">Room</th>
                <th scope="col">Includes</th>
                <th scope="col">Per night</th>
              </tr>
            </thead>
            <tbody>
              {d.rooms.map((r) => (
                <tr key={r.room_type}>
                  <td>{r.room_type}</td>
                  <td>{r.detail.en.replace(" · ", ", ")}</td>
                  <td>{inr(r.nightly_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className={s.display}>Packages</h2>
          {packages.length ? (
            <table className={p.table}>
              <thead>
                <tr>
                  <th scope="col">Package</th>
                  <th scope="col">Includes</th>
                  <th scope="col">Price</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((x) => (
                  <tr key={x.key}>
                    <td>{x.name.en}</td>
                    <td>{x.includes.en}</td>
                    <td>{inr(x.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={s.muted}>Packages coming soon. Approve them on the Website screen.</p>
          )}

          <div className={p.twoCol}>
            <div>
              <h2 className={s.display}>Nearby</h2>
              <table className={p.table}>
                <tbody>
                  {d.nearby.map((n) => (
                    <tr key={n.place.en}>
                      <td>{n.place.en}</td>
                      <td>{n.distance.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h2 className={s.display}>Book direct</h2>
              <table className={p.table}>
                <tbody>
                  <tr>
                    <td>WhatsApp or call</td>
                    <td>{d.contact.phone}</td>
                  </tr>
                  <tr>
                    <td>Advance by UPI</td>
                    <td>{d.contact.upi}</td>
                  </tr>
                  <tr>
                    <td>Website</td>
                    <td>{d.address}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className={p.sheetFoot}>
            <span>
              {d.contact.placeholder ? "Contact, UPI and website are placeholders. Sample data. " : ""}
              Packages add value; room prices stay as listed.
            </span>
            <span>Made with Seedha</span>
          </div>
        </div>
      </article>
    </div>
  );
}
