import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMetaSignature, verifySubscriptionChallenge } from "@/lib/whatsapp/verify";
import { parseInboundWebhook } from "@/lib/whatsapp/client";
import { extractClickToken } from "@/lib/attribution";
import { findOrCreateContact } from "@/lib/contactService";
import { processInboundWithDebounce } from "@/lib/messaging/debounce";
import { publishToWebMirror } from "@/lib/webMirror/bus";

/** INT-01 / FR-B01 — Meta webhook receiver. Validates signature, acknowledges within
 * 500ms (NFR-02), enqueues processing rather than blocking the response on the LLM call.
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const challenge = verifySubscriptionChallenge(
    searchParams.get("hub.mode"),
    searchParams.get("hub.verify_token"),
    searchParams.get("hub.challenge")
  );
  if (challenge === null) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200 });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Acknowledge fast; do the real work without blocking the response (NFR-02: 200 <500ms).
  processWebhookPayload(payload).catch((err) => console.error("[webhook] processing failed:", err));

  return NextResponse.json({ received: true }, { status: 200 });
}

async function processWebhookPayload(payload: unknown): Promise<void> {
  const messages = parseInboundWebhook(payload);

  for (const msg of messages) {
    // FR-B02 — duplicate suppression: a replayed Meta message id is processed exactly once.
    const already = await prisma.message.findUnique({ where: { metaMessageId: msg.metaMessageId } });
    if (already) continue;

    const clickToken = msg.type === "text" ? extractClickToken(msg.text) : null;
    const { contact } = await findOrCreateContact(msg.from, msg.profileName, clickToken);

    const kind = msg.type === "interactive" || msg.type === "button" ? (msg.interactiveReplyId ? "BUTTON" : "TEXT") : "TEXT";
    const body = msg.type === "text" ? msg.text : msg.interactiveReplyTitle ?? msg.text;

    await prisma.message.create({
      data: {
        contactId: contact.id,
        metaMessageId: msg.metaMessageId,
        direction: "INBOUND",
        kind,
        body,
        deliveryStatus: "received",
      },
    });

    // Live-refresh signal for the agent/admin console (FR-H — thread should update without a manual reload).
    publishToWebMirror(contact.waId, { type: "activity" });

    await processInboundWithDebounce(contact.id, {
      metaMessageId: msg.metaMessageId,
      text: msg.type === "text" ? msg.text : undefined,
      interactiveReplyId: msg.interactiveReplyId,
      interactiveReplyTitle: msg.interactiveReplyTitle,
    });
  }
}
