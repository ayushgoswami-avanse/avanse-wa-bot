import type { Contact } from "@prisma/client";

/** FR-C05 — qualified lead, defined in code (not left to convention): "consent plus name,
 * journey, destination or course category, level, intake, year of study." Domestic has no
 * literal "level" field, so course category + institute stand in for it — see ADR note in
 * .ai/memory/decisions.md if this mapping is revisited.
 */
export function isQualifiedLead(contact: Contact): boolean {
  const hasName = !!(contact.confirmedName ?? contact.profileName);
  if (!contact.consentGranted || !hasName || !contact.journey) return false;

  if (contact.journey === "INTERNATIONAL") {
    return !!(
      contact.destinationCountry &&
      contact.degreeLevel &&
      contact.intendedIntake &&
      contact.currentYearOfStudy
    );
  }

  if (contact.journey === "DOMESTIC") {
    return !!(contact.courseCategory && contact.intakeOrBatch && contact.employmentStatus);
  }

  return false;
}
