# BUSINESS REQUIREMENTS DOCUMENT

Status: approved
Owner: Business Analyst
Updated: 2026-09-12 by orchestrator - condensed from Avanse_SEC_BRD_v1_0.docx
Confidence: verified

> Full detail lives in `SEC Whatsapp/Avanse_SEC_BRD_v1_0.docx` — this is a condensed,
> harness-native summary, not a replacement.

## 1. Problem statement
Avanse sources a material share of education loan files through DSAs/ed-tech aggregators
at a flat 1.5% of disbursement (~₹60,000 on a ₹40L ticket). The Student Experience Center
(SEC) is a direct-sourcing channel meant to reduce that dependence and build a relationship
with students up to two years before they're creditworthy.

## 2. Business objective
Deliver an AI counsellor over WhatsApp, entered exclusively by QR code, serving two loan
journeys — international student loans and domestic loans (PG/skilling/professional) —
that measurably lowers cost per sourced file versus the partner channel.

## 3. Success metrics
| Metric | Baseline | Target | By when |
|---|---|---|---|
| Acquisition + tech cost per disbursed file | — | Below ₹60,000 | FY29 |
| Contacts acquired (verified wa_id) | 0 | 9,000+ cumulative | FY29 |
| Qualified lead → login | — | Ramp to 30% (partner benchmark 80%) | FY29 |
| Block + report rate; Meta quality rating | — | <0.5%; Medium/High always | ongoing |
| Seven pilot measurements settled | — | All settled | Week 8 of pilot |

## 4. Stakeholders
Product (SEC), Dev partner/SI, Marketing Ops, Compliance, Credit, DIY portal team,
Processio/LOS team, Infosec, Enterprise Architecture. Full RACI in the source BRD §1.3.

## 5. Scope
**In scope (Phase 1):** QR→redirect→WhatsApp acquisition with two-code attribution; AI
counsellor with proprietary RAG + routed Google grounding; dual journey (international +
domestic); consent ledger, age gate, progressive profiling; Tier 1 indicative eligibility
("up to" only); signed deep-link handoff to DIY; governed nurture; agent console; admin
console, payout engine, reporting.

**Explicitly out of scope (Phase 1):** vernacular languages; full loan application/KYC
(stays in DIY); collection/servicing on the number; co-applicant parent journey (open);
domestic P&L; B2C subscription/B2B lead resale (removed); native mobile app.

## 6. Constraints
- WhatsApp interface limits: 3 reply buttons, 10 list rows, 1,024-char messages.
- Outside the 24h service window, only pre-approved templates may be sent.
- One WhatsApp account per phone number — no co-applicant parent in the student's thread.
- Attribution must survive an editable prefilled message → two-code design is mandatory.
- Utility template pricing is expected to change 1 Oct 2026 — cost model assumes chargeable.

## 7. Assumptions
Meta approves the WABA/business verification within pilot lead time; marketing/utility
templates approved as submitted; domestic BRE ruleset delivered in parallel by DIY (until
then, domestic runs without Tier 1); Avanse's Google Enterprise relationship permits
Search Grounding at/below modelled rate; partner-channel conversion rates (80%/45%/50%)
are representative of steady state.

## 8. Risks
See the source BRD's risk table and `SEC Whatsapp/SEC_Business_Case_v13.xlsx`'s Risk
Register sheet (14 risks, R-01..R-14) — quality-rating spiral, single-channel dependency,
unvalidated chat-start rate, and SEC lead quality vs. partner leads are rated Critical.

## 9. Do-nothing option
Avanse continues paying ~₹60,000/file in partner commission indefinitely, with no direct
top-of-funnel relationship with students before they're creditworthy.
