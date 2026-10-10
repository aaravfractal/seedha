/**
 * Fixed copy on the hotel's own pages (World B), English and Hindi.
 * Hotel-specific text (name, tagline, rooms, packages, nearby) comes from the
 * API; prices always come from the API in paise.
 */
import { addDays, parseIsoDate } from "@/lib/linkPrefill";
import type { Lang } from "@/lib/types-site";

export const COPY = {
  en: {
    back: "Back",
    language: "Language",
    book: "Book directly",
    bookShort: "Book",
    samplePhoto: "Sample photo",
    samplePhotos: "Sample photos",
    checkIn: "Check-in",
    nights: "Nights",
    room: "Room",
    checking: "Checking these dates",
    open: "Open on these dates.",
    closed: {
      past: "That date has passed. Pick a later date.",
      too_far: "Bookings open up to a year ahead. Pick an earlier date.",
      full: "Closed on these dates. This room is taken. Try other dates or another room.",
    },
    why: "Why book direct",
    whyItems: [
      ["Breakfast for returning guests", "Book again with your perk code and breakfast is on us."],
      ["Pay by UPI", "Simple and secure. No card needed."],
      ["Talk to the hotel", "Your message reaches us directly on WhatsApp."],
    ],
    rooms: "Rooms",
    aNight: "a night",
    packages: "Packages",
    packagesNote: "Packages add something extra. Room prices stay as listed.",
    comingSoon: "Packages coming soon.",
    comingSoonSub: "Ask the hotel on WhatsApp about longer stays.",
    photos: "Photos",
    nearby: "Nearby",
    contact: "Contact",
    whatsapp: "WhatsApp or call",
    upi: "Advance by UPI",
    placeholders: "Contact and UPI are placeholders. Sample data.",
    sampleHotel: "Sample hotel. All details are fictional.",
    madeWith: "Made with Seedha",
  },
  hi: {
    back: "वापस",
    language: "भाषा",
    book: "सीधे बुक करें",
    bookShort: "बुक करें",
    samplePhoto: "नमूना फोटो",
    samplePhotos: "नमूना फोटो",
    checkIn: "चेक-इन",
    nights: "रातें",
    room: "कमरा",
    checking: "तारीखें देख रहे हैं",
    open: "इन तारीखों पर कमरा खाली है।",
    closed: {
      past: "यह तारीख बीत चुकी है। आगे की तारीख चुनें।",
      too_far: "बुकिंग एक साल आगे तक खुली है। पहले की तारीख चुनें।",
      full: "इन तारीखों पर यह कमरा भरा है। दूसरी तारीख या कमरा चुनें।",
    },
    why: "सीधे बुक क्यों करें",
    whyItems: [
      ["लौटने वाले मेहमानों के लिए नाश्ता", "अपने पर्क कोड से दोबारा बुक करें, नाश्ता हमारी ओर से।"],
      ["UPI से भुगतान", "आसान और सुरक्षित। कार्ड की ज़रूरत नहीं।"],
      ["होटल से सीधी बात", "आपका संदेश सीधे हमें WhatsApp पर मिलता है।"],
    ],
    rooms: "कमरे",
    aNight: "प्रति रात",
    packages: "पैकेज",
    packagesNote: "पैकेज में कुछ अतिरिक्त मिलता है। कमरों के दाम वही रहते हैं।",
    comingSoon: "पैकेज जल्द आ रहे हैं।",
    comingSoonSub: "लंबे ठहराव के लिए होटल से WhatsApp पर पूछें।",
    photos: "तस्वीरें",
    nearby: "आसपास",
    contact: "संपर्क",
    whatsapp: "WhatsApp या कॉल करें",
    upi: "UPI से अग्रिम भुगतान",
    placeholders: "संपर्क और UPI नमूना हैं। नमूना डेटा।",
    sampleHotel: "नमूना होटल। सभी विवरण काल्पनिक हैं।",
    madeWith: "Made with Seedha",
  },
} as const;

export type Copy = (typeof COPY)[Lang];

/** "2 nights" or "2 रातें". */
export function nightsLabel(n: number, lang: Lang): string {
  if (lang === "hi") return `${n} ${n === 1 ? "रात" : "रातें"}`;
  return `${n} ${n === 1 ? "night" : "nights"}`;
}

/** The first Saturday at least three weeks after `today` (ISO), the booking bar's default. */
export function defaultCheckIn(today: string): string {
  const start = addDays(today, 21);
  const date = parseIsoDate(start);
  if (!date) return start;
  return addDays(start, (6 - date.getUTCDay() + 7) % 7);
}

/** "deluxe-valley-view": the Seedha Link prefill form of a room type. */
export function roomSlug(roomType: string): string {
  return roomType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Seedha Link with the stay prefilled. */
export function linkHref(roomType: string, checkIn: string, nights: number): string {
  const q = new URLSearchParams({ room: roomSlug(roomType), in: checkIn, nights: String(nights) });
  return `/link?${q.toString()}`;
}

/** wa.me needs digits only. */
export function waNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}
