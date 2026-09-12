import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/** One-time (and re-runnable) setup action: subscribes this app to the WABA's webhooks
 * and points Meta's callback at this deployment. Runs server-side on Render, which is
 * NOT behind Avanse's corporate proxy — unlike a developer's own machine, this can reach
 * graph.facebook.com directly. Admin-only since it mutates the live Meta configuration.
 */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const token = process.env.META_WHATSAPP_TOKEN;
  const wabaId = process.env.META_WABA_ID;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!token || !wabaId || !verifyToken || !baseUrl) {
    return NextResponse.json({ error: "Missing META_WHATSAPP_TOKEN / META_WABA_ID / META_VERIFY_TOKEN / NEXT_PUBLIC_BASE_URL" }, { status: 400 });
  }

  const callbackUrl = `${baseUrl}/api/webhook/whatsapp`;

  const subscribeRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const subscribeJson = await subscribeRes.json().catch(() => ({}));

  const overrideRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ override_callback_uri: callbackUrl, verify_token: verifyToken }),
  });
  const overrideJson = await overrideRes.json().catch(() => ({}));

  return NextResponse.json({
    subscribe: { ok: subscribeRes.ok, status: subscribeRes.status, body: subscribeJson },
    override: { ok: overrideRes.ok, status: overrideRes.status, body: overrideJson },
    callbackUrl,
  });
}
