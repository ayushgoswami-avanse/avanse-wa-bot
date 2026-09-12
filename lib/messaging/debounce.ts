import { handleInboundMessage, type InboundTurn } from "@/lib/conversation/flow";
import { getConfigNumber } from "@/lib/config";

/** FR-B03 — message debounce: fragments from one contact within a configurable window are
 * aggregated into a single model invocation. Each fragment is still persisted as its own
 * Message row by the caller (DR-03) before being handed here; this only coalesces how many
 * times the conversation engine actually runs.
 *
 * POC scope: in-process Map, fine for a single Render instance demo. A multi-instance
 * deployment would need this in Redis — noted in .ai/engineering/tech-debt.md.
 */

type PendingBatch = { texts: string[]; timer: ReturnType<typeof setTimeout>; lastMetaMessageId: string };

const pending = (globalThis as unknown as { __debouncePending?: Map<string, PendingBatch> }).__debouncePending ??
  new Map<string, PendingBatch>();
(globalThis as unknown as { __debouncePending?: Map<string, PendingBatch> }).__debouncePending = pending;

export async function processInboundWithDebounce(contactId: string, turn: InboundTurn): Promise<void> {
  // Button/list replies are discrete taps — never debounced, and flush any pending text first.
  if (turn.interactiveReplyId) {
    const existing = pending.get(contactId);
    if (existing) {
      clearTimeout(existing.timer);
      pending.delete(contactId);
      await handleInboundMessage(contactId, { metaMessageId: existing.lastMetaMessageId, text: existing.texts.join(" ") });
    }
    await handleInboundMessage(contactId, turn);
    return;
  }

  if (!turn.text) return;

  const windowMs = await getConfigNumber("DEBOUNCE_WINDOW_MS");
  const existing = pending.get(contactId);

  if (existing) {
    clearTimeout(existing.timer);
    existing.texts.push(turn.text);
    existing.lastMetaMessageId = turn.metaMessageId;
    existing.timer = setTimeout(() => flush(contactId), windowMs);
    return;
  }

  const batch: PendingBatch = {
    texts: [turn.text],
    lastMetaMessageId: turn.metaMessageId,
    timer: setTimeout(() => flush(contactId), windowMs),
  };
  pending.set(contactId, batch);
}

function flush(contactId: string) {
  const batch = pending.get(contactId);
  if (!batch) return;
  pending.delete(contactId);
  handleInboundMessage(contactId, { metaMessageId: batch.lastMetaMessageId, text: batch.texts.join(" ") }).catch((err) =>
    console.error("[debounce] flush failed:", err)
  );
}
