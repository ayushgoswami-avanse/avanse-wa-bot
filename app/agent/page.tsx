import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeServiceWindow } from "@/lib/messaging/sendGovernor";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar, TemperatureBadge, StageBadge, SentimentBadge } from "@/components/ui/Badge";

export default async function AgentThreadListPage({
  searchParams,
}: {
  searchParams: Promise<{ journey?: string; band?: string; handoverOnly?: string }>;
}) {
  const filters = await searchParams;

  const [contacts, queuedCount, claimedCount, totalActive] = await Promise.all([
    prisma.contact.findMany({
      where: {
        journey: filters.journey ? (filters.journey as "INTERNATIONAL" | "DOMESTIC") : undefined,
        propensityBand: filters.band ? (filters.band as "HIGH" | "MEDIUM" | "LOW") : undefined,
        ...(filters.handoverOnly === "1" ? { handovers: { some: { status: "QUEUED" } } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: { handovers: { where: { status: { in: ["QUEUED", "CLAIMED"] } }, take: 1 } },
    }),
    prisma.handover.count({ where: { status: "QUEUED" } }),
    prisma.handover.count({ where: { status: "CLAIMED" } }),
    prisma.contact.count({ where: { stage: { notIn: ["DECLINED", "MINOR_CONTENT_ONLY"] } } }),
  ]);

  const withWindow = await Promise.all(contacts.map(async (c) => ({ contact: c, window: await computeServiceWindow(c.id) })));

  // Surface what needs attention first: queued handovers, then claimed, then the rest by recency.
  withWindow.sort((a, b) => {
    const rank = (h: (typeof a.contact.handovers)[number] | undefined) => (h?.status === "QUEUED" ? 0 : h?.status === "CLAIMED" ? 1 : 2);
    return rank(a.contact.handovers[0]) - rank(b.contact.handovers[0]);
  });

  const hotCount = contacts.filter((c) => c.propensityBand === "HIGH").length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Needs a human now" value={queuedCount} accent="red" index={0} sub={queuedCount > 0 ? "waiting in queue" : "all clear"} />
        <StatCard label="Claimed by an agent" value={claimedCount} accent="amber" index={1} />
        <StatCard label="Hot leads" value={hotCount} accent="teal" index={2} sub="in current view" />
        <StatCard label="Active conversations" value={totalActive} accent="blue" index={3} />
      </div>

      <div className="flex items-center gap-2 text-sm">
        <FilterLink label="All" href="/agent" active={!filters.journey && !filters.band && filters.handoverOnly !== "1"} />
        <FilterLink label="International" href="/agent?journey=INTERNATIONAL" active={filters.journey === "INTERNATIONAL"} />
        <FilterLink label="Domestic" href="/agent?journey=DOMESTIC" active={filters.journey === "DOMESTIC"} />
        <FilterLink label="Hot" href="/agent?band=HIGH" active={filters.band === "HIGH"} />
        <FilterLink label="Needs human" href="/agent?handoverOnly=1" active={filters.handoverOnly === "1"} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Persona</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">Temperature</th>
              <th className="text-left px-4 py-2">Sentiment</th>
              <th className="text-left px-4 py-2">Window</th>
              <th className="text-left px-4 py-2">Handover</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {withWindow.map(({ contact: c, window }, i) => {
              const cohort = computeCohort(c);
              const handover = c.handovers[0];
              return (
                <tr
                  key={c.id}
                  className="animate-fade-in hover:bg-brand-teal-50/40 transition-colors"
                  style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}
                >
                  <td className="px-4 py-2.5">
                    <Link href={`/agent/${c.id}`} className="flex items-center gap-2.5 group">
                      <Avatar name={c.confirmedName ?? c.profileName ?? c.waId} />
                      <span className="font-mono text-xs text-slate-600 group-hover:text-brand-teal-dark transition-colors">{c.waId}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{cohort.personaLabel}</td>
                  <td className="px-4 py-2.5">
                    <StageBadge stage={c.stage} />
                  </td>
                  <td className="px-4 py-2.5">
                    <TemperatureBadge value={bandToTemperature(c.propensityBand)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <SentimentBadge value={c.lastSentiment} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${window.inWindow ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"}`}>
                      {window.inWindow ? "In window" : "Needs template"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {handover ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${handover.status === "QUEUED" ? "bg-red-50 text-red-700 ring-1 ring-red-200 animate-pulse-ring" : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"}`}>
                        {handover.status === "QUEUED" ? "Waiting" : "Claimed"}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {withWindow.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
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
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full transition-colors ${
        active ? "bg-brand-teal-dark text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-brand-teal/40"
      }`}
    >
      {label}
    </Link>
  );
}
