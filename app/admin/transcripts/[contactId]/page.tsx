import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import SalesBriefCard from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { computeCohort } from "@/lib/segmentation";
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <SalesBriefCard brief={brief} waId={contact.waId} segmentTags={cohort.segmentTags} />
        </div>
        {isAdmin && (
          <div className="shrink-0 pt-1">
            <DeleteLeadButton contactId={contact.id} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
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
          <div className="animate-slide-up stagger-1 bg-white rounded-2xl border border-slate-200 p-4 text-sm space-y-2.5 shadow-sm">
            <div className="font-semibold text-slate-900 font-mono text-xs pb-1 border-b border-slate-100">{contact.waId}</div>
            <Row label="Journey" value={contact.journey ?? "—"} />
            <Row label="Stage" value={contact.stage.replaceAll("_", " ").toLowerCase()} />
            <Row label="Attribution" value={contact.attributionTier ?? "—"} />
            <Row label="Propensity" value={`${contact.propensityBand ?? "—"} (${contact.propensityScore})`} />
            <Row label="Qualified lead" value={contact.isQualifiedLead ? "Yes" : "No"} />
            {showFinancials ? (
              <>
                <Row label="Destination/course" value={contact.destinationCountry ?? contact.courseCategory ?? "—"} />
                <Row label="Level" value={contact.degreeLevel ?? "—"} />
              </>
            ) : (
              <div className="text-xs text-slate-400 italic">Financial/course detail masked for your role (FR-H06)</div>
            )}
            <Row label="Sessions" value={String(contact.interactionSessionCount)} />
            <Row label="Last sentiment" value={contact.lastSentiment ?? "—"} />
          </div>

          {session && <DispositionPanel contactId={contact.id} currentDisposition={contact.disposition} initialNotes={notes.map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString(), agentName: n.author.displayName }))} />}
        </div>
      </div>

      <div className="animate-slide-up stagger-2">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Lead journey timeline</h2>
        <LeadTimeline events={events} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 capitalize text-right">{value}</span>
    </div>
  );
}
