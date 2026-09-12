# TECHNICAL DEBT REGISTER

Status: draft
Owner: Staff Engineer
Updated: 2026-09-12 by staff_engineer — initial register from the POC build

> Debt is fine when it is deliberate, recorded, and priced. Log it the moment you take it.
> "Interest" = the ongoing cost of leaving it. "Trigger" = the event that makes repayment
> non-optional.

| ID | Location | What was compromised | Why | Interest | Blast radius | Trigger to repay | Est. effort | Status |
|---|---|---|---|---|---|---|---|---|
| D-001 | `lib/attribution.ts` (`resolveAttribution`, Medium tier) | Real "device signature" matching, per FR-A05 | WhatsApp webhooks carry no device fingerprint at all — there is nothing to match on. POC approximates Medium-tier recovery via time-window uniqueness (exactly one unconsumed click in the window) | Medium — Medium-tier attribution will be less precise than the BRD implies at real ambassador volume | Payout accuracy only; never affects High-tier or Low-tier logic | Before any real ambassador payout run at scale | 3-5 days (would need a client-side fingerprint library on the redirect page) | open |
| D-002 | whole repo | No automated test suite | POC time-boxed toward a working demo over test coverage | High — NFR-27 requires 100% coverage on attribution/consent/governor/sanitisation; none of that is verified today | Any refactor could silently break consent/attribution correctness | Before this becomes anything but a demo | 1-2 weeks for the NFR-27 critical paths | open |
| D-003 | `lib/conversation/rag.ts` | Real vector-embedding retrieval over Avanse's actual outcome corpus | No real outcome data exists yet; keyword-overlap over ~15 synthetic rows is enough to demo the "hook" behaviour | Low today, grows with corpus size | None until real data arrives — then relevance will be poor without embeddings | When real disbursement/outcome data is available to ingest | 2-3 days (pgvector + embeddings) | open |
| D-004 | `app/api/mock/diy-bre`, `app/api/mock/processio` | Real DIY BRE and Processio LOS integrations | Neither system exists for this POC; INT-05/INT-08 payload shapes are real, the destination is not | Low — contained behind a clean interface | None until real handoff/eligibility numbers must be trustworthy | When DIY/Processio integration environments are available | Unknown — depends on their API readiness | open |
| D-005 | `lib/messaging/debounce.ts`, `lib/webMirror/bus.ts` | In-process Map/EventEmitter instead of Redis | Correct for a single Render instance; the whole point of a POC is not provisioning a queue for a demo | Low now; becomes a correctness bug (missed debounce/lost SSE event) the moment there is more than one instance | Any horizontal scale-out | Before scaling past one Render instance | 1-2 days (swap for Redis pub/sub) | open |
| D-006 | `lib/propensity.ts` | Trained propensity model with sentiment analysis, per FR-C07's intent | Transparent weighted heuristic over profile completeness + engagement depth instead | Medium — heuristic may rank leads differently than a real model would | Processio sync gate (FR-F04) quality | Before the real pilot uses this to gate Sales capacity | 1-2 weeks (needs real labelled outcome data first, so blocked on data, not just effort) | open |
| D-007 | `lib/auth.ts`, `middleware.ts` | SSO/MFA for the admin/agent console | Single signed-cookie session against a seeded email/password, to keep the demo self-contained | Medium — no audit-grade access control | NFR around least-privilege access to student PII in the consoles | Before any non-demo user touches real student data | 3-5 days (wire to Avanse SSO) | open |
| D-008 | `lib/conversation/orchestrator.ts` | Automated red-team / hallucination test suite (FR-D11's acceptance criteria) | Guardrails are prompt- and code-enforced (sanitisation, allow-list forcing, length caps) but never adversarially tested | High — FR-D11 explicitly requires "zero fabricated factual claims in the tested set", and there is no tested set | Reputational/compliance risk if a real user hits this before it's tested | Before any real student traffic | 1 week to build a red-team transcript suite | open |
| D-009 | `app/api/mock/diy-bre/route.ts` | FOIR/eligibility formula is illustrative, not Avanse's real underwriting rule | No real BRE exists to call; a plausible formula stands in so the Tier 1 flow is demoable end-to-end | Low — clearly isolated behind INT-05, never touched by the bot itself (FR-E02 intact) | None — this is explicitly fake and contained | The moment a real DIY BRE environment exists | N/A — delete this file and point at the real service | open |
| D-010 | `lib/conversation/flow.ts` (intent keywords) | Human-handover / eligibility / handoff / resource / alumni intent detection is keyword matching, not NLU | Fast, transparent, zero extra cost — sufficient to demo the trigger behaviour | Medium — will misfire on phrasing the keyword lists don't anticipate | User-visible: a real student's phrasing might not trigger the intent | If real usage shows frequent misses | 2-3 days to move this into the orchestrator's tool-calling loop instead | open |
| D-011 | Everywhere `NEXT_PUBLIC_BASE_URL` is used server-side to call our own API routes | Same-process HTTP round-trips (e.g. eligibility → /api/mock/diy-bre) instead of direct function calls | Keeps INT-05/INT-08 demonstrably real integration boundaries (FR-E02's "no credit logic in the bot" is easier to audit as a network call) at a small latency cost | Low | None functionally | If POC latency ever matters | Half a day to inline if ever needed | open |
| D-012 | WhatsApp Flows (FR-C06, FR-E01) | Not implemented — approximated with sequential list/button questions | Real WhatsApp Flows need a Flow JSON definition submitted to Meta for approval, which doesn't fit a self-serve POC timeline | Medium — the "one screen instead of six turns" UX win from FR-C06 doesn't exist yet | UX polish only, not functional gap | Before this goes to a real pilot audience where turn-count matters commercially | 1 week once a Meta Flow can be approved | open |
| D-014 | `lib/conversation/sessions.ts`, `lib/propensity.ts` | Sentiment classification and session-boundary detection (ADR-007) | Sentiment comes from the same Gemini call that drafts the reply (asked to self-report, not a dedicated classifier); a session boundary is purely a time gap, not an explicit "goodbye"/topic-change signal | Medium — self-reported sentiment from a reply-drafting model is weaker evidence than a dedicated classification pass, and a fixed time gap will occasionally split or merge sessions oddly | Lead-temperature accuracy and the Leads CSV Sales relies on | If Sales reports the Hot/Warm/Cold labels don't match reality | 2-3 days for a dedicated sentiment pass; session-boundary heuristics need real usage data to tune | open |

## Suspected dead code
None yet — codebase is new.

## Landmines
- **Prisma major version**: do not blindly `npm update prisma` — 8.x is an RC platform
  rewrite with a different CLI. See ADR-005.
- **Prisma 7 config split**: the datasource connection URL lives in `prisma.config.ts`
  (used by the CLI: generate/db push/migrate), NOT in `prisma/schema.prisma`'s datasource
  block anymore. `PrismaClient` at runtime separately requires an explicit driver adapter
  (`@prisma/adapter-pg`, wired in `lib/prisma.ts` and `prisma/seed.ts`) — `new
  PrismaClient()` with no arguments throws in Prisma 7. Discovered via a failed Render
  build (`Error: Prisma schema validation ... P1012 ... url is no longer supported in
  schema files`) — this is a real behavior change from Prisma 5/6, not a POC shortcut.
- **`lib/messaging/sendGovernor.ts` is the only path allowed to call the Meta client or
  write an outbound `Message` row.** Any new send path (a future scheduled nurture job,
  say) MUST go through `sendOutboundMessage`, or FR-G02 silently stops being true.
- **The web-mirror SSE greeting race** (`/api/web-mirror/stream`): the first-message
  greeting is deliberately triggered from inside the SSE route, after subscribing — never
  move that trigger back into `/start`, or the first outbound message will be published
  before any listener exists and silently vanish.
