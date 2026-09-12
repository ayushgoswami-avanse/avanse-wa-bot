import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Free-text working notes for an agent/sales manager's own understanding of a lead —
 * distinct from the AI's session summaries. Surfaced on the lead timeline.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId, body } = await req.json();
  if (!contactId || !body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "note body is required" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const note = await prisma.agentNote.create({
    data: { contactId, authorId: session.sub, body: body.trim().slice(0, 2000) },
    include: { author: true },
  });

  return NextResponse.json({ ok: true, note: { id: note.id, body: note.body, createdAt: note.createdAt, agentName: note.author.displayName } });
}
