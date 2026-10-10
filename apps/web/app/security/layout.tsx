import { AppFrame } from "@/components/AppFrame";

/** Interim frame until the public website's own layout lands (P7). */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
