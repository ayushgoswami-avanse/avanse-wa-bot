import type { Contact } from "@prisma/client";
import type { OutboundPayload } from "@/lib/whatsapp/types";

/** FR-C02/C04 — branch-specific progressive profiling sequences, priority order per
 * Avanse_PRD_v8_0 §"Progressive profiling priority" table. Enumerable fields use list/button
 * messages (never free text) — the one exception is domestic's target institution, which
 * FR-C04's acceptance criteria does not enumerate and which has no fixed value set.
 */

export type ProfilingStep = {
  field: keyof Contact;
  kind: "list" | "buttons" | "text";
  prompt: () => OutboundPayload;
};

const internationalSteps: ProfilingStep[] = [
  {
    field: "destinationCountry",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "Which country are you hoping to study in?",
      buttonLabel: "Choose country",
      sections: [
        {
          title: "Destination",
          rows: [
            { id: "country_usa", title: "USA" },
            { id: "country_uk", title: "UK" },
            { id: "country_canada", title: "Canada" },
            { id: "country_germany", title: "Germany" },
            { id: "country_australia", title: "Australia" },
            { id: "country_ireland", title: "Ireland" },
            { id: "country_other", title: "Somewhere else" },
          ],
        },
      ],
    }),
  },
  {
    field: "degreeLevel",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "What level are you applying for?",
      buttonLabel: "Choose level",
      sections: [
        {
          title: "Degree level",
          rows: [
            { id: "level_masters", title: "Masters" },
            { id: "level_bachelors", title: "Bachelors" },
            { id: "level_phd", title: "PhD" },
            { id: "level_other", title: "Other" },
          ],
        },
      ],
    }),
  },
  {
    field: "intendedIntake",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "Which intake are you targeting?",
      buttonLabel: "Choose intake",
      sections: [
        {
          title: "Intake",
          rows: [
            { id: "intake_fall26", title: "Fall 2026" },
            { id: "intake_spring27", title: "Spring 2027" },
            { id: "intake_fall27", title: "Fall 2027" },
            { id: "intake_not_sure", title: "Not sure yet" },
          ],
        },
      ],
    }),
  },
  {
    field: "currentYearOfStudy",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "What year are you in right now?",
      buttonLabel: "Choose year",
      sections: [
        {
          title: "Current year",
          rows: [
            { id: "year_2", title: "2nd year" },
            { id: "year_3", title: "3rd year" },
            { id: "year_4", title: "4th / final year" },
            { id: "year_graduated", title: "Already graduated" },
          ],
        },
      ],
    }),
  },
  {
    field: "testStatus",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "Where are you on entrance tests (GRE / GMAT / IELTS)?",
      buttonLabel: "Choose status",
      sections: [
        {
          title: "Test status",
          rows: [
            { id: "test_not_started", title: "Not started" },
            { id: "test_preparing", title: "Preparing" },
            { id: "test_given_gre", title: "Given — GRE" },
            { id: "test_given_gmat", title: "Given — GMAT" },
            { id: "test_given_english", title: "Given — IELTS/TOEFL" },
          ],
        },
      ],
    }),
  },
  {
    field: "admissionStatus",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "How far along is your application?",
      buttonLabel: "Choose status",
      sections: [
        {
          title: "Admission status",
          rows: [
            { id: "admission_not_applied", title: "Not applied yet" },
            { id: "admission_applied", title: "Applied" },
            { id: "admission_admitted", title: "Admitted" },
            { id: "admission_admitted_funded", title: "Admitted with funding" },
          ],
        },
      ],
    }),
  },
];

const domesticSteps: ProfilingStep[] = [
  {
    field: "courseCategory",
    kind: "buttons",
    prompt: () => ({
      kind: "buttons",
      body: "What are you looking at — PG, a skilling programme, or a professional course?",
      buttons: [
        { id: "course_pg", title: "PG (MBA/M.Tech..)" },
        { id: "course_skilling", title: "Skilling" },
        { id: "course_professional", title: "Professional" },
      ],
    }),
  },
  {
    field: "targetInstitution",
    kind: "text",
    prompt: () => ({ kind: "text", body: "Which institute or programme are you targeting? (just type the name)" }),
  },
  {
    field: "intakeOrBatch",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "When does it start for you?",
      buttonLabel: "Choose timing",
      sections: [
        {
          title: "Timing",
          rows: [
            { id: "batch_immediate", title: "Immediately" },
            { id: "batch_3m", title: "Within 3 months" },
            { id: "batch_6m", title: "Within 6 months" },
            { id: "batch_next_year", title: "Next year" },
          ],
        },
      ],
    }),
  },
  {
    field: "employmentStatus",
    kind: "buttons",
    prompt: () => ({
      kind: "buttons",
      body: "Are you currently studying or working?",
      buttons: [
        { id: "status_student", title: "Student" },
        { id: "status_working", title: "Working professional" },
      ],
    }),
  },
  {
    field: "entranceStatus",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "Where are you on the entrance process (CAT/GATE/other), if any?",
      buttonLabel: "Choose status",
      sections: [
        {
          title: "Entrance status",
          rows: [
            { id: "entrance_na", title: "Not applicable" },
            { id: "entrance_preparing", title: "Preparing" },
            { id: "entrance_appeared", title: "Appeared" },
            { id: "entrance_awaited", title: "Result awaited" },
            { id: "entrance_selected", title: "Selected" },
          ],
        },
      ],
    }),
  },
  {
    field: "admissionStatus",
    kind: "list",
    prompt: () => ({
      kind: "list",
      body: "How far along is your application?",
      buttonLabel: "Choose status",
      sections: [
        {
          title: "Admission status",
          rows: [
            { id: "admission_not_applied", title: "Not applied yet" },
            { id: "admission_applied", title: "Applied" },
            { id: "admission_admitted", title: "Admitted" },
          ],
        },
      ],
    }),
  },
];

