import { prisma } from "@/lib/prisma";

/** Module B — consent, identity and age gate (BRD FR-B04..FR-B08, PRD Layer 2). */

export const CONSENT_NOTICE_VERSION = "v1.0-2026-09"; // CR-05 — Legal-approved, version-controlled.

export const IDENTITY_DISCLOSURE_TEXT =
  "Hi! I'm an automated assistant from Avanse Financial Services, an RBI-registered NBFC — " +
  "not a human counsellor, and nothing here is independent financial advice.";

export const PURPOSE_NOTICE_TEXT =
  "I'd like to help you explore education loan options. To do that I'll ask a few questions " +
  "and may pass your details to our sales team. Is that okay?";

/** FR-B06/DR-05 — append-only. No update or delete path exists anywhere else in the codebase. */
export async function recordConsent(
  contactId: string,
  action: "GRANTED" | "WITHDRAWN",
  evidenceMessageId: string
): Promise<void> {
  await prisma.consentLedgerEntry.create({
    data: {
      contactId,
      noticeVersion: CONSENT_NOTICE_VERSION,
      scope: "PROFILING_AND_CONTACT",
      action,
      evidenceMessageId,
    },
  });

  await prisma.contact.update({
    where: { id: contactId },
    data: { consentGranted: action === "GRANTED" },
  });
}

/** FR-B08 — STOP and equivalents, honoured immediately and irreversibly for marketing. */
const OPT_OUT_PHRASES = ["stop", "unsubscribe", "opt out", "optout", "cancel"];

export function isOptOutMessage(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return OPT_OUT_PHRASES.some((p) => normalized === p || normalized.startsWith(p + " "));
}

export async function recordOptOut(contactId: string): Promise<void> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { optedOutMarketing: true, optedOutAt: new Date() },
  });
}

/** FR-B07 — under-18 contacts receive content only: no profiling, no lead record, no
 * nurture, no sales handoff. Age isn't verifiable from WhatsApp, so this is a
 * self-declared control, exactly as the BRD specifies it (a control, not KYC).
 */
export async function recordAgeGate(contactId: string, isAdult: boolean): Promise<void> {
  await prisma.contact.update({
    where: { id: contactId },
    data: { ageGateStatus: isAdult ? "adult" : "minor", isMinor: !isAdult },
  });
}
