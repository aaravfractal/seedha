/** Seedha Site and the hotel's own World B pages. Money is integer paise from the API. */

export type Lang = "en" | "hi";
export type Mood = "pine" | "stone" | "sky";
export type Bi = { en: string; hi: string };

/** `bookable`: Seedha Link books this room at exactly this price; otherwise "Ask the hotel". */
export type SiteRoom = {
  room_type: string;
  name_hi: string;
  detail: Bi;
  nightly_rate: number;
  bookable: boolean;
};

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
  /** Full public address: https://<slug>.<root> or <app>/h/<slug>. */
  url: string;
  /** "none" = the labelled sample render; otherwise the owner's own build. */
  source: "none" | "sample" | "claude" | "edited";
  /** The owner's generated or edited text (null for the sample render). */
  text: SiteText | null;
  /** The owner's photos in order (empty for the sample render). */
  photos: SitePhoto[];
  /** Pro setting: hide "Built with Seedha" and "Powered by Seedha". */
  hide_branding: boolean;
  /** Seedha Link on the app host: absolute when the site has its own host, else "/link". */
  booking_url: string;
};

/** An owner photo; caption_hi falls back to the English caption (API). */
export type SitePhoto = {
  id: number;
  url: string;
  width: number;
  height: number;
  caption_en: string;
  caption_hi: string;
};

export type SiteText = { description: Bi; why_book_direct: { en: string[]; hi: string[] } };

export type SlugReason = "slug_invalid" | "slug_reserved" | "slug_taken";

export type SlugCheck = {
  slug: string;
  ok: boolean;
  reason: SlugReason | null;
  message: string | null;
  suggestion: string;
  url: string;
};

/** GET /site/address: the address in use (null before the first publish), the suggestion. */
export type SiteAddressInfo = {
  slug: string | null;
  suggested_slug: string;
  url: string | null;
  address: string | null;
  published: boolean;
  /** SITE_ROOT_DOMAIN ("" = sites live at <app>/h/<slug>). */
  root_domain: string;
  /** Pro setting: hide "Built with Seedha" and "Powered by Seedha". */
  hide_branding: boolean;
};

/** POST /site/publish. */
export type PublishResult = {
  slug: string;
  url: string;
  address: string;
  published: true;
  published_at: string;
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
  /** The owner's own Google text (empty until generated), or the sample hotel's labelled sample. */
  google: {
    description: Bi;
    categories: string[];
    photos: string[];
    sample: boolean;
    photos_sample: boolean;
  };
};

export type PublicSite = SiteContent & {
  published: boolean;
  today: string;
  packages: PublicPackage[];
  /** Set when an old address (renamed within 30 days) was asked for: the new slug. */
  redirect_to: string | null;
};

export type Availability = {
  open: boolean;
  reason: "past" | "too_far" | "full" | null;
  check_in: string;
  nights: number;
  room_type: string;
};
