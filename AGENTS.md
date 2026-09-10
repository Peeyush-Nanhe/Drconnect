# MyDox workspace

The user authorized keeping this checkout connected to https://github.com/Peeyush-Nanhe/Drconnect on main.

Before coding, inspect git status and fetch origin. Pull clean fast-forward changes. Preserve unfinished local edits and review divergence before merging. Never force-push or discard user work.

After completing authorized work, run appropriate checks, review the diff, commit completed changes and push to origin/main. Exclude unrelated unfinished edits, secrets, .env, installed dependencies and generated build artifacts. Confirm remote and local commits match before reporting a successful push.

Scheduled sync uses scripts/github-sync.mjs. Do not auto-commit unfinished work. Pull clean fast-forward updates, validate them, and push already completed commits only after checks pass. Notify on a sync, failure or conflict; stay quiet when unchanged.

Product name: MyDox. Android ID: com.mydox.app. Patient doctor-booking behavior is frozen unless the owner explicitly requests a change. Keep real Supabase Auth and RLS.

MyDox Staging is pyrlvjeectjikvfksukb. Only staging/supabase/migrations owns its history. Preserve applied SQL and source-manifest checksums; add migrations for changes. Historical identifiers and owner-selected demo email addresses remain compatibility records.

Run npm run check for TypeScript, lint, 19 database tests and build. Hosted tests use the ignored staging .env via npm run test:staging and remove only their synthetic fixtures.
