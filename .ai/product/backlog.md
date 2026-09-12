# BACKLOG

Status: draft
Owner: Product Strategist
Updated: 2026-09-12 by staff_engineer

Ordered. The top unblocked item is what `next_action` should point at.

## Active

| ID | Type | Title | Traces to | Status | Depends on | Notes |
|---|---|---|---|---|---|---|
| T-001 | feature | Build + deploy the full POC | all BRD modules | done | — | Deployed and live; golden path smoke-tested via web mirror and the real webhook pipeline |
| T-008 | feature | Natural counsellor tone, session continuity, interaction/sentiment tracking, Leads dashboard + CSV | direct user feedback | done | T-001 | Deployed and live; see ADR-007 and tech-debt D-014 |
| T-007 | chore | Decide which tech-debt items (D-002 tests, D-008 red-team suite, D-014 sentiment reliability, etc.) to pull forward before the management demo | T-001 | not_started | user decision | See Q-005 (timeline) |

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
| — | Configure + confirm the real Meta WhatsApp channel end-to-end | 2026-09-12 | App-level + WABA webhook subscription both returned success; a signed synthetic webhook payload was correctly verified, parsed, and triggered a real Meta Send API call (rejected only because the test wa_id wasn't in the 5 allowed recipients — confirmed via Render app logs) | Session 1 |
| — | Natural tone, session continuity, sentiment, Leads dashboard + CSV | 2026-09-12 | Ran fresh conversations against the live deployment: confirmed warmer AI tone, a real "welcome back — last time we were talking about..." continuity message after a gap, POSITIVE/NEGATIVE sentiment correctly landing in the CSV export, and lead temperature reacting to it. Also caught and fixed a real data-corruption bug in the process (an unrelated message getting misread as a college name) | Session 1 |
