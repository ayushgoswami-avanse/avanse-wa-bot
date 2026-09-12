import Link from "next/link";
import { getLeadRows } from "@/lib/reporting";
import { StatCard } from "@/components/ui/StatCard";
import { Avatar, TemperatureBadge, SentimentBadge, DispositionBadge, Tag } from "@/components/ui/Badge";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ persona?: string }>;
}) {
  const { persona } = await searchParams;
  const allLeads = await getLeadRows();
  const leads = persona ? allLeads.filter((l) => l.personaLabel === persona) : allLeads;

  const counts = { Hot: 0, Warm: 0, Cold: 0 };
  for (const l of leads) counts[l.leadTemperature]++;

  const personaCounts = new Map<string, number>();
  for (const l of allLeads) personaCounts.set(l.personaLabel, (personaCounts.get(l.personaLabel) ?? 0) + 1);
  const personas = Array.from(personaCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            One row per contact — sessions, sentiment, persona/cohort and qualification rolled up for Sales and marketing
            automation targeting.
          </p>
        </div>
        <a
          href="/api/admin/leads/export"
          className="rounded-lg bg-brand-teal-dark text-white text-sm px-4 py-2 hover:bg-brand-deep transition-colors shadow-sm shrink-0 flex items-center gap-1.5"
        >
          <span>⬇</span> Download CSV
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Hot" value={counts.Hot} accent="red" index={0} />
        <StatCard label="Warm" value={counts.Warm} accent="amber" index={1} />
        <StatCard label="Cold" value={counts.Cold} accent="slate" index={2} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm animate-fade-in">
        <Link
          href="/admin/leads"
          className={`px-3 py-1.5 rounded-full transition-colors ${!persona ? "bg-brand-teal-dark text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-brand-teal/40"}`}
        >
          All personas ({allLeads.length})
        </Link>
        {personas.map(([label, count]) => (
          <Link
            key={label}
            href={`/admin/leads?persona=${encodeURIComponent(label)}`}
            className={`px-3 py-1.5 rounded-full transition-colors ${persona === label ? "bg-brand-teal-dark text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-brand-teal/40"}`}
          >
            {label} ({count})
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Persona / Cohort</th>
              <th className="text-left px-4 py-2">Segment tags</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">Disposition</th>
              <th className="text-left px-4 py-2">Temperature</th>
              <th className="text-left px-4 py-2">Sessions</th>
              <th className="text-left px-4 py-2">Sentiment</th>
              <th className="text-left px-4 py-2">Qualified</th>
              <th className="text-left px-4 py-2">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l, i) => (
              <tr key={l.id} className="animate-fade-in hover:bg-brand-teal-50/40 transition-colors" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                <td className="px-4 py-2.5">
                  <Link href={`/admin/transcripts/${l.id}`} className="flex items-center gap-2.5 group">
                    <Avatar name={l.name || l.waId} />
                    <div>
                      <div className="font-mono text-xs text-slate-600 group-hover:text-brand-teal-dark transition-colors">{l.waId}</div>
                      {l.name && <div className="text-xs text-slate-500">{l.name}</div>}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-900">{l.personaLabel}</div>
                  <div className="text-xs text-slate-500">{l.cohortLabel}</div>
                </td>
                <td className="px-4 py-2.5">
                  {l.segmentTags ? (
                    <div className="flex flex-wrap gap-1">
                      {l.segmentTags.split(", ").map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-600">{l.stage}</td>
                <td className="px-4 py-2.5">
                  <DispositionBadge value={l.disposition} />
                </td>
                <td className="px-4 py-2.5">
                  <TemperatureBadge value={l.leadTemperature} />
                </td>
                <td className="px-4 py-2.5 text-slate-600">{l.interactionSessionCount}</td>
                <td className="px-4 py-2.5">
                  <SentimentBadge value={l.lastSentiment} />
                </td>
                <td className="px-4 py-2.5 text-slate-600">{l.isQualifiedLead ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5 text-slate-500">{new Date(l.lastActiveAt).toLocaleString()}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                  No leads match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
