/** Labels for a consent's proof state, shared by the proof screen and dialog. */

export type ProofTone = "ok" | "plain" | "bad";

export const PROOF_STATUS: Record<string, { label: string; tone: ProofTone }> = {
  verified: { label: "Verified", tone: "ok" },
  pending: { label: "Pending proof", tone: "plain" },
  erased: { label: "Deleted", tone: "plain" },
  deleted: { label: "Deleted", tone: "plain" },
  mismatch: { label: "Mismatch", tone: "bad" },
};

export function proofStatus(status: string): { label: string; tone: ProofTone } {
  return PROOF_STATUS[status] ?? { label: "Pending proof", tone: "plain" };
}

/** "14 Jun 2026, 7:42 PM" in India time. */
export function istStamp(iso: string): string {
  const at = new Date(iso);
  const day = at.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  return `${day}, ${time}`;
}

/** "ab12…ef34" */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash;
}
