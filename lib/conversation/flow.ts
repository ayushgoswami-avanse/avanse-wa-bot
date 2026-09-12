import { prisma } from "@/lib/prisma";
import type { Contact, Journey } from "@prisma/client";
import { sendOutboundMessage } from "@/lib/messaging/sendGovernor";
import { recordConsent, recordOptOut, recordAgeGate, isOptOutMessage, IDENTITY_DISCLOSURE_TEXT, PURPOSE_NOTICE_TEXT } from "@/lib/consent";
import { stampConversationalCollege } from "@/lib/attribution";
import { generateCounsellingReply } from "@/lib/conversation/orchestrator";
import { nextPendingStep, resolveProfilingReply, stepsForJourney } from "@/lib/conversation/profilingSteps";
import { isQualifiedLead } from "@/lib/conversation/qualification";
import { recomputeAndPersistPropensity } from "@/lib/propensity";
import { retrieveInternationalOutcomes, retrieveDomesticOutcomes, formatOutcomesForPrompt } from "@/lib/conversation/rag";
import { requestTier1Eligibility, eligibilityDisclaimerText } from "@/lib/eligibility";
import { mintHandoffToken, syncToProcessioIfGated } from "@/lib/handoff";
import { getConfigBool } from "@/lib/config";
import type { OutboundPayload } from "@/lib/whatsapp/types";
import resourcesData from "@/data/resources.json";

/** Layers 2-8 — the deterministic conversation state machine. The AI (orchestrator.ts) is
 * only invoked for free-text turns inside COUNSELLING/PROFILING; every compliance-sensitive
 * layer (consent, age gate, eligibility, handoff) is scripted, per AI-HARNESS.md's
 * "small, reversible steps" and the BRD's insistence that no credit logic lives in the bot.
 */

export type InboundTurn = {
  metaMessageId: string;
  text?: string;
  interactiveReplyId?: string;
  interactiveReplyTitle?: string;
};

const HUMAN_REQUEST_KEYWORDS = ["human", "agent", "counsellor", "counselor", "talk to someone", "real person"];
const ELIGIBILITY_KEYWORDS = ["eligib", "how much can i get", "how much loan", "loan amount", "qualify for"];
const HANDOFF_KEYWORDS = ["apply now", "continue application", "proceed with application", "start application", "apply for the loan"];
const RESOURCE_KEYWORDS = ["resource", "guide", "checklist", "help me decide", "documents needed"];
const ALUMNI_KEYWORDS = ["alumni", "talk to a student", "connect me with someone who", "senior", "past student"];

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

async function send(contact: Contact, payload: OutboundPayload) {
  await sendOutboundMessage({ contactId: contact.id, waId: contact.waId, journey: contact.journey, payload });
}

async function setStage(contactId: string, stage: string, extra: Record<string, unknown> = {}) {
  return prisma.contact.update({ where: { id: contactId }, data: { stage, ...extra } });
}

function consentAndDisclosurePayload(): OutboundPayload {
  return {
    kind: "buttons",
    body: `${IDENTITY_DISCLOSURE_TEXT}\n\n${PURPOSE_NOTICE_TEXT}`,
    buttons: [
      { id: "consent_yes", title: "Yes, continue" },
      { id: "consent_no", title: "No thanks" },
    ],
  };
}

function ageGatePayload(): OutboundPayload {
  return {
    kind: "buttons",
    body: "Quick check: are you 18 or older?",
    buttons: [
      { id: "age_adult", title: "18 or older" },
      { id: "age_minor", title: "Under 18" },
    ],
  };
}

function journeyForkPayload(): OutboundPayload {
  return {
    kind: "buttons",
    body: "Are you looking at studying in India, or abroad?",
    buttons: [
      { id: "journey_abroad", title: "Abroad" },
      { id: "journey_india", title: "In India" },
      { id: "journey_undecided", title: "Not decided yet" },
    ],
  };
}

