import { prisma } from "@/lib/prisma";
import PayoutActions from "./PayoutActions";
import SimulateDisbursement from "./SimulateDisbursement";

export default async function PayoutsPage() {
  const payouts = await prisma.ambassadorPayout.findMany({
    orderBy: { createdAt: "desc" },
    include: { ambassador: true },
  });
  const ambassadors = await prisma.ambassador.findMany();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Ambassador payouts</h1>
        <p className="text-sm text-slate-500">FR-I04 — first-touch reconciliation, review queue, clawback.</p>
      </div>

      <SimulateDisbursement ambassadors={ambassadors} />

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Ambassador</th>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Attribution tier</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payouts.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2">{p.ambassador.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{p.contactWaId}</td>
                <td className="px-4 py-2">₹{p.amount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-2">{p.attributionTier}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      p.status === "APPROVED" || p.status === "PAID"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.status === "HELD" || p.status === "CLAWED_BACK"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <PayoutActions id={p.id} status={p.status} />
                </td>
              </tr>
            ))}
            {payouts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No payouts yet — simulate a disbursement above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
