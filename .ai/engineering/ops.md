# OPERATIONS RUNBOOK

Status: draft
Owner: DevOps / SRE
Updated: 2026-09-12 by staff_engineer - initial POC runbook

## Environments

| Env | URL | Branch | Data | Who can deploy |
|---|---|---|---|---|
| local | http://localhost:3000 | (no remote yet) | local Postgres or a dev Render DB | anyone with the repo |
| render (demo) | https://sec-whatsapp-bot.onrender.com | main | Render Postgres free tier | whoever holds the Render API token |

There is no separate staging WABA number yet (TR-11 calls for one before a real pilot;
this POC uses one Meta test number for everything — acceptable only because it never
carries production traffic).

## Local setup
```
npm install
cp .env.example .env        # fill in real values
npx prisma generate
npx prisma db push          # creates tables from schema.prisma — no migration history yet (POC)
npm run db:seed             # creates the admin user + demo assets/templates/alumni
npm run dev
```

## Configuration
See `.env.example` for the full list with explanations. Highlights:

| Variable | Purpose | Required | Secret? |
|---|---|---|---|
| `DATABASE_URL` | Render Postgres connection string | yes | yes |
| `ANTHROPIC_API_KEY` | Conversation orchestration | yes | yes |
| `GOOGLE_API_KEY` | Search grounding tool | yes | yes |
| `META_WHATSAPP_TOKEN` / `META_PHONE_NUMBER_ID` / `META_APP_SECRET` / `META_VERIFY_TOKEN` | Meta Cloud API test number | yes for the real WhatsApp channel (web mirror works without them) | yes |
| `JWT_SECRET` | Signs handoff tokens and the admin/agent session cookie | yes | yes |
| `NEXT_PUBLIC_BASE_URL` | Builds QR redirect links, the Meta webhook callback URL, and internal service-to-service calls (mock BRE/Processio) | yes | no |

Runtime feature flags/caps (Tier 1 on/off, spend ceilings, quality-rating simulation,
frequency caps, grounding allow-list, propensity sync gate) live in the `SystemConfig`
table, editable from `/admin/settings` — see `lib/config.ts`. No redeploy needed to change
any of them (NFR-26).

## Build and deploy
```
build  : npm install && npx prisma generate && npm run build
deploy : Render web service, see render.yaml (Blueprint) — or connect the repo in the
         Render dashboard and paste render.yaml's env var list by hand.
```
Approval gates: none yet (POC) — every push to `main` would deploy if auto-deploy is on.

### One-time Meta developer app setup (for the real WhatsApp channel)
1. Create a free Meta developer account and app at developers.facebook.com, add the
   WhatsApp product — this issues a free test phone number.
2. Copy the temporary access token, phone number ID, and WABA ID into Render's env vars.
3. Set `META_VERIFY_TOKEN` to any string; use the same string in the Meta App Dashboard's
   webhook subscription config.
4. Point the webhook callback URL at `https://<render-url>/api/webhook/whatsapp`.
5. Under WhatsApp → API Setup, add up to 5 recipient phone numbers to test with (this is
   Meta's free-tier limit before business verification).

## Rollback
```
Render dashboard → Deploys → pick a previous successful deploy → Rollback.
Database: no migration history yet (db push, not migrate) — a schema rollback means
restoring a manual backup, since there's nothing in a real pilot's data worth preserving
in this POC.
```
Time to roll back: ~1 minute (Render redeploy) · Last rehearsed: not yet

## Observability
- Logs: Render's built-in log stream (Dashboard → Logs). No external log aggregation yet.
- Metrics: `/admin` overview page — computed live from the database, not a separate metrics store.
- Alerts: none wired yet (tech-debt — see NFR-24 in the BRD for what a real build needs).
- Health check: `/login` (returns 200 whether or not authenticated).

## Common failures

| Symptom | Likely cause | First check | Fix |
|---|---|---|---|
| Webhook returns 401 | `META_APP_SECRET` mismatch or missing | Render env vars | Re-copy the app secret from the Meta dashboard |
| AI replies never arrive | `ANTHROPIC_API_KEY` missing/invalid | Render logs for `[orchestrator]` errors | Re-check the key; the orchestrator falls back to a generic "having trouble" message rather than crashing |
| Grounded answers never cite sources | `GOOGLE_API_KEY` missing, or the Gemini model doesn't support `googleSearch` | Render logs for `[grounding]` errors | Re-check the key/model name in `.env` |
| Web chat never gets a first message | SSE not connecting before the greeting fires | Browser devtools → Network → `/api/web-mirror/stream` should show an open `EventSource` | See the tech-debt landmine about this race — don't move the greeting trigger |

## Backups
Render's free Postgres tier does not include automated backups — none configured. Not a
concern for demo data; would be a blocker before any real pilot.
