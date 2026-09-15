import { Type, FunctionCallingConfigMode } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { getGoogleClient, getGeminiModel } from "@/lib/googleClient";
import { findOrCreateContact } from "@/lib/contactService";
import { newWebMirrorWaId } from "@/lib/webMirror/bus";
import { handleInboundMessage } from "@/lib/conversation/flow";
import { recordModelCall } from "@/lib/observability/modelCallLog";
import { runInEvalContext } from "@/lib/observability/evalContext";

/** Evals-based testing section (per explicit request): runs a fixed panel of scripted
 * student personas through the REAL production entrypoint (handleInboundMessage — the
 * same function the WhatsApp webhook calls), then has Gemini judge the resulting
 * transcript for data capture / grounding / flow / response quality / counselling, the
 * same six dimensions used in the manual 10-persona QA pass earlier in this project.
 * Persisted as EvalRun/EvalCase so quality is visible over time instead of living only in
 * an ad hoc chat transcript. Test contacts use the web-mirror channel (waId "web-…") so no
 * real WhatsApp message or spend is ever triggered, and are deleted after scoring — the
 * same cascade-delete cleanup already used for manual QA (see costMetrics.ts's note on
 * why grounding counts can legitimately drop after a cleanup pass).
 */

export type PersonaScript = {
  persona: string;
  messages: string[];
};

// Deliberately small and varied rather than exhaustive — each one is designed to exercise
// a specific thing the manual QA pass found bugs in before: premature loan-pushing, vague
// first messages, mid-conversation corrections, and genuine data-capture-in-parallel.
export const DEFAULT_PERSONAS: PersonaScript[] = [
  {
    persona: "International MS aspirant, cost-anxious",
    messages: [
      "hi, thinking about doing MS in computer science in the US or germany, not sure which makes sense financially",
      "I'm currently in my 3rd year of BTech at VIT. Planning for Fall 2026 intake. Haven't given GRE yet.",
      "ok that's helpful. what about loans — how much can I actually get for something like this?",
    ],
  },
  {
    persona: "Domestic working professional, MBA",
    messages: [
      "Hey, I'm a working professional considering an MBA, is it even worth it at this point",
      "I'm 26, working in marketing for 3 years now, thinking of a 1-year executive MBA within the next 6 months",
      "haven't given CAT yet, was thinking of executive programs that don't need it",
    ],
  },
  {
    persona: "Undecided, vague opener",
    messages: [
      "hello",
      "not really sure what I want to do tbh, everyone says do masters abroad but idk",
      "I'm doing electronics engineering, 2nd year. My parents want me to do MS in the US honestly.",
    ],
  },
  {
    persona: "Corrects herself mid-conversation",
    messages: [
      "Hi, I want to pursue a PhD in AI, probably in Canada",
      "actually sorry, I meant Masters not PhD, my bad",
      "yes Masters in AI, Canada. I graduated last year from Anna University in CS.",
    ],
  },
  {
    persona: "Asks for a human immediately",
    messages: [
      "can I just talk to a real person about my loan eligibility instead of a bot",
    ],
  },
];

export type JudgedCase = {
  persona: string;
  score: number;
  dataCaptureNote: string;
  groundingNote: string;
  conversationFlowNote: string;
  responseQualityNote: string;
  counsellingNote: string;
  escalationNote: string;
  bugsFound: { summary: string; evidenceQuote: string; severity: "low" | "medium" | "high" }[];
};

const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.NUMBER, description: "Overall quality 0-100. 70+ is a pass." },
    dataCaptureNote: { type: Type.STRING, description: "Did it capture the profiling fields the student actually revealed, without turning the chat into a form?" },
    groundingNote: { type: Type.STRING, description: "Did it ground itself in real/proprietary data when it should have, and avoid it when a plain answer was enough?" },
    conversationFlowNote: { type: Type.STRING, description: "Did it feel like a natural conversation, not a scripted funnel or a repeated question?" },
    responseQualityNote: { type: Type.STRING, description: "Were the replies specific, well-judged in length, and actually useful?" },
    counsellingNote: { type: Type.STRING, description: "Did it counsel like a career expert first, and only bring up loans/financing when earned or asked?" },
    escalationNote: { type: Type.STRING, description: "Was any escalate-to-human decision (or lack of one) the right call for this transcript?" },
    bugsFound: {
      type: Type.ARRAY,
      description: "Concrete defects only — leaked tool/code text, truncated replies, wrong facts, ignored corrections. Empty array if none.",
      items: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          evidenceQuote: { type: Type.STRING, description: "The exact bot text that shows the problem." },
          severity: { type: Type.STRING, format: "enum", enum: ["low", "medium", "high"] },
        },
        required: ["summary", "evidenceQuote", "severity"],
      },
    },
  },
  required: [
    "score",
    "dataCaptureNote",
    "groundingNote",
    "conversationFlowNote",
    "responseQualityNote",
    "counsellingNote",
    "escalationNote",
    "bugsFound",
  ],
};

