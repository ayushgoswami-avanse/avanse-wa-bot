/** Outbound message payload shapes, mirroring what the Meta Cloud API accepts and what the
 * web-mirror channel renders. Kept provider-agnostic so the send governor can route the
 * same payload to either channel (see lib/messaging/sendGovernor.ts).
 */

export type OutboundButton = { id: string; title: string }; // max 3 (WhatsApp interface limit)

export type OutboundListRow = { id: string; title: string; description?: string };
export type OutboundListSection = { title: string; rows: OutboundListRow[] }; // max 10 rows total

export type OutboundPayload =
  | { kind: "text"; body: string }
  | { kind: "buttons"; body: string; buttons: OutboundButton[] }
  | {
      kind: "list";
      body: string;
      buttonLabel: string;
      sections: OutboundListSection[];
    }
  | { kind: "cta_url"; body: string; buttonText: string; url: string }
  | {
      kind: "template";
      templateName: string;
      languageCode?: string;
      bodyParams?: string[];
    };

export type InboundWebhookMessage = {
  metaMessageId: string;
  from: string; // wa_id, E.164 without '+'
  profileName?: string;
  timestamp: string;
  type: "text" | "interactive" | "button" | "unknown" | "image" | "document" | "audio" | "video";
  text?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
};
