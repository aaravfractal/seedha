/** Create an owner account and send the first WhatsApp code. */
import type { NextRequest } from "next/server";
import { normalisePhone } from "@/lib/auth";
import { callApi, guard, jsonError, readJson, relay, unreachable } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest): Promise<Response> {
  const refused = guard(request, "send");
  if (refused) return refused;
  const body = await readJson(request);
  const name = text(body?.name);
  const hotel = text(body?.hotel);
  const phone = text(body?.phone);
  if (name.length < 2 || name.length > 80) return jsonError(422, "invalid_name", "Enter your name.");
  if (hotel.length < 2 || hotel.length > 120)
    return jsonError(422, "invalid_hotel", "Enter your hotel name.");
  if (!normalisePhone(phone)) {
    return jsonError(422, "invalid_phone", "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.");
  }
  if (body?.terms !== true) return jsonError(422, "terms_required", "Tick the box to accept the Terms.");
  try {
    return relay(
      await callApi("auth/signup", {
        method: "POST",
        body: { name, hotel, phone, terms: true, updates: body?.updates === true },
        client: clientAddress(request.headers),
      }),
    );
  } catch {
    return unreachable();
  }
}
