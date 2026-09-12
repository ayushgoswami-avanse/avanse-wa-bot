# BACKLOG

Status: draft
Owner: Product Strategist
Updated: 2026-09-12 by staff_engineer

Ordered. The top unblocked item is what `next_action` should point at.

## Active

| ID | Type | Title | Traces to | Status | Depends on | Notes |
|---|---|---|---|---|---|---|
| T-001 | feature | Build + deploy the full POC | all BRD modules | in_review | — | Deployed and live; golden path smoke-tested via web mirror. Real WhatsApp channel not yet confirmed with a real phone |
| T-006 | feature | Configure + confirm the real Meta WhatsApp channel end-to-end | T-001 | in_progress | — | Webhook GET-verify handshake tested OK; subscribe/override action built (`/admin` → Settings → "Configure WhatsApp webhook"); needs a real inbound message from one of the 5 verified test numbers to fully confirm |
| T-007 | chore | Decide which tech-debt items (D-002 tests, D-008 red-team suite, etc.) to pull forward before the management demo | T-001 | not_started | user decision | See Q-005 (timeline) |

## Blocked

(none)

## Done

| ID | Title | Completed | Verified how | Session |
|---|---|---|---|---|
| — | Harness scaffold (.ai/, AI-HARNESS.md, CLAUDE.md) | 2026-09-12 | File existence checked | Session 1 |
| — | Full application code (schema, lib, all API routes, admin/agent/chat UIs, seed script) | 2026-09-12 | Read through against BRD/PRD requirement IDs | Session 1 |
| — | Get credentials from user | 2026-09-12 | Google API key, Render token, admin login, Meta WhatsApp credentials all supplied | Session 1 |
| — | Push to GitHub, create Render Postgres + web service, fix 2 rounds of build failures | 2026-09-12 | Render deploy status = `live`; verified via curl | Session 1 |
| — | Smoke test golden path (consent → age gate → fork → profiling → RAG hook → grounded AI answer → eligibility → handoff → replay rejection) | 2026-09-12 | Ran the actual flow against the live deployment via `/api/web-mirror/*`, inspected `/api/web-mirror/history` and `/portal` responses | Session 1 |
