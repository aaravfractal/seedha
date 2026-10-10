/** Seedha Site and the hotel's own World B pages. Money is integer paise from the API. */

export type Lang = "en" | "hi";
export type Mood = "pine" | "stone" | "sky";
export type Bi = { en: string; hi: string };

export type SiteRoom = { room_type: string; name_hi: string; detail: Bi; nightly_rate: number };

export type PublicPackage = { key: string; name: Bi; includes: Bi; nights: number; price: number };

export type PackageState = "pending" | "approved" | "skipped";

export type OwnerPackage = PublicPackage & {
  room_type: string;
  nightly_rate: number;
  lines: { label: string; amount: number }[];
  why: string;
  state: PackageState;
  approved: boolean;
};

export type SiteContent = {
  slug: string;
  address: string;
  sample: boolean;
  mood: Mood;
  lang: Lang;
  hotel: string;
  hotel_hi: string;
  location: Bi;
  tagline: Bi;
  rooms_count: number;
  rooms: SiteRoom[];
  nearby: { place: Bi; distance: Bi }[];
  gallery: Bi[];
  contact: { phone: string; upi: string; placeholder: boolean };
};

export type OwnerSite = SiteContent & {
  stage: "empty" | "chat" | "review";
  live: boolean;
  published_at: string | null;
  owner_name: string;
  packages: OwnerPackage[];
  setup: {
    photos_sent: number;
    photos_wanted: number;
    photo_labels: string[];
    photo_tip: string;
    voice_length: string;
    voice_summary: string;
  };
  google: { description: Bi; categories: string[]; photos: string[] };
};

export type PublicSite = SiteContent & { published: boolean; today: string; packages: PublicPackage[] };

export type Availability = {
  open: boolean;
  reason: "past" | "too_far" | "full" | null;
  check_in: string;
  nights: number;
  room_type: string;
};
