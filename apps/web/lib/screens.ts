/**
 * Owner sidebar screens, in the approved order (MATCH_THIS, docs/FRONTEND_MASTER.md P1).
 * `icon` names an inline SVG in components/shell/Icons.tsx; `tag` shows a small
 * label such as "Pro"; `built: false` marks screens this version does not have yet.
 */
export type OwnerScreen = {
  key: string;
  label: string;
  href: string;
  icon: string;
  tag?: string;
  built?: false;
};

export const OWNER_SCREENS: OwnerScreen[] = [
  { key: "overview", label: "Overview", href: "/home", icon: "overview" },
  { key: "myplace", label: "My Place", href: "/my-place", icon: "house" },
  { key: "inbox", label: "Guest inbox", href: "/inbox", icon: "inbox" },
  { key: "assistant", label: "Assistant", href: "/assistant", icon: "sparkle" },
  { key: "upload", label: "Upload", href: "/upload", icon: "upload" },
  { key: "flip", label: "Money kept", href: "/flip", icon: "updown" },
  { key: "repeat", label: "Repeat guests", href: "/repeat", icon: "repeat" },
  { key: "scenario", label: "Saturday move", href: "/scenario", icon: "half" },
  { key: "approvals", label: "Approvals", href: "/approvals", icon: "check" },
  { key: "savings", label: "Savings", href: "/savings", icon: "rupee" },
  { key: "ask", label: "Ask on WhatsApp", href: "/ask", icon: "phone" },
  { key: "calendar", label: "Calendar", href: "/calendar", icon: "grid" },
  { key: "site", label: "Website", href: "/site", icon: "ring" },
  { key: "proof", label: "Consent proof", href: "/proof", icon: "diamond" },
  { key: "pro", label: "Pro", href: "/pro", icon: "star", tag: "Pro" },
  { key: "billing", label: "Billing", href: "/billing", icon: "card" },
  { key: "settings", label: "Settings", href: "/settings", icon: "gear" },
];

/** True when `pathname` is this screen or one of its sub-pages. */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Routes that render inside the app shell (header with mode switch). */
export function isAppRoute(pathname: string): boolean {
  if (pathname === "/link" || isCurrent(pathname, "/desk")) return true;
  return OWNER_SCREENS.some((s) => isCurrent(pathname, s.href));
}

/** The 8-step direct loop on Overview ("Set up the direct loop"). */
export type PipelineStepCopy = { key: string; title: string; desc: string; href: string };

export const PIPELINE_STEPS: PipelineStepCopy[] = [
  { key: "up", title: "Upload statements", desc: "OTA payouts and hotel register", href: "/upload" },
  { key: "ai", title: "AI reads every row", desc: "Math check flags bad rows", href: "/upload" },
  { key: "flip", title: "See the flip", desc: "Gross vs net by channel", href: "/flip" },
  { key: "rep", title: "Confirm repeat guests", desc: "Commission paid twice", href: "/repeat" },
  { key: "desk", title: "Check-in consent at the Desk", desc: "Guest scans the Desk QR", href: "/desk" },
  { key: "slip", title: "Print a checkout slip", desc: "Bill and perk code printed", href: "/desk" },
  { key: "msg", title: "Approve the win-back", desc: "Owner approves WhatsApp", href: "/approvals" },
  { key: "book", title: "Guest books direct", desc: "Code used, saving counted", href: "/link" },
];
