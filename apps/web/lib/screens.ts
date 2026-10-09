/** Owner sidebar screens, in prototype order. `pro` marks Pro-plan features. */
export type OwnerScreen = { key: string; label: string; href: string; pro?: boolean };

export const OWNER_SCREENS: OwnerScreen[] = [
  { key: "upload", label: "Upload", href: "/upload" },
  { key: "flip", label: "Money kept", href: "/flip" },
  { key: "repeat", label: "Repeat guests", href: "/repeat" },
  { key: "scenario", label: "Saturday move", href: "/scenario" },
  { key: "approvals", label: "Approvals", href: "/approvals" },
  { key: "savings", label: "Savings", href: "/savings" },
  { key: "ask", label: "Ask", href: "/ask" },
  { key: "site", label: "Website", href: "/site" },
  { key: "proof", label: "Proof", href: "/proof", pro: true },
  { key: "pro", label: "Pro", href: "/pro", pro: true },
  { key: "settings", label: "Settings", href: "/settings" },
];

/** The 8-step demo loop on the Pipeline home. */
export type PipelineStepCopy = { key: string; title: string; desc: string; href: string };

export const PIPELINE_STEPS: PipelineStepCopy[] = [
  { key: "up", title: "Upload statements", desc: "OTA payouts and hotel register", href: "/upload" },
  { key: "ai", title: "AI reads every row", desc: "Math check flags bad rows", href: "/upload" },
  { key: "flip", title: "See the flip", desc: "Gross vs net by channel", href: "/flip" },
  { key: "rep", title: "Find repeat guests", desc: "Commission paid twice", href: "/repeat" },
  { key: "desk", title: "Check-in consent", desc: "Guest scans the Desk QR", href: "/desk" },
  { key: "slip", title: "Checkout slip", desc: "Bill and perk code printed", href: "/desk" },
  { key: "msg", title: "Approve win-back", desc: "Owner approves WhatsApp", href: "/approvals" },
  { key: "book", title: "Guest books direct", desc: "Code used, saving counted", href: "/link" },
];
