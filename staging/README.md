# MyDox staging database

This directory owns the migration history for **MyDox Staging**, project `pyrlvjeectjikvfksukb`, in Mumbai (`ap-south-1`) under `kunal110284-sys's Org`. The owner approved the quoted $10/month project charge on 2026-09-07.

## Applied migrations

| Version | Migration | Purpose |
| --- | --- | --- |
| 20260907094744 | careconnect_fresh_baseline | Clean schema from 64 source migrations; no Auth accounts |
| 20260907095735 | restrict_staging_function_access | RPC grants, patient-scoped family plans, coordinator approval |
| 20260907103546 | rename_seed_hubs_mydox | Rename eleven branded hubs while preserving IDs |
| 20260910131000 | book_doctor_for_later | Canonical doctor appointments and scheduling RPCs |
| 20260910141736 | phase_f_reschedule | Historical cancellation/rescheduling RPCs; hardened by later migrations |
| 20260910183000 | doctor_home_visit_flow | Historical home extension; unsafe RPC grants retired in the same rollout transaction |
| 20260910183100 | secure_home_visit_lifecycle | Gated home booking, consent, shared capacity, check-in, records and settlement |
| 20260910183200 | home_visit_hosted_permissions | Explicit inherited grant revocation, indexes and bounded shared slot discovery |
| 20260910183300 | home_visit_active_capacity | Real-time admission for overdue travel; one active visit; recheck credentials before consultation |
| 20260910183400 | home_visit_hold_expiry_audit | Scoped replacement expiry preserves original, records version/event/outbox and rejects stale acceptance |
| 20260912063350 | post_consultation_chat | Synthetic-only canonical home-consultation chat, atomic sends/debits, receipts, prescription requests and disabled notification outbox |

All are deployed and immutable. The local CLI configuration ID `mydox-staging` is distinct from the hosted project reference. Link metadata under `.temp` is ignored.

Post-consultation chat has an empty synthetic allowlist and is disabled for real patients. The full module remains incomplete pending policy, clinical-completion and external-integration decisions. See [implementation status](../docs/post-consultation-chat/IMPLEMENTATION_STATUS.md); this staging schema deployment is not a reduced-scope product release.

The home-visit rollout keeps real-patient use disabled. See [home-visit operations](../docs/home-visits/OPERATIONS.md) and [acceptance evidence](../docs/home-visits/TEST_REPORT.md) for enabled scope, private test credentials, exact validation and unresolved release gates. Do not apply the historical home extension alone.

The root `supabase/migrations` history is preserved for provenance and existing-database analysis. It is **not** the history of this staging project. Do not push it into staging or replay the baseline into an existing application database.

The baseline requires an empty public schema and no Auth users. It includes 64 source files through `20260907094411`, excluding:

- `20260704083408_d80d0ccf-470a-4694-be11-0421febd259c.sql`: a privileged grant tied to a source-project account UUID.
- `20260708055928_6c5de206-4aeb-4d41-86a9-c05c2764cd67.sql`: an administrator created with an embedded password. This historical file must not run for a fresh environment.

Enum additions are folded into initial declarations for a single transaction. Historical temporary demo triggers are replaced within that transaction; the baseline inserts no Auth users. The final signup trigger grants patient access and records pending provider/facility requests. Checksums and inclusion reasons are in `source-manifest.json`.

`scripts/build-staging-baseline.mjs` now verifies the deployed artifact against that manifest and refuses `--write`. Add subsequent changes as new migrations here.

## Local app

Use Node.js 22.12+ or a compatible newer release (verified with Node 26.2.0). From the repository root:

```powershell
# Only on a new checkout without .env:
Copy-Item .env.example .env
# Fill the URL, publishable key and server-only secret privately.
npm ci
npm run dev
```

The existing local checkout is configured; preserve its `.env`. The dev command loads server values, and Vite exposes only `VITE_` variables to the browser. Never prefix the privileged key with `VITE_`.

Open `http://127.0.0.1:8081/auth`. Supabase Auth uses that origin as Site URL and permits `http://127.0.0.1:8081/**` redirects. Configure any deployed origin explicitly before testing email redirects.

## Future migrations

Use an installed Supabase CLI (2.116.0 was used here). Run from the repository root and specify the staging work directory on every command:

```powershell
supabase link --project-ref pyrlvjeectjikvfksukb --workdir staging
supabase migration list --workdir staging
supabase migration new describe_the_change --workdir staging
# Edit the new file and test.
npm run test:db
supabase db push --dry-run --workdir staging
# After reviewing the target and pending changes:
supabase db push --workdir staging
```

The initial migrations were applied through the management connector; local filenames match the remote versions. A fresh linked checkout should have no pending migrations. Do not use migration repair to hide an unexplained mismatch.

## Accounts

The owner requested the 20 persistent [demo accounts](DEMO_ACCOUNTS.md). They were created through the Auth Admin API with explicit confirmation, without sending email. Role grants are separate from signup metadata. Real public signups still start as patients and require approval for provider/facility access.

For a future private owner: sign up normally, confirm the email, verify the intended account identity, then use `supabase/manual/BOOTSTRAP_SUPER_ADMIN.sql`. The demo super-admin can review roles at `/admin/users` and medical registration at `/admin/credentials`.

## Tests and limits

```powershell
npm run check
# Creates/removes synthetic fixtures in this exact staging project:
npm run test:staging
```

The core database suite and additional home-visit suites use PGlite and minimal Auth fixtures to check replay, RLS, grants, capacity and lifecycle rules. They do not emulate GoTrue, PostgREST or concurrent sessions. The 12 original hosted checks and separate home-visit checks use real Auth and Data API calls, including independent-session races. They remove only their own generated accounts and records; persistent demo users are kept. See the [home-visit test report](../docs/home-visits/TEST_REPORT.md) for current counts and build identifiers.

Independent SQL checks verify synthetic cleanup. Doctor home-visit browser acceptance uses the local TanStack development server and the real hosted staging API. Production hosting, closed-app notifications and Android release remain outstanding.

## Advisor follow-up

Initial staging deployment security advisors reported **0 errors**, **0 anonymous security-definer warnings**, **10 authenticated security-definer warnings**:

`claim_staffing_job`, `find_provider_user_id_by_name`, `has_role`, `is_admin_user`, `is_hub_surgery_preferred`, `is_provider_available`, `is_provider_in_dnd`, `my_physio_partner_id`, `physio_partner_covers_area`, `provider_matches_surgery_role`.

Some role and atomic-claim helpers need elevated access. Review each caller, data scope, search path and grant before changing it. RLS does not replace a policy/function audit. The home-visit rollout adds guarded RPCs and private client-denied tables; its newer advisor findings are in [operations guidance](../docs/home-visits/OPERATIONS.md#advisor-review). [Authenticated security-definer guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

The initial performance scan, before the second migration, reported 29 unindexed foreign keys, 122 Auth RLS initialization-plan notices, 49 unused-index notices, 27 multiple-permissive-policy notices and one absolute Auth connection-limit notice. Rerun the advisor and assess representative workloads before optimizing. Unused indexes in a fresh database alone are not grounds for deletion.

- [Foreign-key indexing](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [Auth RLS evaluation](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [Multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

AI share-token access/lifetime, optional services and production email delivery still need review. Staging verification does not constitute a production release.
