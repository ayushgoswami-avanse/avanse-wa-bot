import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateAssetCode } from "@/lib/attribution";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { channel, collegeName, spotLabel, ambassadorId } = await req.json();

  let code = generateAssetCode();
  // Extremely unlikely collision given the alphabet/length, but guard anyway.
  while (await prisma.asset.findUnique({ where: { code } })) code = generateAssetCode();

  const asset = await prisma.asset.create({
    data: { code, channel, collegeName: collegeName || null, spotLabel: spotLabel || null, ambassadorId: ambassadorId || null },
  });

  return NextResponse.json({ asset });
}
