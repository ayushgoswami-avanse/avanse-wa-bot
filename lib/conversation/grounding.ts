import { prisma } from "@/lib/prisma";
import { getConfigList, getConfigNumber } from "@/lib/config";
import { getGoogleClient, getGeminiModel } from "@/lib/googleClient";
import { recordModelCall } from "@/lib/observability/modelCallLog";

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

// Deterministic, code-level safety net for FR-D04 — NOT the admin-editable allow-list
// below. A live conversation showed the model confidently giving an application timeline
// built on a stale training-cutoff sense of "now" for a phrasing ("tell me the application
// timeline") that never matched the configurable CSV list at all ("application deadline"
// is a different string). Relying only on an admin-curated substring list for something
// this consequential is exactly how it goes quietly wrong — this regex net is broad by
// design and reviewed as code, not config, so it can't silently drift out of date the way
// a CSV can.
const BUILT_IN_GROUNDING_TRIGGERS: { label: string; pattern: RegExp }[] = [
  { label: "visa/immigration", pattern: /\bvisa|immigrat|\bpr\b|permanent residen|green card|h-?1b|\bopt\b|\bcpt\b|work permit|sponsorship|stem opt/i },
  { label: "post-study work/PR pathway", pattern: /post.?study work|job.?seeker visa|residency pathway|pathway to (pr|citizenship)/i },
  { label: "application timeline/deadline", pattern: /deadline|\btimeline\b|when (should|do|can) i apply|application (process|window|cycle|timeline)|intake (date|deadline|cycle)|admission (cycle|timeline|process)|apply (by|before)/i },
  { label: "fees/tuition/cost", pattern: /\b(fees?|tuition|cost of (living|study|the course|the programme|the program)|how much (does|will|would) .* cost|price of (the )?(course|programme|program|degree))\b/i },
  { label: "forex/currency", pattern: /exchange rate|forex|currency conversion|\busd to inr\b|\binr to usd\b|remittance/i },
  { label: "rankings", pattern: /rank(ing)?|best (university|college|program|institute)|top \d+ (university|college|program)|qs ranking|times higher/i },
  { label: "test dates/format", pattern: /(test|exam|gre|gmat|ielts|toefl|sat|cat|gate) (dates?|format|pattern|slots?|registration)/i },
  { label: "scholarship/financial aid", pattern: /scholarship|fellowship|financial aid (deadline|amount)/i },
  { label: "explicit recency", pattern: /\b(current(ly)?|this year|right now|as of (today|now)|latest|updated?) (rule|rate|fee|requirement|policy|deadline|number|figure)/i },
];

export function matchesBuiltInGroundingTrigger(sanitizedQuery: string): string | null {
  const hit = BUILT_IN_GROUNDING_TRIGGERS.find((t) => t.pattern.test(sanitizedQuery));
  return hit?.label ?? null;
}

export async function isAlwaysGroundTopic(sanitizedQuery: string): Promise<string | null> {
  const builtIn = matchesBuiltInGroundingTrigger(sanitizedQuery);
  if (builtIn) return builtIn;

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

const REDIRECT_RESOLVE_TIMEOUT_MS = 2500;
const MAX_CITATIONS_TO_RESOLVE = 4;

/** Gemini's search grounding returns citation URLs as opaque
 * vertexaisearch.cloud.google.com redirect links, not the actual source page — pasting
 * one into a WhatsApp reply looks exactly like a phishing link and defeats the entire
 * point of citing a source for trust. This follows the redirect server-side once (cached
 * alongside the answer) and swaps in the real destination URL, so what the student sees
 * is a genuine, recognizable link — canada.ca, not a 200-character tracking string.
 * Only the top few citations are resolved, both to bound latency and because the model
 * only ever cites one or two per reply anyway.
 */
async function resolveCitationUrls(citations: { title: string; url: string }[]): Promise<{ title: string; url: string }[]> {
  // Only the top few are worth resolving — both to bound latency and because the model
  // only ever cites one or two per reply. The rest stay opaque and simply aren't offered
  // to the model as citable (see runGroundedSearch), rather than risking a dead link.
  const toResolve = citations.slice(0, MAX_CITATIONS_TO_RESOLVE);

  const resolved = await Promise.all(
    toResolve.map(async (c) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REDIRECT_RESOLVE_TIMEOUT_MS);
      try {
        const res = await fetch(c.url, { method: "GET", redirect: "follow", signal: controller.signal });
        // We only need the final URL — drain the body so the connection can close cleanly.
        await res.body?.cancel().catch(() => {});
        return { title: c.title, url: res.url || c.url };
      } catch {
        return null; // timed out, blocked, or otherwise unresolvable — drop rather than cite a dead/opaque link
      } finally {
        clearTimeout(timer);
      }
    })
  );

  return resolved.filter((c): c is { title: string; url: string } => c !== null);
}

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
  rawQuery: string,
  sessionId: string | null = null
): Promise<GroundedAnswer> {
  const sanitized = sanitizeQueryForGrounding(rawQuery);

  const cached = await getCached(sanitized);
  if (cached) {
    await prisma.groundingLog.create({
      data: { contactId, sessionId, queryClass: "CACHE_GROUNDED", sanitizedQuery: sanitized, cacheHit: true },
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
      data: { contactId, sessionId, queryClass: "REFUSED", sanitizedQuery: sanitized, cacheHit: false },
    });
    return fallback;
  }

  const started = Date.now();
  const model = getGeminiModel();
  try {
    const response = await client.models.generateContent({
      model,
      contents: sanitized,
      config: { tools: [{ googleSearch: {} }] },
    });
    await recordModelCall({
      contactId,
      sessionId,
      kind: "grounding",
      model,
      usage: response.usageMetadata,
      latencyMs: Date.now() - started,
    });

    const text = response.text ?? "I couldn't find a confident live answer for that.";
    const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
    const rawCitations =
      groundingMetadata?.groundingChunks
        ?.map((c) => ({ title: c.web?.title ?? c.web?.domain ?? "source", url: c.web?.uri ?? "" }))
        .filter((c) => c.url) ?? [];
    const citations = await resolveCitationUrls(rawCitations);

    const answer: GroundedAnswer = { text, citations, asOf, fromCache: false };
    await setCached(sanitized, answer);

    await prisma.groundingLog.create({
      data: {
        contactId,
        sessionId,
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
        sessionId,
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
