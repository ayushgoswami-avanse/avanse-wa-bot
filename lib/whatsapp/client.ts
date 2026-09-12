import type { OutboundPayload, InboundWebhookMessage } from "./types";

/** INT-02 — Meta Graph API send. Text, interactive buttons (max 3), list messages (max 10
 * rows), cta_url, and templates. This is the ONLY module allowed to talk to the Graph API;
 * everything else calls it through lib/messaging/sendGovernor.ts (FR-G02).
 */

const GRAPH_VERSION = "v21.0";

function graphUrl(path: string) {
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
}

function buildGraphBody(to: string, payload: OutboundPayload): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };

  switch (payload.kind) {
    case "text":
      return { ...base, type: "text", text: { body: payload.body, preview_url: false } };

    case "buttons":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: payload.body },
          action: {
            buttons: payload.buttons.slice(0, 3).map((b) => ({
              type: "reply",
              reply: { id: b.id, title: b.title.slice(0, 20) },
            })),
          },
        },
      };

    case "list":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: payload.body },
          action: {
            button: payload.buttonLabel.slice(0, 20),
            sections: payload.sections.map((s) => ({
              title: s.title.slice(0, 24),
              rows: s.rows.slice(0, 10).map((r) => ({
                id: r.id,
                title: r.title.slice(0, 24),
                description: r.description?.slice(0, 72),
              })),
            })),
          },
        },
      };

    case "cta_url":
      return {
        ...base,
        type: "interactive",
        interactive: {
          type: "cta_url",
          body: { text: payload.body },
          action: {
            name: "cta_url",
            parameters: { display_text: payload.buttonText.slice(0, 20), url: payload.url },
          },
        },
      };

    case "template":
      return {
        ...base,
        type: "template",
        template: {
          name: payload.templateName,
          language: { code: payload.languageCode ?? "en" },
          ...(payload.bodyParams?.length
            ? {
                components: [
                  {
                    type: "body",
                    parameters: payload.bodyParams.map((text) => ({ type: "text", text })),
                  },
                ],
              }
            : {}),
        },
      };
  }
}

export type WhatsAppSendResult = { ok: true; metaMessageId: string } | { ok: false; error: string };

export async function sendWhatsAppMessage(
  to: string,
  payload: OutboundPayload
): Promise<WhatsAppSendResult> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { ok: false, error: "META_WHATSAPP_TOKEN or META_PHONE_NUMBER_ID not configured" };
  }

  const body = buildGraphBody(to, payload);

  try {
    const res = await fetch(graphUrl(`${phoneNumberId}/messages`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json()) as {
      messages?: { id: string }[];
      error?: { message: string };
    };

    if (!res.ok || !json.messages?.[0]?.id) {
      return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
    }

    return { ok: true, metaMessageId: json.messages[0].id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown send error" };
  }
}

/** INT-03 — template approval-state polling. Used by the admin console's template registry. */
export async function fetchTemplateApprovalStates(): Promise<
  { name: string; status: string; category: string; language: string }[]
> {
  const token = process.env.META_WHATSAPP_TOKEN;
  const wabaId = process.env.META_WABA_ID;
  if (!token || !wabaId) return [];

  try {
    const res = await fetch(
      graphUrl(`${wabaId}/message_templates?fields=name,status,category,language&limit=100`),
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = (await res.json()) as { data?: { name: string; status: string; category: string; language: string }[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

/** FR-B01 — parses one Meta webhook "entry[].changes[].value" payload into normalised
 * inbound messages. Meta batches multiple messages per webhook call.
 */
export function parseInboundWebhook(payload: unknown): InboundWebhookMessage[] {
  const out: InboundWebhookMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry ?? [];

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes ?? [];
    for (const change of changes) {
      const value = (change as { value?: Record<string, unknown> })?.value;
      if (!value) continue;

      const contacts = (value.contacts as { profile?: { name?: string }; wa_id: string }[]) ?? [];
      const messages = (value.messages as Record<string, unknown>[]) ?? [];

      for (const msg of messages) {
        const from = String(msg.from);
        const profileName = contacts.find((c) => c.wa_id === from)?.profile?.name;
        const type = String(msg.type) as InboundWebhookMessage["type"];

        let text: string | undefined;
        let interactiveReplyId: string | undefined;
        let interactiveReplyTitle: string | undefined;

        if (type === "text") {
          text = (msg.text as { body?: string })?.body;
        } else if (type === "interactive") {
          const interactive = msg.interactive as Record<string, unknown>;
          const buttonReply = interactive?.button_reply as { id: string; title: string } | undefined;
          const listReply = interactive?.list_reply as { id: string; title: string } | undefined;
          interactiveReplyId = buttonReply?.id ?? listReply?.id;
          interactiveReplyTitle = buttonReply?.title ?? listReply?.title;
        } else if (type === "button") {
          const button = msg.button as { text?: string; payload?: string };
          text = button?.text;
          interactiveReplyId = button?.payload;
        }

        out.push({
          metaMessageId: String(msg.id),
          from,
          profileName,
          timestamp: String(msg.timestamp),
          type: ["text", "interactive", "button", "image", "document", "audio", "video"].includes(type)
            ? type
            : "unknown",
          text,
          interactiveReplyId,
          interactiveReplyTitle,
        });
      }
    }
  }

  return out;
}
