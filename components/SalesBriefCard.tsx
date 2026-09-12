import type { SalesBrief } from "@/lib/salesBrief";
import { Tag } from "@/components/ui/Badge";

/** Shared between the admin transcript page and the agent thread page — one brief,
 * computed once from structured data (lib/salesBrief.ts), rendered in both places. No
 * extra LLM call is made to show this a second time in a different console.
 */
export default function SalesBriefCard({
  brief,
  waId,
  segmentTags,
  compact = false,
}: {
  brief: SalesBrief;
  waId: string;
  segmentTags?: string[];
  compact?: boolean;
}) {
  return (
    <div className="animate-slide-up bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="text-xs font-medium text-brand-teal-dark uppercase tracking-wide">Sales brief</div>
          <h1 className={`font-semibold text-slate-900 ${compact ? "text-base" : "text-lg"}`}>{brief.headline}</h1>
          {segmentTags && segmentTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {segmentTags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>
        <div className="font-mono text-xs text-slate-400 shrink-0">{waId}</div>
      </div>

      {brief.flags.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {brief.flags.map((f) => (
            <div key={f} className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
              <span>⚠</span>
              <span>{f}</span>
            </div>
          ))}
        </div>
      )}

      <div className={`grid gap-x-8 gap-y-2 text-sm mb-3 ${compact ? "grid-cols-1" : "grid-cols-2"}`}>
        <BriefRow label="Temperature" value={brief.temperatureLine} />
        <BriefRow label="Qualification" value={brief.qualificationLine} />
        <BriefRow label="Journey" value={brief.journeyLine} />
        <BriefRow label="Attribution" value={brief.attributionLine} />
        <BriefRow label="Engagement" value={brief.engagementLine} />
        <BriefRow label="Last activity" value={brief.latestActivity} />
      </div>

      <div className="rounded-lg bg-gradient-to-r from-brand-teal-dark to-brand-deep text-white text-sm px-4 py-3">
        <span className="font-semibold">Next action: </span>
        {brief.nextAction}
      </div>
    </div>
  );
}

function BriefRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400 text-xs">{label}: </span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
