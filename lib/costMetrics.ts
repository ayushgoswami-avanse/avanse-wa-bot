import { prisma } from "@/lib/prisma";
import type { GroundingClass } from "@prisma/client";

/** Cost/observability KPI layer for app/admin/costs — the dashboard's single source of
 * truth for token usage, grounding, and spend, computed on-the-fly over the raw
 * ModelCallLog/GroundingLog/InteractionSession/CostLedgerEntry rows for the selected
 * period. At this app's volume (a pilot, not billions of events) that's the right call:
 * Mixpanel and PostHog both document that precomputed rollup tables only pay for
 * themselves once a query is actually slow at real volume — see the observability
 * research this was built from. No rollup tables here until that's ever true.
 *
 * Three tiers, per the explicit ask: TOTAL (the whole period), USER-level (per distinct
 * student who had any AI interaction), SESSION-level (per InteractionSession). This
 * mirrors the GA4/Amplitude convention of Total → Unique-user → Session as three
 * measures of the same underlying activity, not three unrelated numbers.
 */

export type Period = "day" | "week" | "month" | "year";

const PERIOD_MS: Record<Period, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
};

export const PERIOD_LABELS: Record<Period, string> = {
  day: "Last 24 hours",
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
};

// A grounding "hit" is a turn that was actually answered with a live or cached grounded
// result — RAG_ONLY (the model judged no search was needed) and REFUSED (no client
// configured, or the call failed) both mean no grounded fact was served, so they count
// toward the invocation/decision totals but never toward "hits".
const GROUNDING_HIT_CLASSES: GroundingClass[] = ["LIVE_GROUNDED", "CACHE_GROUNDED"];

function resolveRange(period: Period, now: Date) {
  const durationMs = PERIOD_MS[period];
  const end = now;
  const start = new Date(end.getTime() - durationMs);
  const prevStart = new Date(start.getTime() - durationMs);
  return { start, end, prevStart, prevEnd: start };
}

type WindowAggregate = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  modelCallCount: number;
  totalGroundingDecisions: number;
  totalGroundingHits: number;
  cacheHits: number;
  totalSessions: number;
  totalMessagesAcrossSessions: number;
  activeUserCount: number;
  aiCostInr: number;
  messagingCostInr: number;
  costByCategory: { category: string; amountInr: number; units: number }[];
};

async function aggregateWindow(start: Date, end: Date): Promise<WindowAggregate> {
  const [modelCalls, groundingLogs, sessions, costByCategoryRaw] = await Promise.all([
    prisma.modelCallLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { contactId: true, inputTokens: true, outputTokens: true, totalTokens: true },
    }),
    prisma.groundingLog.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { contactId: true, queryClass: true, cacheHit: true },
    }),
    prisma.interactionSession.findMany({
      where: { startedAt: { gte: start, lt: end } },
      select: { contactId: true, messageCount: true },
    }),
    prisma.costLedgerEntry.groupBy({
      by: ["category"],
      where: { date: { gte: start, lt: end }, environment: "production" },
      _sum: { amountInr: true, units: true },
    }),
  ]);
  const costByCategory = costByCategoryRaw.map((c) => ({
    category: c.category,
    amountInr: c._sum.amountInr ?? 0,
    units: c._sum.units ?? 0,
  }));

  const totalInputTokens = modelCalls.reduce((s, m) => s + m.inputTokens, 0);
  const totalOutputTokens = modelCalls.reduce((s, m) => s + m.outputTokens, 0);
  const totalTokens = modelCalls.reduce((s, m) => s + m.totalTokens, 0);

  const totalGroundingHits = groundingLogs.filter((g) => GROUNDING_HIT_CLASSES.includes(g.queryClass)).length;
  const cacheHits = groundingLogs.filter((g) => g.cacheHit).length;

  // "Active user" = any student the model actually did work for this period — either a
  // counselling/grounding call or a session. Union, not just token-callers, so a period
  // with sessions but (e.g.) a Gemini outage still reports the right denominator instead
  // of a misleadingly small one.
  const activeUserIds = new Set<string>([
    ...modelCalls.map((m) => m.contactId),
    ...groundingLogs.map((g) => g.contactId),
    ...sessions.map((s) => s.contactId),
  ]);

  const aiCostInr = costByCategory.find((c) => c.category === "ai_tokens")?.amountInr ?? 0;
  const messagingCostInr = costByCategory
    .filter((c) => c.category === "whatsapp_marketing" || c.category === "whatsapp_utility")
    .reduce((s, c) => s + c.amountInr, 0);

  return {
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    modelCallCount: modelCalls.length,
    totalGroundingDecisions: groundingLogs.length,
    totalGroundingHits,
    cacheHits,
    totalSessions: sessions.length,
    totalMessagesAcrossSessions: sessions.reduce((s, x) => s + x.messageCount, 0),
    activeUserCount: activeUserIds.size,
    aiCostInr,
    messagingCostInr,
    costByCategory,
  };
}

