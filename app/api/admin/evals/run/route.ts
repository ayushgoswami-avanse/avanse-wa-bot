import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runEvalPanel } from "@/lib/evals/runEval";

/** Triggers the evals-testing panel on demand from the cost/reporting dashboard. Runs the
 * fixed persona script set synchronously (a handful of short scripted conversations plus
 * one judge call each — tens of seconds, acceptable for an on-demand admin action, not
 * something that needs a background job queue at this scale).
 */
export async function POST() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const runId = await runEvalPanel();
    return NextResponse.json({ runId });
  } catch (err) {
    console.error("[evals] run failed:", err);
    return NextResponse.json({ error: "Eval run failed — see server logs." }, { status: 500 });
  }
}
