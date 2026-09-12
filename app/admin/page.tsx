import { prisma } from "@/lib/prisma";
import { getPilotMetrics, getLeadRows } from "@/lib/reporting";
import { StatCard } from "@/components/ui/StatCard";
import { TemperatureDonut } from "@/components/charts/TemperatureDonut";

function pct(v: number | null): string {
  return v === null ? "—" : `${(v * 100).toFixed(1)}%`;
}

export default async function AdminOverviewPage() {
  const [contacts, qualifiedLeads, handedOff, pendingHandovers, metrics, leads] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { isQualifiedLead: true } }),
    prisma.handoffToken.count({ where: { consumedAt: { not: null } } }),
    prisma.handover.count({ where: { status: "QUEUED" } }),
    getPilotMetrics(),
    getLeadRows(),
  ]);

  const tempCounts = { Hot: 0, Warm: 0, Cold: 0 };
  const personaCounts = new Map<string, number>();
  for (const l of leads) {
    tempCounts[l.leadTemperature]++;
    personaCounts.set(l.personaLabel, (personaCounts.get(l.personaLabel) ?? 0) + 1);
  }
  const topPersonas = Array.from(personaCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <h1 className="text-xl font-semibold text-slate-900">Overview</h1>
        <p className="text-sm text-slate-500">Live from this environment — nothing here is a projection.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Contacts (verified wa_id)" value={contacts} accent="blue" index={0} />
        <StatCard label="Qualified leads" value={qualifiedLeads} accent="teal" index={1} />
        <StatCard label="Handed off to DIY" value={handedOff} accent="teal" index={2} />
        <StatCard label="Pending human handovers" value={pendingHandovers} accent={pendingHandovers > 0 ? "red" : "slate"} index={3} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="animate-slide-up stagger-1 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Lead temperature</h2>
          <TemperatureDonut hot={tempCounts.Hot} warm={tempCounts.Warm} cold={tempCounts.Cold} />
          <div className="flex justify-center gap-4 text-xs mt-1">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />Hot {tempCounts.Hot}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Warm {tempCounts.Warm}</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" />Cold {tempCounts.Cold}</span>
          </div>
        </div>

        <div className="col-span-2 animate-slide-up stagger-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Top personas</h2>
          <div className="space-y-2.5">
            {topPersonas.map(([label, count]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-48 text-sm text-slate-700 truncate">{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-brand-teal to-brand-blue h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${leads.length ? (count / leads.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-xs text-slate-500 text-right">{count}</span>
              </div>
            ))}
            {topPersonas.length === 0 && <p className="text-sm text-slate-400">No leads yet.</p>}
          </div>
        </div>
      </div>

      <div className="animate-slide-up stagger-3">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Pilot instrumentation — the seven measurements (BRD §9.1)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Scan → send rate" value={pct(metrics.scanToSendRate)} sub={`${metrics.raw.consumedClicks}/${metrics.raw.totalClicks} clicks`} accent="blue" />
          <StatCard label="Chat-start (abroad-intent)" value="—" sub="needs campus population data" accent="slate" />
          <StatCard label="Contact → qualified lead" value={pct(metrics.contactToQualifiedLeadRate)} sub={`${metrics.raw.qualifiedContacts}/${metrics.raw.totalContacts} contacts`} accent="teal" />
          <StatCard label="Qualified lead → login" value="—" sub="needs real DIY logins" accent="slate" />
          <StatCard label="High-confidence attribution" value={pct(metrics.attributionConfidenceMix.highPct)} sub="alert if < 90%" accent="teal" />
          <StatCard label="Live grounding share" value={pct(metrics.liveGroundingSharePct)} sub="target: ≥80% reduction vs unrouted" accent="blue" />
          <StatCard label="Semantic cache hit rate" value={pct(metrics.cacheHitRatePct)} accent="teal" />
          <StatCard label="Block & report rate" value="—" sub="simulate via Settings → Quality rating" accent="slate" />
        </div>
      </div>

      <div className="animate-slide-up stagger-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Attribution confidence mix</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-2 shadow-sm">
          {Object.entries(metrics.attributionConfidenceMix.counts).map(([tier, count]) => (
            <div key={tier} className="flex items-center gap-3">
              <span className="w-32 text-xs text-slate-500">{tier}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-brand-teal-dark to-brand-deep h-3 rounded-full transition-all duration-700"
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
