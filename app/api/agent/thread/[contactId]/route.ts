import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";

/** Backs the agent/admin live thread view — polled/pinged after any bus "activity" event
 * so a console tab reflects a new inbound message, an agent send, or a handover status
 * change without a manual browser reload (the "not updating automatically" bug report).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId } = await params;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [messages, handover, { inWindow }] = await Promise.all([
    prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } }),
    prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } }),
    computeServiceWindow(contactId),
  ]);

  const showFinancials = canViewFinancials(session.role);

  return NextResponse.json({
    messages,
    handover,
    inWindow,
    contact: {
      id: contact.id,
      waId: contact.waId,
      journey: contact.journey,
      stage: contact.stage,
      attributionTier: contact.attributionTier,
      propensityBand: contact.propensityBand,
      destinationCountry: showFinancials ? contact.destinationCountry : null,
      courseCategory: showFinancials ? contact.courseCategory : null,
    },
  });
}
