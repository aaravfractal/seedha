import { OwnerSidebar } from "@/components/OwnerSidebar";
import { ScreenEnter } from "@/components/shell/ScreenEnter";
import styles from "@/components/shell/Shell.module.css";

/** Owner app frame: sidebar (pill row on phones) and the screen. */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.frame}>
      <OwnerSidebar />
      <ScreenEnter>{children}</ScreenEnter>
    </div>
  );
}
