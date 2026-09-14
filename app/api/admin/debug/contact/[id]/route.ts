import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Admin-only raw dump of a contact's full state — messages, sessions, handovers, send
 * logs — for debugging a reported issue precisely instead of guessing.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const [contact, messages, sessions, handovers, sendLogs, groundingLogs] = await Promise.all([
    prisma.contact.findUnique({ where: { id } }),
    prisma.message.findMany({ where: { contactId: id }, orderBy: { createdAt: "asc" } }),
    prisma.interactionSession.findMany({ where: { contactId: id }, orderBy: { startedAt: "asc" } }),
    prisma.handover.findMany({ where: { contactId: id } }),
    prisma.sendLog.findMany({ where: { contactId: id }, orderBy: { createdAt: "asc" } }),
    prisma.groundingLog.findMany({ where: { contactId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  return NextResponse.json({ contact, messages, sessions, handovers, sendLogs, groundingLogs });
}
