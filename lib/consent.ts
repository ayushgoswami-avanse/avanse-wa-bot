import { prisma } from "@/lib/prisma";

/** Module B — consent, identity and age gate (BRD FR-B04..FR-B08, PRD Layer 2). */

export const CONSENT_NOTICE_VERSION = "v2.0-2026-09"; // CR-05 — version-controlled. v2.0 moves consent from a cold opening gate to the point it actually applies: just before a student's details reach the human sales team.

/** FR-B04/B05 — asked once, at the moment it actually means something: the student is
 * about to be handed to a human counsellor or an eligibility check, which is when their
 * details leave the conversation. Asking this up front (as v1.x did) gated a career
 * conversation that never needed it.
 */
export const SALES_CONSENT_TEXT =
  "Before I bring in our team on this — okay if I share what we've discussed with an Avanse " +
  "counsellor so they can pick up from here instead of starting over?";

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
