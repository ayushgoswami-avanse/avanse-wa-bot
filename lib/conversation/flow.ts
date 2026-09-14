import { prisma } from "@/lib/prisma";
import type { Contact } from "@prisma/client";
import { sendOutboundMessage } from "@/lib/messaging/sendGovernor";
import { recordConsent, recordOptOut, recordAgeGate, isOptOutMessage, SALES_CONSENT_TEXT } from "@/lib/consent";
import { generateCounsellingReply } from "@/lib/conversation/orchestrator";
import { resolveProfilingReply } from "@/lib/conversation/profilingSteps";
import { isQualifiedLead } from "@/lib/conversation/qualification";
import { recomputeAndPersistPropensity } from "@/lib/propensity";
import { requestTier1Eligibility, eligibilityDisclaimerText } from "@/lib/eligibility";
import { mintHandoffToken, syncToProcessioIfGated } from "@/lib/handoff";
import { touchSession, recordTurnInsights, closeSessionSnapshot } from "@/lib/conversation/sessions";
import { parseIndianAmount } from "@/lib/parseAmount";
import { getConfigBool } from "@/lib/config";
import type { OutboundPayload } from "@/lib/whatsapp/types";
import resourcesData from "@/data/resources.json";

/** Layers 2-8 — the thin deterministic shell around the conversation.
 *
 * ADR-010 inverts what this file used to do. It was a funnel: consent gate → age gate →
 * journey fork → a fixed sequence of profiling questions, with the AI allowed to speak only
 * once the form was filled. That produced exactly the interrogation it looks like on paper.
 *
 * Guru now owns the conversation from the first message and captures profile data as a
 * by-product of counselling (orchestrator.ts's save_student_profile tool). What stays
 * scripted here is only what must be: opt-out handling, the sequential eligibility capture
 * (no credit logic in the model), the DIY handoff, and the consent + age gate — which now
 * attach to the single moment they actually govern, the point where a student's details
 * would reach a human or an eligibility check, rather than blocking a career conversation
 * that never needed them.
 */

export type InboundTurn = {
  metaMessageId: string;
  text?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
};

// Deliberately phrase-level, not single words: Guru now calls itself a counsellor and talks
// about counsellors constantly, so matching the bare word "counsellor" escalated conversations
// that were going fine.
const HUMAN_REQUEST_KEYWORDS = [
  "talk to a human",
  "speak to a human",
  "talk to someone",
  "speak to someone",
  "real person",
  "human agent",
  "human counsellor",
  "human counselor",
  "call me",
  "connect me to an agent",
];
// Sustained, not a single bad turn: this many consecutive negative-sentiment turns despite
// the AI's own attempts to help is what actually triggers a human handover — not the LLM's
// own say-so, which proved too eager on a single frustrated message (see orchestrator.ts).
const NEGATIVE_SENTIMENT_ESCALATION_THRESHOLD = 3;
const ELIGIBILITY_KEYWORDS = ["eligib", "how much can i get", "how much loan", "loan amount", "qualify for"];
const HANDOFF_KEYWORDS = ["apply now", "continue application", "proceed with application", "start application", "apply for the loan"];
const RESOURCE_KEYWORDS = ["resource", "guide", "checklist", "help me decide", "documents needed"];
const ALUMNI_KEYWORDS = ["alumni", "talk to a student", "connect me with someone who", "senior", "past student"];

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/** The LLM's own escalate flag now fires rarely and for varied reasons (see orchestrator.ts) —
 * this buckets its free-text reason into the right HandoverReason for the agent console,
 * rather than blindly labelling every AI-decided escalation "negative sentiment".
 */
function classifyEscalationReason(reasonText?: string): "EXPLICIT_REQUEST" | "COMPLEX_OR_HIGH_VALUE" | "COUNSELLOR_REFUSAL" {
  const t = (reasonText ?? "").toLowerCase();
  if (/human|person|agent|talk to someone|speak (with|to)/.test(t)) return "EXPLICIT_REQUEST";
  if (/safety|self.?harm|complaint|legal|regulat/.test(t)) return "COUNSELLOR_REFUSAL";
  return "COMPLEX_OR_HIGH_VALUE";
}

async function send(contact: Contact, payload: OutboundPayload) {
  const result = await sendOutboundMessage({ contactId: contact.id, waId: contact.waId, journey: contact.journey, payload });
  if (!result.sent) {
    console.error(`[flow] send blocked/failed for contact ${contact.id} (${contact.waId}): ${result.reason}`);
  }
}

