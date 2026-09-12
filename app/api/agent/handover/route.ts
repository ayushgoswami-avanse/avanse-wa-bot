import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { publishToWebMirror } from "@/lib/webMirror/bus";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId, action } = await req.json();
  const handover = await prisma.handover.findFirst({
    where: { contactId, status: { in: ["QUEUED", "CLAIMED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!handover) return NextResponse.json({ error: "no open handover" }, { status: 404 });

  if (action === "claim") {
    await prisma.handover.update({ where: { id: handover.id }, data: { status: "CLAIMED", claimedById: session.sub } });
  } else if (action === "resolve") {
    await prisma.handover.update({ where: { id: handover.id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    // Return the thread to the AI counsellor.
    await prisma.contact.update({ where: { id: contactId }, data: { stage: "COUNSELLING" } });
  } else {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (contact) publishToWebMirror(contact.waId, { type: "activity" });

  return NextResponse.json({ ok: true });
}
