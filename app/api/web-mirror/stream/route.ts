import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { subscribeToWebMirror } from "@/lib/webMirror/bus";
import { handleInboundMessage } from "@/lib/conversation/flow";

export const dynamic = "force-dynamic";

/** SSE channel for the web chat mirror. Subscribes BEFORE triggering the first-message
 * greeting, so no outbound event can be published before a listener exists (see the note
 * in /start/route.ts).
 */
export async function GET(req: NextRequest) {
  const waId = req.nextUrl.searchParams.get("waId");
  if (!waId) return new Response("Missing waId", { status: 400 });

  const contact = await prisma.contact.findUnique({ where: { waId } });
  if (!contact) return new Response("Unknown contact", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      unsubscribe = subscribeToWebMirror(waId, (event) => {
        if (event.type === "outbound") send({ type: "outbound", payload: event.payload });
      });

      send({ type: "ready" });

      // First-ever connection for a brand-new contact: trigger the greeting now that
      // we're guaranteed to be listening for the outbound event it produces.
      prisma.message.count({ where: { contactId: contact.id } }).then((count) => {
        if (count === 0) {
          handleInboundMessage(contact.id, { metaMessageId: `web-init-${Date.now()}` }).catch((err) =>
            console.error("[web-mirror stream] greeting failed:", err)
          );
        }
      });

      const keepAlive = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15000);
      req.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        unsubscribe();
        controller.close();
      });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
