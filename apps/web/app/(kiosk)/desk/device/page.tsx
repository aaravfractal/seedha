import type { Metadata } from "next";
import { Kiosk } from "@/components/desk/Kiosk";

export const metadata: Metadata = {
  title: "Seedha Desk",
  description: "The front desk screen: consent QR, ring and slips on a phone or tablet.",
  robots: { index: false, follow: false },
};

export default function DeskDevicePage() {
  return <Kiosk />;
}
