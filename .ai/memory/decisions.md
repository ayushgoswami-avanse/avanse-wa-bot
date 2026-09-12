# DECISION LOG (ADRs)

Status: draft
Owner: Principal Architect
Updated: 2026-09-13 by staff_engineer — added ADR-008 (console redesign + AI-suggested replies)

**Append-only.** Never edit or delete a past decision. To change course, add a new ADR
with `Supersedes: ADR-00X`. The value of this file is that it explains *why* the system
looks the way it does to someone who wasn't there.

Record an ADR whenever: a technology is chosen, a pattern is adopted, a trade-off is
accepted, a constraint is discovered, or a plausible alternative is rejected.

---

## ADR-001 — Next.js (App Router) + Prisma + Postgres as the POC stack

- **Date:** 2026-09-12
- **Status:** accepted
- **Deciders:** user, agent
- **Phase:** build

**Context**
The user asked for a fully-functional POC to show management, explicitly ruling out AWS
and asking for open-source/free infra (naming Vercel or Render). No source code existed
yet (greenfield). The BRD/PRD specify a fairly complex backend (async webhook pipeline,
send governor, RAG, grounding router) plus three UIs (admin console, agent console, web
chat mirror).

**Options considered**

| Option | Pros | Cons | Cost / risk |
|---|---|---|---|
| A — Next.js App Router, one deployable service | API routes + React UI in one codebase; long-running Node process (not serverless) keeps in-memory debounce/SSE alive; deploys cleanly to Render as a single web service | Less "proper" separation of concerns than a dedicated backend | Low |
| B — Separate Express backend + Vite/React frontend, two Render services | Clearer separation | Two deploys, two URLs, CORS to manage, more moving parts for a demo | Medium |
| C — Serverless (Vercel functions) | Vercel's flagship use case | FR-B03 debounce and the web-mirror SSE bus need in-memory state across requests, which serverless functions don't reliably preserve between invocations | High — would force a Redis dependency for what should be a demo-scale nicety |

**Decision**
Option A — Next.js App Router as a single Render web service, Prisma ORM, Render-managed Postgres.

**Rationale**
One deployable, one URL, Node stays a persistent process so in-memory debounce/pub-sub work
without a Redis dependency, and Render's free Postgres tier satisfies "real relational
system of record" from the data-model requirements without provisioning cost.

**Consequences**
- Accepted: no horizontal scaling story yet (single instance) — fine for a demo, not for the real pilot.
- Enables: one build command, one deploy, one env var list.
- Forecloses: nothing that can't be unwound later (Redis for debounce/pubsub is a drop-in swap — see tech-debt D-007).
- Revisit when: this moves past POC toward the actual P0/P1 phases in the BRD.

**Confidence:** verified

---

## ADR-002 — Anthropic Claude + Google Gemini replace AWS Bedrock + Google Search Grounding

- **Date:** 2026-09-12
- **Status:** accepted
- **Deciders:** user (via AskUserQuestion), agent
- **Phase:** build

**Context**
BRD/PRD specify a Bedrock-native conversation model with Google Gemini + Search Grounding
invoked as a tool. The user explicitly ruled out AWS for this POC.

**Options considered**

| Option | Pros | Cons | Cost / risk |
|---|---|---|---|
| A — Claude (orchestration) + Gemini (grounding tool) | Preserves the exact architecture the BRD cares about: grounding as a tool, never the conversation model | Two API keys instead of one | Low |
| B — Claude only, grounding stubbed | Simplest | Loses the "live grounding" demo value entirely | Medium (weakens the demo) |
| C — OpenAI for both roles | One provider | Diverges furthest from the BRD's tool-use architecture description | Low-medium |

**Decision**
Option A, chosen directly by the user when asked.

**Rationale**
This is the one piece of the BRD's AI architecture that is architecturally load-bearing
(FR-D03/D05: grounding is a *tool*, not the model) rather than a vendor-name detail — worth
preserving exactly even while substituting the underlying providers.

