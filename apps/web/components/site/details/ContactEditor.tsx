"use client";

import type { Contact } from "@/lib/types-site-v2-owner";
import { Block, TextBox } from "./fields";
import d from "./details.module.css";

/** Phone, WhatsApp, email, address and the map position (numbers only, no map service). */
export function ContactEditor({
  contact,
  lat,
  lng,
  errors,
  onContact,
  onGeo,
}: {
  contact: Contact;
  lat: string;
  lng: string;
  errors: Record<string, string>;
  onContact: (patch: Partial<Contact>) => void;
  onGeo: (patch: { lat?: string; lng?: string }) => void;
}) {
  return (
    <>
      <Block
        id="details-contact"
        title="Contact"
        hint="Shown on your site and printed cards. Leave a box empty to hide it."
      >
        <div className={d.pair}>
          <TextBox
            label="Phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={contact.phone}
            error={errors["contact.phone"]}
            onChange={(v) => onContact({ phone: v })}
          />
          <TextBox
            label="WhatsApp number"
            type="tel"
            inputMode="tel"
            placeholder="+91 98765 43210"
            value={contact.whatsapp}
            error={errors["contact.whatsapp"]}
            onChange={(v) => onContact({ whatsapp: v })}
          />
        </div>
        <TextBox
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={contact.email}
          error={errors["contact.email"]}
          onChange={(v) => onContact({ email: v })}
        />
        <div className={d.pair}>
          <TextBox
            label="Address in English"
            rows={2}
            value={contact.address_en}
            error={errors["contact.address_en"]}
            onChange={(v) => onContact({ address_en: v })}
          />
          <TextBox
            label="Address in Hindi (optional)"
            rows={2}
            lang="hi"
            value={contact.address_hi}
            error={errors["contact.address_hi"]}
            onChange={(v) => onContact({ address_hi: v })}
          />
        </div>
      </Block>
      <Block
        id="details-geo"
        title="Map position"
        hint="Latitude and longitude of the hotel, for the map on your site. In Google Maps, press and hold (or right-click) on your hotel to see the two numbers. Leave both empty to hide the map."
      >
        <div className={d.pair}>
          <TextBox
            label="Latitude"
            inputMode="decimal"
            placeholder="30.4598"
            value={lat}
            error={errors["geo.lat"]}
            onChange={(v) => onGeo({ lat: v })}
          />
          <TextBox
            label="Longitude"
            inputMode="decimal"
            placeholder="78.0664"
            value={lng}
            error={errors["geo.lng"]}
            onChange={(v) => onGeo({ lng: v })}
          />
        </div>
      </Block>
    </>
  );
}
