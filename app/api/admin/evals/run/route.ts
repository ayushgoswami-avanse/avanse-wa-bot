import { NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runEvalPanel, STALE_AFTER_MS } from "@/lib/evals/runEval";

/** Triggers the evals-testing panel on demand from the cost/reporting dashboard.
 *
 * Used to run synchronously and await the whole thing ("tens of seconds, acceptable").
 * Live-verified that assumption was wrong: a real run took long enough that the browser's
 * fetch() came back as a network error ("Failed to fetch") rather than a clean response —
 * on Render's free tier, either an idle-triggered spin-down or resource pressure from a
 * multi-minute synchronous request killed the connection outright. This now returns as
 * soon as the run row exists and lets the actual work continue after the response is sent
 * (Next's after()), which is safe here specifically because this is a persistent `next
 * start` process, not a serverless function that would freeze the moment a response goes
 * out — see lib/evals/runEval.ts and app/admin/evals/RunEvalButton.tsx for the rest of
 * this (status GET route + client polling).
 */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Single-flight: this is an admin-only, occasional action, not a queue. An orphaned run
  // (process died mid-run, so its own .catch() below never fired) must not block new runs
  // forever, hence the staleness cutoff here too, not just in the UI.
  const inFlight = await prisma.evalRun.findFirst({
    where: { completedAt: null, startedAt: { gt: new Date(Date.now() - STALE_AFTER_MS) } },
    orderBy: { startedAt: "desc" },
  });
  if (inFlight) return NextResponse.json({ runId: inFlight.id, alreadyRunning: true }, { status: 409 });

  const run = await prisma.evalRun.create({ data: {} });

  after(() =>
    runEvalPanel(undefined, undefined, run.id).catch(async (err) => {
      console.error("[evals] background run failed:", err);
      await prisma.evalRun.update({ where: { id: run.id }, data: { completedAt: new Date() } }).catch(() => null);
    })
  );

  return NextResponse.json({ runId: run.id }, { status: 202 });
}
