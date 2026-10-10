/** Channel chart colour tokens (neutral greys, pine for Direct; dark mode in globals.css). */
const CHANNEL_COLOUR: Record<string, string> = {
  mmt: "var(--ch-mmt)",
  bcom: "var(--ch-bcom)",
  agoda: "var(--ch-agoda)",
  ta: "var(--ch-agent)",
  walkin: "var(--ch-walkin)",
  direct: "var(--ch-direct)",
};

/** The chart colour for a channel key; unknown channels use the mid grey. */
export function channelColour(key: string): string {
  return CHANNEL_COLOUR[key] ?? "var(--ch-agoda)";
}
