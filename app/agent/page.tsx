import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";

export default async function AgentThreadListPage({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string; band?: string; handoverOnly?: string }>;
}) {
  const filters = await searchParams;

  const contacts = await prisma.contact.findMany({
    where: {
      journey: filters.journey ? (filters.journey as "INTERNATIONAL" | "DOMESTIC") : undefined,
      propensityBand: filters.band ? (filters.band as "HIGH" | "MEDIUM" | "LOW") : undefined,
      ...(filters.handoverOnly === "1" ? { handovers: { some: { status: "QUEUED" } } } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { handovers: { where: { status: "QUEUED" }, take: 1 } },
  });

  const withWindow = await Promise.all(
    contacts.map(async (c) => ({ contact: c, window: await computeServiceWindow(c.id) }))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-sm">
        <FilterLink label="All" href="/agent" active={!filters.journey && !filters.band && filters.handoverOnly !== "1"} />
        <FilterLink label="International" href="/agent?journey=INTERNATIONAL" active={filters.journey === "INTERNATIONAL"} />
        <FilterLink label="Domestic" href="/agent?journey=DOMESTIC" active={filters.journey === "DOMESTIC"} />
        <FilterLink label="High propensity" href="/agent?band=HIGH" active={filters.band === "HIGH"} />
        <FilterLink label="Needs human" href="/agent?handoverOnly=1" active={filters.handoverOnly === "1"} />
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Journey</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">Propensity</th>
              <th className="text-left px-4 py-2">Window</th>
              <th className="text-left px-4 py-2">Handover</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {withWindow.map(({ contact: c, window }) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/agent/${c.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {c.waId}
                  </Link>
                </td>
                <td className="px-4 py-2">{c.journey ?? "—"}</td>
                <td className="px-4 py-2">{c.stage}</td>
                <td className="px-4 py-2">{c.propensityBand ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${window.inWindow ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {window.inWindow ? "In window" : "Needs template"}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {c.handovers.length > 0 ? <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">Queued</span> : "—"}
                </td>
              </tr>
            ))}
            {withWindow.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No conversations match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className={`px-3 py-1.5 rounded-md ${active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
      {label}
    </Link>
  );
}
