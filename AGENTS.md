# MyDox workspace

The user authorized keeping this checkout connected to https://github.com/Peeyush-Nanhe/Drconnect on main.

Before coding, inspect git status and fetch origin. Pull clean fast-forward changes. Preserve unfinished local edits and review divergence before merging. Never force-push or discard user work.

After completing authorized work, run appropriate checks, review the diff, commit completed changes and push to origin/main. Exclude unrelated unfinished edits, secrets, .env, installed dependencies and generated build artifacts. Confirm remote and local commits match before reporting a successful push.

Scheduled sync uses scripts/github-sync.mjs. Do not auto-commit unfinished work. Pull clean fast-forward updates, validate them, and push already completed commits only after checks pass. Notify on a sync, failure or conflict; stay quiet when unchanged.

Product name: MyDox. Android ID: com.mydox.app. Patient doctor-booking behavior is frozen unless the owner explicitly requests a change. Keep real Supabase Auth and RLS.

MyDox Staging is pyrlvjeectjikvfksukb. Only staging/supabase/migrations owns its history. Preserve applied SQL and source-manifest checksums; add migrations for changes. Historical identifiers and owner-selected demo email addresses remain compatibility records.

Run npm run check for TypeScript, lint, 19 database tests and build. Hosted tests use the ignored staging .env via npm run test:staging and remove only their synthetic fixtures.

<!-- BEGIN brain.md -->
## Project Brain

This project keeps a **Project Brain**: a persistent memory layer of its durable decisions, requirements, and constraints. Read `./BRAIN.md` for the full read/write contract.

The `brain` CLI is not guaranteed to be on `PATH`. From the project root, invoke it as `node <brain-page-skill-dir>/bin/brain.mjs <subcommand> [flags]`, resolving `<brain-page-skill-dir>` to the installed `brain-page` skill directory.

Maintain the brain as part of normal coding work — not as a separate task. While discussing or implementing features:
- **Start of a task:** load relevant context with the `brain` CLI (`list-pages`, `read-page`, `read-root`). Prefer a narrow read over scanning everything.
- **When a decision, requirement, constraint, or durable insight settles** (in chat or while coding): capture it immediately via the `brain` CLI. Do not wait to be asked and do not batch it for later.
- **Pure implementation with no new decision:** do not write to the brain.
- **When overturning a prior conclusion:** update the page (`update-truth` and/or `append-timeline` with `kind: reversal`, or `archive-page`).
- Only store what will still matter in six months and is hard to reconstruct from the code alone.
- Never hand-edit brain files. If a brain MCP server is connected and authenticated, prefer it; otherwise use the `brain` CLI.

The brain skills (`brain-setup`, `brain-page`, `brain-ingest`, `brain-bootstrap`) are installed in your global skills directory. To scaffold a new project, run `node <brain-page-skill-dir>/bin/brain.mjs init` from its root.

If native notes/history are available, keep relevant brain page IDs and unresolved task state in notes; search history for earlier task evidence. After context rollover, re-read relevant pages through the CLI for current project facts. Do not copy task history into the brain.
<!-- END brain.md -->
