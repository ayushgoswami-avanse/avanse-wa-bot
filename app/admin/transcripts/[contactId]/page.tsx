import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import SalesBriefCard from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { buildLeadFacts } from "@/lib/leadFacts";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import { buildLeadTimeline } from "@/lib/timeline";
import { getAttributionSource } from "@/lib/attribution";
import LiveTranscript from "./LiveTranscript";
import LeadTimeline from "@/components/LeadTimeline";
import DispositionPanel from "@/components/DispositionPanel";
import ProfileFieldsPanel from "@/components/ProfileFieldsPanel";
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
  const source = await getAttributionSource(contact);

  // FR-H05 — every transcript view is logged with user, contact, timestamp.
  if (session) {
    await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  }

  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, openHandover, handoffTokens);
  const cohort = computeCohort(contact);
  const isAdmin = session?.role === "ADMIN";
  const facts = buildLeadFacts(contact, { inWindow, showFinancials, sourceSummary: source.summary });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lead journey</h2>
        <LeadTimeline events={events} />
      </div>

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
        <div className="space-y-4">
          {session && (
            <DispositionPanel
              contactId={contact.id}
              currentDisposition={contact.disposition}
              initialNotes={notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), agentName: n.author.displayName }))}
            />
          )}
          {session && (
            <ProfileFieldsPanel
              contactId={contact.id}
              initial={{
                confirmedName: contact.confirmedName ?? "",
                journey: contact.journey ?? "",
                destinationCountry: contact.destinationCountry ?? "",
                degreeLevel: contact.degreeLevel ?? "",
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
          )}
        </div>
      </div>
    </div>
  );
}
