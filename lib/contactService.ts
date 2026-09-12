import { prisma } from "@/lib/prisma";
import { resolveAttribution, stampFirstTouchIfUnset, recordLastTouch } from "@/lib/attribution";
import { getConfigNumber } from "@/lib/config";
import type { Contact } from "@prisma/client";

/** Layer 1 — entry and attribution resolution (PRD §2.1). Shared by the real WhatsApp
 * webhook and the web-mirror channel so both flow through identical attribution,
 * consent and conversation logic (FR-J04/J05).
 */
export async function findOrCreateContact(
  waId: string,
  profileName: string | undefined,
  clickToken: string | null
): Promise<{ contact: Contact; isNew: boolean }> {
  const existing = await prisma.contact.findUnique({ where: { waId } });
  if (existing) {
    // FR-A08 — a later scan by a known contact is recorded for analysis, never re-resolved.
    if (clickToken) await recordLastTouch(existing.id, clickToken);
    return { contact: existing, isNew: false };
  }

  const contact = await prisma.contact.create({
    data: { waId, profileName },
  });

  // FR-A04/A07 — resolve once, on the very first inbound message, and stamp permanently.
  const recoveryWindow = await getConfigNumber("ATTRIBUTION_RECOVERY_WINDOW_MINUTES");
  const attribution = await resolveAttribution(clickToken, recoveryWindow);
  await stampFirstTouchIfUnset(contact.id, attribution);

  const refreshed = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
  return { contact: refreshed, isNew: true };
}
