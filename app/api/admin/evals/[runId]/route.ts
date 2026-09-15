import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STALE_AFTER_MS } from "@/lib/evals/runEval";

/** Status poll for a background eval run — see app/api/admin/evals/run/route.ts for why
 * this exists (the run itself no longer completes within the triggering HTTP request).
 * `casesCompletedSoFar` comes from a live count of this run's own EvalCase rows rather
 * than a separate progress field, since runEvalPanel already creates one per persona as
 * it finishes — no extra write path needed to get real incremental progress.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { runId } = await params;
  const [run, casesCompletedSoFar] = await Promise.all([
    prisma.evalRun.findUnique({ where: { id: runId } }),
    prisma.evalCase.count({ where: { runId } }),
  ]);
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stale = !run.completedAt && Date.now() - run.startedAt.getTime() > STALE_AFTER_MS;

  return NextResponse.json({
    done: run.completedAt !== null,
    stale,
    expectedCases: run.totalCases,
    casesCompletedSoFar,
    passedCases: run.passedCases,
    avgScore: run.avgScore,
  });
}

/** Lets an admin discard a bad eval run (e.g. one that failed mid-way, or was itself a
 * test of the eval harness) so the dashboard's run history stays a trustworthy quality
 * signal rather than accumulating debugging artifacts.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { runId } = await params;
  await prisma.evalRun.delete({ where: { id: runId } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