export type KpiValue = {
  label: string;
  value: number;
  /** % change vs. the immediately preceding period of equal length. Null when there's no
   * prior-period baseline to compare against (division by zero), not zero — a dashboard
   * that renders "0%" there would claim "no change" when the truth is "unmeasurable". */
  deltaPct: number | null;
};

export type CostDashboardData = {
  period: Period;
  rangeStart: string;
  rangeEnd: string;
  totals: {
    activeUsers: KpiValue;
    sessions: KpiValue;
    inputTokens: KpiValue;
    outputTokens: KpiValue;
    totalTokens: KpiValue;
    groundingHits: KpiValue;
    aiCostInr: KpiValue;
    messagingCostInr: KpiValue;
  };
  perUser: {
    avgInputTokens: number;
    avgOutputTokens: number;
    avgGroundingHits: number;
    avgAiCostInr: number;
  };
  perSession: {
    avgInputTokens: number;
    avgOutputTokens: number;
    avgGroundingHits: number;
    avgMessages: number;
  };
  groundingHealth: {
    cacheHitRate: number | null; // cacheHits / (cacheHits + liveGrounded), i.e. of served hits, what fraction were free
    invocationRate: number | null; // hits / total decisions — a volume signal, not a quality one (see research notes)
  };
  costLedger: { category: string; amountInr: number; units: number }[];
  costPerQualifiedLead: number | null;
};

function delta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

function kpi(label: string, curr: number, prev: number): KpiValue {
  return { label, value: curr, deltaPct: delta(curr, prev) };
}

export async function getCostDashboardData(period: Period, now: Date = new Date()): Promise<CostDashboardData> {
  const { start, end, prevStart, prevEnd } = resolveRange(period, now);

  const [curr, prev, qualifiedLeads] = await Promise.all([
    aggregateWindow(start, end),
    aggregateWindow(prevStart, prevEnd),
    prisma.contact.count({ where: { isQualifiedLead: true } }),
  ]);

  const totalPeriodCostInr = curr.aiCostInr + curr.messagingCostInr;

  const liveGroundedCount = curr.totalGroundingHits - curr.cacheHits >= 0 ? curr.totalGroundingHits - curr.cacheHits : 0;
  const cacheHitRate = curr.cacheHits + liveGroundedCount > 0 ? curr.cacheHits / (curr.cacheHits + liveGroundedCount) : null;
  const invocationRate = curr.totalGroundingDecisions > 0 ? curr.totalGroundingHits / curr.totalGroundingDecisions : null;

  return {
    period,
    rangeStart: start.toISOString(),
    rangeEnd: end.toISOString(),
    totals: {
      activeUsers: kpi("Active students", curr.activeUserCount, prev.activeUserCount),
      sessions: kpi("Sessions", curr.totalSessions, prev.totalSessions),
      inputTokens: kpi("Input tokens", curr.totalInputTokens, prev.totalInputTokens),
      outputTokens: kpi("Output tokens", curr.totalOutputTokens, prev.totalOutputTokens),
      totalTokens: kpi("Total tokens", curr.totalTokens, prev.totalTokens),
      groundingHits: kpi("Grounding hits", curr.totalGroundingHits, prev.totalGroundingHits),
      aiCostInr: kpi("AI spend", curr.aiCostInr, prev.aiCostInr),
      messagingCostInr: kpi("Messaging spend", curr.messagingCostInr, prev.messagingCostInr),
    },
    perUser: {
      avgInputTokens: curr.activeUserCount ? curr.totalInputTokens / curr.activeUserCount : 0,
      avgOutputTokens: curr.activeUserCount ? curr.totalOutputTokens / curr.activeUserCount : 0,
      avgGroundingHits: curr.activeUserCount ? curr.totalGroundingHits / curr.activeUserCount : 0,
      avgAiCostInr: curr.activeUserCount ? curr.aiCostInr / curr.activeUserCount : 0,
    },
    perSession: {
      avgInputTokens: curr.totalSessions ? curr.totalInputTokens / curr.totalSessions : 0,
      avgOutputTokens: curr.totalSessions ? curr.totalOutputTokens / curr.totalSessions : 0,
      avgGroundingHits: curr.totalSessions ? curr.totalGroundingHits / curr.totalSessions : 0,
      avgMessages: curr.totalSessions ? curr.totalMessagesAcrossSessions / curr.totalSessions : 0,
    },
    groundingHealth: { cacheHitRate, invocationRate },
    costLedger: curr.costByCategory,
    costPerQualifiedLead: qualifiedLeads > 0 ? totalPeriodCostInr / qualifiedLeads : null,
  };
}

export type EvalRunSummary = Awaited<ReturnType<typeof getEvalRuns>>[number];

export async function getEvalRuns(limit = 10) {
  return prisma.evalRun.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
    include: { cases: true },
  });
}
