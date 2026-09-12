import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { subscribeToWebMirror } from "@/lib/webMirror/bus";

export const dynamic = "force-dynamic";

/** SSE channel the agent/admin console subscribes to for a given contact. Carries no
 * payload of its own — it's purely a "something changed, go refetch" ping, so the
 * console always renders the true DB state rather than a reconstructed event shape.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ contactId: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { contactId } = await params;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return new Response("Not found", { status: 404 });

  const encoder = new TextEncoder();
  let unsubscribe: () => void = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      unsubscribe = subscribeToWebMirror(contact.waId, () => send({ type: "ping" }));
      send({ type: "ready" });

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
