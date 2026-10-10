/** API shapes added for the owner screens (P2). Money is always integer paise. */
import type { ProofOverview, SaturdayMove, SavingItem, Savings, WinbackMessage } from "./types";

/** GET /messages items now also carry the perk, the guest's link and the language. */
export type OwnerMessage = WinbackMessage & { perk: string; link: string; language: string };
export type OwnerMessages = { pending: number; simulated: boolean; messages: OwnerMessage[] };

/** GET /savings: Season in review (coded bookings booked Apr to Sep). */
export type SavingsSeason = { start: string; end: string; count: number; total_net_saving: number };
/** Each item also carries the perk split (Split the Commission); perk_cost is a sample unless the owner set it. */
export type OwnerSavingItem = SavingItem & {
  nights: number;
  perk: string;
  perk_cost: number;
  kept_after_perk: number;
};
export type OwnerSavings = Omit<Savings, "items"> & {
  season: SavingsSeason;
  items: OwnerSavingItem[];
  perk_cost_per_night: number;
  perk_cost_is_sample: boolean;
};

/** GET /proof: every consent with its re-checked state. bundle_id null = waiting for tonight. */
export type ProofEntryStatus = "verified" | "pending" | "deleted" | "mismatch";
export type ProofEntry = {
  bundle_id: number | null;
  consent_id: number | null;
  guest_name: string | null;
  given_at: string | null;
  status: ProofEntryStatus;
};
export type OwnerProof = ProofOverview & { sealed: number; mismatches: number; entries: ProofEntry[] };

/** GET /ask/morning: the 8 AM line. */
export type MorningLine = { hi: string; en: string; figures: string[]; source: string };

/** GET /scenario/saturday now also returns the before and after totals for one Saturday. */
export type OwnerSaturday = SaturdayMove & {
  before_per_saturday: number | null;
  after_per_saturday: number | null;
};

/** GET /statements/disputes (Seedha Recover). audit_claim equals Pro's audit_claim. */
export type Dispute = {
  booking_id: number;
  channel: string;
  external_ref: string;
  reason: string;
  review_status: string;
  audit_claim: number;
  other_claim: number;
  subject: string;
  text: string;
};
export type RecoverData = { audit_claim: number; other_claim: number; disputes: Dispute[] };
