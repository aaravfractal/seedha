"use client";

import { DETAIL_LIMITS } from "@/lib/siteDetails";
import type { RoomDraft } from "@/lib/siteDetails";
import type { SitePhoto } from "@/lib/types-site";
import { Block, Choice, TextBox } from "./fields";
import d from "./details.module.css";

function photoName(photo: SitePhoto, index: number): string {
  return photo.caption_en ? `Photo ${index + 1}: ${photo.caption_en}` : `Photo ${index + 1}`;
}

/**
 * Room facts for each room type the hotel sells: size, beds, most guests, two
 * short features and a photo from the site's own photos. Prices are not here:
 * they come from the hotel's rooms and rates. Empty boxes are left off the site.
 */
export function RoomsEditor({
  rooms,
  photos,
  errors,
  onChange,
}: {
  rooms: RoomDraft[];
  photos: readonly SitePhoto[];
  errors: Record<string, string>;
  onChange: (next: RoomDraft[]) => void;
}) {
  const L = DETAIL_LIMITS;
  function set(i: number, patch: Partial<RoomDraft>) {
    onChange(rooms.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function setFeature(i: number, lang: "features_en" | "features_hi", k: 0 | 1, value: string) {
    const room = rooms[i];
    if (!room) return;
    const next: [string, string] = [...room[lang]];
    next[k] = value;
    set(i, { [lang]: next });
  }

  return (
    <Block
      id="details-rooms"
      title="Rooms"
      count={rooms.length ? `${rooms.length} room ${rooms.length === 1 ? "type" : "types"}` : undefined}
      hint="What guests see on each room card. Leave a box empty to leave it off. Prices come from your rooms and rates."
    >
      {rooms.length === 0 ? (
        <p className={d.hint}>No room types yet. They come from your rooms and rates.</p>
      ) : (
        <ol className={d.items}>
          {rooms.map((r, i) => {
            const e = (field: string) => errors[`rooms.${i}.${field}`];
            const known = photos.some((p) => String(p.id) === r.photo_id);
            const options: Array<readonly [string, string]> = [
              ["", "No photo"],
              ...photos.map((p, n) => [String(p.id), photoName(p, n)] as const),
              ...(r.photo_id && !known ? [[r.photo_id, "A photo no longer on your site"] as const] : []),
            ];
            const chosen = photos.find((p) => String(p.id) === r.photo_id);
            return (
              <li key={r.name} className={d.item}>
                <div className={d.itemHead}>
                  <h4 className={d.itemTitle}>{r.name}</h4>
                </div>
                <div className={d.pair}>
                  <TextBox
                    label="Size in sq ft (optional)"
                    inputMode="numeric"
                    hint={`${L.sizeMin} to ${L.sizeMax}`}
                    value={r.size_sqft}
                    error={e("size_sqft")}
                    onChange={(v) => set(i, { size_sqft: v })}
                  />
                  <TextBox
                    label="Most guests (optional)"
                    inputMode="numeric"
                    hint={`${L.guestsMin} to ${L.guestsMax}`}
                    value={r.max_guests}
                    error={e("max_guests")}
                    onChange={(v) => set(i, { max_guests: v })}
                  />
                </div>
                <div className={d.pair}>
                  <TextBox
                    label="Beds in English"
                    placeholder="1 king bed"
                    value={r.beds_en}
                    error={e("beds_en")}
                    onChange={(v) => set(i, { beds_en: v })}
                  />
                  <TextBox
                    label="Beds in Hindi (optional)"
                    lang="hi"
                    value={r.beds_hi}
                    error={e("beds_hi")}
                    onChange={(v) => set(i, { beds_hi: v })}
                  />
                </div>
                {([0, 1] as const).map((k) => (
                  <div key={k} className={d.pair}>
                    <TextBox
                      label={`Feature ${k + 1} in English`}
                      placeholder={k === 0 ? "Valley view balcony" : "Room heater"}
                      hint={`Up to ${L.feature} letters`}
                      value={r.features_en[k]}
                      error={e(`features_en.${k}`)}
                      onChange={(v) => setFeature(i, "features_en", k, v)}
                    />
                    <TextBox
                      label={`Feature ${k + 1} in Hindi (optional)`}
                      lang="hi"
                      hint={`Up to ${L.feature} letters`}
                      value={r.features_hi[k]}
                      error={e(`features_hi.${k}`)}
                      onChange={(v) => setFeature(i, "features_hi", k, v)}
                    />
                  </div>
                ))}
                {photos.length || r.photo_id ? (
                  <div className={d.pair}>
                    <div className={d.field}>
                      <Choice
                        label="Photo"
                        value={r.photo_id}
                        options={options}
                        onChange={(v) => set(i, { photo_id: v })}
                      />
                      {e("photo_id") ? <p className={d.error}>{e("photo_id")}</p> : null}
                    </div>
                    {chosen ? (
                      // eslint-disable-next-line @next/next/no-img-element -- owner-only photo through the /api proxy, as in PhotoPicker
                      <img
                        className={d.roomThumb}
                        src={chosen.url}
                        alt={`Chosen photo for ${r.name}`}
                        width={chosen.width}
                        height={chosen.height}
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className={d.hint}>Add photos to your site to pick one for this room.</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {errors.rooms ? <p className={d.error}>{errors.rooms}</p> : null}
    </Block>
  );
}
