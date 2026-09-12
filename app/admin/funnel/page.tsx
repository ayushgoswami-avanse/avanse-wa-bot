import { getFunnelByDimension } from "@/lib/reporting";

export default async function FunnelPage() {
  const { byCollege, byJourney, totalContacts } = await getFunnelByDimension();
  const maxCollege = Math.max(1, ...byCollege.map((c) => c.contacts));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Funnel &amp; attribution reporting</h1>
        <p className="text-sm text-slate-500">FR-I02/I03 — every funnel step, reportable by college, spot, ambassador, channel and journey.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {byJourney.map((j) => (
          <div key={j.journey} className="bg-white rounded-lg border border-slate-200 p-5">
            <div className="text-xs text-slate-500 uppercase">{j.journey}</div>
            <div className="text-2xl font-semibold text-slate-900">{j.count}</div>
            <div className="text-xs text-slate-400">{totalContacts > 0 ? `${((j.count / totalContacts) * 100).toFixed(0)}% of contacts` : ""}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Contacts & qualified leads by college</h2>
        <div className="space-y-3">
          {byCollege.map((c) => (
            <div key={c.college}>
              <div className="flex justify-between text-xs text-slate-600 mb-1">
                <span>{c.college}</span>
                <span>{c.qualified}/{c.contacts} qualified</span>
              </div>
              <div className="w-full bg-slate-100 rounded h-3 overflow-hidden flex">
                <div className="bg-slate-900 h-3" style={{ width: `${(c.contacts / maxCollege) * 100}%` }} />
              </div>
            </div>
          ))}
          {byCollege.length === 0 && <p className="text-sm text-slate-400">No attributed contacts yet.</p>}
        </div>
      </div>
    </div>
  );
}
