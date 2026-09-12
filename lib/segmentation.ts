import type { Contact } from "@prisma/client";

/** Cohort/persona segmentation for Sales targeting and personalised marketing automation
 * (PRD §1 "Users and jobs" table describes personas at a system level; this derives one
 * per actual lead from the profiling data already captured, purely computed — no schema
 * change, no extra model call, so it's always in sync with the live profile).
 */

export type Cohort = {
  /** Short, filterable label: journey + course + destination + intake, e.g.
   * "International · Masters · USA · Fall 2026". Good for grouping in a spreadsheet. */
  cohortLabel: string;
  /** One of a small fixed set of marketing-facing persona names — the "who is this,
   * broadly" a campaign or a sales rep's opening line would be built around. */
  personaLabel: string;
  /** Additional filterable tags: urgency, engagement, life-stage signals. */
  segmentTags: string[];
};

const NEAR_TERM_INTAKES = ["fall 2026", "immediately", "within 3 months"];

function isNearTermIntake(intake: string | null): boolean {
  if (!intake) return false;
  return NEAR_TERM_INTAKES.includes(intake.toLowerCase());
}

function isAdvancedStage(admissionStatus: string | null, entranceStatus: string | null): boolean {
  const text = `${admissionStatus ?? ""} ${entranceStatus ?? ""}`.toLowerCase();
  return ["admitted", "selected", "applied", "appeared", "result awaited"].some((k) => text.includes(k));
}

export function computeCohort(contact: Contact): Cohort {
  const tags: string[] = [];

  if (contact.journey === "INTERNATIONAL") {
    const cohortLabel = [
      "International",
      contact.degreeLevel,
      contact.destinationCountry,
      contact.intendedIntake,
    ]
      .filter(Boolean)
      .join(" · ") || "International · Undetermined";

    const nearTerm = isNearTermIntake(contact.intendedIntake);
    const advanced = isAdvancedStage(contact.admissionStatus, null);
    const testReady = (contact.testStatus ?? "").toLowerCase().startsWith("given");

    if (nearTerm) tags.push("near-intake");
    if (testReady) tags.push("test-ready");
    if (contact.currentYearOfStudy?.toLowerCase().includes("final") || contact.currentYearOfStudy?.toLowerCase().includes("4th")) {
      tags.push("final-year");
    }
    if (contact.propensityBand === "HIGH") tags.push("high-engagement");

    let personaLabel: string;
    if (advanced) personaLabel = "Decision-Stage Applicant";
    else if (testReady && nearTerm) personaLabel = "Fast-Track International Aspirant";
    else if (testReady) personaLabel = "Application-Ready Planner";
    else if (nearTerm) personaLabel = "Time-Pressed Early Planner";
    else personaLabel = "Early-Stage Explorer";

    return { cohortLabel, personaLabel, segmentTags: tags };
  }

  if (contact.journey === "DOMESTIC") {
    const cohortLabel = [
      "Domestic",
      contact.courseCategory,
      contact.targetInstitution,
      contact.intakeOrBatch,
    ]
      .filter(Boolean)
      .join(" · ") || "Domestic · Undetermined";

    const nearTerm = isNearTermIntake(contact.intakeOrBatch);
    const working = contact.employmentStatus === "Working professional";
    const advanced = isAdvancedStage(contact.admissionStatus, contact.entranceStatus);

    if (nearTerm) tags.push("near-intake");
    if (working) tags.push("working-professional");
    if (contact.courseCategory === "Skilling") tags.push("skilling-track");
    if (contact.propensityBand === "HIGH") tags.push("high-engagement");

    let personaLabel: string;
    if (working && contact.courseCategory === "Professional") personaLabel = "Career Upskiller";
    else if (working) personaLabel = "Working Professional Reskiller";
    else if (advanced) personaLabel = "Domestic PG Achiever";
    else if (contact.courseCategory === "Skilling") personaLabel = "Skilling Fast-Starter";
    else personaLabel = "Campus PG Aspirant";

    return { cohortLabel, personaLabel, segmentTags: tags };
  }

  return { cohortLabel: "Undecided journey", personaLabel: "Undecided Explorer", segmentTags: [] };
}
