import { NextRequest, NextResponse } from "next/server";
import { resolveAndRegisterClick } from "@/lib/attribution";
import { getConfig } from "@/lib/config";

/** FR-A02/A10 — the branded redirect service. Resolves the asset code, writes the click
 * record BEFORE issuing the redirect (target: p95 < 100ms, NFR-01), and can fail over to
 * the web mirror without a code deploy if the WhatsApp number is ever restricted.
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const userAgent = req.headers.get("user-agent") ?? undefined;

  const resolution = await resolveAndRegisterClick(code, { userAgent });

  if (!resolution.ok) {
    // FR-A01 — expired/unknown codes get a graceful message, never a raw error.
    return new NextResponse(
      `<html><body style="font-family:sans-serif;text-align:center;margin-top:20vh">
        <h2>This link isn't active right now</h2>
        <p>Please try scanning again, or visit our chat directly.</p>
        <a href="/chat">Open web chat</a>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  const failoverTarget = await getConfig("REDIRECT_FAILOVER_TARGET");

  if (failoverTarget === "web_mirror") {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    return NextResponse.redirect(`${baseUrl}/chat?t=${resolution.clickToken}`, { status: 302 });
  }

  const waNumber = process.env.META_PHONE_NUMBER_DISPLAY ?? "";
  const prefill = encodeURIComponent(resolution.clickToken);
  return NextResponse.redirect(`https://wa.me/${waNumber}?text=${prefill}`, { status: 302 });
}
