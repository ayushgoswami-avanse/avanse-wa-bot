import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import SalesBriefCard from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { computeCohort } from "@/lib/segmentation";
import LiveAgentThread from "./LiveAgentThread";

export default async function AgentThreadPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const session = await getSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const messages = await prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } });
  const sessions = await prisma.interactionSession.findMany({ where: { contactId }, orderBy: { startedAt: "desc" } });
  const handover = await prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } });
  const handoffTokens = await prisma.handoffToken.findMany({ where: { contactId } });
  const { inWindow } = await computeServiceWindow(contactId);
  const templates = await prisma.messageTemplate.findMany({ where: { metaApprovalState: "approved" } });

  if (session) await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, handover, handoffTokens);
  const cohort = computeCohort(contact);

  return (
    <div className="space-y-6">
      <SalesBriefCard brief={brief} waId={contact.waId} segmentTags={cohort.segmentTags} compact />

      <LiveAgentThread
        contactId={contact.id}
        initialMessages={messages}
        initialHandover={handover}
        initialInWindow={inWindow}
        initialMeta={{
          id: contact.id,
          waId: contact.waId,
          journey: contact.journey,
          stage: contact.stage,
          attributionTier: contact.attributionTier,
          propensityBand: contact.propensityBand,
          destinationCountry: showFinancials ? contact.destinationCountry : null,
          courseCategory: showFinancials ? contact.courseCategory : null,
        }}
        showFinancials={showFinancials}
        templates={templates.map((t) => ({ name: t.name, category: t.category }))}
      />
    </div>
  );
}
