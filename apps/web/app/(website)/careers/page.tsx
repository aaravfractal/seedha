import type { Metadata } from "next";
import { Careers } from "@/components/website/Pricing";

export const metadata: Metadata = {
  title: "Careers · Seedha",
  description: "Roles the Seedha team plans to hire for after launch.",
};

export default function CareersPage() {
  return <Careers page />;
}
