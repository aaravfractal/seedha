import type { V2Copy } from "./copy";
import s from "./hotel.module.css";

/**
 * The slim line above the hotel's header: "<Hotel> on Seedha". Plain text,
 * no link, so a guest is never sent away from the hotel's page. Hidden with
 * the Pro "hide branding" setting, like "Built with Seedha".
 */
export function SeedhaBar({ hotel, t }: { hotel: string; t: V2Copy }) {
  return <p className={s.seedhaBar}>{t.onSeedha(hotel)}</p>;
}
