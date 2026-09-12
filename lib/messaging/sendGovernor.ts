import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp/client";
import { publishToWebMirror, isWebMirrorWaId } from "@/lib/webMirror/bus";
import { getConfig, getConfigNumber } from "@/lib/config";
import type { OutboundPayload } from "@/lib/whatsapp/types";
import type { TemplateCategory } from "@prisma/client";

/** FR-G02 — the send governor. Every outbound message, from the AI counsellor, the agent
 * console, or nurture jobs, passes through sendOutboundMessage. Nothing else may call the
 * Meta client directly (enforced by convention here; a real build would add an
 * architecture/lint test per NFR-26's "no code path can bypass the governor").
 */

// Business-case rates (SEC_Business_Case_v13, sheet "Inputs" §6), incl. 18% GST.
const PRICING_INR = { marketing: 1.0185, utility: 0.1357, service: 0 } as const;

export type GovernorDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export async function computeServiceWindow(contactId: string): Promise<{
  inWindow: boolean;
  expiresAt: Date | null;
}> {
  const lastInbound = await prisma.message.findFirst({
    where: { contactId, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
  });
  if (!lastInbound) return { inWindow: false, expiresAt: null };

  const expiresAt = new Date(lastInbound.createdAt.getTime() + 24 * 60 * 60 * 1000);
  return { inWindow: expiresAt.getTime() > Date.now(), expiresAt };
}

async function checkGovernance(
  contactId: string,
  payload: OutboundPayload,
  category: TemplateCategory | null
): Promise<GovernorDecision> {
  // FR-G05 — quality-rating monitor: a drop to Low pauses ALL marketing sends automatically.
  const qualityRating = await getConfig("QUALITY_RATING");
  if (category === "MARKETING" && qualityRating === "low") {
    return { allowed: false, reason: "Marketing sends paused: WhatsApp quality rating is Low" };
  }

  // FR-G01/G03 — outside the service window, only approved templates may be sent.
  if (payload.kind !== "template") {
    const { inWindow } = await computeServiceWindow(contactId);
    if (!inWindow) {
      return {
        allowed: false,
        reason: "Outside 24h service window: free-form send blocked, an approved template is required",
      };
    }
  } else {
    const template = await prisma.messageTemplate.findUnique({ where: { name: payload.templateName } });
    if (!template) {
      return { allowed: false, reason: `Template "${payload.templateName}" is not registered` };
    }
    if (template.metaApprovalState !== "approved") {
      return { allowed: false, reason: `Template "${payload.templateName}" is not Meta-approved` };
    }

    // FR-G04 — marketing frequency cap, per contact.
    if (template.category === "MARKETING") {
      const capPerFortnight = await getConfigNumber("MARKETING_TEMPLATES_PER_CONTACT_FORTNIGHT");
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const sentRecently = await prisma.sendLog.count({
        where: { contactId, category: "MARKETING", allowed: true, createdAt: { gte: since } },
      });
      if (sentRecently >= capPerFortnight) {
        return { allowed: false, reason: "Marketing frequency cap reached for this contact" };
      }
    }
  }

  // FR-G08 — global messaging spend circuit breaker.
  const estCost = category === "MARKETING" ? PRICING_INR.marketing : category === "UTILITY" ? PRICING_INR.utility : 0;
  if (estCost > 0) {
    const dailyCeiling = await getConfigNumber("DAILY_SPEND_CEILING_INR");
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const spentToday = await prisma.costLedgerEntry.aggregate({
      where: { category: { in: ["whatsapp_marketing", "whatsapp_utility"] }, date: { gte: startOfDay } },
      _sum: { amountInr: true },
    });
    if ((spentToday._sum.amountInr ?? 0) + estCost > dailyCeiling) {
      return { allowed: false, reason: "Daily messaging spend ceiling would be exceeded" };
    }
  }

  return { allowed: true };
}

export async function sendOutboundMessage(params: {
  contactId: string;
  waId: string;
  journey?: "INTERNATIONAL" | "DOMESTIC" | "UNDECIDED" | null;
  payload: OutboundPayload;
  agentId?: string;
}): Promise<{ sent: boolean; reason?: string; metaMessageId?: string }> {
  const { contactId, waId, journey, payload, agentId } = params;

  const category: TemplateCategory | null =
    payload.kind === "template"
      ? (await prisma.messageTemplate.findUnique({ where: { name: payload.templateName } }))?.category ?? null
      : null;

  const decision = await checkGovernance(contactId, payload, category);

  await prisma.sendLog.create({
    data: {
      contactId,
      journey: journey ?? undefined,
      category: category ?? undefined,
      templateId:
        payload.kind === "template"
          ? (await prisma.messageTemplate.findUnique({ where: { name: payload.templateName } }))?.id
          : undefined,
      allowed: decision.allowed,
      reason: decision.allowed ? undefined : decision.reason,
    },
  });

  if (!decision.allowed) {
    return { sent: false, reason: decision.reason };
  }

  const { inWindow } = await computeServiceWindow(contactId);
  const bodyText = payloadToPlainText(payload);

  let metaMessageId: string | undefined;

  if (isWebMirrorWaId(waId)) {
    publishToWebMirror(waId, { type: "outbound", payload });
    metaMessageId = `web-${Date.now()}`;
  } else {
    const result = await sendWhatsAppMessage(waId, payload);
    if (!result.ok) {
      return { sent: false, reason: `Meta send failed: ${result.error}` };
    }
    metaMessageId = result.metaMessageId;
    // Live-refresh signal for any other open agent/admin tab on this thread.
    publishToWebMirror(waId, { type: "activity" });
  }

  await prisma.message.create({
    data: {
      contactId,
      metaMessageId,
      direction: "OUTBOUND",
      kind: payload.kind === "template" ? "TEMPLATE" : payload.kind === "list" ? "LIST" : payload.kind === "buttons" ? "BUTTON" : "TEXT",
      body: bodyText,
      templateName: payload.kind === "template" ? payload.templateName : undefined,
      windowStateAtSend: inWindow ? "in_window" : "out_of_window",
      deliveryStatus: "sent",
      sentByAgentId: agentId,
    },
  });

  if (category) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.costLedgerEntry.create({
      data: {
        date: today,
        category: category === "MARKETING" ? "whatsapp_marketing" : "whatsapp_utility",
        journey: journey ?? undefined,
        amountInr: category === "MARKETING" ? PRICING_INR.marketing : PRICING_INR.utility,
        units: 1,
      },
    });
  }

  return { sent: true, metaMessageId };
}

function payloadToPlainText(payload: OutboundPayload): string {
  switch (payload.kind) {
    case "text":
      return payload.body;
    case "buttons":
      return `${payload.body}\n[${payload.buttons.map((b) => b.title).join(" | ")}]`;
    case "list":
      return `${payload.body}\n[${payload.sections.flatMap((s) => s.rows.map((r) => r.title)).join(", ")}]`;
    case "cta_url":
      return `${payload.body}\n[${payload.buttonText} → ${payload.url}]`;
    case "template":
      return `[template:${payload.templateName}] ${payload.bodyParams?.join(" · ") ?? ""}`;
  }
}
