/**
 * Pro card id -> its expanded mini view (POLISH_BUILD section C).
 * B5 owns this file, the page, the expandable card and five views; B6 owns
 * the other five view files and their API. Neither edits the other's files.
 */
import type { ComponentType } from "react";
import { AuditView } from "./views/AuditView";
import { PulseView } from "./views/PulseView";
import { RateWatchView } from "./views/RateWatchView";
import { TonightView } from "./views/TonightView";
import { ProofView } from "./views/ProofView";
import { DiscountSplitView } from "./views/DiscountSplitView";
import { FloorView } from "./views/FloorView";
import { DisplacementView } from "./views/DisplacementView";
import { KhataView } from "./views/KhataView";
import { RollupView } from "./views/RollupView";

export type ProCardId =
  | "audit"
  | "pulse"
  | "rate-watch"
  | "tonight"
  | "proof"
  | "discount-split"
  | "floor"
  | "displacement"
  | "khata"
  | "rollup";

export const PRO_VIEWS: Record<ProCardId, ComponentType> = {
  audit: AuditView,
  pulse: PulseView,
  "rate-watch": RateWatchView,
  tonight: TonightView,
  proof: ProofView,
  "discount-split": DiscountSplitView,
  floor: FloorView,
  displacement: DisplacementView,
  khata: KhataView,
  rollup: RollupView,
};
