import { prisma } from "@/lib/prisma";
import type { Contact, PropensityBand } from "@prisma/client";

/** FR-C07 — propensity scoring, updated as profile fields and engagement change.
 *
 * POC simplification: a transparent weighted heuristic over profile completeness,
 * admission/entrance progress and engagement depth, rather than a trained model on
 * sentiment + behavioural signals. Logged in .ai/engineering/tech-debt.md. The band
 * (not the raw score) is what drives FR-F04's Processio sync gate, so the heuristic
 * only needs to rank contacts sensibly, not be precise.
 */

const POSITIVE_STATUS_KEYWORDS = ["admit", "selected", "shortlisted", "offer", "confirmed", "qualified"];

export function computePropensityScore(
  contact: Pick<
    Contact,
    | "journey"
    | "destinationCountry"
    | "degreeLevel"
    | "intendedIntake"
    | "currentYearOfStudy"
    | "testStatus"
    | "admissionStatus"
    | "courseCategory"
    | "targetInstitution"
    | "intakeOrBatch"
    | "employmentStatus"
    | "entranceStatus"
  >,
  messageCount: number
): number {
  let score = 0;

  const internationalFields = [
    contact.destinationCountry,
    contact.degreeLevel,
    contact.intendedIntake,
    contact.currentYearOfStudy,
    contact.testStatus,
    contact.admissionStatus,
  ];
  const domesticFields = [
    contact.courseCategory,
    contact.targetInstitution,
    contact.intakeOrBatch,
    contact.currentYearOfStudy,
    contact.entranceStatus,
    contact.admissionStatus,
  ];

  const fields = contact.journey === "DOMESTIC" ? domesticFields : internationalFields;
  score += fields.filter(Boolean).length * 10; // up to 60

  const statusText = `${contact.admissionStatus ?? ""} ${contact.entranceStatus ?? ""} ${contact.testStatus ?? ""}`.toLowerCase();
  if (POSITIVE_STATUS_KEYWORDS.some((k) => statusText.includes(k))) score += 15;

  if (messageCount >= 10) score += 15;
  else if (messageCount >= 5) score += 8;

  return Math.min(100, score);
}

export function scoreToBand(score: number): PropensityBand {
  if (score >= 70) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export async function recomputeAndPersistPropensity(contactId: string): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const messageCount = await prisma.message.count({ where: { contactId, direction: "INBOUND" } });

  const score = computePropensityScore(contact, messageCount);
  const band = scoreToBand(score);

  await prisma.contact.update({
    where: { id: contactId },
    data: { propensityScore: score, propensityBand: band },
  });
}
