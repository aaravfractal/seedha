/**
 * The fixed 40 amenities of Hotel Site V2, in the order the site shows them.
 * Mirrors AMENITIES in apps/api/app/services/site_details.py (same ids, same
 * English and Hindi labels); lib/siteDetails.test.ts checks the two match.
 */
export const AMENITIES = [
  { id: "wifi", en: "Free Wi-Fi", hi: "मुफ़्त वाई-फ़ाई" },
  { id: "parking", en: "Free parking", hi: "मुफ़्त पार्किंग" },
  { id: "breakfast", en: "Breakfast", hi: "नाश्ता" },
  { id: "restaurant", en: "Restaurant", hi: "रेस्तरां" },
  { id: "room_service", en: "Room service", hi: "रूम सर्विस" },
  { id: "hot_water", en: "24-hour hot water", hi: "24 घंटे गर्म पानी" },
  { id: "heater", en: "Room heater", hi: "रूम हीटर" },
  { id: "power_backup", en: "Power backup", hi: "पावर बैकअप" },
  { id: "valley_view", en: "Valley view", hi: "घाटी का नज़ारा" },
  { id: "mountain_view", en: "Mountain view", hi: "पहाड़ों का नज़ारा" },
  { id: "balcony", en: "Balcony", hi: "बालकनी" },
  { id: "garden", en: "Garden", hi: "बगीचा" },
  { id: "terrace", en: "Terrace", hi: "छत" },
  { id: "bonfire", en: "Bonfire", hi: "अलाव" },
  { id: "family_rooms", en: "Family rooms", hi: "फ़ैमिली कमरे" },
  { id: "kids_play", en: "Kids' play area", hi: "बच्चों के खेलने की जगह" },
  { id: "pet_friendly", en: "Pets allowed", hi: "पालतू जानवर ला सकते हैं" },
  { id: "travel_desk", en: "Travel desk", hi: "ट्रैवल डेस्क" },
  { id: "taxi", en: "Taxi on request", hi: "मांग पर टैक्सी" },
  { id: "airport_pickup", en: "Airport pickup", hi: "एयरपोर्ट पिकअप" },
  { id: "laundry", en: "Laundry", hi: "लॉन्ड्री" },
  { id: "housekeeping", en: "Daily housekeeping", hi: "रोज़ सफ़ाई" },
  { id: "tv", en: "TV", hi: "टीवी" },
  { id: "tea_coffee", en: "Tea and coffee maker", hi: "चाय-कॉफ़ी मेकर" },
  { id: "geyser", en: "Geyser", hi: "गीज़र" },
  { id: "lift", en: "Lift", hi: "लिफ़्ट" },
  { id: "wheelchair", en: "Wheelchair access", hi: "व्हीलचेयर से पहुंच" },
  { id: "doctor_on_call", en: "Doctor on call", hi: "डॉक्टर ऑन कॉल" },
  { id: "first_aid", en: "First aid", hi: "प्राथमिक चिकित्सा" },
  { id: "cctv", en: "CCTV in common areas", hi: "सामान्य जगहों पर सीसीटीवी" },
  { id: "upi", en: "UPI payments", hi: "यूपीआई भुगतान" },
  { id: "cards", en: "Cards accepted", hi: "कार्ड स्वीकार" },
  { id: "veg_food", en: "Pure veg food", hi: "शुद्ध शाकाहारी भोजन" },
  { id: "local_food", en: "Local Garhwali food", hi: "स्थानीय गढ़वाली भोजन" },
  { id: "yoga", en: "Yoga space", hi: "योग की जगह" },
  { id: "trek_guide", en: "Trek guide on request", hi: "मांग पर ट्रेक गाइड" },
  { id: "library", en: "Book corner", hi: "किताबों का कोना" },
  { id: "indoor_games", en: "Indoor games", hi: "इनडोर खेल" },
  { id: "workspace", en: "Work desk", hi: "काम की मेज़" },
  { id: "luggage", en: "Luggage storage", hi: "सामान रखने की जगह" },
] as const;

export type AmenityId = (typeof AMENITIES)[number]["id"];

export const AMENITY_IDS: readonly AmenityId[] = AMENITIES.map((a) => a.id);
