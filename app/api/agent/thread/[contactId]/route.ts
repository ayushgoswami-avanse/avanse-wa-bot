import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import { buildSalesBrief } from "@/lib/salesBrief";
import { buildLeadFacts } from "@/lib/leadFacts";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";
import { getAttributionSource } from "@/lib/attribution";

/** Backs the agent/admin live thread view — polled/pinged after any bus "activity" event
 * so a console tab reflects a new inbound message, an agent send, a handover status
 * change, or a captured/edited profile field without a manual browser reload. Returns
 * everything the top-of-page Sales Brief card needs too (not just the conversation) —
 * that card used to be computed once at page load and never refresh, which meant new
 * fields Guru captured mid-conversation (or an agent's own dropdown edit) sat invisible
 * until a manual reload.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId } = await params;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [messages, handover, { inWindow }, sessions, handoffTokens] = await Promise.all([
    prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } }),
    prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } }),
    computeServiceWindow(contactId),
    prisma.interactionSession.findMany({ where: { contactId }, orderBy: { startedAt: "desc" } }),
    prisma.handoffToken.findMany({ where: { contactId } }),
  ]);

  const showFinancials = canViewFinancials(session.role);
  const source = await getAttributionSource(contact);
  const brief = buildSalesBrief(contact, sessions, handover, handoffTokens);
  const cohort = computeCohort(contact);
  const facts = buildLeadFacts(contact, { inWindow, showFinancials, sourceSummary: source.summary });

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
    brief,
    facts,
    temperature: bandToTemperature(contact.propensityBand),
    segmentTags: cohort.segmentTags,
  });
}
