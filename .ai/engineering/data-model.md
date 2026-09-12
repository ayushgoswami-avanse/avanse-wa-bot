# DATA MODEL

Status: draft
Owner: Principal Architect
Updated: 2026-09-12 by staff_engineer - initial POC model

> `prisma/schema.prisma` is the source of truth — every model carries a comment citing the
> BRD requirement(s) it exists for. This file is a map into it, not a duplicate.

## Entities (see schema.prisma for full field lists)

| Entity | Traces to | Notes |
|---|---|---|
| `Asset` / `ClickRecord` | FR-A01/A02/A09 | Permanent code vs. single-use click token — see PRD's "Layer 0" table |
| `Contact` | DR-01, FR-A04/A07, FR-C01-C08 | wa_id is the primary key concept; carries attribution, consent, journey, profiling fields, and the deterministic `stage` state machine |
| `ConsentLedgerEntry` | FR-B06, DR-05 | Append-only — no update/delete path exists in the codebase, by convention (not a DB constraint, since POC) |
| `Message` | DR-03 | One row per message, never a concatenated transcript |
| `MessageTemplate` / `SendLog` | FR-G02/G03 | Every outbound attempt logged, allowed or not, with a reason if blocked |
| `EligibilityRequest` | FR-E06 | Every Tier 1 request's inputs, BRE response, and disclaimer version, audited |
| `HandoffToken` | FR-F01 | Single-use, short-TTL, signed JWT |
| `Handover` | FR-H04 | Human-takeover queue with a reason code |
| `AgentUser` / `TranscriptView` | FR-H05 | RBAC + audit log of every transcript open |
| `Ambassador` / `AmbassadorPayout` | FR-I04 | First-touch reconciliation, review queue, clawback |
| `AlumniProfile` / `AlumniConnect` | FR-J01/J02, FR-I05 | Matching + slot booking + payout on a verified completed session |
| `GroundingLog` / `SemanticCacheEntry` | FR-D03/D07 | Router decision log + cache |
| `PilotMetricSnapshot` | FR-I09 | Daily rollup point for the seven pilot measurements (not all seven are computable without real DIY/campus data — see `lib/reporting.ts`) |
| `CostLedgerEntry` | FR-I06/I07 | Messaging + AI spend, by category |
| `ProcessioSyncLog` | FR-F05 | Every sync attempt to the mocked Processio endpoint |
| `SystemConfig` | NFR-26 | Runtime-editable feature flags/caps/allow-lists |
| `InteractionSession` | user feedback (not a BRD item) | One row per burst of activity: message count, AI-classified sentiment, a rolling summary, and a snapshot of profiling fields captured — the basis for the admin Leads page and CSV export |

## Data rules
- Timezone / timestamp convention: UTC, Prisma `DateTime` (JS `Date`) throughout.
- Money representation: `Float` in INR for the POC — a real build should move to integer
  paise/cents per BRD financial rigor, logged here as a gap rather than silently fixed.
- Soft vs hard delete: nothing is soft-deleted yet; consent/attribution are designed to be
  immutable by convention, not by a DB trigger (tech-debt: worth a real constraint before
  this is anything but a demo).
- Uniqueness and natural keys: `Contact.waId`, `Asset.code`, `ClickRecord.clickToken`,
  `Message.metaMessageId`, `HandoffToken.token`, `MessageTemplate.name` are all unique.

## Migrations
No migration history yet — the POC uses `prisma db push` (schema-sync, no migration
files) rather than `prisma migrate dev`, since there's no prior schema to migrate from and
no other environment to keep in sync yet. Move to `prisma migrate dev` the moment a second
environment (e.g. a real staging DB) needs to track schema changes over time.
