import { EventEmitter } from "events";
import type { OutboundPayload } from "@/lib/whatsapp/types";

/** FR-J04 — the web chat mirror is a full alternate channel: same conversation engine,
 * same send governor, no Meta account required. This in-process event bus is what lets
 * the mirror's SSE route push outbound messages to a connected browser tab in real time.
 *
 * POC scope note: in-process only (no Redis), which is fine for a single Render instance
 * demo. Logged in .ai/engineering/tech-debt.md as the thing to swap for multi-instance scale.
 */

export type WebMirrorEvent =
  | { type: "outbound"; payload: OutboundPayload }
  | { type: "typing" };

const bus = (globalThis as unknown as { __webMirrorBus?: EventEmitter }).__webMirrorBus ??
  new EventEmitter().setMaxListeners(0);
(globalThis as unknown as { __webMirrorBus?: EventEmitter }).__webMirrorBus = bus;

export function webMirrorChannel(waId: string) {
  return `contact:${waId}`;
}

export function publishToWebMirror(waId: string, event: WebMirrorEvent) {
  bus.emit(webMirrorChannel(waId), event);
}

export function subscribeToWebMirror(
  waId: string,
  onEvent: (event: WebMirrorEvent) => void
): () => void {
  const channel = webMirrorChannel(waId);
  bus.on(channel, onEvent);
  return () => bus.off(channel, onEvent);
}

/** Web-mirror contacts use a synthetic wa_id so they flow through the exact same
 * Contact/Message/attribution pipeline as real WhatsApp users (FR-J04, FR-J05).
 */
export function isWebMirrorWaId(waId: string): boolean {
  return waId.startsWith("web-");
}

export function newWebMirrorWaId(): string {
  return `web-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}