export function stepsForJourney(journey: "INTERNATIONAL" | "DOMESTIC"): ProfilingStep[] {
  return journey === "DOMESTIC" ? domesticSteps : internationalSteps;
}

/** FR-C05 — qualified lead requires every field in the branch's sequence to be set. */
export function nextPendingStep(
  journey: "INTERNATIONAL" | "DOMESTIC",
  contact: Contact
): ProfilingStep | null {
  const steps = stepsForJourney(journey);
  return steps.find((s) => !contact[s.field]) ?? null;
}

export function isProfilingComplete(journey: "INTERNATIONAL" | "DOMESTIC", contact: Contact): boolean {
  return nextPendingStep(journey, contact) === null;
}

const ROW_ID_TO_FIELD_VALUE: Record<string, { field: keyof Contact; value: string }> = {
  country_usa: { field: "destinationCountry", value: "USA" },
  country_uk: { field: "destinationCountry", value: "UK" },
  country_canada: { field: "destinationCountry", value: "Canada" },
  country_germany: { field: "destinationCountry", value: "Germany" },
  country_australia: { field: "destinationCountry", value: "Australia" },
  country_ireland: { field: "destinationCountry", value: "Ireland" },
  country_other: { field: "destinationCountry", value: "Other" },

  level_masters: { field: "degreeLevel", value: "Masters" },
  level_bachelors: { field: "degreeLevel", value: "Bachelors" },
  level_phd: { field: "degreeLevel", value: "PhD" },
  level_other: { field: "degreeLevel", value: "Other" },

  intake_fall26: { field: "intendedIntake", value: "Fall 2026" },
  intake_spring27: { field: "intendedIntake", value: "Spring 2027" },
  intake_fall27: { field: "intendedIntake", value: "Fall 2027" },
  intake_not_sure: { field: "intendedIntake", value: "Not sure yet" },

  year_2: { field: "currentYearOfStudy", value: "2nd year" },
  year_3: { field: "currentYearOfStudy", value: "3rd year" },
  year_4: { field: "currentYearOfStudy", value: "4th / final year" },
  year_graduated: { field: "currentYearOfStudy", value: "Graduated" },

  test_not_started: { field: "testStatus", value: "Not started" },
  test_preparing: { field: "testStatus", value: "Preparing" },
  test_given_gre: { field: "testStatus", value: "Given — GRE" },
  test_given_gmat: { field: "testStatus", value: "Given — GMAT" },
  test_given_english: { field: "testStatus", value: "Given — IELTS/TOEFL" },

  admission_not_applied: { field: "admissionStatus", value: "Not applied" },
  admission_applied: { field: "admissionStatus", value: "Applied" },
  admission_admitted: { field: "admissionStatus", value: "Admitted" },
  admission_admitted_funded: { field: "admissionStatus", value: "Admitted with funding" },

  course_pg: { field: "courseCategory", value: "PG" },
  course_skilling: { field: "courseCategory", value: "Skilling" },
  course_professional: { field: "courseCategory", value: "Professional" },

  batch_immediate: { field: "intakeOrBatch", value: "Immediately" },
  batch_3m: { field: "intakeOrBatch", value: "Within 3 months" },
  batch_6m: { field: "intakeOrBatch", value: "Within 6 months" },
  batch_next_year: { field: "intakeOrBatch", value: "Next year" },

  status_student: { field: "employmentStatus", value: "Student" },
  status_working: { field: "employmentStatus", value: "Working professional" },

  entrance_na: { field: "entranceStatus", value: "Not applicable" },
  entrance_preparing: { field: "entranceStatus", value: "Preparing" },
  entrance_appeared: { field: "entranceStatus", value: "Appeared" },
  entrance_awaited: { field: "entranceStatus", value: "Result awaited" },
  entrance_selected: { field: "entranceStatus", value: "Selected" },
};

export function resolveProfilingReply(replyId: string): { field: keyof Contact; value: string } | null {
  return ROW_ID_TO_FIELD_VALUE[replyId] ?? null;
}
