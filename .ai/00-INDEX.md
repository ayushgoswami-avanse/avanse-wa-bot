# PROJECT INDEX — Tier 0

<!-- ALWAYS READ FIRST. Keep under 150 lines. This is a map, not a document. -->
<!-- Orchestrator owns this file. Update it whenever a doc's status or purpose changes. -->

**Project:** `Avanse SEC WhatsApp AI Counsellor`
**Mode:** `greenfield`
**One-liner:** `WhatsApp-first AI counsellor for Avanse's Student Experience Center — QR-attributed acquisition, dual loan journeys, AI counselling with routed search grounding, and DIY handoff.`
**Phase:** `build`
**Updated:** `2026-09-12`

---

## Where things are

| Doc | Path | Status | Read when |
|---|---|---|---|
| Business requirements | `product/brd.md` | approved | Scope/priority/business questions |
| Product requirements | `product/prd.md` | approved | Building a feature, writing acceptance criteria |
| Backlog | `product/backlog.md` | draft | Choosing what's next |
| Architecture | `engineering/architecture.md` | draft | Any structural change |
| API contracts | `engineering/api-contracts.md` | missing | Touching an interface — routes are self-documented inline for now |
| Data model | `engineering/data-model.md` | draft | Touching storage or schemas (schema.prisma is the real source of truth) |
| Test strategy | `engineering/test-strategy.md` | missing | No automated tests exist yet — see tech-debt D-002 |
| Ops | `engineering/ops.md` | draft | Build, run, deploy, config, incidents |
| Tech debt | `engineering/tech-debt.md` | draft | 12 open items — read before assuming any POC shortcut is production-ready |
| Decisions (ADRs) | `memory/decisions.md` | draft | "Why is it like this?" — 5 ADRs recorded |
| Open questions | `memory/open-questions.md` | draft | 5 open, 1 blocking (credentials) |
| Glossary | `memory/glossary.md` | missing | Unfamiliar domain term — see BRD §8 glossary in the source docx meanwhile |
| Session log | `memory/session-log.md` | draft | Cold start / "what happened last time" |

Original source documents (BRD v1.0, PRD v8.0, business case v13) live as .docx/.xlsx in
`SEC Whatsapp/` — read those for anything this harness's condensed docs don't cover.

---

## How to run this project

```
install : npm install
run     : npm run dev
test    : (none yet — tech-debt D-002)
lint    : npm run lint
build   : npm run build
```

Entry point(s): `app/api/webhook/whatsapp/route.ts` (real WhatsApp), `app/chat/page.tsx` (web mirror), `app/admin`, `app/agent`
Config / env: `.env` (see `.env.example` for the full list)

---

## Current focus

**Task:** `T-001` — Build and deploy a fully-functional POC for a management demo
**Next action:** `staff_engineer` — Get real credentials from the user (Anthropic, Google, Meta WhatsApp test number, Render token), then `prisma db push` + seed + deploy + smoke test
**Blockers:** No DATABASE_URL / API keys / Meta credentials / Render token supplied yet (Q-001)

---

## Map of the territory

```
[Meta WhatsApp / web chat] ── webhook or SSE ── [Next.js service] ── Postgres (Render)
                                                       │
                          ┌────────────────────────────┼────────────────────────────┐
                     Claude (orchestration)    Gemini (grounding tool)      mock DIY BRE / Processio
```

- `app/` — Next.js routes: webhook, web-mirror, admin console, agent console, portal stub, chat UI
- `lib/` — all business logic: attribution, consent, propensity, eligibility, handoff, send governor, conversation engine
- `prisma/schema.prisma` — full data model, one comment per model citing its BRD requirement
- `.ai/` — this harness
- `SEC Whatsapp/` — original BRD/PRD/business-case source documents (read-only reference)

---

## Rules specific to this project

- Never add a new outbound-send code path outside `lib/messaging/sendGovernor.ts` — see
  tech-debt.md's landmines section.
- Never put credit/eligibility math anywhere but `app/api/mock/diy-bre/route.ts` (FR-E02).
- Don't upgrade `prisma` past 7.x without re-reading ADR-005 first.