async function setStage(contactId: string, stage: string, extra: Record<string, unknown> = {}) {
  return prisma.contact.update({ where: { id: contactId }, data: { stage, ...extra } });
}

/** Guru's opening. No consent wall, no age form, no identity notice — a counsellor saying
 * hello and offering to be useful. Everything compliance-sensitive now attaches to the
 * moment it actually applies (see ensureConsentAndAgeGate).
 */
const GURU_GREETING =
  "Hey! I'm Guru 👋 I help students figure out the big stuff — where to study, which course " +
  "actually opens the doors you want, visas, PR pathways, timelines, and how to pay for it " +
  "when you get there.\n\nWhat's on your mind right now?";

function salesConsentPayload(): OutboundPayload {
  return {
    kind: "buttons",
    body: SALES_CONSENT_TEXT,
    buttons: [
      { id: "consent_yes", title: "Yes, go ahead" },
      { id: "consent_no", title: "Not yet" },
    ],
  };
}

function ageGatePayload(): OutboundPayload {
  return {
    kind: "buttons",
    body: "One quick thing before I loop in the team — are you 18 or older?",
    buttons: [
      { id: "age_adult", title: "18 or older" },
      { id: "age_minor", title: "Under 18" },
    ],
  };
}

/** FR-B05/B07 — consent and the age gate, asked at the only point they carry meaning: just
 * before this student's details would reach a human counsellor or an eligibility check.
 * Returns true when the caller may proceed; otherwise it has already sent the prompt and
 * parked the contact in the matching stage.
 */
async function ensureConsentAndAgeGate(contact: Contact): Promise<boolean> {
  if (contact.isMinor) {
    await send(contact, {
      kind: "text",
      body: "Since you're under 18, I'll keep helping you with guidance here, but I can't pass your details on or run a funding check just yet. Plenty I can still help you figure out though.",
    });
    return false;
  }

  if (contact.ageGateStatus === "unknown") {
    await send(contact, ageGatePayload());
    await setStage(contact.id, "AWAITING_AGE_GATE");
    return false;
  }

  if (!contact.consentGranted) {
    await send(contact, salesConsentPayload());
    await setStage(contact.id, "AWAITING_CONSENT");
    return false;
  }

  return true;
}

function pendingEligibilityPrompt(stage: string): string {
  if (stage === "ELIGIBILITY_INCOME") return "What's the co-applicant's net monthly income (in ₹)? Just the number is fine.";
  if (stage === "ELIGIBILITY_EMIS") return "And their existing monthly EMI obligations, if any (0 if none)?";
  return "Roughly how much are you looking to borrow (in ₹)?";
}

async function handleQualificationIfNeeded(contact: Contact) {
  await recomputeAndPersistPropensity(contact.id);
  const fresh = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
  if (!fresh.isQualifiedLead && isQualifiedLead(fresh)) {
    await prisma.contact.update({ where: { id: contact.id }, data: { isQualifiedLead: true, qualifiedAt: new Date() } });
    void syncToProcessioIfGated(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } }));
  }
}

async function offerEligibilityOrHandoff(contact: Contact): Promise<void> {
  await send(contact, {
    kind: "buttons",
    body: "Want me to check an indicative eligibility figure, or go straight to the application?",
    buttons: [
      { id: "start_eligibility", title: "Check eligibility" },
      { id: "start_handoff", title: "Go to application" },
    ],
  });
}

async function startEligibilityFlow(contact: Contact): Promise<void> {
  if (!(await ensureConsentAndAgeGate(contact))) return;

  const enabled = await getConfigBool("FEATURE_TIER1_ELIGIBILITY_ENABLED");
  if (!enabled) {
    await send(contact, {
      kind: "text",
      body: "Indicative eligibility isn't available right now — let's take you straight to the application instead.",
    });
    await triggerHandoff(contact);
    return;
  }
  await setStage(contact.id, "ELIGIBILITY_INCOME", { eligibilityDraftJson: "{}" });
  await send(contact, { kind: "text", body: "What's the co-applicant's net monthly income (in ₹)? Just the number is fine." });
}

async function triggerHandoff(contact: Contact): Promise<void> {
  if (!(await ensureConsentAndAgeGate(contact))) return;

  const { url } = await mintHandoffToken(contact);
  await send(contact, {
    kind: "cta_url",
    body: "Here's your personalised application link — it'll skip repeating your mobile verification.",
    buttonText: "Continue application",
    url,
  });
  void syncToProcessioIfGated(contact);
}

