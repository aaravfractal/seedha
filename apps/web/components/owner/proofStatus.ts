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

export { istStamp } from "@/lib/format";

/** "ab12…ef34" */
export function shortHash(hash: string): string {
  return hash.length > 12 ? `${hash.slice(0, 6)}…${hash.slice(-6)}` : hash;
}
