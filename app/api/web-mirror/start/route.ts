import { NextRequest, NextResponse } from "next/server";
import { newWebMirrorWaId } from "@/lib/webMirror/bus";
import { findOrCreateContact } from "@/lib/contactService";

/** FR-J04/J05 — starts a web-mirror session: same Contact/attribution/conversation
 * pipeline as real WhatsApp, keyed by a synthetic wa_id instead of a phone number. Also
 * serves as the desktop / no-WhatsApp fallback path.
 *
 * The greeting (disclosure + consent) is NOT sent here — it's triggered by the SSE
 * /stream route once the client is actually subscribed, so the first outbound event is
 * never published before anyone is listening for it.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const clickToken = typeof body.clickToken === "string" ? body.clickToken : null;

  const waId = newWebMirrorWaId();
  const { contact } = await findOrCreateContact(waId, "Web visitor", clickToken);

  return NextResponse.json({ waId, contactId: contact.id });
}