async function sendRagHookTeaser(contact: Contact) {
  const outcomes =
    contact.journey === "DOMESTIC"
      ? retrieveDomesticOutcomes("", contact.collegeNameAttributed)
      : retrieveInternationalOutcomes("", contact.collegeNameAttributed);
  if (outcomes.length === 0) return;
  const formatted = formatOutcomesForPrompt(contact.journey === "DOMESTIC" ? "DOMESTIC" : "INTERNATIONAL", outcomes.slice(0, 1));
  await send(contact, { kind: "text", body: `While we talk — here's something relevant:\n${formatted}` });
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

async function escalateToHuman(contact: Contact, reason: "EXPLICIT_REQUEST" | "NEGATIVE_SENTIMENT" | "COMPLEX_OR_HIGH_VALUE" | "COUNSELLOR_REFUSAL") {
  await prisma.handover.create({ data: { contactId: contact.id, reason } });
  await setStage(contact.id, "HUMAN_HANDOVER");
  await send(contact, { kind: "text", body: "I'm connecting you with a counsellor — they'll pick up right here in this chat shortly." });
}

export async function handleInboundMessage(contactId: string, turn: InboundTurn): Promise<void> {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  const text = (turn.text ?? turn.interactiveReplyTitle ?? "").trim();

  // FR-B08 — checked before anything else, in every stage.
  if (text && isOptOutMessage(text)) {
    await recordOptOut(contact.id);
    await send(contact, { kind: "text", body: "You've been opted out of marketing messages. You can still message me anytime for help." });
    return;
  }

  switch (contact.stage) {
    case "NEW": {
      await send(contact, consentAndDisclosurePayload());
      await setStage(contact.id, "AWAITING_CONSENT");
      return;
    }

    case "AWAITING_CONSENT": {
      if (turn.interactiveReplyId === "consent_yes") {
        await recordConsent(contact.id, "GRANTED", turn.metaMessageId);
        await send(contact, ageGatePayload());
        await setStage(contact.id, "AWAITING_AGE_GATE");
      } else if (turn.interactiveReplyId === "consent_no") {
        await send(contact, { kind: "text", body: "No problem at all — message me anytime if you change your mind." });
        await setStage(contact.id, "DECLINED");
      } else {
        await send(contact, consentAndDisclosurePayload());
      }
      return;
    }

    case "AWAITING_AGE_GATE": {
      if (turn.interactiveReplyId === "age_adult") {
        await recordAgeGate(contact.id, true);
        await send(contact, journeyForkPayload());
        await setStage(contact.id, "AWAITING_JOURNEY_FORK");
      } else if (turn.interactiveReplyId === "age_minor") {
        await recordAgeGate(contact.id, false);
        await send(contact, {
          kind: "text",
          body: "Thanks for letting me know. I can share general information, but I won't collect your details or pass you to sales until you're 18.",
        });
        await setStage(contact.id, "MINOR_CONTENT_ONLY");
      } else {
        await send(contact, ageGatePayload());
      }
      return;
    }

    case "AWAITING_JOURNEY_FORK": {
      const journeyMap: Record<string, Journey> = { journey_india: "DOMESTIC", journey_abroad: "INTERNATIONAL" };
      const chosen = turn.interactiveReplyId ? journeyMap[turn.interactiveReplyId] : undefined;

      if (chosen) {
        const updated = await prisma.contact.update({ where: { id: contact.id }, data: { journey: chosen } });
        const step = nextPendingStep(chosen, updated);
        if (step) {
          await send(updated, step.prompt());
          await setStage(contact.id, "PROFILING", { pendingProfilingField: step.field as string });
        }
      } else if (turn.interactiveReplyId === "journey_undecided") {
        await send(contact, {
          kind: "text",
          body:
            "Totally fine — a lot of students haven't decided. Broadly: abroad means a bigger ticket size and forex " +
            "steps but strong global outcomes; domestic PG/skilling is faster and rupee-denominated. Ask me anything " +
            "and I'll help you compare. I'll check back in a bit to see if you've decided.",
        });
        await setStage(contact.id, "COUNSELLING", { awaitingUndecidedRecheckAt: new Date(Date.now() + 5 * 60 * 1000) });
      } else {
        await send(contact, journeyForkPayload());
      }
      return;
    }

    case "PROFILING": {
      const journey = contact.journey as Journey;
      const resolved = turn.interactiveReplyId ? resolveProfilingReply(turn.interactiveReplyId) : null;
      const pendingStep = stepsForJourney(journey === "DOMESTIC" ? "DOMESTIC" : "INTERNATIONAL").find(
        (s) => (s.field as string) === contact.pendingProfilingField
      );

      const isTextAnswer = pendingStep?.kind === "text" && text && !/[?]/.test(text);
      const matchesPending = resolved && (resolved.field as string) === contact.pendingProfilingField;

      if (matchesPending || isTextAnswer) {
        const field = pendingStep!.field as string;
        const value = matchesPending ? resolved!.value : text;
        await prisma.contact.update({ where: { id: contact.id }, data: { [field]: value } });

        await handleQualificationIfNeeded(contact);
        const updated = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });

        const next = nextPendingStep(journey === "DOMESTIC" ? "DOMESTIC" : "INTERNATIONAL", updated);
        if (next) {
          await send(updated, next.prompt());
          await prisma.contact.update({ where: { id: contact.id }, data: { pendingProfilingField: next.field as string } });
        } else {
          await setStage(contact.id, "COUNSELLING", { pendingProfilingField: null });
          await sendRagHookTeaser(updated);
          await offerEligibilityOrHandoff(updated);
        }
      } else if (text) {
        // FR-C03 — answer the student's own question first, THEN re-ask the same pending field.
        const result = await generateCounsellingReply(contact, text);
        await send(contact, { kind: "text", body: result.replyText });
        if (result.escalate) {
          await escalateToHuman(contact, "COUNSELLOR_REFUSAL");
          return;
        }
        if (pendingStep) await send(contact, pendingStep.prompt());
      } else if (pendingStep) {
        await send(contact, pendingStep.prompt());
      }
      return;
    }

    case "ELIGIBILITY_INCOME":
    case "ELIGIBILITY_EMIS":
    case "ELIGIBILITY_AMOUNT": {
      const amount = Number(text.replace(/[^\d.]/g, ""));
      const draft = JSON.parse(contact.eligibilityDraftJson ?? "{}") as {
        coApplicantIncome?: number;
        existingEmis?: number;
      };

      if (!Number.isFinite(amount) || amount < 0) {
        await send(contact, { kind: "text", body: "Please share just the number (e.g. 45000)." });
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
      if (contact.stage === "COUNSELLING" && !contact.journey && contact.awaitingUndecidedRecheckAt && contact.awaitingUndecidedRecheckAt.getTime() <= Date.now()) {
        await send(contact, journeyForkPayload());
        await setStage(contact.id, "AWAITING_JOURNEY_FORK", { awaitingUndecidedRecheckAt: null });
        return;
      }

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

      if (contact.stage === "COUNSELLING" && contact.attributionTier === "LOW" && !contact.collegeNameAttributed) {
        // FR-A06 — Low-tier conversational fallback, asked naturally once.
        const looksLikeCollegeAnswer = text.length < 60 && !/[?]/.test(text);
        if (looksLikeCollegeAnswer && contact.pendingProfilingField === "__college_ask__") {
          await stampConversationalCollege(contact.id, text);
        } else if (contact.pendingProfilingField !== "__college_ask__") {
          await prisma.contact.update({ where: { id: contact.id }, data: { pendingProfilingField: "__college_ask__" } });
          await send(contact, { kind: "text", body: "By the way, which college are you at? Helps me tailor this better." });
        }
      }

      const result = await generateCounsellingReply(contact, text);
      await send(contact, { kind: "text", body: result.replyText });
      if (result.escalate) {
        await escalateToHuman(contact, "NEGATIVE_SENTIMENT");
      }
      return;
    }

    case "HUMAN_HANDOVER": {
      // Agent console takes over; no automatic reply. Message is already persisted by the caller.
      return;
    }

    default: {
      await send(contact, consentAndDisclosurePayload());
      await setStage(contact.id, "AWAITING_CONSENT");
    }
  }
}

export { offerEligibilityOrHandoff };
