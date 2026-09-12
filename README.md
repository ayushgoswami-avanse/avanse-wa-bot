# Avanse SEC — WhatsApp AI Counsellor (POC)

A working proof-of-concept of the Avanse Student Experience Center's WhatsApp-first AI
counsellor, built to run on free/open-source infrastructure (Render + Postgres) instead
of the BRD's AWS/Bedrock target stack, for a management demo.

Full spec: `SEC Whatsapp/Avanse_SEC_BRD_v1_0.docx`, `Avanse_PRD_v8_0_WhatsApp_Dual_Journey (1).docx`.
Harness / architecture / decisions / tech-debt: `.ai/` (start at `.ai/00-INDEX.md`).

## What's here
- Real Meta WhatsApp Cloud API channel **and** a web chat mirror (no phone/Meta account needed)
- AI counselling: Anthropic Claude for orchestration, Google Gemini invoked as a tool for
  live search grounding — never as the conversation model (matches the BRD's architecture)
- Full attribution (QR → redirect → click token → 4-tier resolution), consent ledger, age
  gate, dual-journey progressive profiling, Tier 1 indicative eligibility, signed DIY
  handoff, a send governor enforcing window/template/cap/quality/spend rules, human
  handover, and admin + agent consoles
- Two systems that don't exist in this environment (DIY BRE, Processio LOS) are mocked
  behind real HTTP contracts, not skipped — see `app/api/mock/*`

## Quick start
```
npm install
cp .env.example .env      # fill in real values — see below
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```
Then open http://localhost:3000/chat (web mirror, works immediately) or
http://localhost:3000/login (admin/agent console — see `SEED_ADMIN_EMAIL`/`PASSWORD` in `.env`).

**Note:** `prisma generate`/`db push` download a small platform binary from
`binaries.prisma.sh` — if you're behind a corporate proxy that blocks executable
downloads, this step needs to run somewhere without that restriction (it works fine on
Render's build servers regardless).

## Deploy to Render
`render.yaml` is a Render Blueprint — in the Render dashboard, "New +" → "Blueprint",
point it at this repo, and fill in the `sync: false` env vars (API keys, Meta credentials)
when prompted. See `.ai/engineering/ops.md` for the full runbook, including the one-time
Meta developer app setup for the real WhatsApp channel.

## What's simplified for a POC (and why)
See `.ai/engineering/tech-debt.md` for the full, honest list — no automated tests yet,
in-memory (not Redis) debounce/pub-sub, a heuristic (not ML) propensity score, mocked
external systems, and a single-session (no SSO) console login are the main ones.
