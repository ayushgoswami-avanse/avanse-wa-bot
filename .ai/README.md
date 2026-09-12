# `.ai/` — Project Memory

This directory is the AI agent's only persistent memory. **Commit it to version control.**

- `00-INDEX.md` and `state.json` are Tier 0 — read on every turn. Keep them small and true.
- `memory/decisions.md` and `memory/session-log.md` are append-only.
- Superseded documents move to `archive/`, they are not deleted.

Humans can edit anything here. If you do, tell the agent — or just run `SYNC` and it will
reconcile docs against the code.

Full protocol: `../AI-HARNESS.md`
