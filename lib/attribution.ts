import { prisma } from "@/lib/prisma";
import type { AttributionTier, Contact } from "@prisma/client";
import { randomBytes } from "crypto";

/** Module A — acquisition and attribution (BRD FR-A01..FR-A10, PRD Layer 0/1). */

// Excludes 0/O and 1/I/l per FR-A03's acceptance criteria.
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

/** FR-A01 — permanent, non-sequential, non-guessable asset code. */
export function generateAssetCode(): string {
  return randomCode(5);
}

/** FR-A03 — short, single-use click token carried in the prefilled WhatsApp message. */
export function generateClickToken(): string {
  return randomCode(8);
}

export type RedirectResolution =
  | { ok: true; waNumber: string; clickToken: string }
  | { ok: false; reason: "not_found" | "expired" };

/** FR-A02 — resolves the asset code, mints a token, writes the click record. Must complete
 * before the redirect is issued (p95 < 100ms target, NFR-01).
 */
export async function resolveAndRegisterClick(
  assetCode: string,
  meta: { userAgent?: string; coarseGeo?: string }
): Promise<RedirectResolution> {
  const asset = await prisma.asset.findUnique({ where: { code: assetCode } });
  if (!asset) return { ok: false, reason: "not_found" };
  if (asset.validUntil && asset.validUntil.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  const clickToken = generateClickToken();
  await prisma.clickRecord.create({
    data: {
      assetId: asset.id,
      clickToken,
      userAgent: meta.userAgent,
      coarseGeo: meta.coarseGeo,
    },
  });

  const waNumber = process.env.META_PHONE_NUMBER_DISPLAY ?? process.env.META_PHONE_NUMBER_ID ?? "";
  return { ok: true, waNumber, clickToken };
}

export type AttributionResult = {
  tier: AttributionTier;
  method: string;
  clickRecordId?: string;
};

/** FR-A04/A05/A07/A09 — resolves attribution once, on the first inbound message only.
 * Token present & unconsumed → High-exact. Token present & already consumed → High-reuse
 * (forwarded screenshot). No token → probabilistic recovery within a configurable window
 * (Medium). Nothing → Low, handled conversationally by the caller (FR-A06).
 */
export async function resolveAttribution(
  clickToken: string | null,
  recoveryWindowMinutes: number
): Promise<AttributionResult> {
  if (clickToken) {
    const record = await prisma.clickRecord.findUnique({ where: { clickToken } });

    if (record) {
      if (!record.consumed) {
        await prisma.clickRecord.update({
          where: { id: record.id },
          data: { consumed: true, consumedAt: new Date() },
        });
        return { tier: "HIGH_EXACT", method: "token_exact", clickRecordId: record.id };
      }

      await prisma.clickRecord.update({ where: { id: record.id }, data: { reused: true } });
      return { tier: "HIGH_REUSE", method: "token_reuse", clickRecordId: record.id };
    }
  }

  // FR-A05 — probabilistic recovery. POC simplification: WhatsApp webhooks carry no device
  // fingerprint, so "device signature" matching is approximated by time-window uniqueness
  // (exactly one unconsumed click in the window). See .ai/engineering/tech-debt.md.
  const since = new Date(Date.now() - recoveryWindowMinutes * 60 * 1000);
  const candidates = await prisma.clickRecord.findMany({
    where: { consumed: false, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (candidates.length === 1) {
    const record = candidates[0];
    await prisma.clickRecord.update({
      where: { id: record.id },
      data: { consumed: true, consumedAt: new Date() },
    });
    return { tier: "MEDIUM", method: "device_recovery", clickRecordId: record.id };
  }

  return { tier: "LOW", method: "direct" };
}

/** FR-A07 — first-touch stamping. Written once; every later message is a reply with no
 * re-resolution. Safe to call repeatedly — becomes a no-op once attribution is set.
 */
export async function stampFirstTouchIfUnset(
  contactId: string,
  attribution: AttributionResult
): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.attributionTier) return; // already stamped — never re-resolve

  await prisma.contact.update({
    where: { id: contactId },
    data: {
      attributionTier: attribution.tier,
      attributionMethod: attribution.method,
      firstClickRecordId: attribution.clickRecordId,
    },
  });
}

/** FR-A06 — Low-tier conversational fallback: college-level credit only, never spot or
 * ambassador-level, and never overrides a token-based tier.
 */
export async function stampConversationalCollege(contactId: string, collegeName: string): Promise<void> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact || contact.attributionTier !== "LOW") return;
  await prisma.contact.update({ where: { id: contactId }, data: { collegeNameAttributed: collegeName } });
}

/** FR-A08 — last-touch recording for analysis only; never re-drives payout. */
export async function recordLastTouch(contactId: string, clickToken: string): Promise<void> {
  const record = await prisma.clickRecord.findUnique({ where: { clickToken } });
  if (!record) return;
  await prisma.lastTouchEvent.create({ data: { contactId, clickRecordId: record.id } });
}

/** FR-A03 — parses the click token out of a possibly-tampered prefilled message body.
 * Treats everything else as untrusted (FR-D12 / PRD §6.5): only a strict token pattern is
 * ever extracted, the remainder is discarded before it can reach model context.
 */
const TOKEN_PATTERN = /\b([2-9A-HJ-NP-Za-km-z]{8})\b/;

export function extractClickToken(prefilledText: string | undefined | null): string | null {
  if (!prefilledText) return null;
  const match = TOKEN_PATTERN.exec(prefilledText);
  return match ? match[1] : null;
}

export type AttributionSource = {
  /** One-line, human-readable summary for a fact chip or timeline entry, e.g.
   * "QR poster · VIT Vellore · Canteen board 2" or "Direct / unattributed". */
  summary: string;
  channel: string | null;
  collegeName: string | null;
  spotLabel: string | null;
  campaign: string | null;
  assetCode: string | null;
};

/** Resolves the actual QR/asset a lead came from (not just the tier/method code) — the
 * "where did this lead come from" a sales rep or a marketing campaign actually needs, e.g.
 * which poster/QR/ambassador drove it, not just "HIGH_EXACT · token_exact".
 */
export async function getAttributionSource(contact: Pick<Contact, "firstClickRecordId" | "collegeNameAttributed">): Promise<AttributionSource> {
  if (contact.firstClickRecordId) {
    const record = await prisma.clickRecord.findUnique({ where: { id: contact.firstClickRecordId }, include: { asset: true } });
    if (record) {
      const a = record.asset;
      const bits = [a.channel, a.collegeName, a.spotLabel ?? a.campaign].filter(Boolean);
      return {
        summary: bits.length ? bits.join(" · ") : a.code,
        channel: a.channel,
        collegeName: a.collegeName,
        spotLabel: a.spotLabel,
        campaign: a.campaign,
        assetCode: a.code,
      };
    }
  }
  if (contact.collegeNameAttributed) {
    return {
      summary: `Conversational · ${contact.collegeNameAttributed}`,
      channel: "conversational",
      collegeName: contact.collegeNameAttributed,
      spotLabel: null,
      campaign: null,
      assetCode: null,
    };
  }
  return { summary: "Direct / unattributed", channel: null, collegeName: null, spotLabel: null, campaign: null, assetCode: null };
}
