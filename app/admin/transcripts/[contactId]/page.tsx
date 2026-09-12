import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import SalesBriefCard from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { computeCohort } from "@/lib/segmentation";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import LiveTranscript from "./LiveTranscript";

export default async function TranscriptDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const session = await getSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const messages = await prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } });
  const sessions = await prisma.interactionSession.findMany({ where: { contactId }, orderBy: { startedAt: "desc" } });
  const openHandover = await prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } });
  const handoffTokens = await prisma.handoffToken.findMany({ where: { contactId } });
  const { inWindow } = await computeServiceWindow(contactId);

  // FR-H05 — every transcript view is logged with user, contact, timestamp.
  if (session) {
    await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  }

  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, openHandover, handoffTokens);
  const cohort = computeCohort(contact);

  return (
    <div className="space-y-6">
      <SalesBriefCard brief={brief} waId={contact.waId} segmentTags={cohort.segmentTags} />

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
              <div className="text-xs text-slate-500 italic">Financial/course detail masked for your role (FR-H06)</div>
            )}
            <Row label="Sessions" value={String(contact.interactionSessionCount)} />
            <Row label="Last sentiment" value={contact.lastSentiment ?? "—"} />
          </div>

          <div className="animate-slide-up stagger-2 bg-white rounded-2xl border border-slate-200 p-4 text-sm space-y-3 shadow-sm">
            <div className="font-semibold text-slate-900">Interaction sessions</div>
            {sessions.length === 0 && <div className="text-xs text-slate-500">No sessions recorded yet.</div>}
            {sessions.map((s) => (
              <div key={s.id} className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{new Date(s.startedAt).toLocaleString()}</span>
                  <span>
                    {s.messageCount} msgs{s.sentiment ? ` · ${s.sentiment.toLowerCase()}` : ""}
                  </span>
                </div>
                {s.summary && <div className="text-xs text-slate-700 whitespace-pre-wrap mt-1">{s.summary}</div>}
              </div>
            ))}
          </div>
        </div>
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