async function sendResourceHub(contact: Contact): Promise<void> {
  const items = resourcesData.items.filter((r) => !r.journey || r.journey === contact.journey);
  if (items.length === 0) return;
  await send(contact, {
    kind: "list",
    body: "Here are a few things that might help:",
    buttonLabel: "Browse resources",
    sections: [{ title: "Resources", rows: items.slice(0, 10).map((r, i) => ({ id: `resource_${i}`, title: r.title, description: r.category })) }],
  });
}

async function sendAlumniMatches(contact: Contact): Promise<void> {
  const matches = await prisma.alumniProfile.findMany({
    where: {
      active: true,
      ...(contact.journey === "DOMESTIC" ? { courseCategory: contact.courseCategory ?? undefined } : { destinationCountry: contact.destinationCountry ?? undefined }),
    },
    take: 5,
  });
  const pool = matches.length > 0 ? matches : await prisma.alumniProfile.findMany({ where: { active: true }, take: 5 });
  if (pool.length === 0) {
    await send(contact, { kind: "text", body: "I don't have a matching alumni connect available right now — a counsellor can follow up on this." });
    return;
  }
  await send(contact, {
    kind: "list",
    body: "A few alumni you could connect with:",
    buttonLabel: "Pick someone",
    sections: [
      {
        title: "Alumni",
        rows: pool.map((a) => ({ id: `alumni_${a.id}`, title: a.name, description: a.institution ?? a.collegeName ?? undefined })),
      },
    ],
  });
}

/** Runs one AI counselling turn and folds the model's own sentiment/session-note read
 * back into the session + rolling profile summary (lib/conversation/sessions.ts) — this
 * is what lets a later turn (or a sales rep) know what was actually discussed.
 */
async function runCounselling(
  contact: Contact,
  text: string,
  sessionId: string,
  isNewSession: boolean
): Promise<{ escalate: boolean; escalateReason?: string; consecutiveNegativeTurns: number }> {
  const result = await generateCounsellingReply(contact, text, isNewSession);
  // A long, genuinely thorough answer arrives as consecutive messages rather than one
  // truncated bubble — see orchestrator.ts's splitReply.
  for (const segment of result.replySegments) {
    await send(contact, { kind: "text", body: segment });
  }
  const { consecutiveNegativeTurns } = await recordTurnInsights(contact.id, sessionId, {
    sentiment: result.sentiment,
    sessionNote: result.sessionNote,
  });
  // Profile fields are now captured mid-conversation by the orchestrator's
  // save_student_profile tool, so qualification has to be re-checked after every turn
  // rather than only at the end of a scripted profiling sequence.
  await handleQualificationIfNeeded(contact);
  return { escalate: result.escalate, escalateReason: result.escalateReason, consecutiveNegativeTurns };
}

async function escalateToHuman(contact: Contact, reason: "EXPLICIT_REQUEST" | "NEGATIVE_SENTIMENT" | "COMPLEX_OR_HIGH_VALUE" | "COUNSELLOR_REFUSAL") {
  await prisma.handover.create({ data: { contactId: contact.id, reason } });
  await setStage(contact.id, "HUMAN_HANDOVER");
  await send(contact, { kind: "text", body: "I'm connecting you with a counsellor — they'll pick up right here in this chat shortly." });
}

export async function handleInboundMessage(contactId: string, turn: InboundTurn): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const text = (turn.text ?? turn.interactiveReplyTitle ?? "").trim();

  // Every inbound message counts toward an interaction session, and a gap since the last
  // one may mean this is the student picking things back up after a break (PRD §5.3).
  const { sessionId, isNewSession } = await touchSession(contact);
  const isReturningSession = isNewSession && contact.interactionSessionCount > 0;

  try {
    await handleInboundMessageInStage(contact, turn, text, sessionId, isReturningSession);
  } finally {
    const fresh = await prisma.contact.findUnique({ where: { id: contactId } });
    if (fresh) await closeSessionSnapshot(fresh, sessionId);
  }
}

