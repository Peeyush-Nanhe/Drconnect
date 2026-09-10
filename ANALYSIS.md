# Source analysis and consolidation decisions

## Inputs analysed

1. `MyDox-IT-Handover-Package.zip` — release/security/product guidance
2. `care-connect-hub-source.zip` — older but richer Care Physician/RMO UI and workflow
3. `CareConnect_source_2026-09-06.zip` — newer application and newer Supabase migrations/admin modules

## Base selected

`CareConnect_source_2026-09-06.zip` was selected as the base because it contains the newer database history and product work: Mental Wellness, coordinator flow, locum control room, Care Physician duty portal, physiotherapy admin/patient workflows and push infrastructure.

The older source was not discarded. Its strongest unique area — the Care Physician marketplace profile/matching workflow — was recovered and rebuilt as modular files over the newer staffing backend.

## Guidance findings applied

- Kept Supabase as the authoritative backend.
- Removed the hardcoded external MyDox Supabase form-capture URL/key from `MyDoxFull.jsx`.
- Local form capture now writes to this application's `form_submissions` table with RLS.
- Recovered the earlier security migration that scopes legacy role-checking policies to authenticated users.
- Removed the vendor-specific Vite/TanStack config wrapper and configured standard Vite/TanStack/Tailwind plugins directly.
- Recovered and normalized the Capacitor Android shell and unified its application ID.
- Preserved the existing Mental Wellness safety routing and newer admin modules rather than regressing to the older source.

## Codebase comparison that changed the merge plan

The handover text described the Care Physician portal as local-state-only. That was true for the older build, but the September source already contains persistent `staffing_jobs`, `staffing_assignments`, feedback and attendance migrations. Therefore the consolidation uses the September staffing tables instead of creating a parallel job system.

What was still missing was the richer physician profile and safe matching layer. The new `care_physician_profiles` table and React module add that layer to the existing staffing system.

## Care Physician safety and concurrency design

Client-side ranking is useful UX, but mandatory requirements are also enforced in PostgreSQL triggers so a modified client cannot bypass them.

A physician cannot accept a duty if:

- the physician profile does not exist or is offline;
- minimum experience is not met;
- the required qualification is not met;
- any required procedure is missing;
- the duty is ICU/gated and registration verification is pending;
- the duty is ICU/gated and no critical-care procedure capability is present;
- the job is closed/filled or capacity has already been reached.

The `claim_staffing_job(uuid)` function locks the staffing job row before acceptance. This makes the final-slot operation atomic and protects the "first accept wins" workflow from ordinary race conditions.

## Credential verification

A physician cannot set `registration_verified` through the normal client. A trigger protects this field. The new `/admin/credentials` screen uses an authenticated admin check plus the server-side Supabase admin client to approve/revoke registration verification.

Registration verification should be understood as the licence/registration gate only. Procedure capabilities remain physician-declared until evidence-upload/per-procedure verification is implemented.

## Authentication / privilege model corrected

The September UI allowed a new user to select provider or facility and then immediately tried to open that dashboard, while the database was already designed not to trust self-claimed privileged roles. That created both a security ambiguity and RLS write failures.

The consolidated build resolves this with `account_role_requests`:

- signup always grants only patient privileges;
- provider/facility selections become pending requests, including the requested dashboard subtype;
- super-admin approval in `/admin/users` grants the actual role;
- existing approved providers can still resolve their older stored profile/dashboard subtype;
- the auth UI no longer contains hardcoded one-click demo account credentials;
- the signup trigger no longer auto-grants admin/super-admin based on hardcoded email addresses.

A manual owner bootstrap template is provided at `supabase/manual/BOOTSTRAP_SUPER_ADMIN.sql`. On an existing database, any demo admin users created by an already-applied older migration must still be disabled/deleted explicitly before production; the new migration does not silently remove accounts.

## What remains intentionally unchanged

`MyDoxFull.jsx` remains a very large legacy component. The guidance recommends treating it as an executable specification and avoiding risky broad visual rewrites. New Care Physician work is split into small modules, but a full decomposition of the legacy file should be a separate regression-tested refactor.

The Lovable MCP package remains because the newer source contains an actual MCP integration. The Lovable-specific Vite config wrapper was removed.

## Native/mobile note

The app contains TanStack Start server functions. A static Capacitor WebView does not itself provide those server endpoints. For the first live validation, deploy the React/TanStack web application with Supabase. Native packaging can follow after deciding whether to keep hosted server APIs, move relevant server functions to Supabase Edge Functions, or implement another production mobile API layer.

## Verification performed in this workspace

- Compared source file sets and migration histories between both code ZIPs.
- Confirmed the newer source already contains staffing persistence and dialysis/medical-tourism database support.
- Added the missing legacy RLS hardening as a current migration.
- Added safe role-request signup/approval and removed hardcoded demo-login UI/automatic demo admin assignment from the final auth path.
- Removed the hardcoded external Supabase capture URL/key and scanned the source for the known external endpoint/key markers.
- Updated generated Supabase TypeScript definitions for the newly added tables/column/RPC.
- Syntax-transpiled the React/TypeScript source with TypeScript 5.8.3.
- The initial offline package installation was blocked. That was subsequently resolved: dependency installation, TypeScript, lint, 19 local database tests and the client/server build now pass. See `BUILD_STATUS.md` and `IT_TEAM_HANDOVER.md` for current results and remaining work.
