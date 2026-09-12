import { prisma } from "@/lib/prisma";
import { getConfigList, getConfigNumber } from "@/lib/config";
import { getGoogleClient, getGeminiModel } from "@/lib/googleClient";

/** Module D grounding path — FR-D03..FR-D08. Google Gemini with Search Grounding is
 * invoked as a TOOL only, never as the conversation model (that's Claude — see
 * orchestrator.ts). ADR-002 records why AWS Bedrock was substituted for this POC.
 */

// FR-D06 — strip anything identity- or finance-shaped before it can leave the process.
const PHONE_RE = /(\+?\d[\d\s-]{7,}\d)/g;
const NAME_LIKE_RE = /\bmy name is [^.,\n]+/gi;
const MONEY_RE = /₹\s?[\d,]+(\.\d+)?|\brs\.?\s?[\d,]+/gi;

export function sanitizeQueryForGrounding(rawText: string): string {
  return rawText
    .replace(PHONE_RE, "[redacted]")
    .replace(NAME_LIKE_RE, "[redacted]")
    .replace(MONEY_RE, "[amount redacted]")
    .slice(0, 400);
}

export async function isAlwaysGroundTopic(sanitizedQuery: string): Promise<string | null> {
  const topics = await getConfigList("GROUNDING_ALWAYS_ALLOW_TOPICS");
  const lower = sanitizedQuery.toLowerCase();
  return topics.find((t) => lower.includes(t.toLowerCase())) ?? null;
}

function normalizeForCache(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export type GroundedAnswer = {
  text: string;
  citations: { title: string; url: string }[];
  asOf: string;
  fromCache: boolean;
};

/** FR-D07 — semantic cache. POC simplification: exact-normalized-string cache key rather
 * than embedding similarity, which is enough to demonstrate repeated-question reuse in a
 * short demo. Logged in tech-debt.md. */
async function getCached(query: string): Promise<GroundedAnswer | null> {
  const key = normalizeForCache(query);
  const hit = await prisma.semanticCacheEntry.findUnique({ where: { normalizedQuery: key } });
  if (!hit || hit.expiresAt.getTime() < Date.now()) return null;
  return {
    text: hit.answer,
    citations: hit.citations ? JSON.parse(hit.citations) : [],
    asOf: hit.createdAt.toISOString().slice(0, 10),
    fromCache: true,
  };
}

async function setCached(query: string, answer: GroundedAnswer): Promise<void> {
  const ttlMinutes = await getConfigNumber("SEMANTIC_CACHE_TTL_MINUTES");
  const key = normalizeForCache(query);
  await prisma.semanticCacheEntry.upsert({
    where: { normalizedQuery: key },
    create: {
      normalizedQuery: key,
      answer: answer.text,
      citations: JSON.stringify(answer.citations),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
    update: {
      answer: answer.text,
      citations: JSON.stringify(answer.citations),
      expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000),
    },
  });
}

/** FR-D05 — the grounding tool itself: called by the orchestrator when Claude decides a
 * query needs live facts, or forced when the sanitized query matches the always-ground
 * allow-list (FR-D04). Checks the semantic cache first (FR-D07).
 */
export async function runGroundedSearch(
  contactId: string,
  rawQuery: string
): Promise<GroundedAnswer> {
  const sanitized = sanitizeQueryForGrounding(rawQuery);

  const cached = await getCached(sanitized);
  if (cached) {
    await prisma.groundingLog.create({
      data: { contactId, queryClass: "CACHE_GROUNDED", sanitizedQuery: sanitized, cacheHit: true },
    });
    return cached;
  }

  const client = getGoogleClient();
  const asOf = new Date().toISOString().slice(0, 10);

  if (!client) {
    const fallback: GroundedAnswer = {
      text:
        "I don't have a live source configured for this right now, so I can't confidently ground that answer — " +
        "let me connect you with a counsellor for the current figure.",
      citations: [],
      asOf,
      fromCache: false,
    };
    await prisma.groundingLog.create({
      data: { contactId, queryClass: "REFUSED", sanitizedQuery: sanitized, cacheHit: false },
    });
    return fallback;
  }

  const started = Date.now();
  try {
    const response = await client.models.generateContent({
      model: getGeminiModel(),
      contents: sanitized,
      config: { tools: [{ googleSearch: {} }] },
    });

    const text = response.text ?? "I couldn't find a confident live answer for that.";
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const citations =
      groundingMetadata?.groundingChunks
        ?.map((c) => ({ title: c.web?.title ?? c.web?.domain ?? "source", url: c.web?.uri ?? "" }))
        .filter((c) => c.url) ?? [];

    const answer: GroundedAnswer = { text, citations, asOf, fromCache: false };
    await setCached(sanitized, answer);

    await prisma.groundingLog.create({
      data: {
        contactId,
        queryClass: "LIVE_GROUNDED",
        sanitizedQuery: sanitized,
        citations: JSON.stringify(citations),
        cacheHit: false,
        latencyMs: Date.now() - started,
      },
    });

    return answer;
  } catch (err) {
    const fallback: GroundedAnswer = {
      text:
        "I ran into an issue reaching a live source for that just now. I'll flag this for a counsellor to " +
        "confirm rather than guess.",
      citations: [],
      asOf,
      fromCache: false,
    };
    await prisma.groundingLog.create({
      data: {
        contactId,
        queryClass: "REFUSED",
        sanitizedQuery: sanitized,
        cacheHit: false,
        latencyMs: Date.now() - started,
      },
    });
    console.error("[grounding] Gemini call failed:", err);
    return fallback;
  }
}
