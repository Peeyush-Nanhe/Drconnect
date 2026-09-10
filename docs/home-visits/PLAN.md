# Doctor Home Visit implementation audit and plan

Audit date: 10 September 2026. This supersedes the earlier plan's unverified completion claims.

## Baseline and branch

- Active branch at intake: `Dev`, commit `f22b6e74ff0ae40729c622f04e5cd1878bbecaeb`.
- Fetched origin before coding. `origin/main` was `b76486d16e48ce1aaa26af7ad677076847c2fa9c`; it is an ancestor of Dev, with twelve newer commits retained. `origin/Dev` was `7c2d1133d99c85a55301f056d0967636d4a8731b`.
- Tracked tree was clean; untracked `.supabase/` telemetry/traces are unrelated and must remain private and uncommitted.
- Baseline `npm run check`: PASS, TypeScript, ESLint (0 errors, 157 existing warnings), 20 PGlite tests and production build. These tests did not establish confidentiality, concurrency or end-to-end safety.
- Read workspace instructions, README, BUILD_NOTES, staging/README, Android guidance, docs/BOOK_DOCTOR_PLAN and the supplied request. The four separately named historical audit/update documents were not present.

## Environment and schema mapping

Approved staging is **`pyrlvjeectjikvfksukb`**. Management API confirmed MyDox Staging, Mumbai, PostgreSQL 17. Both current browser (`VITE_SUPABASE_URL`) and server (`SUPABASE_URL`) configuration point to it. No key values were displayed or exported.

Android uses `com.mydox.app`. Emulator/USB preview loads the same running TanStack server at the configured development URL. No production hosted origin or installed-device build was verified; a static Capacitor bundle cannot supply TanStack server functions.

| Concern | Actual implementation at intake |
| --- | --- |
| Canonical future/home appointment | `doctor_appointments` |
| Immediate generic dispatch | `care_requests` |
| Future hours, timezone, DND and leave | `provider_availability` |
| Medical registration verification | admin-protected `care_physician_profiles.registration_verified` |
| Trusted account role/subtype | `user_roles`, approved `account_role_requests` |
| Other doctor capacity | `staffing_assignments` / `staffing_jobs`, generic `care_requests` |
| Existing clinical records | Legacy EMR/prescription UI uses demo state; no durable generic medical-record table exists in this migration history. New signed home encounters are visit-linked and do not reuse that demo prescription path. |
| Background transport scaffold | `device_tokens`, `push_deliveries`, `src/lib/push.server.ts` |
| Missing historical names | No `scheduled_appointments`, `scheduled_appointment_events`, scheduling directory or occupancy ledger exists in this checkout |

Remote history at audit contains `20260907094744`, `20260907095735`, `20260907103546`, `20260910131000`. Local `20260910141736_phase_f_reschedule.sql` and `20260910183000_doctor_home_visit_flow.sql` were **not applied**. Preserve all existing migration bytes and the baseline source manifest. Only `staging/supabase/migrations` owns this target.

## Reproduced defects

Serial PGlite reproduction against the original migration demonstrated: missing address/consent and client fees accepted; another patient could read pending private addresses and replay another actor's idempotency key; a patient with no doctor role could accept; the clinician received the arrival code; invalid-code attempts rolled back to zero; empty clinical summary could complete and default to settled.

Frontend inspection found direct inserts followed by best-effort address/consent updates, direct status mutations, client-generated OTP and a `123456` bypass, plus legacy Now simulation/countdown dispatch. Later could display confirmed despite a pending row. Existing newer calendar styling is retained.

## Implementation and acceptance gates

1. Keep `doctor_appointments` as the canonical identity. Add restricted home metadata and RPCs; retire unsafe home RPC access and route doctor/home UI to a focused module.
2. Validate actor/patient authority, approved doctor subtype and registration, configured coverage, fees, timezone, duration, travel, hours/leave/DND, and consent. Store a server quote and atomic actor-scoped idempotency fingerprint.
3. Reserve capacity under one provider lock across appointments and relevant dispatch/staffing assignments. Verify with independent authenticated hosted sessions, not only serial PGlite.
4. Implement explicit confirmation, travel, patient-issued server check-in, consultation, signed record, separate settlement and exceptions. Keep codes and private offer details out of doctor discovery and generic table reads.
5. Persist expiry/outbox jobs, state/version events, rescheduling holds and recovery references; reconcile both dashboards after reconnect/restart.
6. Run local full checks, hosted synthetic Auth/API/race tests, and browser checks. Record unexecuted mobile and integration tests as BLOCKED/NOT RUN. Deploy additive changes only after review, backup and local tests.

## Policy decisions and release gate

Real-patient use stays disabled. Synthetic test participants can be explicitly allowlisted by the staging harness and removed afterward. New timeouts and operating limits are staging proposals, not owner-approved commercial policy.

Unresolved: coverage/service restrictions; doctor fees, buffers and hours; acceptance/cancellation/no-show evidence rules; real-patient consent wording; pay-at-visit approval; notification channel; coordinator check-in exceptions; gateway/refund integration. Do not invent triage criteria, charges, taxes or refunds.

At audit, `FCM_SERVICE_ACCOUNT_JSON` was not valid service-account JSON and `PUSH_DISPATCH_SECRET` was missing or a placeholder. No functional background transport or registered test phone is established. Payment gateway configuration is absent. Background sends and online payment remain disabled.

Final evidence is in [TEST_REPORT.md](TEST_REPORT.md). The state matrix, configuration, deployment and recovery instructions are in [OPERATIONS.md](OPERATIONS.md).
