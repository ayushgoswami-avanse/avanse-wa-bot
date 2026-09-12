import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";

/** FR-I01 — QR artwork for an asset code, generated on demand at print resolution. The QR
 * always encodes the branded redirect, never a raw wa.me link (PRD §2.0 — this is what
 * makes attribution and channel failover possible).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const asset = await prisma.asset.findUnique({ where: { code } });
  if (!asset) return new NextResponse("Not found", { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const redirectUrl = `${baseUrl}/api/redirect/${code}`;

  const png = await QRCode.toBuffer(redirectUrl, { width: 1024, margin: 2 });
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" },
  });
}