**Consequences**
- Accepted: two vendor API keys to manage instead of one.
- Enables: an honest demo of the router/grounding/citation/cache behaviour from FR-D03..D08.
- Forecloses: nothing — swapping either provider later is a `lib/conversation/orchestrator.ts` /
  `lib/conversation/grounding.ts` change, not an architecture change.
- Revisit when: a real AWS Bedrock account and Google Enterprise agreement exist for the actual pilot.

**Confidence:** verified — implemented in `lib/conversation/orchestrator.ts` and `grounding.ts`.

**Implementation note (2026-09-12):** `@google/generative-ai` is end-of-life (Aug 2025);
used the current `@google/genai` package with `tools:[{googleSearch:{}}]`, verified against
current Google documentation via web search rather than assumed from training data.

---

## ADR-003 — Real Meta WhatsApp Cloud API test number, with a web chat mirror as a parallel channel

- **Date:** 2026-09-12
- **Status:** accepted
- **Deciders:** user (via AskUserQuestion), agent
- **Phase:** build

**Context**
Needed to decide how convincing vs. how much manual setup the WhatsApp channel demo
requires.

**Decision**
Both: a real Meta Cloud API test number (free, up to 5 verified recipient numbers) for
the "it's really WhatsApp" moment, and the web chat mirror (already a Must-have per
FR-J04) as the always-available, zero-setup demo surface for the rest of the audience.

**Rationale**
The user chose "real Meta test number" as primary, but FR-J04 already requires a web
mirror to exist regardless — building it first means the demo doesn't depend on Meta app
review/webhook configuration being done in time, and both channels share one conversation
engine (`lib/contactService.ts`, `lib/conversation/flow.ts`), so there is no duplicated logic.

**Consequences**
- Accepted: two channels to wire (Meta webhook + SSE web-mirror bus).
- Enables: a working demo even before the Meta developer app is configured.
- Revisit when: moving to a business-verified WABA number for the real pilot.

**Confidence:** verified

---

## ADR-004 — Deterministic state machine for compliance-sensitive layers; AI only for free-text counselling

- **Date:** 2026-09-12
- **Status:** accepted
- **Deciders:** agent
- **Phase:** build

**Context**
The BRD is explicit that consent, age-gating, and eligibility must never be left to model
judgement (FR-E02: "no credit logic in the bot"; CR-05/CR-07 require exact, versioned
notice text). An LLM-driven conversation manager risks silently skipping or rewording a
compliance-required step.

