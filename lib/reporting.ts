import { prisma } from "@/lib/prisma";
import { bandToTemperature } from "@/lib/propensity";

/** FR-I09 — the seven pilot measurements, computed live from what this POC can actually
 * observe. Two of the seven need real campus/DIY data this environment doesn't have —
 * those are reported as unavailable rather than faked (AI-HARNESS.md prime directive #2).
 */
export async function getPilotMetrics() {
  const [totalClicks, consumedClicks, totalContacts, qualifiedContacts, groundingLogs, contactsByTier] =
    await Promise.all([
      prisma.clickRecord.count(),
      prisma.clickRecord.count({ where: { consumed: true } }),
      prisma.contact.count(),
      prisma.contact.count({ where: { isQualifiedLead: true } }),
      prisma.groundingLog.findMany({ select: { queryClass: true, cacheHit: true } }),
      prisma.contact.groupBy({ by: ["attributionTier"], _count: true }),
    ]);

  const liveOrCache = groundingLogs.filter((g) => g.queryClass === "LIVE_GROUNDED" || g.queryClass === "CACHE_GROUNDED");
  const cacheHits = groundingLogs.filter((g) => g.cacheHit).length;

  const tierCounts = Object.fromEntries(contactsByTier.map((t) => [t.attributionTier ?? "UNRESOLVED", t._count]));
  const highConfidence = (tierCounts["HIGH_EXACT"] ?? 0) + (tierCounts["HIGH_REUSE"] ?? 0);
  const totalAttributed = contactsByTier.reduce((sum, t) => sum + t._count, 0);

  return {
    scanToSendRate: totalClicks > 0 ? consumedClicks / totalClicks : null,
    chatStartRateAbroadIntent: null as number | null, // needs campus population data — not available in this POC
    contactToQualifiedLeadRate: totalContacts > 0 ? qualifiedContacts / totalContacts : null,
    qualifiedLeadToLoginByBand: null as Record<string, number> | null, // needs real DIY logins — not available
    attributionConfidenceMix: {
      highPct: totalAttributed > 0 ? highConfidence / totalAttributed : null,
      mediumPct: totalAttributed > 0 ? (tierCounts["MEDIUM"] ?? 0) / totalAttributed : null,
      lowPct: totalAttributed > 0 ? (tierCounts["LOW"] ?? 0) / totalAttributed : null,
      counts: tierCounts,
    },
    liveGroundingSharePct: groundingLogs.length > 0 ? liveOrCache.length / groundingLogs.length : null,
    cacheHitRatePct: liveOrCache.length > 0 ? cacheHits / liveOrCache.length : null,
    blockAndReportRatePct: null as number | null, // needs real Meta quality data — see Settings for the simulated toggle
    raw: { totalClicks, consumedClicks, totalContacts, qualifiedContacts },
  };
}

export type LeadRow = {
  id: string;
  waId: string;
  name: string;
  journey: string;
  stage: string;
  college: string;
  attributionTier: string;
  leadTemperature: "Hot" | "Warm" | "Cold";
  propensityScore: number;
  isQualifiedLead: boolean;
  interactionSessionCount: number;
  lastSentiment: string;
  destinationOrCourse: string;
  createdAt: Date;
  lastActiveAt: Date;
};

/** The sales-facing lead rollup: one row per contact, sessions aggregated, requested
 * directly by the user (not a BRD requirement) to give Sales a downloadable worklist
 * instead of having to read raw transcripts.
 */
export async function getLeadRows(): Promise<LeadRow[]> {
  const contacts = await prisma.contact.findMany({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });

  return contacts.map((c) => ({
    id: c.id,
    waId: c.waId,
    name: c.confirmedName ?? c.profileName ?? "",
    journey: c.journey ?? "Undecided",
    stage: c.stage,
    college: c.collegeNameAttributed ?? "",
    attributionTier: c.attributionTier ?? "Unresolved",
    leadTemperature: bandToTemperature(c.propensityBand),
    propensityScore: c.propensityScore,
    isQualifiedLead: c.isQualifiedLead,
    interactionSessionCount: c.interactionSessionCount,
    lastSentiment: c.lastSentiment ?? "",
    destinationOrCourse: c.destinationCountry ?? c.courseCategory ?? "",
    createdAt: c.createdAt,
    lastActiveAt: c.messages[0]?.createdAt ?? c.updatedAt,
  }));
}

export async function getFunnelByDimension() {
  const contacts = await prisma.contact.findMany({
    select: {
      journey: true,
      isQualifiedLead: true,
      attributionTier: true,
      firstClickRecord: { select: { asset: { select: { code: true, collegeName: true, channel: true, ambassadorId: true } } } },
    },
  });

  const byCollege = new Map<string, { contacts: number; qualified: number }>();
  for (const c of contacts) {
    const college = c.firstClickRecord?.asset.collegeName ?? "Unattributed / direct";
    const row = byCollege.get(college) ?? { contacts: 0, qualified: 0 };
    row.contacts++;
    if (c.isQualifiedLead) row.qualified++;
    byCollege.set(college, row);
  }

  const byJourney = new Map<string, number>();
  for (const c of contacts) {
    const key = c.journey ?? "Undecided";
    byJourney.set(key, (byJourney.get(key) ?? 0) + 1);
  }

  return {
    byCollege: Array.from(byCollege.entries()).map(([college, v]) => ({ college, ...v })),
    byJourney: Array.from(byJourney.entries()).map(([journey, count]) => ({ journey, count })),
    totalContacts: contacts.length,
  };
}
