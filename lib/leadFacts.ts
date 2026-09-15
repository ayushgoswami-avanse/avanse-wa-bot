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

export type FactSection = { title: string; facts: BriefFact[] };

/** The single source of truth for "every profiling variable we track on a lead", shown
 * identically in both the admin and agent consoles, grouped into three sections:
 *
 * - Lead Overview: who/where this lead came from and the system's own read on it —
 *   Journey, Sentiment, Attribution, Source, Name, plus derived state (Stage, Window,
 *   Sessions, Qualified).
 * - Current Profile: where the student actually is right now (current year of study,
 *   current employment) — independent of which journey they're on.
 * - Target Plan: what they're aiming for. Journey-conditional, because showing BOTH
 *   branches' fields side by side (International's "Intended intake" next to Domestic's
 *   "Intake/batch", one always null) read as confusing near-duplicates rather than a
 *   real gap — once the journey is known, only that branch's fields are shown, merged
 *   into shared labels ("Target intake") where the two branches mean the same thing.
 */
export function buildLeadFacts(
  contact: Contact,
  opts: { inWindow: boolean; showFinancials: boolean; sourceSummary: string }
): FactSection[] {
  const overview: BriefFact[] = [
    { label: "Name", value: orNull(contact.confirmedName ?? contact.profileName) },
    { label: "Journey", value: contact.journey ?? NULL_DISPLAY },
    { label: "Stage", value: contact.stage.replaceAll("_", " ").toLowerCase() },
    { label: "Window", value: opts.inWindow ? "Open" : "Closed" },
    { label: "Attribution", value: contact.attributionTier ?? NULL_DISPLAY },
    { label: "Source", value: opts.sourceSummary },
    { label: "Sessions", value: String(contact.interactionSessionCount) },
    { label: "Qualified", value: contact.isQualifiedLead ? "Yes" : "No" },
    { label: "Sentiment", value: contact.lastSentiment ? contact.lastSentiment.toLowerCase() : NULL_DISPLAY },
  ];

  const currentProfile: BriefFact[] = [
    { label: "Current year", value: orNull(contact.currentYearOfStudy) },
    { label: "Employment", value: orNull(contact.employmentStatus) },
  ];

  const sections: FactSection[] = [
    { title: "Lead Overview", facts: overview },
    { title: "Current Profile", facts: currentProfile },
  ];

  if (opts.showFinancials) {
    const targetPlan: BriefFact[] =
      contact.journey === "DOMESTIC"
        ? [
            { label: "Course category", value: orNull(contact.courseCategory) },
            { label: "Subject/major", value: orNull(contact.fieldOfStudy) },
            { label: "Target institute", value: orNull(contact.targetInstitution) },
            { label: "Target intake", value: orNull(contact.intakeOrBatch) },
            { label: "Entrance status", value: orNull(contact.entranceStatus) },
            { label: "Admission status", value: orNull(contact.admissionStatus) },
          ]
        : contact.journey === "INTERNATIONAL"
        ? [
            { label: "Destination", value: orNull(contact.destinationCountry) },
            { label: "Degree level", value: orNull(contact.degreeLevel) },
            { label: "Subject/major", value: orNull(contact.fieldOfStudy) },
            { label: "Target intake", value: orNull(contact.intendedIntake) },
            { label: "Test status", value: orNull(contact.testStatus) },
            { label: "Admission status", value: orNull(contact.admissionStatus) },
          ]
        : [{ label: "Status", value: "Journey not yet decided" }];

    sections.push({ title: "Target Plan", facts: targetPlan });
  } else {
    sections.push({ title: "Target Plan", facts: [{ label: "Status", value: "Masked for your role" }] });
  }

  return sections;
}
