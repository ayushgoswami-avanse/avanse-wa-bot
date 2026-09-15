import { AsyncLocalStorage } from "node:async_hooks";

/** Carries "this Gemini call is part of a scripted eval run, not a real student
 * conversation" across the normal call chain (handleInboundMessage → runCounselling →
 * generateCounsellingReply → recordModelCall) without threading an extra parameter
 * through every function in between. recordModelCall reads this to tag the CostLedgerEntry
 * it writes so eval spend never blends into the dashboard's production cost KPIs.
 */
const storage = new AsyncLocalStorage<{ environment: "eval" }>();

export function runInEvalContext<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ environment: "eval" }, fn);
}

export function currentEnvironment(): "production" | "eval" {
  return storage.getStore()?.environment ?? "production";
}
