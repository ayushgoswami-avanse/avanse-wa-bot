import Link from "next/link";
import { getLeadRows } from "@/lib/reporting";

const TEMP_STYLES: Record<string, string> = {
  Hot: "bg-red-100 text-red-700",
  Warm: "bg-amber-100 text-amber-700",
  Cold: "bg-slate-100 text-slate-500",
};

const SENTIMENT_STYLES: Record<string, string> = {
  POSITIVE: "bg-emerald-100 text-emerald-700",
  NEUTRAL: "bg-slate-100 text-slate-500",
  NEGATIVE: "bg-red-100 text-red-700",
};

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            One row per contact — sessions, sentiment, persona/cohort and qualification rolled up for Sales and marketing
            automation targeting.
          </p>
        </div>
        <a
          href="/api/admin/leads/export"
          className="rounded-md bg-slate-900 text-white text-sm px-4 py-2 hover:bg-slate-800 shrink-0"
        >
          Download CSV
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-red-600 uppercase font-medium">Hot</div>
          <div className="text-2xl font-semibold text-slate-900">{counts.Hot}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-amber-600 uppercase font-medium">Warm</div>
          <div className="text-2xl font-semibold text-slate-900">{counts.Warm}</div>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="text-xs text-slate-500 uppercase font-medium">Cold</div>
          <div className="text-2xl font-semibold text-slate-900">{counts.Cold}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/admin/leads"
          className={`px-3 py-1.5 rounded-md ${!persona ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
        >
          All personas ({allLeads.length})
        </Link>
        {personas.map(([label, count]) => (
          <Link
            key={label}
            href={`/admin/leads?persona=${encodeURIComponent(label)}`}
            className={`px-3 py-1.5 rounded-md ${persona === label ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600"}`}
          >
            {label} ({count})
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Persona / Cohort</th>
              <th className="text-left px-4 py-2">Segment tags</th>
              <th className="text-left px-4 py-2">Stage</th>
              <th className="text-left px-4 py-2">Temperature</th>
              <th className="text-left px-4 py-2">Sessions</th>
              <th className="text-left px-4 py-2">Sentiment</th>
              <th className="text-left px-4 py-2">Qualified</th>
              <th className="text-left px-4 py-2">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/admin/transcripts/${l.id}`} className="text-blue-600 hover:underline font-mono text-xs">
                    {l.waId}
                  </Link>
                </td>
                <td className="px-4 py-2">{l.name || "—"}</td>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-900">{l.personaLabel}</div>
                  <div className="text-xs text-slate-400">{l.cohortLabel}</div>
                </td>
                <td className="px-4 py-2">
                  {l.segmentTags ? (
                    <div className="flex flex-wrap gap-1">
                      {l.segmentTags.split(", ").map((tag) => (
                        <span key={tag} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">{l.stage}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs ${TEMP_STYLES[l.leadTemperature]}`}>{l.leadTemperature}</span>
                </td>
                <td className="px-4 py-2">{l.interactionSessionCount}</td>
                <td className="px-4 py-2">
                  {l.lastSentiment ? (
                    <span className={`px-2 py-0.5 rounded text-xs ${SENTIMENT_STYLES[l.lastSentiment]}`}>{l.lastSentiment.toLowerCase()}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2">{l.isQualifiedLead ? "Yes" : "No"}</td>
                <td className="px-4 py-2">{new Date(l.lastActiveAt).toLocaleString()}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
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
