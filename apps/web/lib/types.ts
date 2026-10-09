/** Shapes returned by the Seedha API. Money is always integer paise. */

export type PropertyInfo = {
  name: string;
  short_name: string;
  city: string;
  address: string;
  rooms_count: number;
  owner_name: string;
  is_sample: boolean;
};

export type PipelineStatus = {
  steps: { key: string; done: boolean }[];
  done_count: number;
};

export type StatementFile = {
  id: number;
  filename: string;
  file_type: string;
  parse_method: string;
  row_count: number;
  flagged_count: number;
  is_sample: boolean;
  uploaded_at: string;
};

export type FlaggedRow = {
  id: number;
  channel: string;
  external_ref: string;
  reason: string;
  detail: string;
  review_status: "pending" | "accepted" | "excluded" | "none";
};

export type StatementsSummary = {
  files: StatementFile[];
  rows: number;
  flagged: number;
  pending_review: number;
  flagged_rows: FlaggedRow[];
};

export type IngestOutcome = {
  filename: string;
  status: "imported" | "already_imported";
  file_id: number | null;
  layout: string | null;
  method: string | null;
  rows: number;
  flagged: number;
  duplicates: number;
  message: string;
  flagged_refs: string[];
};

export type SampleFile = { index: number; filename: string };
