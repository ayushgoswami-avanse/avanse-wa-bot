import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { publishToWebMirror } from "@/lib/webMirror/bus";

const VALID_DISPOSITIONS = [
  "NEW",
  "INTERESTED",
  "HOT_FOLLOW_UP",
  "CALLBACK_REQUESTED",
  "NOT_INTERESTED",
  "CONVERTED",
  "DO_NOT_CONTACT",
  "INVALID_CONTACT",
  "DUPLICATE",
] as const;

/** Sales disposition — set manually by whoever is working the lead, distinct from the
 * AI's own stage/propensity machinery. Every change is also logged to DispositionEvent
 * so it shows up on the lead timeline with who set it and when.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId, disposition, note } = await req.json();
  if (!VALID_DISPOSITIONS.includes(disposition)) {
    return NextResponse.json({ error: "invalid disposition" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.contact.update({ where: { id: contactId }, data: { disposition, dispositionUpdatedAt: new Date() } }),
    prisma.dispositionEvent.create({
      data: { contactId, disposition, note: note || null, setByAgentId: session.sub },
    }),
  ]);

  publishToWebMirror(contact.waId, { type: "activity" });

  return NextResponse.json({ ok: true });
}
