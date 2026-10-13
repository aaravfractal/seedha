import type { Metadata } from "next";
import { Kiosk } from "@/components/desk/Kiosk";

export const metadata: Metadata = {
  title: "Front desk screen",
  description:
    "The front desk screen: the consent QR and the checkout slip on a phone or tablet at reception.",
  robots: { index: false, follow: false },
};

export default function DeskDevicePage() {
  return <Kiosk />;
}
