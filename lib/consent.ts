import { prisma } from "@/lib/prisma";

/** Module B — consent, identity and age gate (BRD FR-B04..FR-B08, PRD Layer 2). */

export const CONSENT_NOTICE_VERSION = "v1.1-2026-09"; // CR-05 — Legal-approved, version-controlled. Bumped for the warmer v1.1 wording below (same disclosed substance: AI, not human; Avanse Financial Services, RBI-registered NBFC; purpose + data-sharing ask).

// FR-B04 warmup line, sent as its own message just before the disclosure below — pure
// rapport-building, discloses nothing new, never skips or delays the actual disclosure.
export const WARM_OPENER_TEXT = "Hey! 👋 Thinking about funding your next big move — college, a course, maybe a move abroad?";

export const IDENTITY_DISCLOSURE_TEXT =
  "Quick heads-up before we dive in: I'm Aanya, an AI counsellor (not a human) built by Avanse " +
  "Financial Services, an RBI-registered NBFC. Think of me as your fastest first stop — I can't " +
  "give independent financial advice, but I can get you real answers fast and line up a human " +
  "counsellor the moment you need one.";

export const PURPOSE_NOTICE_TEXT =
  "I'll ask a few quick questions to understand what you're looking for, and — with your OK — " +
  "share your details with our team so they can follow up faster. Cool if we get started?";

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
