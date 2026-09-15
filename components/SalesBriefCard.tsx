import type { SalesBrief } from "@/lib/salesBrief";
import type { FactSection } from "@/lib/leadFacts";
import { Avatar, TemperatureBadge, Tag } from "@/components/ui/Badge";

export type BriefFact = { label: string; value: string };

/** Shared between the admin transcript page and the agent thread page — one brief,
 * computed once from structured data (lib/salesBrief.ts), rendered in both places. No
 * extra LLM call is made to show this a second time in a different console.
 *
 * Deliberately compact: everything a sales rep needs in one glance — name/persona,
 * temperature, stage/window/attribution/etc as small fact chips, one flag banner if
 * escalated, and the next action — without the tall stacked layout that used to push
 * the actual conversation below the fold.
 */
export default function SalesBriefCard({
  brief,
  waId,
  temperature,
  sections,
  segmentTags,
}: {
  brief: SalesBrief;
  waId: string;
  temperature: "Hot" | "Warm" | "Cold";
  sections: FactSection[];
  segmentTags?: string[];
}) {
  return (
    <div className="animate-slide-up bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={brief.headline} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h1 className="font-semibold text-slate-900 text-sm truncate">{brief.headline}</h1>
            <span className="font-mono text-[11px] text-slate-400 shrink-0">{waId}</span>
          </div>
          {segmentTags && segmentTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {segmentTags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>
        <TemperatureBadge value={temperature} />
      </div>

      {brief.flags.length > 0 && (
        <div className="mt-2.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-1.5 flex items-start gap-1.5">
          <span>⚠</span>
          <span className="flex-1">{brief.flags.join(" · ")}</span>
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        {sections.map((section) => (
          <div key={section.title}>
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{section.title}</div>
            <div className="flex flex-wrap gap-1.5">
              {section.facts.map((f) => {
                const isNull = f.value === "null";
                return (
                  <span
                    key={f.label}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] ${
                      isNull ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <span className="text-slate-500">{f.label}</span>
                    <span className={isNull ? "italic text-amber-600" : "font-medium text-slate-800"}>{f.value}</span>
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
        <div className="rounded-lg bg-gradient-to-r from-brand-teal-dark to-brand-deep text-white text-[11.5px] px-3 py-1.5 leading-snug">
          <span className="font-semibold">Next: </span>
          {brief.nextAction}
        </div>
        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{brief.latestActivity}</p>
      </div>
    </div>
  );
}
