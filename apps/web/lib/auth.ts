/**
 * Sign-in rules shared by the auth pages (handoff BEHAVIOR validation rules,
 * FRONTEND_MASTER D4). The API enforces the same rules; these only give the
 * owner quick feedback.
 */

export const OTP_DIGITS = 6;
export const OTP_TTL_SECONDS = 300;
export const OTP_RESEND_SECONDS = 30;
export const OTP_MAX_TRIES = 5;

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** "+91 98765-43210" -> "9876543210", or null when it is not an Indian mobile. */
export function normalisePhone(raw: string): string | null {
  let digits = raw.trim().replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return INDIAN_MOBILE.test(digits) ? digits : null;
}

/** "9876543210" -> "+91 98765 •••10". */
export function maskPhone(phone: string): string {
  return `+91 ${phone.slice(0, 5)} •••${phone.slice(-2)}`;
}

/** Only digits, at most six. */
export function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, OTP_DIGITS);
}

/** 299 -> "4:59". Never negative. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * What a screen reader hears about the countdown: only at whole minutes, at
 * 30 and 10 seconds and at expiry, so it is not read out every second.
 */
export function countdownAnnouncement(seconds: number): string | null {
  const s = Math.max(0, Math.ceil(seconds));
  if (s === 0) return "The code has expired. Ask for a new one.";
  if (s === 30 || s === 10) return `Code expires in ${s} seconds.`;
  if (s % 60 === 0) {
    const m = s / 60;
    return `Code expires in ${m} minute${m === 1 ? "" : "s"}.`;
  }
  return null;
}

export function triesText(left: number): string {
  return `${left} of ${OTP_MAX_TRIES} tries left`;
}

/** A same-site path to return to after sign in, else Overview. */
export function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/home";
}

/** Sign-in state carried from /login or /signup to /otp in sessionStorage. */
export type PendingCode = {
  phone: string;
  masked: string;
  remember: boolean;
  flow: "signin" | "signup";
  sentAt: number;
  expiresIn: number;
  resendIn: number;
  triesLeft: number;
  demoCode: string | null;
  next: string;
};

export const PENDING_KEY = "seedha-otp";

export function parsePending(raw: string | null): PendingCode | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingCode>;
    if (typeof value.phone !== "string" || normalisePhone(value.phone) === null) return null;
    if (typeof value.sentAt !== "number") return null;
    return {
      phone: value.phone,
      masked: maskPhone(value.phone),
      remember: value.remember === true,
      flow: value.flow === "signup" ? "signup" : "signin",
      sentAt: value.sentAt,
      expiresIn: typeof value.expiresIn === "number" ? value.expiresIn : OTP_TTL_SECONDS,
      resendIn: typeof value.resendIn === "number" ? value.resendIn : OTP_RESEND_SECONDS,
      triesLeft: typeof value.triesLeft === "number" ? value.triesLeft : OTP_MAX_TRIES,
      demoCode: typeof value.demoCode === "string" ? value.demoCode : null,
      next: safeNext(value.next),
    };
  } catch {
    return null;
  }
}

/** The JSON the code-sending endpoints answer with. */
export type CodeSent = {
  sent: boolean;
  masked_phone: string;
  expires_in: number;
  resend_in: number;
  tries_left: number;
  demo_code: string | null;
};

export type ApiErrorBody = { error?: { code?: string; message?: string; tries_left?: number } };
