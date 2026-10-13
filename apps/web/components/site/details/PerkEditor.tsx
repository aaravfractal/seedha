"use client";

import { DETAIL_LIMITS, letters } from "@/lib/siteDetails";
import { Block, TextBox } from "./fields";
import d from "./details.module.css";

/**
 * The owner's own returning-guest perk for the printed cards and for guests
 * who scan one. Owner-written and owner-approved (rules 6 and 7): a perk,
 * never a lower rate. Empty means the cards and the site promise none.
 */
export function PerkEditor({
  en,
  hi,
  errors,
  onChange,
}: {
  en: string;
  hi: string;
  errors: Record<string, string>;
  onChange: (patch: { card_perk_en?: string; card_perk_hi?: string }) => void;
}) {
  const max = DETAIL_LIMITS.cardPerk;
  return (
    <Block
      id="details-perk"
      title="Card perk"
      hint="Shown on your printed cards and when a guest scans one. Leave empty if you offer none."
    >
      <div className={d.pair}>
        <TextBox
          label="Card perk in English"
          placeholder="Free evening tea for returning guests"
          hint={`${letters(en)} of ${max} letters. Printed on the cards.`}
          value={en}
          error={errors.card_perk_en}
          onChange={(v) => onChange({ card_perk_en: v })}
        />
        <TextBox
          label="Card perk in Hindi (optional)"
          lang="hi"
          hint={`${letters(hi)} of ${max} letters. On the site only; cards print in English.`}
          value={hi}
          error={errors.card_perk_hi}
          onChange={(v) => onChange({ card_perk_hi: v })}
        />
      </div>
    </Block>
  );
}
