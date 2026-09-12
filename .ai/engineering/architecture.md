# ARCHITECTURE

Status: draft
Owner: Principal Architect
Updated: 2026-09-12 by staff_engineer - initial POC architecture
Confidence: verified
Traces to: product/prd.md, Avanse_SEC_BRD_v1_0, Avanse_PRD_v8_0

## 1. System context
A single Next.js (App Router) service on Render, backed by Render-managed Postgres,
talks to Meta's WhatsApp Cloud API (real test number), Anthropic Claude (conversation
orchestration) and Google Gemini (search grounding tool, invoked only by Claude). Two
systems named in the BRD — DIY and Processio — don't exist in this environment, so their
integration points (INT-05, INT-06/07, INT-08) are implemented as real HTTP contracts
against local mock routes rather than skipped (ADR — see decisions.md's tech-debt table).

```
[Meta WhatsApp Cloud API] <--webhook/send--> [Next.js service] <--> [Render Postgres]
[Web browser (chat mirror)] <--SSE/HTTP-->        |     |
[Anthropic Claude] <--tool-use-->                 |     |--> [Google Gemini + Search Grounding]
[Admin console / Agent console (same service)] <--|
[/api/mock/diy-bre, /api/mock/processio] <---------|  (stand-ins for systems that don't exist here)
```

## 2. Quality attribute drivers
- **Demoable without AWS or a business-verified WABA.** Every external dependency has a
  free/POC-scale substitute (ADR-001..003).
- **Compliance-sensitive layers must never be model-dependent.** Consent, age-gate, and
  eligibility wording must be byte-identical every time (ADR-004).
- **No credit logic in the bot** (FR-E02) — enforced by putting the FOIR-style formula
  behind an HTTP call to a route explicitly named as a mock external service, not an
  inline function.
- **Single-instance-friendly, not solved-for-scale.** In-memory debounce/pub-sub is a
  deliberate trade for zero extra infra at demo scale (tech-debt D-005).

## 3. Components

| Component | Responsibility | Owns data? | Depends on | Source path |
|---|---|---|---|---|
| Webhook receiver | Verify + ingest Meta messages | writes Message, Contact | Meta Graph API | `app/api/webhook/whatsapp` |
| Web mirror | Browser-based alternate channel | writes Message, Contact | SSE bus | `app/chat`, `app/api/web-mirror/*` |
| Attribution | Asset/click/tier resolution | Asset, ClickRecord, Contact | — | `lib/attribution.ts` |
| Consent | Disclosure/consent/age-gate/opt-out | ConsentLedgerEntry, Contact | — | `lib/consent.ts` |
| Conversation flow | Deterministic stage machine | Contact.stage, Message | orchestrator, eligibility, handoff | `lib/conversation/flow.ts` |
| Orchestrator | AI counselling turns | GroundingLog (indirectly) | Anthropic, grounding, rag | `lib/conversation/orchestrator.ts` |
| Grounding | Live search tool, sanitisation, cache | GroundingLog, SemanticCacheEntry | Gemini | `lib/conversation/grounding.ts` |
| Send governor | Single choke point for all outbound sends | SendLog, Message, CostLedgerEntry | whatsapp client, webMirror bus | `lib/messaging/sendGovernor.ts` |
| Eligibility | Tier 1 flow | EligibilityRequest | mock DIY BRE | `lib/eligibility.ts`, `app/api/mock/diy-bre` |
| Handoff | Signed deep link + Processio sync | HandoffToken, ProcessioSyncLog | mock Processio | `lib/handoff.ts`, `app/portal` |
| Admin console | Reporting, config, payouts | reads everything; writes SystemConfig, AmbassadorPayout | — | `app/admin/*` |
| Agent console | Human takeover | Handover, Message (agent-sent) | send governor | `app/agent/*` |

## 4. Tech stack

| Layer | Choice | Version | Why (ADR ref) |
|---|---|---|---|
| Language | TypeScript | 5.x | Next.js default |
| Framework | Next.js, App Router | 16.3.5 | ADR-001 |
| ORM | Prisma | 7.10.0 (pinned) | ADR-005 |
| Datastore | Postgres | Render free tier | ADR-001 |
| AI orchestration | Anthropic Claude | claude-sonnet-5 | ADR-002 |
| Search grounding | Google Gemini (`@google/genai`) | gemini-2.5-flash | ADR-002 |
| Messaging channel | Meta WhatsApp Cloud API (direct, no BSP) | Graph API v21.0 | ADR-003, matches BRD TR-04/D5 |
| Hosting | Render (single web service) | — | ADR-001 |
| CI/CD | none yet | — | tech-debt |

## 5. Key flows
1. **Acquisition → attribution:** QR → `/api/redirect/[code]` (writes ClickRecord, mints
   token, 302s to wa.me) → first inbound message carries the token → `resolveAttribution`
   stamps a tier once, permanently, via `findOrCreateContact`.
2. **Conversation turn:** webhook/web-mirror → dedup + debounce → `handleInboundMessage`
   (stage machine) → for free-text turns, `generateCounsellingReply` (Claude, optionally
   calling the grounding tool) → `sendOutboundMessage` (the governor) → Meta or web-mirror
   bus, always logging a `SendLog` row regardless of outcome.
3. **Handoff:** qualified lead or explicit ask → `mintHandoffToken` (signed JWT, 15 min
   TTL) → student taps the link → `/portal` verifies and consumes it once → (in a real
   build) DIY pre-fills the application; here, the stub page proves the claims decode
   correctly and replay is rejected.

## 6. Cross-cutting concerns

| Concern | Approach |
|---|---|
| Error handling | Every external call (Anthropic, Gemini, Meta) is wrapped and falls back to a safe default reply/log rather than throwing to the user |
| Logging / tracing | `console.error` with a `[module]` prefix; no correlation IDs yet (tech-debt) |
| Config / secrets | Env vars for secrets; `SystemConfig` DB table for runtime-editable caps/flags (`lib/config.ts`) |
| AuthN / AuthZ | Signed cookie session (`lib/auth.ts`), `AgentRole` enum, middleware redirects unauthenticated console access |
| Validation | `zod` at API boundaries that accept structured input (e.g. mock BRE) |
| Idempotency | Meta message ID dedup (`Message.metaMessageId` unique); handoff tokens single-use; click tokens single-use |
| Background jobs | None yet — debounce uses in-process timers, not a job queue (tech-debt D-005) |
| Feature flags | `SystemConfig` table, editable from `/admin/settings`, no redeploy needed |

## 7. Boundaries and rules
- Nothing but `lib/messaging/sendGovernor.ts` may call `lib/whatsapp/client.ts` or write
  an outbound `Message` row.
- Nothing but `app/api/mock/diy-bre/route.ts` may contain a FOIR-style formula (FR-E02).
- The conversation `flow.ts` state machine owns all compliance-sensitive wording;
  `orchestrator.ts` is only ever invoked for free-text counselling turns.

## 8. Rejected alternatives
See ADR-001..005 in `memory/decisions.md`.

## 9. Known architectural risks

| Risk | Trigger | Mitigation / escape hatch |
|---|---|---|
| In-memory debounce/pub-sub breaks on >1 instance | Render autoscaling turned on | Swap for Redis (tech-debt D-005) before scaling |
| No automated tests | Any refactor | Write the NFR-27 critical-path suite (tech-debt D-002) before this becomes more than a demo |
| Mock DIY/Processio diverge from real contracts once those systems exist | Real integration environments become available | Payload shapes were written directly from BRD INT-05/08 — should need only URL/auth changes, but verify against the real API docs when available |
