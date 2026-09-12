import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendOutboundMessage } from "@/lib/messaging/sendGovernor";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId, text, templateName } = await req.json();
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const payload = templateName ? ({ kind: "template", templateName } as const) : ({ kind: "text", body: text } as const);

  const result = await sendOutboundMessage({
    contactId: contact.id,
    waId: contact.waId,
    journey: contact.journey,
    payload,
    agentId: session.sub,
  });

  if (!result.sent) return NextResponse.json({ error: "blocked", reason: result.reason }, { status: 409 });
  return NextResponse.json({ ok: true });
}
