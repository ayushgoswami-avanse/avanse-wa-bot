import { prisma } from "@/lib/prisma";

export default async function CostsPage() {
  const entries = await prisma.costLedgerEntry.groupBy({
    by: ["category"],
    _sum: { amountInr: true, units: true },
  });

  const groundingLogs = await prisma.groundingLog.count({ where: { queryClass: "LIVE_GROUNDED" } });
  const cacheHits = await prisma.groundingLog.count({ where: { cacheHit: true } });
  const totalQueries = await prisma.groundingLog.count();
  const qualifiedLeads = await prisma.contact.count({ where: { isQualifiedLead: true } });

  const totalInr = entries.reduce((sum, e) => sum + (e._sum.amountInr ?? 0), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Cost reporting</h1>
        <p className="text-sm text-slate-500">FR-I06/I07 — messaging and AI spend, by category, with per-qualified-lead unit economics.</p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-left px-4 py-2">Units</th>
              <th className="text-left px-4 py-2">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((e) => (
              <tr key={e.category}>
                <td className="px-4 py-2">{e.category}</td>
                <td className="px-4 py-2">{e._sum.units ?? "—"}</td>
                <td className="px-4 py-2">₹{(e._sum.amountInr ?? 0).toFixed(2)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No spend recorded yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-medium">
              <td className="px-4 py-2">Total</td>
              <td></td>
              <td className="px-4 py-2">₹{totalInr.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase">Grounded calls</div>
          <div className="text-2xl font-semibold">{groundingLogs}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase">Cache hit rate</div>
          <div className="text-2xl font-semibold">{totalQueries > 0 ? `${((cacheHits / totalQueries) * 100).toFixed(0)}%` : "—"}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-5">
          <div className="text-xs text-slate-500 uppercase">Messaging cost / qualified lead</div>
          <div className="text-2xl font-semibold">{qualifiedLeads > 0 ? `₹${(totalInr / qualifiedLeads).toFixed(0)}` : "—"}</div>
        </div>
      </div>
    </div>
  );
}
