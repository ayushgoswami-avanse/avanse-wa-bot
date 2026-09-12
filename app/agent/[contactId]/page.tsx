import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import ConversationView from "@/components/ConversationView";
import SendBox from "./SendBox";
import HandoverControls from "./HandoverControls";

export default async function AgentThreadPage({ params }: { params: Promise<{ contactId: string }> }) {
  const { contactId } = await params;
  const session = await getSession();

  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const messages = await prisma.message.findMany({ where: { contactId }, orderBy: { createdAt: "asc" } });
  const handover = await prisma.handover.findFirst({ where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } } });
  const { inWindow } = await computeServiceWindow(contactId);
  const templates = await prisma.messageTemplate.findMany({ where: { metaApprovalState: "approved" } });

  if (session) await prisma.transcriptView.create({ data: { contactId, agentId: session.sub } });
  const showFinancials = session ? canViewFinancials(session.role) : false;

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5 max-h-[65vh] overflow-y-auto">
          <ConversationView messages={messages} />
        </div>
        <SendBox contactId={contact.id} inWindow={inWindow} templates={templates.map((t) => ({ name: t.name, category: t.category }))} />
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-sm space-y-2">
          <div className="font-semibold text-slate-900 font-mono text-xs">{contact.waId}</div>
          <Row label="Journey" value={contact.journey ?? "—"} />
          <Row label="Stage" value={contact.stage} />
          <Row label="Window" value={inWindow ? "In window (free-form OK)" : "Closed (template only)"} />
          <Row label="Attribution" value={contact.attributionTier ?? "—"} />
          <Row label="Propensity" value={contact.propensityBand ?? "—"} />
          {showFinancials ? (
            <Row label="Destination/course" value={contact.destinationCountry ?? contact.courseCategory ?? "—"} />
          ) : (
            <div className="text-xs text-slate-400 italic">Course/financial detail masked for your role</div>
          )}
        </div>

        <HandoverControls contactId={contact.id} handover={handover} />
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
