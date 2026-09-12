# PRODUCT REQUIREMENTS DOCUMENT

Status: approved
Owner: Product Strategist
Updated: 2026-09-12 by orchestrator - condensed from Avanse_PRD_v8_0_WhatsApp_Dual_Journey.docx
Confidence: verified
Traces to: product/brd.md

> Full detail (all FR/NFR/TR/INT/DR/CR requirement IDs) lives in
> `SEC Whatsapp/Avanse_PRD_v8_0_WhatsApp_Dual_Journey (1).docx`. This condenses it into
> what the harness needs day to day; the POC's actual implementation of each module is
> traced inline in the corresponding `lib/` and `app/` files by requirement ID.

## 1. Users and jobs
| Persona | Job to be done | Frequency |
|---|---|---|
| Prospective student (international) | Explore study-abroad loan options, get a feel for eligibility, apply | Over months, asynchronous |
| Prospective student (domestic PG/skilling/professional) | Same, for an Indian programme | Over months, asynchronous |
| Ambassador | Drive scans, earn incentive on disbursement | Ongoing |
| Sales/Credit (via DIY/Processio) | Convert qualified, propensity-gated leads | Per lead |
| SEC agent | Take over a thread on escalation | Per handover |
| SEC admin | Manage assets, monitor funnel/cost/quality, resolve payouts | Ongoing |

## 2. Core user flows — the nine PRD layers
0. **Asset code + click token** — QR encodes a branded redirect, never a raw wa.me link.
1. **Entry & attribution** — wa_id + profile name arrive free on message 1; four-tier
   resolution (High-exact/High-reuse/Medium/Low), stamped once, first-touch only.
2. **Disclosure, consent, age gate** — identity disclosure, purpose notice, two-button
   consent, age gate (control, not KYC), STOP handling — all before any profiling.
3. **Fork + progressive profiling** — India/Abroad/Not-decided, then one enumerable
   question per turn (list/button, never free text for the six standard fields).
4. **Counselling** — proprietary RAG hook by turn four; grounding routed (allow-list
   topics always ground); answer length disciplined (≤600 target, 1024 hard cap).
5. **Eligibility (interim)** — Tier 1 "up to" figure only, from DIY BRE, feature-flaggable off.
6. **Handoff to DIY** — signed short-lived token skips repeat mobile OTP.
7. **Nurture** — fortnightly marketing cap, unlimited utility, auto-pause on quality/block-rate.
8. **Human handover** — explicit ask / negative sentiment / complex case / model refusal;
   SLA measured against window expiry, not wall clock.

## 3. Functional requirements
Implemented module-by-module, each traced by FR-ID in code comments:
- Module A (attribution) → `lib/attribution.ts`, `app/api/redirect/[code]`, `app/api/qr/[code]`
- Module B (consent/identity) → `lib/consent.ts`, `app/api/webhook/whatsapp`
- Module C (fork/profiling) → `lib/conversation/profilingSteps.ts`, `qualification.ts`
- Module D (AI counselling/grounding) → `lib/conversation/orchestrator.ts`, `grounding.ts`, `rag.ts`
- Module E (eligibility) → `lib/eligibility.ts`, `app/api/mock/diy-bre`
- Module F (handoff) → `lib/handoff.ts`, `app/portal`
- Module G (messaging governance) → `lib/messaging/sendGovernor.ts`, `debounce.ts`
- Module H (agent console) → `app/agent/*`
- Module I (admin/reporting/payouts) → `app/admin/*`, `lib/reporting.ts`
- Module J (alumni/resources/web mirror) → `app/chat`, alumni/resource logic in `lib/conversation/flow.ts`

## 4. Non-functional requirements
POC posture vs. the BRD's NFR table: performance/scalability/availability targets (NFR-01
to NFR-11) are aspirational, not load-tested, at demo scale. Security/privacy NFRs
(NFR-12 to NFR-22) are implemented where feasible (webhook signature validation, sanitised
grounding queries, no media fetch) but not independently audited — see tech-debt.md.
Maintainability NFR-26 (config over deployment) is implemented via the `SystemConfig`
table and `/admin/settings`.

## 5. Edge cases and error handling
Handled: duplicate webhook delivery, debounced fragments, expired/reused click tokens,
minor age-gate branch, opt-out, template-vs-free-form window enforcement, handoff token
replay, feature-flagged eligibility, orchestrator/grounding call failures (safe fallback
replies rather than crashes). Not yet handled: true offline/queued delivery retries beyond
Meta's own retry behaviour.

## 6. Out of scope for this release
Same as BRD §5 "out of scope" — vernacular languages, full DIY application/KYC, native
mobile app, domestic P&L modelling, co-applicant parent journey.

## 7. Open product questions
See `.ai/memory/open-questions.md` Q-001..Q-005.

## 8. Release definition of done (for this POC)
- [x] Every module has a working, demoable implementation (simplified where a real
      dependency doesn't exist — see tech-debt.md)
- [ ] Deployed and smoke-tested end to end (blocked on credentials, Q-001)
- [ ] NFR-27 test coverage — explicitly deferred, not waived silently (tech-debt D-002)
- [x] Ops runbook exists (`engineering/ops.md`)
