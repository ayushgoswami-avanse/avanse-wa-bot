import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCounsellingReply } from "@/lib/conversation/orchestrator";

/** Drafts a reply for the agent to review/edit before sending — reuses the exact same
 * orchestrator call the AI counsellor itself uses (same context window, same
 * profileSummary, same grounding tool), so the suggestion is consistent with how the bot
 * would have answered. Nothing is persisted here: no Message row, no sentiment/session
 * update — only an actual send (via /api/agent/send) writes anything.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { contactId } = await req.json();
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const lastInbound = await prisma.message.findFirst({
    where: { contactId, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastInbound?.body) {
    return NextResponse.json({ suggestion: "" , note: "No recent student message to respond to."});
  }

  const result = await generateCounsellingReply(contact, lastInbound.body, false);
  return NextResponse.json({ suggestion: result.replyText });
}
