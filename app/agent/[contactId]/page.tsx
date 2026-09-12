import { prisma } from "@/lib/prisma";
import { getSession, canViewFinancials } from "@/lib/auth";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import ConversationView from "@/components/ConversationView";
import SalesBriefCard from "@/components/SalesBriefCard";
import { buildSalesBrief } from "@/lib/salesBrief";
import { computeCohort } from "@/lib/segmentation";
import SendBox from "./SendBox";
import HandoverControls from "./HandoverControls";

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

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="animate-fade-in bg-white rounded-xl border border-slate-200 p-5 max-h-[55vh] overflow-y-auto brand-scroll shadow-sm">
            <ConversationView messages={messages} />
          </div>
          <SendBox contactId={contact.id} inWindow={inWindow} templates={templates.map((t) => ({ name: t.name, category: t.category }))} />
        </div>

        <div className="space-y-4">
          <div className="animate-slide-up stagger-1 bg-white rounded-xl border border-slate-200 p-4 text-sm space-y-2 shadow-sm">
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

          <div className="animate-slide-up stagger-2">
            <HandoverControls contactId={contact.id} handover={handover} />
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
