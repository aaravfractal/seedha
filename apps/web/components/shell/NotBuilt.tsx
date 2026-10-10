import Link from "next/link";
import { Icon } from "./Icons";
import type { IconName } from "./Icons";
import styles from "./Shell.module.css";

/** A screen this version does not have yet: says so plainly, shows no data. */
export function NotBuilt({ title, icon, what }: { title: string; icon: IconName; what: string }) {
  return (
    <section className={styles.soon} aria-labelledby="not-built-title">
      <span className={styles.soonTile} aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <h1 id="not-built-title">{title}</h1>
      <p>{what} This screen is not built yet in this version, so there is nothing to show here.</p>
      <Link href="/home" className="btn ghost small">
        Back to Overview
      </Link>
    </section>
  );
}
