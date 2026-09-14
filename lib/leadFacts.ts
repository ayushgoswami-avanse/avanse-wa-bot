import type { Contact } from "@prisma/client";
import type { BriefFact } from "@/components/SalesBriefCard";

/** Explicit stand-in for "not captured yet" — shown as-is (styled distinctly, see
 * SalesBriefCard) rather than a silently-omitted chip, so a counsellor scanning this
 * before a phone call can see at a glance exactly which fields are still missing and
 * needs to ask for them, instead of wondering whether a blank means "unknown" or
 * "doesn't apply".
 */
export const NULL_DISPLAY = "null";

function orNull(v: string | null | undefined): string {
  return v && v.trim() ? v : NULL_DISPLAY;
}

/** The single source of truth for "every profiling variable we track on a lead", shown
 * identically in both the admin and agent consoles (previously each screen built its own
 * ad hoc subset, which is how a destinationCountry ended up mislabelled under a chip
 * literally titled "Course"). Always returns the full set — journey-inapplicable fields
 * still render as "null" rather than being hidden, since a Domestic lead showing
 * International-only fields as null is informative (confirms the branch), not confusing.
 */
export function buildLeadFacts(
  contact: Contact,
  opts: { inWindow: boolean; showFinancials: boolean; sourceSummary: string }
): BriefFact[] {
  const facts: BriefFact[] = [
    { label: "Journey", value: contact.journey ?? NULL_DISPLAY },
    { label: "Stage", value: contact.stage.replaceAll("_", " ").toLowerCase() },
    { label: "Window", value: opts.inWindow ? "Open" : "Closed" },
    { label: "Attribution", value: contact.attributionTier ?? NULL_DISPLAY },
    { label: "Source", value: opts.sourceSummary },
    { label: "Name", value: orNull(contact.confirmedName ?? contact.profileName) },
  ];

  if (opts.showFinancials) {
    facts.push({ label: "Destination", value: orNull(contact.destinationCountry) }, { label: "Degree level", value: orNull(contact.degreeLevel) });
  }

  facts.push(
    { label: "Intended intake", value: orNull(contact.intendedIntake) },
    { label: "Current year", value: orNull(contact.currentYearOfStudy) },
    { label: "Test status", value: orNull(contact.testStatus) },
    { label: "Admission status", value: orNull(contact.admissionStatus) }
  );

  if (opts.showFinancials) {
    facts.push({ label: "Course category", value: orNull(contact.courseCategory) }, { label: "Target institute", value: orNull(contact.targetInstitution) });
  }

  facts.push(
    { label: "Intake/batch", value: orNull(contact.intakeOrBatch) },
    { label: "Employment", value: orNull(contact.employmentStatus) },
    { label: "Entrance status", value: orNull(contact.entranceStatus) },
    { label: "Sessions", value: String(contact.interactionSessionCount) },
    { label: "Qualified", value: contact.isQualifiedLead ? "Yes" : "No" },
    { label: "Sentiment", value: contact.lastSentiment ? contact.lastSentiment.toLowerCase() : NULL_DISPLAY }
  );

  return facts;
}
