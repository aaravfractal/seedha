/**
 * Settings validation (handoff BEHAVIOR "Validation rules"), shared by the
 * form and its tests. The API checks the same rules; neither ever logs a
 * GSTIN or PAN.
 */

export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;
export const PAN = /^[A-Z]{5}\d{4}[A-Z]$/;
export const PIN = /^\d{6}$/;
export const MOBILE = /^[6-9]\d{9}$/;
export const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,120}\.[A-Za-z]{2,}$/;

export type DetailsForm = {
  name: string;
  email: string;
  business_name: string;
  gstin: string;
  pan: string;
  address: string;
  pin: string;
};

export type DetailsErrors = Partial<Record<keyof DetailsForm, string>>;

/** Upper-case and strip spaces from a tax id as the owner types it. */
export function taxId(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

/** Field errors for the personal details form; empty optional fields pass. */
export function checkDetails(form: DetailsForm): DetailsErrors {
  const errors: DetailsErrors = {};
  if (form.name.trim().length < 2) errors.name = "Enter your name.";
  const email = form.email.trim();
  if (email && !EMAIL.test(email)) errors.email = "Enter an email like name@example.com.";
  const gstin = taxId(form.gstin);
  if (gstin && !GSTIN.test(gstin)) errors.gstin = "GSTIN has 15 characters, like 05ABCDE1234F1Z5.";
  const pan = taxId(form.pan);
  if (pan && !PAN.test(pan)) errors.pan = "PAN has 10 characters, like ABCDE1234F.";
  if (!errors.gstin && !errors.pan && gstin && pan && gstin.slice(2, 12) !== pan) {
    errors.pan = "Characters 3 to 12 of a GSTIN are the PAN. These two do not match.";
  }
  const pin = form.pin.trim();
  if (pin && !PIN.test(pin)) errors.pin = "PIN code has 6 digits.";
  return errors;
}

/** "+91 98111 11111" or "098111 11111" to "9811111111" (or "" when it is not a mobile). */
export function mobileDigits(value: string): string {
  let digits = value.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE.test(digits) ? digits : "";
}

/** Which form field an API error code belongs to. */
export function fieldForCode(code: string): keyof DetailsForm | "mobile" | "role" | null {
  const map: Record<string, keyof DetailsForm | "mobile" | "role"> = {
    invalid_email: "email",
    invalid_gstin: "gstin",
    invalid_pan: "pan",
    pan_gstin_mismatch: "pan",
    invalid_pin: "pin",
    invalid_name: "name",
    invalid_mobile: "mobile",
    already_invited: "mobile",
    invalid_role: "role",
  };
  return map[code] ?? null;
}

/** Basis points to a percent with up to two decimals: 2200 -> "22%", 1850 -> "18.5%". */
export function bpsPct(bps: number): string {
  const whole = Math.trunc(bps / 100);
  const rest = Math.abs(bps % 100);
  if (rest === 0) return `${whole}%`;
  const decimals = rest % 10 === 0 ? String(rest / 10) : String(rest).padStart(2, "0");
  return `${whole}.${decimals}%`;
}
