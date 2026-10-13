import type { V2Copy } from "./copy";
import s from "./hotel.module.css";

/**
 * The slim line above the hotel's header: "<Short name> on Seedha", a link
 * to the main Seedha home (`home`: the app's origin on a hotel's own host).
 * Hidden with the Pro "hide branding" setting, like "Powered by Seedha".
 */
export function SeedhaBar({ hotel, home, t }: { hotel: string; home: string; t: V2Copy }) {
  return (
    <p className={s.seedhaBar}>
      <a href={home}>{t.onSeedha(hotel)}</a>
    </p>
  );
}
