# BACKLOG

Status: draft
Owner: Product Strategist
Updated: 2026-09-12 by staff_engineer

Ordered. The top unblocked item is what `next_action` should point at.

## Active

| ID | Type | Title | Traces to | Status | Depends on | Notes |
|---|---|---|---|---|---|---|
| T-001 | feature | Build + deploy the full POC | all BRD modules | in_progress | — | Code complete; blocked on credentials before DB push/seed/deploy |
| T-002 | chore | Get real credentials (Anthropic, Google, Meta, Render, DB) from user | T-001 | not_started | user response | See open-questions.md Q-001 |
| T-003 | chore | `prisma db push` + `db:seed` against real Render Postgres | T-002 | not_started | T-002 | |
| T-004 | chore | Deploy to Render, verify build succeeds (local `prisma generate` is blocked by a corporate proxy — see tech-debt) | T-002 | not_started | T-002 | |
| T-005 | chore | Smoke test the golden path end to end | T-004 | not_started | T-004 | QR → chat → consent → fork → profiling → counselling (with one grounded query) → eligibility → handoff → agent takeover → admin dashboards |
| T-006 | feature | Configure the real Meta developer app + webhook for the WhatsApp channel | T-004 | not_started | T-004 | User-side setup steps in ops.md |

## Blocked

| ID | Title | Blocked by | Since | Unblock condition |
|---|---|---|---|---|
| T-003, T-004, T-005 | DB push / deploy / smoke test | Missing credentials (Q-001) | 2026-09-12 | User supplies ANTHROPIC_API_KEY, GOOGLE_API_KEY, Meta WhatsApp credentials, Render API token, DATABASE_URL |

## Done

| ID | Title | Completed | Verified how | Session |
|---|---|---|---|---|
| — | Harness scaffold (.ai/, AI-HARNESS.md, CLAUDE.md) | 2026-09-12 | File existence checked | Session 1 |
| — | Full application code (schema, lib, all API routes, admin/agent/chat UIs, seed script) | 2026-09-12 | Read through against BRD/PRD requirement IDs; NOT runtime-tested yet | Session 1 |
