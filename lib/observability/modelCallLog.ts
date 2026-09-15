import { prisma } from "@/lib/prisma";
import { currentEnvironment } from "@/lib/observability/evalContext";

/** Shape of the subset of Gemini's usageMetadata this app actually reads — kept narrow
 * and structural (not imported from @google/genai) so any call site can pass its
 * response.usageMetadata straight through regardless of which SDK type wraps it.
 */
export type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
} | undefined;

// ai.google.dev/gemini-api/docs/pricing (Gemini 2.5 Flash, checked Sep 2026) — this app
// only ever calls gemini-2.5-flash (see getGeminiModel), so one rate covers every call
// site; applied as a fallback to any other model id too rather than silently costing it
// at zero. Same style as PRICING_INR in lib/messaging/sendGovernor.ts.
const GEMINI_USD_PER_1M_INPUT = 0.3;
const GEMINI_USD_PER_1M_OUTPUT = 2.5;
const USD_TO_INR = 88; // approximate spot rate for this POC's cost estimates, not a live FX feed

function estimateCostInr(inputTokens: number, outputTokens: number): number {
  const usd = (inputTokens / 1_000_000) * GEMINI_USD_PER_1M_INPUT + (outputTokens / 1_000_000) * GEMINI_USD_PER_1M_OUTPUT;
  return usd * USD_TO_INR;
}

/** The single instrumentation point for every Gemini call this app makes. Token usage
 * was previously not tracked anywhere at all — this is what backs the cost-reporting
 * dashboard's token/cost KPIs (lib/costMetrics.ts). Also writes the estimated INR cost
 * into CostLedgerEntry (category "ai_tokens") so the existing cost-ledger table reflects
 * AI spend the same way it already does WhatsApp messaging spend. Never throws: an
 * observability write must never be able to break the actual conversation it's observing.
 */
export async function recordModelCall(params: {
  contactId: string;
  sessionId?: string | null;
  kind: "counselling" | "grounding" | "suggested_reply" | "eval_judge";
  model: string;
  usage: GeminiUsage;
  latencyMs: number;
}): Promise<void> {
  try {
    const inputTokens = params.usage?.promptTokenCount ?? 0;
    const outputTokens = params.usage?.candidatesTokenCount ?? 0;
    const totalTokens = params.usage?.totalTokenCount ?? inputTokens + outputTokens;
    const costInr = estimateCostInr(inputTokens, outputTokens);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.$transaction([
      prisma.modelCallLog.create({
        data: {
          contactId: params.contactId,
          sessionId: params.sessionId ?? undefined,
          kind: params.kind,
          model: params.model,
          inputTokens,
          outputTokens,
          totalTokens,
          latencyMs: params.latencyMs,
        },
      }),
      prisma.costLedgerEntry.create({
        data: {
          date: today,
          category: "ai_tokens",
          amountInr: costInr,
          units: totalTokens,
          environment: currentEnvironment(),
        },
      }),
    ]);
  } catch (err) {
    console.error("[observability] failed to record model call (non-fatal):", err);
  }
}
