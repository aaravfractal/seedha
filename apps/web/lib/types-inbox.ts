/** Guest inbox and Assistant API shapes (apps/api/app/routers/inbox.py, assistant.py). */

export type InboxFilter = "all" | "unread" | "auto" | "open";

export type ThreadLast = {
  body: string;
  direction: "in" | "out";
  sent_by: "guest" | "owner" | "away";
  at: string;
};

export type Thread = {
  consent_id: number;
  guest_name: string;
  short_name: string;
  city: string | null;
  last: ThreadLast | null;
  unread: number;
  auto_replied: boolean;
  window_open: boolean;
  window_closes_at: string | null;
  stays: number;
};

export type Away = { text: string | null; approved_at: string | null; enabled: boolean };

/** A rate card line; nightly_rate is paise, line is written by the API. */
export type RateLine = { room_type: string; nightly_rate: number; line: string };

export type Threads = {
  threads: Thread[];
  counts: Record<InboxFilter, number>;
  away: Away;
  rate_card: RateLine[];
  simulated: boolean;
};

export type InboxEntry = {
  key: string;
  direction: "in" | "out";
  sent_by: "guest" | "owner" | "away";
  kind: "text" | "winback";
  body: string;
  at: string;
  transport: string | null;
};

export type BookingCard = {
  kind: "direct" | "stay";
  check_in: string;
  nights: number;
  room_type: string | null;
  channel: string;
  link: string | null;
};

export type Stay = { check_in: string; nights: number; channel: string; room_type: string | null };

export type GuestProfile = {
  guest_name: string;
  city: string | null;
  consent_given_at: string;
  consent_wording: string;
  proof_status: string;
  language: string | null;
  perk_code: string | null;
  stays: Stay[];
};

export type ThreadDetail = {
  thread: Thread;
  messages: InboxEntry[];
  can_reply: boolean;
  reply_note: string;
  suggestions: string[];
  booking: BookingCard | null;
  profile: GuestProfile;
};

export type InboxDraft = { text: string; source: "ai" | "template"; label: string };

export type AssistantIntro = { greeting: string; reading: string[]; suggestions: string[] };

export type AssistantSource = { label: string; href: string };

export type AssistantReply = {
  question: string;
  intent: string;
  answer: string;
  figures: string[];
  sources: AssistantSource[];
  suggestions: string[];
  worded_by: "code" | "claude";
  footer: string;
};
