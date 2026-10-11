/**
 * Public contact addresses for the website, read on the server from
 * PUBLIC_CONTACT_EMAIL, PUBLIC_PRIVACY_EMAIL and PUBLIC_SECURITY_EMAIL.
 * The pages that use them are prerendered, so the values are read when the
 * web app is built: set them in .env before `next build`. An unset or
 * malformed value shows CONTACT_PENDING instead, never a placeholder.
 */

export type ContactKind = "contact" | "privacy" | "security";

export const CONTACT_PENDING = "Contact details will be published before launch.";

const ENV_NAME: Record<ContactKind, string> = {
  contact: "PUBLIC_CONTACT_EMAIL",
  privacy: "PUBLIC_PRIVACY_EMAIL",
  security: "PUBLIC_SECURITY_EMAIL",
};

/** One plain address: no spaces, no angle brackets, one @, a dotted domain. */
const EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** The configured address for this kind, or null when unset or not a plain email. */
export function publicEmail(
  kind: ContactKind,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = (env[ENV_NAME[kind]] ?? "").trim();
  return value.length <= 254 && EMAIL.test(value) ? value : null;
}
