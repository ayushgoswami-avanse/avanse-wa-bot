import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { waId, ambassadorId, amount } = await req.json();
  const contact = await prisma.contact.findUnique({ where: { waId } });
  if (!contact) return NextResponse.json({ error: "no contact with that wa_id" }, { status: 404 });

  // FR-A09/I04 — every payout starts in review; a reused (forwarded) token or Low-tier
  // attribution is exactly the case this queue exists to catch before money moves.
  const tier = contact.attributionTier ?? "LOW";

  const payout = await prisma.ambassadorPayout.create({
    data: { ambassadorId, contactWaId: waId, amount, attributionTier: tier, status: "PENDING_REVIEW" },
  });

  return NextResponse.json({ payout });
}
