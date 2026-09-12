import { prisma } from "@/lib/prisma";
import { getConfigNumber } from "@/lib/config";
import type { Contact, Sentiment } from "@prisma/client";

/** Interaction-session tracking: aggregates a burst of back-and-forth into one row with a
 * summary, sentiment and a snapshot of what was collected — what a sales rep skimming a
 * lead needs, without reading the raw transcript. Not a BRD requirement; added per direct
 * user feedback on the POC demo.
 */

const PROFILE_FIELDS = [
  "destinationCountry",
  "degreeLevel",
  "intendedIntake",
  "currentYearOfStudy",
  "testStatus",
  "admissionStatus",
  "courseCategory",
  "targetInstitution",
  "intakeOrBatch",
  "employmentStatus",
  "entranceStatus",
] as const;

function snapshotProfileFields(contact: Contact): string {
  const snapshot: Record<string, string> = {};
  for (const f of PROFILE_FIELDS) {
    const v = contact[f];
    if (v) snapshot[f] = v as string;
  }
  return JSON.stringify(snapshot);
}

/** Returns the contact's currently-open session, opening a new one (and closing the
 * previous one, if any) when the gap since its last activity exceeds SESSION_GAP_MINUTES.
 * Also true on a brand-new contact's very first message. Always bumps messageCount.
 */
export async function touchSession(contact: Contact): Promise<{ sessionId: string; isNewSession: boolean }> {
  const gapMinutes = await getConfigNumber("SESSION_GAP_MINUTES");

  const open = await prisma.interactionSession.findFirst({
    where: { contactId: contact.id, endedAt: null },
    orderBy: { startedAt: "desc" },
  });

  const gapExceeded = open ? Date.now() - open.updatedAt.getTime() > gapMinutes * 60 * 1000 : false;

  if (open && !gapExceeded) {
    await prisma.interactionSession.update({
      where: { id: open.id },
      data: { messageCount: { increment: 1 } },
    });
    return { sessionId: open.id, isNewSession: false };
  }

  if (open && gapExceeded) {
    await prisma.interactionSession.update({
      where: { id: open.id },
      data: { endedAt: open.updatedAt, stageAtEnd: contact.stage },
    });
  }

  const created = await prisma.interactionSession.create({
    data: {
      contactId: contact.id,
      messageCount: 1,
      dataSnapshotJson: snapshotProfileFields(contact),
    },
  });

  await prisma.contact.update({
    where: { id: contact.id },
    data: { interactionSessionCount: { increment: 1 } },
  });

  return { sessionId: created.id, isNewSession: true };
}

/** Called after an AI turn: records the model's own sentiment read and one-line note
 * against the current session, and rolls a short note into the contact's maintained
 * profile summary (PRD §5.3 — "last time you were looking at Fall 2027").
 */
export async function recordTurnInsights(
  contactId: string,
  sessionId: string,
  insights: { sentiment?: Sentiment; sessionNote?: string }
): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });

  if (insights.sentiment) {
    await prisma.contact.update({ where: { id: contactId }, data: { lastSentiment: insights.sentiment } });
  }

  if (insights.sessionNote) {
    const session = await prisma.interactionSession.findUnique({ where: { id: sessionId } });
    const existingSummary = session?.summary ?? "";
    const nextSummary = existingSummary ? `${existingSummary}\n- ${insights.sessionNote}` : `- ${insights.sessionNote}`;

    await prisma.interactionSession.update({
      where: { id: sessionId },
      data: {
        summary: nextSummary.slice(-1500),
        sentiment: insights.sentiment,
        dataSnapshotJson: snapshotProfileFields(contact),
      },
    });

    // Rolling, cross-session summary — capped so it stays cheap to inject into every prompt.
    const priorProfileSummary = contact.profileSummary ?? "";
    const nextProfileSummary = priorProfileSummary
      ? `${priorProfileSummary}\n- ${insights.sessionNote}`
      : `- ${insights.sessionNote}`;
    await prisma.contact.update({
      where: { id: contactId },
      data: { profileSummary: nextProfileSummary.slice(-800) },
    });
  }
}

export async function closeSessionSnapshot(contact: Contact, sessionId: string): Promise<void> {
  await prisma.interactionSession.update({
    where: { id: sessionId },
    data: { stageAtEnd: contact.stage, dataSnapshotJson: snapshotProfileFields(contact) },
  });
}
