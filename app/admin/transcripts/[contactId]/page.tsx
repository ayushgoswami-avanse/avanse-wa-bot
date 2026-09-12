import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import SalesBriefCard, { type BriefFact } from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import { buildLeadTimeline } from "@/lib/timeline";
import LiveTranscript from "./LiveTranscript";
import LeadTimeline from "@/components/LeadTimeline";
import DispositionPanel from "@/components/DispositionPanel";
import DeleteLeadButton from "@/components/DeleteLeadButton";

export default async function TranscriptDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const session = await getSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const messages = await prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } });
  const sessions = await prisma.interactionSession.findMany({ where: { contactId }, orderBy: { startedAt: "desc" } });
  const openHandover = await prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } });
  const handoffTokens = await prisma.handoffToken.findMany({ where: { contactId } });
  const { inWindow } = await computeServiceWindow(contactId);
  const notes = await prisma.agentNote.findMany({ where: { contactId }, orderBy: { createdAt: "desc" }, include: { author: true } });
  const { events } = await buildLeadTimeline(contact);

  // FR-H05 — every transcript view is logged with user, contact, timestamp.
  if (session) {
    await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  }

  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, openHandover, handoffTokens);
  const cohort = computeCohort(contact);
  const isAdmin = session?.role === "ADMIN";

  const facts: BriefFact[] = [
    { label: "Stage", value: contact.stage.replaceAll("_", " ").toLowerCase() },
    { label: "Window", value: inWindow ? "Open" : "Closed" },
    { label: "Attribution", value: contact.attributionTier ?? "—" },
    { label: "Sessions", value: String(contact.interactionSessionCount) },
    { label: "Qualified", value: contact.isQualifiedLead ? "Yes" : "No" },
    ...(showFinancials
      ? [{ label: "Course", value: contact.destinationCountry ?? contact.courseCategory ?? "—" }]
      : []),
    ...(contact.lastSentiment ? [{ label: "Sentiment", value: contact.lastSentiment.toLowerCase() }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <SalesBriefCard brief={brief} waId={contact.waId} temperature={bandToTemperature(contact.propensityBand)} facts={facts} segmentTags={cohort.segmentTags} />
        </div>
        {isAdmin && (
          <div className="shrink-0 pt-1">
            <DeleteLeadButton contactId={contact.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2">
          <LiveTranscript
            contactId={contact.id}
            initialMessages={messages}
            initialHandover={openHandover}
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
          />
        </div>
        <div>
          {session && (
            <DispositionPanel
              contactId={contact.id}
              currentDisposition={contact.disposition}
              initialNotes={notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), agentName: n.author.displayName }))}
            />
          )}
        </div>
      </div>

      <div className="animate-slide-up stagger-2">
        <h2 className="text-sm font-semibold text-slate-700 mb-2.5">Lead journey timeline</h2>
        <div className="max-w-2xl max-h-[480px] overflow-y-auto brand-scroll pr-2">
          <LeadTimeline events={events} />
        </div>
      </div>
    </div>
  );
}
