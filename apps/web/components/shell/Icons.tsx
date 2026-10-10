/**
 * Inline SVG icons for the shell (no icon library). 24px grid, stroked with
 * currentColor so tiles control the colour. Decorative: always aria-hidden.
 */

export type IconName =
  | "overview"
  | "house"
  | "inbox"
  | "sparkle"
  | "upload"
  | "updown"
  | "repeat"
  | "half"
  | "check"
  | "rupee"
  | "phone"
  | "grid"
  | "ring"
  | "diamond"
  | "star"
  | "card"
  | "gear"
  | "bell"
  | "search"
  | "chevron"
  | "back"
  | "arrowOut"
  | "desk"
  | "guest";

const PATHS: Record<IconName, React.ReactNode> = {
  overview: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
    </>
  ),
  house: <path d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9" />,
  inbox: (
    <>
      <rect x="3.5" y="6" width="17" height="12.5" rx="2.5" />
      <path d="m4.5 7.5 7.5 6 7.5-6" />
    </>
  ),
  sparkle: (
    <path
      d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  upload: <path d="M12 19V6m0 0-5.5 5.5M12 6l5.5 5.5" />,
  updown: <path d="M8 19V5m0 0L4.5 8.5M8 5l3.5 3.5M16 5v14m0 0-3.5-3.5M16 19l3.5-3.5" />,
  repeat: (
    <>
      <path d="M18.5 12a6.5 6.5 0 1 1-2-4.7" />
      <path d="M17.5 3.8v4h-4" />
    </>
  ),
  half: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 4.5a7.5 7.5 0 0 0 0 15Z" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  rupee: <path d="M7 5h10M7 9h10M7 5h3.5a4 4 0 0 1 0 8H7l7.5 6.5" />,
  phone: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9.5 8.5c-.6.6-.5 2 .9 3.7 1.4 1.7 3 2.7 3.8 2.2l.9-.9-1.6-1.4-.9.6c-.6-.3-1.4-1.1-1.8-1.9l.6-.9-1.3-1.7Z" />
    </>
  ),
  grid: (
    <>
      <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
      <path d="M4.5 9.5h15M4.5 14.5h15M9.5 4.5v15M14.5 4.5v15" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
    </>
  ),
  diamond: (
    <>
      <path d="M12 3.5 20.5 12 12 20.5 3.5 12Z" />
      <path d="M12 8 16 12 12 16 8 12Z" fill="currentColor" stroke="none" />
    </>
  ),
  star: (
    <path
      d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6Z"
      fill="currentColor"
      stroke="none"
    />
  ),
  card: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="2.5" />
      <path d="M3.5 10h17" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
    </>
  ),
  bell: (
    <>
      <path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.5 1.5H5Z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m15.5 15.5 4 4" />
    </>
  ),
  chevron: <path d="m9.5 6 6 6-6 6" />,
  back: <path d="m14.5 6-6 6 6 6" />,
  arrowOut: <path d="M8 16 16 8m0 0H9.5M16 8v6.5" />,
  desk: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M9 19.5h6M12 16v3.5" />
    </>
  ),
  guest: (
    <>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </>
  ),
};

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
