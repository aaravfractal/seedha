import type { Metadata } from "next";
import { HomePage } from "@/components/website/HomePage";

export const metadata: Metadata = {
  title: "Seedha · Know what you really keep",
  description:
    "Every booking channel, after discount, commission and GST, on one screen. For hotels, homestays and mountain stays.",
};

export default function Home() {
  return <HomePage />;
}
