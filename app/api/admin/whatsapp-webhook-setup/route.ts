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
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const verifyToken = process.env.META_VERIFY_TOKEN;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!token || !wabaId || !appId || !appSecret || !verifyToken || !baseUrl) {
    return NextResponse.json(
      { error: "Missing META_WHATSAPP_TOKEN / META_WABA_ID / META_APP_ID / META_APP_SECRET / META_VERIFY_TOKEN / NEXT_PUBLIC_BASE_URL" },
      { status: 400 }
    );
  }

  const callbackUrl = `${baseUrl}/api/webhook/whatsapp`;
  const appAccessToken = `${appId}|${appSecret}`;

  // Step 1 — set the App's default webhook (object=whatsapp_business_account). A fresh
  // test app has no default callback yet; the per-WABA override below requires one to
  // already exist, which is why this step must run first.
  const appSubParams = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: "messages",
    access_token: appAccessToken,
  });
  const appSubRes = await fetch(`https://graph.facebook.com/v21.0/${appId}/subscriptions`, {
    method: "POST",
    body: appSubParams,
  });
  const appSubJson = await appSubRes.json().catch(() => ({}));

  // Step 2 — link this WABA to the app so it actually receives that webhook.
  const subscribeRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const subscribeJson = await subscribeRes.json().catch(() => ({}));

  return NextResponse.json({
    appLevelSubscription: { ok: appSubRes.ok, status: appSubRes.status, body: appSubJson },
    wabaSubscription: { ok: subscribeRes.ok, status: subscribeRes.status, body: subscribeJson },
    callbackUrl,
  });
}
