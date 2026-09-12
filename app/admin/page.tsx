import { prisma } from "@/lib/prisma";
import { getPilotMetrics } from "@/lib/reporting";

function pct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const [contacts, qualifiedLeads, handedOff, pendingHandovers, metrics] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { isQualifiedLead: true } }),
    prisma.handoffToken.count({ where: { consumedAt: { not: null } } }),
    prisma.handover.count({ where: { status: "QUEUED" } }),
    getPilotMetrics(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Live from this environment — nothing here is a projection.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Contacts (verified wa_id)" value={String(contacts)} />
        <StatCard label="Qualified leads" value={String(qualifiedLeads)} />
        <StatCard label="Handed off to DIY" value={String(handedOff)} />
        <StatCard label="Pending human handovers" value={String(pendingHandovers)} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Pilot instrumentation — the seven measurements (BRD §9.1)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Scan → send rate" value={pct(metrics.scanToSendRate)} sub={`${metrics.raw.consumedClicks}/${metrics.raw.totalClicks} clicks`} />
          <StatCard label="Chat-start (abroad-intent)" value="—" sub="needs campus population data" />
          <StatCard label="Contact → qualified lead" value={pct(metrics.contactToQualifiedLeadRate)} sub={`${metrics.raw.qualifiedContacts}/${metrics.raw.totalContacts} contacts`} />
          <StatCard label="Qualified lead → login" value="—" sub="needs real DIY logins" />
          <StatCard label="High-confidence attribution" value={pct(metrics.attributionConfidenceMix.highPct)} sub="alert if < 90%" />
          <StatCard label="Live grounding share" value={pct(metrics.liveGroundingSharePct)} sub="target: ≥80% reduction vs unrouted" />
          <StatCard label="Semantic cache hit rate" value={pct(metrics.cacheHitRatePct)} />
          <StatCard label="Block & report rate" value="—" sub="simulate via Settings → Quality rating" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Attribution confidence mix</h2>
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-2">
          {Object.entries(metrics.attributionConfidenceMix.counts).map(([tier, count]) => (
            <div key={tier} className="flex items-center gap-3">
              <span className="w-32 text-xs text-slate-500">{tier}</span>
              <div className="flex-1 bg-slate-100 rounded h-3 overflow-hidden">
                <div
                  className="bg-slate-900 h-3"
                  style={{ width: `${metrics.raw.totalContacts ? (Number(count) / metrics.raw.totalContacts) * 100 : 0}%` }}
                />
              </div>
              <span className="w-10 text-xs text-slate-500 text-right">{String(count)}</span>
            </div>
          ))}
          {Object.keys(metrics.attributionConfidenceMix.counts).length === 0 && (
            <p className="text-sm text-slate-400">No contacts yet — scan a QR code or open the web chat to generate one.</p>
          )}
        </div>
      </div>
    </div>
  );
}