async function judgeTranscript(persona: string, contactId: string): Promise<JudgedCase> {
  const client = getGoogleClient();
  const messages = await prisma.message.findMany({
    where: { contactId },
    orderBy: { createdAt: "asc" },
    select: { direction: true, body: true },
  });
  const transcript = messages
    .filter((m) => m.body)
    .map((m) => `${m.direction === "INBOUND" ? "STUDENT" : "GURU"}: ${m.body}`)
    .join("\n");

  const fallback: JudgedCase = {
    persona,
    score: 0,
    dataCaptureNote: "Judge unavailable — no GOOGLE_API_KEY configured.",
    groundingNote: "",
    conversationFlowNote: "",
    responseQualityNote: "",
    counsellingNote: "",
    escalationNote: "",
    bugsFound: [],
  };
  if (!client) return fallback;

  const started = Date.now();
  const model = getGeminiModel();
  const response = await client.models.generateContent({
    model,
    contents:
      `You are grading a WhatsApp study-abroad/education counsellor bot named "Guru" against a real ` +
      `student persona ("${persona}"). Judge ONLY what's in this transcript — be specific and cite the ` +
      `bot's own words as evidence for any bug found.\n\n${transcript}`,
    config: {
      tools: [{ functionDeclarations: [{ name: "submit_judgment", description: "Submit your scored judgment.", parameters: JUDGE_SCHEMA }] }],
      // Unlike the orchestrator's conversational tools (which the model chooses between,
      // alongside a free-text reply), this call exists ONLY to extract structured
      // judgment — there is nothing else it could legitimately do. Live-verified: without
      // forcing this, the model answered in plain prose on 5/5 personas and never once
      // invoked the tool, silently producing "unmeasured" scores for every eval run.
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["submit_judgment"] },
      },
    },
  });
  await recordModelCall({
    contactId,
    kind: "eval_judge",
    model,
    usage: response.usageMetadata,
    latencyMs: Date.now() - started,
  });

  const call = response.functionCalls?.find((c) => c.name === "submit_judgment");
  if (!call?.args) {
    // Distinct from the no-API-key fallback above: the judge ran but didn't return a
    // structured verdict. A silent score of 0 here would misleadingly read as "this
    // persona's conversation was bad" rather than "the judge itself didn't score it".
    return { ...fallback, dataCaptureNote: "Judge call completed without a structured verdict — treat this score as unmeasured, not a failing conversation." };
  }
  const args = call.args as Record<string, unknown>;
  return {
    persona,
    score: typeof args.score === "number" ? args.score : 0,
    dataCaptureNote: String(args.dataCaptureNote ?? ""),
    groundingNote: String(args.groundingNote ?? ""),
    conversationFlowNote: String(args.conversationFlowNote ?? ""),
    responseQualityNote: String(args.responseQualityNote ?? ""),
    counsellingNote: String(args.counsellingNote ?? ""),
    escalationNote: String(args.escalationNote ?? ""),
    bugsFound: Array.isArray(args.bugsFound) ? (args.bugsFound as JudgedCase["bugsFound"]) : [],
  };
}

const PASS_THRESHOLD = 70;

export async function runEvalPanel(personas: PersonaScript[] = DEFAULT_PERSONAS, label?: string): Promise<string> {
  const run = await prisma.evalRun.create({ data: { label: label ?? null } });

  const cases: JudgedCase[] = [];
  for (const script of personas) {
    const waId = newWebMirrorWaId();
    const { contact } = await findOrCreateContact(waId, `Eval — ${script.persona}`, null);
    // Bypass the compliance funnel noise (consent/age-gate) so the judged transcript is
    // about counselling quality, not about whether the scripted persona answered a
    // deterministic yes/no prompt correctly — that path is exercised by real traffic.
    await prisma.contact.update({
      where: { id: contact.id },
      data: { consentGranted: true, ageGateStatus: "adult" },
    });

    // Everything in here — including the judge call below — is tagged "eval" so its
    // Gemini spend never blends into the dashboard's production cost KPIs.
    const judged = await runInEvalContext(async () => {
      for (const [i, text] of script.messages.entries()) {
        await handleInboundMessage(contact.id, { metaMessageId: `eval-${run.id}-${i}`, text });
      }
      return judgeTranscript(script.persona, contact.id);
    });
    cases.push(judged);

    await prisma.evalCase.create({
      data: {
        runId: run.id,
        persona: judged.persona,
        score: judged.score,
        dataCaptureNote: judged.dataCaptureNote,
        groundingNote: judged.groundingNote,
        conversationFlowNote: judged.conversationFlowNote,
        responseQualityNote: judged.responseQualityNote,
        counsellingNote: judged.counsellingNote,
        escalationNote: judged.escalationNote,
        bugsFoundJson: JSON.stringify(judged.bugsFound),
        contactWaId: waId,
      },
    });

    // Cascade-deletes this contact's Messages/InteractionSessions/GroundingLogs/
    // ModelCallLogs too — the eval's own token/grounding usage is captured in EvalCase
    // above before cleanup, so nothing is lost, only the throwaway conversation state.
    await prisma.contact.delete({ where: { id: contact.id } });
  }

  const passedCases = cases.filter((c) => c.score >= PASS_THRESHOLD).length;
  const avgScore = cases.length ? cases.reduce((s, c) => s + c.score, 0) / cases.length : 0;

  await prisma.evalRun.update({
    where: { id: run.id },
    data: { completedAt: new Date(), totalCases: cases.length, passedCases, avgScore },
  });

  return run.id;
}
