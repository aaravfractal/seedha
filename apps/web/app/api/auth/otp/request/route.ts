/** Ask for a sign-in code on WhatsApp (simulated sender, see the API). */
import type { NextRequest } from "next/server";
import { normalisePhone } from "@/lib/auth";
import { callApi, guard, jsonError, readJson, relay, unreachable } from "@/lib/authServer";
import { clientAddress } from "@/lib/ratelimit";

export async function POST(request: NextRequest): Promise<Response> {
  const refused = guard(request, "send");
  if (refused) return refused;
  const body = await readJson(request);
  const phone = typeof body?.phone === "string" ? body.phone : "";
  if (!normalisePhone(phone)) {
    return jsonError(422, "invalid_phone", "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.");
  }
  try {
    return relay(
      await callApi("auth/otp/request", {
        method: "POST",
        body: { phone },
        client: clientAddress(request.headers),
      }),
    );
  } catch {
    return unreachable();
  }
}