async function handleInboundMessageInStage(
  contact: Contact,
  turn: InboundTurn,
  text: string,
  sessionId: string,
  isReturningSession: boolean
): Promise<void> {
  // FR-B08 — checked before anything else, in every stage.
  if (text && isOptOutMessage(text)) {
    await recordOptOut(contact.id);
    await send(contact, { kind: "text", body: "You've been opted out of marketing messages. You can still message me anytime for help." });
    return;
  }

  switch (contact.stage) {
    case "NEW": {
      // Guru just says hello and opens the floor. Profiling now happens inside the
      // conversation (orchestrator's save_student_profile tool), and consent/age attach
      // to the handoff moment — so there is nothing to gate the first reply behind.
      await send(contact, { kind: "text", body: GURU_GREETING });
      await setStage(contact.id, "COUNSELLING");
      return;
    }

    case "AWAITING_CONSENT": {
      if (turn.interactiveReplyId === "consent_yes") {
        await recordConsent(contact.id, "GRANTED", turn.metaMessageId);
        await setStage(contact.id, "COUNSELLING");
        const fresh = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
        await handleQualificationIfNeeded(fresh);
        await offerEligibilityOrHandoff(fresh);
      } else if (turn.interactiveReplyId === "consent_no") {
        await send(contact, {
          kind: "text",
          body: "No problem at all — we'll keep this between us. I'm still here for whatever you want to figure out.",
        });
        await setStage(contact.id, "COUNSELLING");
      } else {
        // They typed instead of tapping — answer them properly rather than re-asking.
        await setStage(contact.id, "COUNSELLING");
        if (text) {
          const result = await runCounselling(contact, text, sessionId, isReturningSession);
          if (result.escalate) await escalateToHuman(contact, classifyEscalationReason(result.escalateReason));
        }
      }
      return;
    }

    case "AWAITING_AGE_GATE": {
      if (turn.interactiveReplyId === "age_adult") {
        await recordAgeGate(contact.id, true);
        await send(contact, salesConsentPayload());
        await setStage(contact.id, "AWAITING_CONSENT");
      } else if (turn.interactiveReplyId === "age_minor") {
        await recordAgeGate(contact.id, false);
        await send(contact, {
          kind: "text",
          body: "Thanks for telling me. I'll keep helping you plan — I just won't pass your details on or run a funding check until you're 18.",
        });
        await setStage(contact.id, "MINOR_CONTENT_ONLY");
      } else {
        await setStage(contact.id, "COUNSELLING");
        if (text) {
          const result = await runCounselling(contact, text, sessionId, isReturningSession);
          if (result.escalate) await escalateToHuman(contact, classifyEscalationReason(result.escalateReason));
        }
      }
      return;
    }

    // Legacy stages from the old scripted funnel. Contacts mid-flow when this shipped get
    // absorbed into the conversation rather than stranded — a tapped button still records
    // its answer, and everything continues as a normal counselling turn from here on.
    case "AWAITING_JOURNEY_FORK":
    case "PROFILING": {
      const journeyMap: Record<string, "INTERNATIONAL" | "DOMESTIC" | "UNDECIDED"> = {
        journey_india: "DOMESTIC",
        journey_abroad: "INTERNATIONAL",
        journey_undecided: "UNDECIDED",
      };
      const chosenJourney = turn.interactiveReplyId ? journeyMap[turn.interactiveReplyId] : undefined;
      const resolved = turn.interactiveReplyId ? resolveProfilingReply(turn.interactiveReplyId) : null;

      if (chosenJourney) {
        await prisma.contact.update({ where: { id: contact.id }, data: { journey: chosenJourney } });
      } else if (resolved) {
        await prisma.contact.update({ where: { id: contact.id }, data: { [resolved.field as string]: resolved.value } });
      }

      await setStage(contact.id, "COUNSELLING", { pendingProfilingField: null });
      const resumed = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      await handleQualificationIfNeeded(resumed);

      const spoken = text || turn.interactiveReplyTitle || "";
      if (spoken) {
        const result = await runCounselling(resumed, spoken, sessionId, isReturningSession);
        if (result.escalate) await escalateToHuman(resumed, classifyEscalationReason(result.escalateReason));
      }
      return;
    }

    case "ELIGIBILITY_INCOME":
    case "ELIGIBILITY_EMIS":
    case "ELIGIBILITY_AMOUNT": {
      // Handles "1 lac", "5k", "2.5 lakhs", "1 crore", not just bare digits — a live
      // test showed "1 lacs" silently becoming ₹1 with the old digit-only parser.
      const amount = parseIndianAmount(text);
      const draft = JSON.parse(contact.eligibilityDraftJson ?? "{}") as {
        coApplicantIncome?: number;
        existingEmis?: number;
      };

      if (amount === null || !Number.isFinite(amount) || amount < 0) {
        // Router: a live conversation showed a student ask "what will the fees be, so I
        // can tell you the loan amount" and get "please share just the number" on repeat —
        // a real question flattened into a form-validation error. Anything that isn't a
        // bare number gets an actual answer from Guru first (grounded if it needs to be),
        // THEN the same numeric prompt — never just the error, and never silently drop the
        // capture either.
        if (text) {
          const result = await runCounselling(contact, text, sessionId, isReturningSession);
          if (result.escalate) {
            await escalateToHuman(contact, classifyEscalationReason(result.escalateReason));
            return;
          }
        }
        await send(contact, { kind: "text", body: pendingEligibilityPrompt(contact.stage) });
        return;
      }

      if (contact.stage === "ELIGIBILITY_INCOME") {
        draft.coApplicantIncome = amount;
        await setStage(contact.id, "ELIGIBILITY_EMIS", { eligibilityDraftJson: JSON.stringify(draft) });
        await send(contact, { kind: "text", body: "And their existing monthly EMI obligations, if any (0 if none)?" });
        return;
      }

      if (contact.stage === "ELIGIBILITY_EMIS") {
        draft.existingEmis = amount;
        await setStage(contact.id, "ELIGIBILITY_AMOUNT", { eligibilityDraftJson: JSON.stringify(draft) });
        await send(contact, { kind: "text", body: "Roughly how much are you looking to borrow (in ₹)?" });
        return;
      }

      // ELIGIBILITY_AMOUNT — final step.
      const result = await requestTier1Eligibility(contact.id, {
        coApplicantIncome: draft.coApplicantIncome ?? 0,
        existingEmis: draft.existingEmis ?? 0,
        destinationOrCourse: (contact.destinationCountry ?? contact.courseCategory ?? "unspecified") as string,
        courseType: (contact.degreeLevel ?? contact.courseCategory ?? "unspecified") as string,
        amountSought: amount,
      });

      await setStage(contact.id, "COUNSELLING", { eligibilityDraftJson: null });

      if (result.ok) {
        await send(contact, {
          kind: "text",
          body: `Based on what you've shared, you may be eligible for up to ₹${result.upToAmount.toLocaleString("en-IN")}. ${eligibilityDisclaimerText()} (as of ${result.asOf})`,
        });
        await triggerHandoff(contact);
      } else {
        await send(contact, { kind: "text", body: "I couldn't complete that check right now — let's continue via the application instead." });
        await triggerHandoff(contact);
      }
      return;
    }

    case "MINOR_CONTENT_ONLY":
    case "DECLINED":
    case "COUNSELLING": {
      if (contact.stage === "COUNSELLING" && turn.interactiveReplyId === "start_eligibility") {
        await startEligibilityFlow(contact);
        return;
      }
      if (contact.stage === "COUNSELLING" && turn.interactiveReplyId === "start_handoff") {
        await triggerHandoff(contact);
        return;
      }

      if (!text) return;

      if (containsAny(text, HUMAN_REQUEST_KEYWORDS)) {
        await escalateToHuman(contact, "EXPLICIT_REQUEST");
        return;
      }

      if (contact.stage === "COUNSELLING" && containsAny(text, ELIGIBILITY_KEYWORDS)) {
        await startEligibilityFlow(contact);
        return;
      }

      if (contact.stage === "COUNSELLING" && containsAny(text, HANDOFF_KEYWORDS)) {
        await triggerHandoff(contact);
        return;
      }

      if (contact.stage === "COUNSELLING" && containsAny(text, RESOURCE_KEYWORDS)) {
        await sendResourceHub(contact);
        return;
      }

      if (contact.stage === "COUNSELLING" && containsAny(text, ALUMNI_KEYWORDS)) {
        await sendAlumniMatches(contact);
        return;
      }

      // FR-A06's conversational college fallback used to interrupt here with a scripted
      // "which college are you at?". Guru now picks the college up naturally when it comes
      // up and records it through save_student_profile (orchestrator.ts).
      const result = await runCounselling(contact, text, sessionId, isReturningSession);
      if (result.escalate) {
        await escalateToHuman(contact, classifyEscalationReason(result.escalateReason));
        return;
      }
      if (result.consecutiveNegativeTurns >= NEGATIVE_SENTIMENT_ESCALATION_THRESHOLD) {
        await prisma.contact.update({ where: { id: contact.id }, data: { consecutiveNegativeTurns: 0 } });
        await escalateToHuman(contact, "NEGATIVE_SENTIMENT");
      }
      return;
    }

    case "HUMAN_HANDOVER": {
      // Agent console takes over; no automatic reply. Message is already persisted by the caller.
      return;
    }

    default: {
      // Unknown/stale stage — drop into the conversation rather than restarting a funnel.
      await setStage(contact.id, "COUNSELLING");
      if (text) {
        const result = await runCounselling(contact, text, sessionId, isReturningSession);
        if (result.escalate) await escalateToHuman(contact, classifyEscalationReason(result.escalateReason));
      } else {
        await send(contact, { kind: "text", body: GURU_GREETING });
      }
    }
  }
}

export { offerEligibilityOrHandoff };