**Decision**
`lib/conversation/flow.ts` implements an explicit `Contact.stage` state machine for
disclosure/consent/age-gate/journey-fork/profiling/eligibility/handoff. The AI
(`orchestrator.ts`) is invoked only for free-text turns during PROFILING (to answer the
student's own question before re-asking the pending field, per FR-C03) and COUNSELLING.

**Options considered**

| Option | Pros | Cons | Cost/risk |
|---|---|---|---|
| A — scripted state machine + AI only for open Q&A | Compliance text is always exact and auditable; matches AI-HARNESS.md's "small, reversible steps" | More code, more explicit states to maintain | Low |
| B — single AI agent with tools for every layer | Less code | Compliance-critical wording becomes model-dependent and non-deterministic | High — unacceptable for consent/eligibility |

**Decision**: Option A.

**Consequences**
- Accepted: adding a new profiling field or stage means touching `flow.ts` and `profilingSteps.ts`, not just a prompt.
- Enables: every consent/age-gate/eligibility message is byte-identical every time, and unit-testable in principle (tech-debt D-002 — no tests written yet).
- Revisit when: a real conversational-AI compliance review has taken place and the org wants more model latitude in scripted layers.

**Confidence:** verified

---

## ADR-005 — Pin Prisma to 7.10.0, not the 8.0.0-rc "Prisma Developer Platform" rewrite

- **Date:** 2026-09-12
- **Status:** accepted
- **Deciders:** agent
- **Phase:** build

**Context**
`npm install prisma` resolved to `8.0.0-rc.13`, which turned out to be a ground-up CLI
rewrite (`prisma project`, `prisma postgres`, `prisma deploy`, `prisma orm` — a hosted
"Prisma Developer Platform" concept) with no `prisma generate` or `prisma migrate`
commands. This surfaced only when `npx prisma generate` returned `CLI.UNKNOWN_COMMAND`.

**Decision**
Pinned `prisma` and `@prisma/client` to the exact stable release `7.10.0` (the latest
non-RC version) in `package.json`, rather than adopting the RC platform.

**Rationale**
An `-rc` major-version rewrite is not something to build a management demo on sight
unseen, and its account/project/hosted-Postgres model doesn't obviously fit "point Prisma
at a Render Postgres database" — the classic generate/migrate workflow is exactly what
this POC needs and 7.10.0 still provides it.

**Consequences**
- Accepted: will need a deliberate, tested upgrade later if the org wants Prisma 8's platform features.
- Enables: `prisma generate` / `prisma db push` / `prisma migrate dev` work exactly as documented for years of Prisma usage.
- Revisit when: Prisma 8 leaves RC and its docs/migration guide exist.

**Confidence:** verified — reproduced the `CLI.UNKNOWN_COMMAND` error directly, confirmed 7.10.0 is the latest non-prerelease via `npm view prisma versions`.

---

## ADR-006 — Single Google API key for both orchestration and grounding

- **Date:** 2026-09-12
- **Status:** accepted — supersedes ADR-002's provider split
- **Deciders:** user
- **Phase:** build

**Context**
The user supplied one Google API key and no Anthropic key, with explicit instruction to
"use google api key to build both for grounding, and non grounding queries."

**Decision**
`lib/conversation/orchestrator.ts` now runs on Gemini function-calling (the same
`ground_with_google_search` + forced `submit_reply` tool-loop pattern previously built for
Claude), and `@anthropic-ai/sdk` was removed from the project. `lib/conversation/
grounding.ts` is unchanged — it already ran as an isolated Gemini call using only the
`googleSearch` tool.

**Rationale**
One vendor key instead of two, per the user's direct instruction. The BRD's actual
architectural concern — grounding invoked as a tool, in an isolated call, never mixed into
the main conversation turn — is preserved: Gemini does not support combining
`googleSearch` with custom `functionDeclarations` in a single call, so the orchestrator's
tool-calling turn and the grounding tool's search turn remain two separate model
invocations, exactly as before.

**Consequences**
- Accepted: both roles now share one quota/rate limit and one point of vendor failure.
- Enables: single-key setup — one fewer credential to manage for the POC.
- Forecloses: nothing architectural; swapping either role to a different provider later is
  still a single-file change (`orchestrator.ts` or `grounding.ts`).
- Revisit when: rate-limit contention between orchestration and grounding calls becomes
  visible in the admin console's cost/latency reporting.

**Confidence:** verified — implemented and the request/response shapes (`functionDeclarations`,
`response.functionCalls`, `functionCall`/`functionResponse` parts) confirmed via live
documentation search before writing the code, not assumed from training data.

---

## ADR-007 — Interaction sessions, sentiment, and a lead rollup (direct user feedback, not a BRD item)

- **Date:** 2026-09-12
- **Status:** accepted
- **Deciders:** user
- **Phase:** harden

**Context**
After the first demo pass, the user asked for three things the BRD doesn't specify: (1) a
warmer, more human counsellor tone; (2) conversational continuity across a gap ("start
from where they left off"); (3) session-level analytics (summary, sentiment, data
collected) rolled up into a lead-level table with Hot/Warm/Cold categorisation,
downloadable as CSV for Sales.

**Decision**
- Rewrote the orchestrator's persona and added `sentiment` + `sessionNote` as *required*
  fields on the existing `submit_reply` tool call, rather than a separate classification
  call — one model call still does the whole turn.
- Added `InteractionSession` (gap-bounded via `SESSION_GAP_MINUTES`, default 30) holding a
  rolling summary, last sentiment, message count, and a snapshot of profiling fields.
- Reused the existing `propensityBand` as the "lead temperature" (labelled Hot/Warm/Cold
  in the UI/CSV) rather than inventing a parallel scoring system, and folded sentiment
  into its heuristic (`lib/propensity.ts`) so temperature reacts to how the conversation
  is actually going, not just profile completeness.
- Continuity is implemented by feeding `Contact.profileSummary` (already in the schema,
  previously unused) back into the system prompt only when a session reopens after a gap
  — a one-line, optional acknowledgement, not a forced "welcome back" every turn.

**Rationale**
Reusing `propensityBand`/`profileSummary` instead of adding parallel fields keeps one
source of truth for "how warm is this lead" and avoids a second, competing signal. Putting
sentiment on the same tool call as the reply avoids a second Gemini round-trip per turn.

**Consequences**
- Accepted: the `submit_reply` tool call is now doing three jobs (reply, escalation,
  analytics) in one call — acceptable for a POC, would want to reconsider if any one of
  those needs independent latency/reliability guarantees later.
- Enables: `/admin/leads` (table + CSV export) and per-session summaries on the transcript
  detail page.
- Revisit when: this needs to scale past "one Gemini call classifies its own turn" — e.g.
  a dedicated sentiment/quality model, or session boundaries driven by explicit signals
  (e.g. a "goodbye") rather than only a time gap.

**Confidence:** verified — implemented; not yet run through the same live smoke test as
the rest of the golden path (see backlog).

---

## ADR-008 — Console redesign: Avanse brand theme, shared brief component, AI-suggested replies

- **Date:** 2026-09-13
- **Status:** accepted
- **Deciders:** user
- **Phase:** harden

**Context**
User asked for a "state of the art" redesign of both consoles with the real Avanse brand
theme, plus agent-efficiency features (suggested replies, summaries, a dashboard), while
explicitly asking to reuse existing transcript summaries rather than add new LLM calls
for that purpose.

**Decision**
- Sourced Avanse's actual brand colors (teal `#00AEAF`, cornflower blue `#4E78F4`, deep
  teal `#10847E`) from public brand assets rather than inventing a palette, and wired them
  into Tailwind v4's `@theme` block in `globals.css` alongside a small shared animation
  vocabulary (fade/slide/scale-in, shimmer, pulse-ring).
