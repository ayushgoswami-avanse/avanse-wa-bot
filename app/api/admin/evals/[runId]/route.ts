import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
