import Link from "next/link";
import { StatCard } from "@/components/ui/StatCard";
import { getCostDashboardData, getEvalRuns, PERIOD_LABELS, type Period, type KpiValue } from "@/lib/costMetrics";
import { RunEvalButton } from "../evals/RunEvalButton";

export const dynamic = "force-dynamic";

const PERIODS: Period[] = ["day", "week", "month", "year"];
const nf = new Intl.NumberFormat("en-IN");

function fmt(n: number): string {
  return nf.format(Math.round(n));
}
function fmtInr(n: number): string {
  return `₹${nf.format(Math.round(n))}`;
}
function deltaSub(k: KpiValue, unit?: (n: number) => string): string {
  const formatted = unit ? unit(k.value) : fmt(k.value);
  if (k.deltaPct === null) return `${formatted} · no prior-period data yet`;
  const sign = k.deltaPct >= 0 ? "+" : "";
  return `${formatted} · ${sign}${k.deltaPct.toFixed(0)}% vs prior period`;
}

function PeriodSwitcher({ period }: { period: Period }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 gap-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`/admin/costs?period=${p}`}
          className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
            p === period ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {p}
        </Link>
      ))}
    </div>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5">{description}</p>
    </div>
  );
}

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: rawPeriod } = await searchParams;
  const period: Period = PERIODS.includes(rawPeriod as Period) ? (rawPeriod as Period) : "week";

  const [data, evalRuns] = await Promise.all([getCostDashboardData(period), getEvalRuns()]);
  const { totals, perUser, perSession, groundingHealth, costLedger, costPerQualifiedLead } = data;

  const totalLedgerInr = costLedger.reduce((s, e) => s + e.amountInr, 0);
  const latestRun = evalRuns[0];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap animate-fade-in">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Cost &amp; observability reporting</h1>
          <p className="text-sm text-slate-500">
            AI token spend, grounding health, and messaging cost — {PERIOD_LABELS[period].toLowerCase()}, with quality evals below.
          </p>
        </div>
        <PeriodSwitcher period={period} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total spend this period"
          value={fmtInr(totals.aiCostInr.value + totals.messagingCostInr.value)}
          sub="AI tokens + WhatsApp messaging"
          accent="slate"
        />
        <StatCard
          label="Cost per qualified lead"
          value={costPerQualifiedLead !== null ? fmtInr(costPerQualifiedLead) : "—"}
          sub="Period spend ÷ qualified leads to date"
          accent="amber"
        />
        <StatCard
          label="Grounding cache hit rate"
          value={groundingHealth.cacheHitRate !== null ? `${(groundingHealth.cacheHitRate * 100).toFixed(0)}%` : "—"}
          sub={
            groundingHealth.invocationRate !== null
              ? `Invoked on ${(groundingHealth.invocationRate * 100).toFixed(0)}% of turns`
              : "No grounding decisions yet"
          }
          accent="blue"
        />
      </div>

      <section>
        <SectionHeading title="Total" description={`Everything the bot did, ${PERIOD_LABELS[period].toLowerCase()} (production traffic only — eval runs excluded).`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard index={0} label="Active students" value={fmt(totals.activeUsers.value)} sub={deltaSub(totals.activeUsers)} accent="teal" />
          <StatCard index={1} label="Sessions" value={fmt(totals.sessions.value)} sub={deltaSub(totals.sessions)} accent="teal" />
          <StatCard index={2} label="Grounding hits" value={fmt(totals.groundingHits.value)} sub={deltaSub(totals.groundingHits)} accent="blue" />
          <StatCard index={3} label="AI spend" value={fmtInr(totals.aiCostInr.value)} sub={deltaSub(totals.aiCostInr, fmtInr)} accent="amber" />
          <StatCard index={4} label="Input tokens" value={fmt(totals.inputTokens.value)} sub={deltaSub(totals.inputTokens)} accent="slate" />
          <StatCard index={5} label="Output tokens" value={fmt(totals.outputTokens.value)} sub={deltaSub(totals.outputTokens)} accent="slate" />
          <StatCard index={6} label="Total tokens" value={fmt(totals.totalTokens.value)} sub={deltaSub(totals.totalTokens)} accent="slate" />
          <StatCard index={7} label="Messaging spend" value={fmtInr(totals.messagingCostInr.value)} sub={deltaSub(totals.messagingCostInr, fmtInr)} accent="amber" />
        </div>
      </section>

      <section>
        <SectionHeading title="User-level" description="Averaged across every student who had at least one AI interaction this period." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard index={0} label="Avg input tokens / user" value={fmt(perUser.avgInputTokens)} accent="slate" />
          <StatCard index={1} label="Avg output tokens / user" value={fmt(perUser.avgOutputTokens)} accent="slate" />
          <StatCard index={2} label="Avg grounding hits / user" value={perUser.avgGroundingHits.toFixed(2)} accent="blue" />
          <StatCard index={3} label="Avg AI cost / user" value={fmtInr(perUser.avgAiCostInr)} accent="amber" />
        </div>
      </section>

      <section>
        <SectionHeading title="Session-level" description="Averaged across every InteractionSession opened this period." />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard index={0} label="Avg input tokens / session" value={fmt(perSession.avgInputTokens)} accent="slate" />
          <StatCard index={1} label="Avg output tokens / session" value={fmt(perSession.avgOutputTokens)} accent="slate" />
          <StatCard index={2} label="Avg grounding hits / session" value={perSession.avgGroundingHits.toFixed(2)} accent="blue" />
          <StatCard index={3} label="Avg messages / session" value={perSession.avgMessages.toFixed(1)} accent="teal" />
        </div>
      </section>

      <section>
        <SectionHeading title="Cost ledger" description={`By category, ${PERIOD_LABELS[period].toLowerCase()}.`} />
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
              {costLedger.map((e) => (
                <tr key={e.category}>
                  <td className="px-4 py-2">{e.category}</td>
                  <td className="px-4 py-2">{fmt(e.units)}</td>
                  <td className="px-4 py-2">{fmtInr(e.amountInr)}</td>
                </tr>
              ))}
              {costLedger.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No spend recorded in this period.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 font-medium">
                <td className="px-4 py-2">Total</td>
                <td></td>
                <td className="px-4 py-2">{fmtInr(totalLedgerInr)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <SectionHeading
            title="Evals-based testing"
            description="Scripted student personas run against the live counselling engine, judged by Gemini across the same six dimensions used in manual QA."
          />
          <RunEvalButton />
        </div>

        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Started</th>
                <th className="text-left px-4 py-2">Cases</th>
                <th className="text-left px-4 py-2">Passed (≥70)</th>
                <th className="text-left px-4 py-2">Avg score</th>
                <th className="text-left px-4 py-2">Bugs found</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {evalRuns.map((run) => {
                const bugCount = run.cases.reduce((s, c) => {
                  try {
                    return s + (c.bugsFoundJson ? (JSON.parse(c.bugsFoundJson) as unknown[]).length : 0);
                  } catch {
                    return s;
                  }
                }, 0);
                return (
                  <tr key={run.id}>
                    <td className="px-4 py-2">{run.startedAt.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">{run.totalCases}</td>
                    <td className="px-4 py-2">{run.passedCases}</td>
                    <td className="px-4 py-2">{run.avgScore !== null ? run.avgScore.toFixed(0) : "—"}</td>
                    <td className="px-4 py-2">
                      {bugCount > 0 ? <span className="text-red-600 font-medium">{bugCount}</span> : "0"}
                    </td>
                  </tr>
                );
              })}
              {evalRuns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No eval runs yet — click &ldquo;Run new eval&rdquo; to test the live bot against 5 scripted personas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {latestRun && latestRun.cases.length > 0 && (
          <div className="mt-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Latest run — per-persona detail
            </h3>
            {latestRun.cases.map((c) => {
              let bugs: { summary: string; evidenceQuote: string; severity: string }[] = [];
              try {
                bugs = c.bugsFoundJson ? JSON.parse(c.bugsFoundJson) : [];
              } catch {
                bugs = [];
              }
              return (
                <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-slate-900">{c.persona}</div>
                    <div className={`text-sm font-semibold ${(c.score ?? 0) >= 70 ? "text-emerald-600" : "text-red-600"}`}>
                      {c.score?.toFixed(0) ?? "—"} / 100
                    </div>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-xs text-slate-600">
                    {c.dataCaptureNote && <div><dt className="font-medium text-slate-500">Data capture</dt><dd>{c.dataCaptureNote}</dd></div>}
                    {c.groundingNote && <div><dt className="font-medium text-slate-500">Grounding</dt><dd>{c.groundingNote}</dd></div>}
                    {c.conversationFlowNote && <div><dt className="font-medium text-slate-500">Conversation flow</dt><dd>{c.conversationFlowNote}</dd></div>}
                    {c.responseQualityNote && <div><dt className="font-medium text-slate-500">Response quality</dt><dd>{c.responseQualityNote}</dd></div>}
                    {c.counsellingNote && <div><dt className="font-medium text-slate-500">Counselling</dt><dd>{c.counsellingNote}</dd></div>}
                    {c.escalationNote && <div><dt className="font-medium text-slate-500">Escalation</dt><dd>{c.escalationNote}</dd></div>}
                  </dl>
                  {bugs.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {bugs.map((b, i) => (
                        <div key={i} className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1">
                          <span className="font-medium text-red-700 uppercase mr-1">{b.severity}</span>
                          <span className="text-red-800">{b.summary}</span>
                          {b.evidenceQuote && <div className="text-red-500 italic mt-0.5">&ldquo;{b.evidenceQuote}&rdquo;</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
