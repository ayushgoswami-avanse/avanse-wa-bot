import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/config";
import type { Contact, PropensityBand } from "@prisma/client";

/** Module F — handoff and lead distribution (BRD FR-F01..FR-F07, PRD Layer 6). */

const DEFAULT_TTL_MINUTES = 15;

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return secret;
}

/** FR-F01/F02 — signed, short-lived token carrying enough profile to skip repeat mobile
 * OTP on the DIY side. FR-F03 — the journey field drives which DIY journey it lands in.
 */
export async function mintHandoffToken(contact: Contact): Promise<{ token: string; url: string }> {
  const ttlMinutes = DEFAULT_TTL_MINUTES;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  const claims = {
    waId: contact.waId,
    name: contact.confirmedName ?? contact.profileName ?? undefined,
    journey: contact.journey,
    destinationOrCourse: contact.destinationCountry ?? contact.courseCategory ?? undefined,
    level: contact.degreeLevel ?? undefined,
    intake: contact.intendedIntake ?? contact.intakeOrBatch ?? undefined,
    attributionTier: contact.attributionTier ?? undefined,
    identitySource: "whatsapp_verified", // FR-F06 — replaces the misleading mobile_otp_verified flag
  };

  const token = jwt.sign(claims, jwtSecret(), { expiresIn: `${ttlMinutes}m` });

  await prisma.handoffToken.create({
    data: {
      contactId: contact.id,
      token,
      journey: contact.journey ?? "UNDECIDED",
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return { token, url: `${baseUrl}/portal?token=${encodeURIComponent(token)}` };
}

export type HandoffClaims = {
  waId: string;
  name?: string;
  journey?: string;
  destinationOrCourse?: string;
  level?: string;
  intake?: string;
  attributionTier?: string;
  identitySource: string;
};

export type HandoffVerification =
  | { ok: true; claims: HandoffClaims }
  | { ok: false; reason: "invalid" | "expired" | "replayed" };

/** FR-F01 — TTL enforced, replay rejected: a token can only ever be consumed once. */
export async function verifyAndConsumeHandoffToken(token: string): Promise<HandoffVerification> {
  let claims: HandoffClaims;
  try {
    claims = jwt.verify(token, jwtSecret()) as HandoffClaims;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return { ok: false, reason: "expired" };
    return { ok: false, reason: "invalid" };
  }

  const record = await prisma.handoffToken.findUnique({ where: { token } });
  if (!record) return { ok: false, reason: "invalid" };
  if (record.consumedAt) return { ok: false, reason: "replayed" };

  await prisma.handoffToken.update({ where: { id: record.id }, data: { consumedAt: new Date() } });
  return { ok: true, claims };
}

/** FR-F04/F05 — propensity gate, then extended-payload sync to Processio (mocked). */
export async function syncToProcessioIfGated(contact: Contact): Promise<void> {
  const minBand = (await getConfig("PROPENSITY_SYNC_GATE_MIN_BAND")) as PropensityBand;
  const bandRank: Record<PropensityBand, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

  const band = contact.propensityBand ?? "LOW";
  if (bandRank[band] < bandRank[minBand]) return; // stays in WhatsApp nurture

  const messageCount = await prisma.message.count({ where: { contactId: contact.id } });
  const firstMessage = await prisma.message.findFirst({
    where: { contactId: contact.id },
    orderBy: { createdAt: "asc" },
  });
  const threadAgeDays = firstMessage
    ? Math.floor((Date.now() - firstMessage.createdAt.getTime()) / 86_400_000)
    : 0;

  const payload = {
    lead_origin_channel: "WHATSAPP_QR",
    whatsapp: { wa_id: contact.waId, thread_age_days: threadAgeDays, message_count: messageCount },
    attribution: { confidence_tier: contact.attributionTier ?? "LOW" },
    journey: contact.journey,
    identity_source: "whatsapp_verified",
    profile: {
      name: contact.confirmedName ?? contact.profileName,
      destination_country: contact.destinationCountry,
      degree_level: contact.degreeLevel,
      intended_intake: contact.intendedIntake,
      course_category: contact.courseCategory,
      target_institution: contact.targetInstitution,
    },
    propensity_band: contact.propensityBand,
  };

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  let succeeded = false;
  let errorMessage: string | undefined;
  try {
    const res = await fetch(`${baseUrl}/api/mock/processio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    succeeded = res.ok;
    if (!res.ok) errorMessage = `HTTP ${res.status}`;
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "unknown error";
  }

  await prisma.processioSyncLog.create({
    data: {
      contactWaId: contact.waId,
      journey: contact.journey ?? "UNDECIDED",
      propensityBand: band,
      attributionTier: contact.attributionTier,
      payloadJson: JSON.stringify(payload),
      succeeded,
      errorMessage,
    },
  });
}
