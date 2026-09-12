import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleInboundMessage } from "@/lib/conversation/flow";

/** Web-mirror equivalent of the WhatsApp webhook — one discrete browser submission per
 * call, so unlike the real channel this bypasses the debounce buffer (FR-B03 exists to
 * coalesce fragmented typing, which doesn't happen through a single text box).
 */
export async function POST(req: NextRequest) {
  const { waId, text, interactiveReplyId, interactiveReplyTitle } = await req.json();
  if (!waId || (!text && !interactiveReplyId)) {
    return NextResponse.json({ error: "waId and (text or interactiveReplyId) required" }, { status: 400 });
  }

  const contact = await prisma.contact.findUnique({ where: { waId } });
  if (!contact) return NextResponse.json({ error: "unknown contact" }, { status: 404 });

  const metaMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await prisma.message.create({
    data: {
      contactId: contact.id,
      metaMessageId,
      direction: "INBOUND",
      kind: interactiveReplyId ? "BUTTON" : "TEXT",
      body: text ?? interactiveReplyTitle,
      deliveryStatus: "received",
    },
  });

  await handleInboundMessage(contact.id, { metaMessageId, text, interactiveReplyId, interactiveReplyTitle });

  return NextResponse.json({ ok: true });
}
