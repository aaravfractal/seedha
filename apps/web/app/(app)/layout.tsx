import { AppFrame } from "@/components/AppFrame";

/** Desk, guest pages, plans and sign-in: the app frame without the owner sidebar. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
