import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

/** Admin-only lead deletion. Every child row (messages, sessions, handovers, disposition
 * history, notes, send/grounding logs, etc.) is declared with onDelete: Cascade back to
 * Contact in schema.prisma, so a single delete here removes the whole lead and every
 * interaction/association in one atomic DB-level cascade — nothing is left orphaned.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { contactId } = await params;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.contact.delete({ where: { id: contactId } });

  return NextResponse.json({ ok: true });
}
