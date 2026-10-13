"use client";

import { useId, useState } from "react";
import { AMENITY_IDS } from "@/lib/amenities";
import type { AmenityId } from "@/lib/amenities";
import { AMENITY_GROUPS, DETAIL_LIMITS, amenityLabel, matchesAmenity } from "@/lib/siteDetails";
import { Block } from "./fields";
import d from "./details.module.css";

/** Pick from the fixed 40 amenities, grouped, with a search box. */
export function AmenitiesEditor({
  value,
  error,
  onChange,
}: {
  value: AmenityId[];
  error?: string;
  onChange: (next: AmenityId[]) => void;
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const chosen = new Set(value);
  const groups = AMENITY_GROUPS.map((g) => ({
    ...g,
    ids: g.ids.filter((id) => matchesAmenity(id, query)),
  })).filter((g) => g.ids.length > 0);

  function toggle(id: AmenityId, on: boolean) {
    const next = new Set(chosen);
    if (on) next.add(id);
    else next.delete(id);
    onChange(AMENITY_IDS.filter((a) => next.has(a)));
  }

  return (
    <Block
      id="details-amenities"
      title="Amenities"
      count={`${value.length} of ${DETAIL_LIMITS.amenities} chosen`}
      hint="Tick what your hotel really has. Your site shows the first 12 and a button for the rest."
    >
      <div className={`${d.field} ${d.search}`}>
        <label className={d.label} htmlFor={searchId}>
          Search amenities
        </label>
        <input
          id={searchId}
          className={d.input}
          type="search"
          value={query}
          placeholder="For example: parking"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {groups.length === 0 ? (
        <p className={d.hint} role="status">
          No amenity matches “{query.trim()}”.
        </p>
      ) : (
        groups.map((g) => (
          <fieldset key={g.title} className={d.group}>
            <legend>{g.title}</legend>
            <ul className={d.chips}>
              {g.ids.map((id) => {
                const label = amenityLabel(id);
                return (
                  <li key={id}>
                    <label className={d.chip}>
                      <input
                        type="checkbox"
                        checked={chosen.has(id)}
                        onChange={(e) => toggle(id, e.target.checked)}
                      />
                      <span className={d.chipText}>
                        <span>{label.en}</span>
                        <small lang="hi" className={d.deva}>
                          {label.hi}
                        </small>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))
      )}
      {error ? <p className={d.error}>{error}</p> : null}
    </Block>
  );
}
