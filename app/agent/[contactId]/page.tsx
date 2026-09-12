import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import SalesBriefCard, { type BriefFact } from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";
import { buildLeadTimeline } from "@/lib/timeline";
import LeadTimeline from "@/components/LeadTimeline";
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
  const notes = await prisma.agentNote.findMany({ where: { contactId }, orderBy: { createdAt: "desc" }, include: { author: true } });
  const { events } = await buildLeadTimeline(contact);

  if (session) await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, handover, handoffTokens);
  const cohort = computeCohort(contact);

  const facts: BriefFact[] = [
    { label: "Stage", value: contact.stage.replaceAll("_", " ").toLowerCase() },
    { label: "Window", value: inWindow ? "Open" : "Closed" },
    { label: "Attribution", value: contact.attributionTier ?? "—" },
    { label: "Sessions", value: String(contact.interactionSessionCount) },
    { label: "Qualified", value: contact.isQualifiedLead ? "Yes" : "No" },
    ...(showFinancials
      ? [{ label: "Course", value: contact.destinationCountry ?? contact.courseCategory ?? "—" }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <SalesBriefCard brief={brief} waId={contact.waId} temperature={bandToTemperature(contact.propensityBand)} facts={facts} segmentTags={cohort.segmentTags} />

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
        templates={templates.map((t) => ({ name: t.name, category: t.category }))}
        currentDisposition={contact.disposition}
        initialNotes={notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), agentName: n.author.displayName }))}
      />

      <div className="animate-slide-up stagger-3">
        <h2 className="text-sm font-semibold text-slate-700 mb-2.5">Lead journey timeline</h2>
        <div className="max-w-2xl max-h-[420px] overflow-y-auto brand-scroll pr-2">
          <LeadTimeline events={events} />
        </div>
      </div>
    </div>
  );
}
