import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const ACTION_TO_STATUS = {
  approve: "APPROVED",
  hold: "HELD",
  clawback: "CLAWED_BACK",
} as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const { action } = await req.json();
  const status = ACTION_TO_STATUS[action as keyof typeof ACTION_TO_STATUS];
  if (!status) return NextResponse.json({ error: "invalid action" }, { status: 400 });

  const payout = await prisma.ambassadorPayout.update({ where: { id }, data: { status, resolvedAt: new Date() } });
  return NextResponse.json({ payout });
}
