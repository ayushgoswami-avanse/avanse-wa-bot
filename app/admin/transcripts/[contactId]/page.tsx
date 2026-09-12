import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import ConversationView from "@/components/ConversationView";
import { buildSalesBrief } from "@/lib/salesBrief";

export default async function TranscriptDetailPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const session = await getSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const messages = await prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } });
  const sessions = await prisma.interactionSession.findMany({ where: { contactId }, orderBy: { startedAt: "desc" } });
  const openHandover = await prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } });
  const handoffTokens = await prisma.handoffToken.findMany({ where: { contactId } });

  // FR-H05 — every transcript view is logged with user, contact, timestamp.
  if (session) {
    await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  }

  const showFinancials = session ? canViewFinancials(session.role) : false;
  const brief = buildSalesBrief(contact, sessions, openHandover, handoffTokens);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wide">Sales brief</div>
            <h1 className="text-lg font-semibold text-slate-900">{brief.headline}</h1>
          </div>
          <div className="font-mono text-xs text-slate-400">{contact.waId}</div>
        </div>

        {brief.flags.length > 0 && (
          <div className="mb-3 space-y-1">
            {brief.flags.map((f) => (
              <div key={f} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-3 py-1.5">
                ⚠ {f}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-3">
          <BriefRow label="Temperature" value={brief.temperatureLine} />
          <BriefRow label="Qualification" value={brief.qualificationLine} />
          <BriefRow label="Journey" value={showFinancials ? brief.journeyLine : "masked for your role"} />
          <BriefRow label="Attribution" value={brief.attributionLine} />
          <BriefRow label="Engagement" value={brief.engagementLine} />
          <BriefRow label="Last activity" value={brief.latestActivity} />
        </div>

        <div className="rounded-md bg-slate-900 text-white text-sm px-4 py-3">
          <span className="font-medium">Next action: </span>
          {brief.nextAction}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-lg border border-slate-200 p-5 max-h-[70vh] overflow-y-auto">
          <ConversationView messages={messages} />
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm space-y-2">
            <div className="font-semibold text-slate-900 font-mono text-xs">{contact.waId}</div>
            <Row label="Journey" value={contact.journey ?? "—"} />
            <Row label="Stage" value={contact.stage} />
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

          <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm space-y-3">
            <div className="font-semibold text-slate-900">Interaction sessions</div>
            {sessions.length === 0 && <div className="text-xs text-slate-400">No sessions recorded yet.</div>}
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
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400 text-xs">{label}: </span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
