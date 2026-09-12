import type { Contact, Handover, HandoffToken, InteractionSession } from "@prisma/client";
import { computeCohort } from "@/lib/segmentation";
import { bandToTemperature } from "@/lib/propensity";

/** A deterministic, composed brief from the sales manager's point of view — what someone
 * about to call or follow up on this lead needs to know in 15 seconds, without reading
 * the raw transcript. Built from structured fields + the rolling summaries already
 * captured (lib/conversation/sessions.ts), not a fresh AI call — reliable and free to
 * regenerate on every page view.
 */

export type SalesBrief = {
  headline: string;
  temperatureLine: string;
  qualificationLine: string;
  journeyLine: string;
  attributionLine: string;
  engagementLine: string;
  latestActivity: string;
  nextAction: string;
  flags: string[];
};

const ACTIVE_ONBOARDING_STAGES = new Set(["NEW", "AWAITING_CONSENT", "AWAITING_AGE_GATE", "AWAITING_JOURNEY_FORK"]);

export function buildSalesBrief(
  contact: Contact,
  sessions: InteractionSession[],
  openHandover: Handover | null,
  handoffTokens: HandoffToken[]
): SalesBrief {
  const cohort = computeCohort(contact);
  const temperature = bandToTemperature(contact.propensityBand);
  const name = contact.confirmedName ?? contact.profileName ?? "This student";

  const headline = `${name} — ${cohort.personaLabel}`;

  const temperatureReasons: string[] = [];
  if (contact.lastSentiment === "POSITIVE") temperatureReasons.push("recent positive sentiment");
  if (contact.lastSentiment === "NEGATIVE") temperatureReasons.push("recent negative sentiment — handle with care");
  if (contact.isQualifiedLead) temperatureReasons.push("profile fully qualified");
  if (cohort.segmentTags.includes("near-intake")) temperatureReasons.push("intake is close");
  const temperatureLine = `${temperature} (score ${contact.propensityScore}/100)${
    temperatureReasons.length ? ` — ${temperatureReasons.join(", ")}` : ""
  }`;

  const qualificationLine = contact.isQualifiedLead
    ? `Qualified lead since ${contact.qualifiedAt ? new Date(contact.qualifiedAt).toLocaleDateString() : "recently"}.`
    : "Not yet qualified — profile is still incomplete.";

  const journeyBits =
    contact.journey === "DOMESTIC"
      ? [contact.courseCategory, contact.targetInstitution, contact.intakeOrBatch, contact.employmentStatus]
      : [contact.destinationCountry, contact.degreeLevel, contact.intendedIntake, contact.currentYearOfStudy];
  const journeyLine = journeyBits.filter(Boolean).join(" · ") || "Journey details not yet captured.";

  const attributionLine = `${contact.attributionTier ?? "Unresolved"} attribution${
    contact.collegeNameAttributed ? ` · ${contact.collegeNameAttributed}` : ""
  }`;

  const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
  const engagementLine = `${contact.interactionSessionCount} session${contact.interactionSessionCount === 1 ? "" : "s"}, ${totalMessages} messages total`;

  const latestSession = sessions[0]; // caller passes sessions ordered newest-first
  const latestActivity = latestSession?.summary?.split("\n").pop()?.replace(/^- /, "") ?? "No AI-summarised activity yet.";

  const flags: string[] = [];
  if (contact.isMinor) flags.push("Under 18 — content only, do not pass to Sales");
  if (contact.optedOutMarketing) flags.push("Opted out of marketing sends");
  if (openHandover) flags.push(`Escalated to a human counsellor (${openHandover.reason.replaceAll("_", " ").toLowerCase()}) — needs agent attention`);

  const consumedHandoff = handoffTokens.find((t) => t.consumedAt);

  let nextAction: string;
  if (contact.isMinor) {
    nextAction = "No sales action — under-18 contacts are content-only by policy.";
  } else if (openHandover) {
    nextAction = "Pick this up in the Agent Console now — the student is waiting on a human.";
  } else if (ACTIVE_ONBOARDING_STAGES.has(contact.stage)) {
    nextAction = "Still onboarding (consent/age/journey) — not yet actionable.";
  } else if (contact.stage.startsWith("ELIGIBILITY_")) {
    nextAction = "Mid indicative-eligibility check with the bot — check back shortly.";
  } else if (contact.stage === "PROFILING") {
    nextAction = "Still being profiled by the bot — revisit once qualified.";
  } else if (consumedHandoff) {
    nextAction = "Has opened the DIY application link — follow up on application progress.";
  } else if (contact.isQualifiedLead && temperature === "Hot") {
    nextAction = "Qualified and hot — good candidate for a proactive call today.";
  } else if (contact.isQualifiedLead) {
    nextAction = "Qualified — nurture via WhatsApp or a lower-priority follow-up call.";
  } else {
    nextAction = "Still exploring — keep in automated nurture, not yet ready for a sales call.";
  }

  return { headline, temperatureLine, qualificationLine, journeyLine, attributionLine, engagementLine, latestActivity, nextAction, flags };
}
