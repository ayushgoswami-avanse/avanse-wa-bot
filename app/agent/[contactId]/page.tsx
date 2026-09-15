import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import LiveSalesBrief from "@/components/LiveSalesBrief";
import { buildSalesBrief } from "@/lib/salesBrief";
import { buildLeadFacts } from "@/lib/leadFacts";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";
import { buildLeadTimeline } from "@/lib/timeline";
import { getAttributionSource } from "@/lib/attribution";
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
  const source = await getAttributionSource(contact);

  if (session) await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, handover, handoffTokens);
  const cohort = computeCohort(contact);
  const facts = buildLeadFacts(contact, { inWindow, showFinancials, sourceSummary: source.summary });

  const threadState = {
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
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lead journey</h2>
        <LeadTimeline events={events} />
      </div>

      <LiveSalesBrief contactId={contact.id} initial={threadState} />

      <LiveAgentThread
        contactId={contact.id}
        initial={threadState}
        templates={templates.map((t) => ({ name: t.name, category: t.category }))}
        currentDisposition={contact.disposition}
        initialNotes={notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), agentName: n.author.displayName }))}
        profileFields={{
          confirmedName: contact.confirmedName ?? "",
          journey: contact.journey ?? "",
          destinationCountry: contact.destinationCountry ?? "",
          degreeLevel: contact.degreeLevel ?? "",
          fieldOfStudy: contact.fieldOfStudy ?? "",
          intendedIntake: contact.intendedIntake ?? "",
          currentYearOfStudy: contact.currentYearOfStudy ?? "",
          testStatus: contact.testStatus ?? "",
          admissionStatus: contact.admissionStatus ?? "",
          courseCategory: contact.courseCategory ?? "",
          targetInstitution: contact.targetInstitution ?? "",
          intakeOrBatch: contact.intakeOrBatch ?? "",
          employmentStatus: contact.employmentStatus ?? "",
          entranceStatus: contact.entranceStatus ?? "",
        }}
      />
    </div>
  );
}
