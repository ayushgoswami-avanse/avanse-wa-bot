import { prisma } from "@/lib/prisma";
import type { Contact, InteractionSession, DispositionEvent, AgentNote, Handover, AgentUser } from "@prisma/client";
import { getAttributionSource } from "@/lib/attribution";

const FIELD_LABELS: Record<string, string> = {
  journey: "Journey",
  attributionTier: "Attribution",
  source: "Source",
  college: "College",
  destinationCountry: "Destination",
  degreeLevel: "Degree level",
  fieldOfStudy: "Subject/major",
  intendedIntake: "Intended intake",
  currentYearOfStudy: "Current year",
  testStatus: "Test status",
  admissionStatus: "Admission status",
  courseCategory: "Course",
  targetInstitution: "Target institution",
  intakeOrBatch: "Intake/batch",
  employmentStatus: "Employment status",
  entranceStatus: "Entrance status",
  isQualifiedLead: "Qualified lead",
  propensityScore: "Propensity score",
  propensityBand: "Propensity band",
  leadTemperature: "Lead temperature",
  cohortLabel: "Cohort",
  personaLabel: "Persona",
  segmentTags: "Segment tags",
};

export type SnapshotDiff = { key: string; label: string; from: string; to: string };

export type TimelineEvent =
  | { kind: "first_contact"; at: Date; attributionTier: string | null; sourceSummary: string; assetCode: string | null }
  | { kind: "session"; at: Date; session: InteractionSession; snapshot: Record<string, unknown>; changed: SnapshotDiff[] }
  | { kind: "disposition"; at: Date; disposition: string; note: string | null; agentName: string }
  | { kind: "note"; at: Date; body: string; agentName: string }
  | { kind: "handover_opened"; at: Date; reason: string }
  | { kind: "handover_resolved"; at: Date; reason: string };

function parseSnapshot(json: string | null): Record<string, unknown> {
  if (!json) return {};
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function diffSnapshots(prev: Record<string, unknown>, next: Record<string, unknown>): SnapshotDiff[] {
  const diffs: SnapshotDiff[] = [];
  for (const key of Object.keys(next)) {
    const from = prev[key];
    const to = next[key];
    if (from === to) continue;
    // Skip pure score fluctuations without a band change to avoid noisy 1-point diffs.
    if (key === "propensityScore") continue;
    diffs.push({
      key,
      label: FIELD_LABELS[key] ?? key,
      from: from === undefined ? "—" : String(from),
      to: String(to),
    });
  }
  return diffs;
}

/** Builds one chronologically-sorted timeline for a lead: first-touch attribution, every
 * interaction session (with what changed vs the prior snapshot so a sales rep can see
 * preferences evolving at a glance), disposition changes, free-text notes, and human
 * handover open/resolve events. Everything a sales manager needs to understand the whole
 * journey without reading the raw transcript.
 */
export async function buildLeadTimeline(
  contact: Contact
): Promise<{ events: TimelineEvent[]; dispositionEvents: (DispositionEvent & { setByAgent: AgentUser })[]; notes: (AgentNote & { author: AgentUser })[] }> {
  const [sessions, dispositionEvents, notes, handovers] = await Promise.all([
    prisma.interactionSession.findMany({ where: { contactId: contact.id }, orderBy: { startedAt: "asc" } }),
    prisma.dispositionEvent.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" }, include: { setByAgent: true } }),
    prisma.agentNote.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" }, include: { author: true } }),
    prisma.handover.findMany({ where: { contactId: contact.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const events: TimelineEvent[] = [];
  const attributionSource = await getAttributionSource(contact);

  events.push({
    kind: "first_contact",
    at: contact.createdAt,
    attributionTier: contact.attributionTier,
    sourceSummary: attributionSource.summary,
    assetCode: attributionSource.assetCode,
  });

  let prevSnapshot: Record<string, unknown> = {};
  for (const session of sessions) {
    const snapshot = parseSnapshot(session.dataSnapshotJson);
    events.push({
      kind: "session",
      at: session.startedAt,
      session,
      snapshot,
      changed: diffSnapshots(prevSnapshot, snapshot),
    });
    prevSnapshot = snapshot;
  }

  for (const d of dispositionEvents) {
    events.push({ kind: "disposition", at: d.createdAt, disposition: d.disposition, note: d.note, agentName: d.setByAgent.displayName });
  }

  for (const n of notes) {
    events.push({ kind: "note", at: n.createdAt, body: n.body, agentName: n.author.displayName });
  }

  for (const h of handovers) {
    events.push({ kind: "handover_opened", at: h.createdAt, reason: h.reason });
    if (h.resolvedAt) events.push({ kind: "handover_resolved", at: h.resolvedAt, reason: h.reason });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  return { events, dispositionEvents, notes };
}