- Extracted `SalesBriefCard` (and the underlying `buildSalesBrief`/`computeCohort`, both
  pure functions over already-captured data) into one shared component used by *both*
  the admin transcript page and the agent thread page — one computation, two consoles,
  zero extra model calls to show it twice.
- Added `/api/agent/suggest-reply`: a genuinely new on-demand LLM call (there's no way to
  "suggest a reply" without generating one), but it reuses `generateCounsellingReply` —
  the exact same context/history/profileSummary path the AI counsellor itself uses —
  rather than a bespoke second prompt, and writes nothing to the database unless the
  agent actually sends it.
- Added `components/ui/{Badge,StatCard}.tsx` and `components/charts/TemperatureDonut.tsx`
  (recharts, already an unused dependency) as the shared visual vocabulary for both
  consoles' dashboards.

**Rationale**
A real brand palette (not a placeholder) makes the demo read as an actual Avanse product;
sharing the brief component guarantees the admin and agent views of the same lead can
never silently drift out of sync; reusing the orchestrator for suggestions keeps the
"why did it say that" story consistent between what the bot would have said and what it
suggests an agent say.

**Consequences**
- Accepted: agent-facing suggestions cost one Gemini call per click — acceptable since
  it's agent-initiated, not automatic, unlike the always-on counselling path.
- Enables: the two consoles now share a design token set and can add new stat
  cards/badges/briefs without re-deriving their look.
- Revisit when: real Avanse brand guidelines (not a third-party brand-asset aggregator)
  become available — swap the three hex values in `globals.css` if they differ.

**Confidence:** inferred for the exact hex values (sourced from Brandfetch, a third-party
aggregator, not Avanse's own brand guidelines — flagged in tech-debt) — verified for
everything else, implemented and deployed.
