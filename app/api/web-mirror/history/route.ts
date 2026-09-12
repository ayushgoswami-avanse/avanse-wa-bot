import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const waId = req.nextUrl.searchParams.get("waId");
  if (!waId) return NextResponse.json({ error: "waId required" }, { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { waId } });
  if (!contact) return NextResponse.json({ messages: [] });

  const messages = await prisma.message.findMany({
    where: { contactId: contact.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      kind: m.kind,
      body: m.body,
      createdAt: m.createdAt,
    })),
  });
}
