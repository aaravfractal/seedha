/**
 * Seedha Site real mode: the owner's photos, words, rooms and the generated
 * text. Shapes follow apps/api/app/routers/site_build.py exactly.
 */

export type SitePhoto = {
  id: number;
  position: number;
  width: number;
  height: number;
  size_bytes: number;
  /** "/api/site/photos/<id>": owner-only, through the BFF. */
  url: string;
  caption_en: string;
  caption_hi: string;
};

export type SitePhotos = { photos: SitePhoto[] };

/** A room the owner typed. Money is integer paise; rupee text is converted at the edge. */
export type BuildRoom = { name: string; price_paise: number; blurb_en: string; blurb_hi: string };

export type BuildContent = {
  description_en: string;
  description_hi: string;
  why_book_direct_en: string[];
  why_book_direct_hi: string[];
  google_description_en: string;
  google_description_hi: string;
};

export type BuildSource = "none" | "sample" | "claude" | "edited";

export type BuildState = {
  owner_description: string;
  rooms: BuildRoom[];
  content: BuildContent;
  photos: SitePhoto[];
  source: BuildSource;
  key_configured: boolean;
  model: string;
  generations_today: number;
  daily_limit: number;
  month_tokens_used: number;
  monthly_token_cap: number;
};

export type GenerateStatus = "generated" | "limit_reached" | "offline" | "sample";

export type GenerateResult = BuildState & {
  status: GenerateStatus;
  fallback_fields: string[];
  message: string;
};

/** PATCH /site/build: omitted fields stay as they are. Blurbs left out are kept by room name. */
export type BuildPatch = {
  owner_description?: string;
  rooms?: { name: string; price_paise: number; blurb_en?: string; blurb_hi?: string }[];
  content?: Partial<BuildContent>;
  captions?: { photo_id: number; caption_en?: string; caption_hi?: string }[];
};

export type GenRun = {
  at: string;
  status: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
};

/** GET /site/gen/usage. Month input includes cache tokens. */
export type GenUsage = {
  runs: GenRun[];
  month_input_tokens: number;
  month_output_tokens: number;
  month_runs: number;
  monthly_token_cap: number;
  generations_today: number;
  daily_limit: number;
};
