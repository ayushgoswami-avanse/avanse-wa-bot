import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/** Checks whether the configured phone number has actually completed WhatsApp's
 * registration (a distinct step from just being added to a WABA in the dashboard —
 * `code_verification_status`/`platform_type` here explain a "not on WhatsApp" symptom
 * that a valid access token alone won't fix). Also supports completing the Cloud API
 * `/register` step (2-step PIN) via POST, since that runs server-side and this local
 * environment's corporate proxy blocks graph.facebook.com directly.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return NextResponse.json({ error: "Missing META_WHATSAPP_TOKEN / META_PHONE_NUMBER_ID" }, { status: 400 });

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,platform_type,quality_rating,is_official_business_account,messaging_limit_tier`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, status: res.status, body });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { pin } = await req.json();
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return NextResponse.json({ error: "Missing META_WHATSAPP_TOKEN / META_PHONE_NUMBER_ID" }, { status: 400 });
  if (!pin || !/^\d{6}$/.test(pin)) return NextResponse.json({ error: "pin must be exactly 6 digits" }, { status: 400 });

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
  const body = await res.json().catch(() => ({}));
  return NextResponse.json({ ok: res.ok, status: res.status, body });
}
