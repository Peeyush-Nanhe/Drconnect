# Home visits: configuration, permissions and rollout

## Enabled scope

The code supports self-booked Doctor Home Visit Now and Later, real doctor acceptance, travel, patient acknowledgement, signed encounter and separately recorded cash settlement for explicitly allowlisted synthetic staging participants. Real-patient access defaults to **off**. Do not enable it until the owner approves policy and the required device/integration acceptance tests pass.

There is one appointment ID in `doctor_appointments`. Consent, quote, home lifecycle metadata, encounter, settlement, events and reschedule holds reference that ID. No emergency `care_requests` row is created by this flow. Generic clinic/video and other service screens retain their own paths, with shared capacity guards against home commitments.

## Configuration and decisions

| Setting | Source and behavior |
| --- | --- |
| Real-patient access | Service-only `home_visit_policy.real_patients_enabled`, default false |
| Synthetic access | Service-only `home_visit_pilot_participants`; authenticated test-domain users only while real access is off |
| Doctor authorization | Trusted provider role, approved doctor/Care Physician subtype and verified registration; capability claims alone are insufficient |
| Coverage | Doctor-configured six-digit pincodes; manually entered address, no invented GPS position |
| Hours and leave | Existing `provider_availability.working_hours`, `blocked_dates`, timezone and DND |
| Immediate dispatch | Existing online state; offline does not remove future appointments |
| Fee and currency | Doctor-published settings, snapshotted in a server quote; changed quote/settings require review |
| Consultation/travel | Configured duration and before/after buffers reserve full capacity; no route distance or ETA is fabricated |
| Lead/horizon/acceptance | Explicit settings supplied by doctor; proposed staging limits, not commercial policy |
| Consent | Version in `home_visit_policy`; synthetic proposal text, atomically linked to actor, patient, scope and server timestamp |
| Arrival | Patient-only server-generated six-digit code, hashed with visit and salt, ten-minute expiry, five persistent failed attempts, reissue cooldown and cap |
| Cancellation | Staging proposal permits participant cancellation with reason before arrival; no automatic fee or refund |
| Expiry | Persisted acceptance deadline checked during acceptance even if scheduler is delayed; worker releases pending reservations |
| Cash | Separate service-approved policy or synthetic settlement allowlist; assigned doctor records actual cash matching agreed amount/currency |
| Online payment/refund | Disabled; no approved gateway, callback verifier or refund integration |
| Background notifications | Default disabled; optional push jobs require valid FCM credentials, hosted worker and test-device acceptance |
| Family/delegation | Disabled until backend relationship and resulting record-access authorization are approved and implemented |
| No-show / coordinator override | Disabled pending evidence, authorization and dispute policy; no universal check-in override |
| Documents / prescriptions | Optional document sharing is disabled pending an authorized private-storage path. Legacy prescription composer is demo-only; no automatic prescription is created. Signed home encounter and follow-up are persisted independently. |

The quoted fee has no invented tax, travel surcharge or refund rule. Pool offers contain only doctors matching the reviewed fee/currency/duration. Named requests retain the selected doctor. A replacement address requires a fresh supported coverage/quote/consent workflow; accepted addresses cannot be silently edited.

## State and permission matrix

Every mutation checks the authenticated actor, persisted state and expected version in the database. Events use server timestamps; payment is a separate record.

| Action | Permitted actor and precondition | State/capacity effect | Notification event |
| --- | --- | --- | --- |
| Create | Patient, valid quote/address/consent and actor-scoped idempotency key | Pending; named capacity reserved with buffers; pool awaits atomic claim | Requested to patient and eligible offers |
| Accept | Invited eligible doctor, pending and before deadline | Confirmed; claims doctor under shared provider lock; removes availability of competing offer | Acceptance to participants and unavailable notice to candidates |
| Decline | Invited doctor, reason | Declines their offer; final/named decline terminates and releases reservation | Decline |
| Cancel | Patient or assigned doctor before arrival, reason and current version | Cancelled; releases capacity and holds, invalidates check-in | Cancellation |
| Expire | Service-only worker; still pending and deadline elapsed | Expired; releases pending capacity, cannot cancel confirmed visit | Expiry |
| Start travel | Assigned doctor, confirmed, within travel window, no other active visit and room for actual travel/consultation from server time | En route; active visits remain blocking until finished; overdue visits retain agreed time in history | Travel started |
| Report arrival | Assigned travelling doctor | Doctor-reported arrival only; no patient acknowledgement implied | Arrival reported |
| Verify arrival | Assigned doctor supplies active patient-issued code | Records patient acknowledgement; consumes code once | Patient arrival acknowledged |
| Start consultation | Currently authorised and registration-verified assigned doctor after acknowledgement | In consultation; care already started remains documentable if credentials are subsequently revoked | Consultation started |
| Save encounter | Assigned consulting doctor, nonempty clinician-authored summary | Signs durable encounter; does not mark paid | Encounter saved |
| Amend encounter | Assigned clinician, amendment and reason | Preserves original signed text and appends amendment | Amendment |
| Complete | Assigned consulting doctor with saved encounter | Completed; releases active capacity; settlement remains independent | Completed |
| Record cash | Assigned doctor, completed visit, cash enabled, exact amount/currency | One recorded collection/receipt; never gateway-verified | Settlement recorded |
| Raise dispute | Patient or accepted doctor, reason and current version | Opens a support dispute; preserves visit/settlement history and creates no refund | Dispute opened |
| Propose replacement | Patient, confirmed future visit and revalidated quote/consent | Original preserved; temporary replacement hold | Reschedule requested |
| Accept replacement | Assigned doctor, unexpired valid hold, current settings/capacity | Atomically swaps original reservation | Reschedule accepted |
| Decline/expire replacement | Assigned doctor with reason / service worker | Removes replacement hold; retains original | Reschedule declined / hold expiry |

Unaccepted offers disclose locality/pincode, fee and time only. Full address, contact, reason, signed records and events are visible only to the patient and accepted doctor. Arrival code/hash are excluded from normal doctor/table APIs. Support access requires an explicit `home_visit_operations_members` grant; an admin label alone does not grant unrestricted clinical or credential access.

## Environment variable names

Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

Server: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Optional server notification/scheduler: `FCM_SERVICE_ACCOUNT_JSON`, `HOME_VISIT_JOB_SECRET`. Existing generic push endpoint uses `PUSH_DISPATCH_SECRET`. Local command tooling can use `SUPABASE_CLI_BIN`; the browser test app URL override is `MYDOX_TEST_APP_URL` (Chrome CDP uses port 9333). Android preview uses `MYDOX_ANDROID_PREVIEW`.

Never prefix server secrets with `VITE_`. Preserve `.env`; commit only `.env.example`. Supabase traces and telemetry under `.supabase/` are ignored.

## Deployment and recovery

1. Confirm `pyrlvjeectjikvfksukb` and its history. Run `npm ci`, `npm run check` and inspect all SQL. Existing migration/source-manifest bytes must not change.
2. Verify a completed Supabase physical backup. The audit found the 10 September 00:43 UTC backup complete. The scoped pre-change snapshot was saved privately outside Git; a full `pg_dump` was blocked by missing Docker/Podman. The scoped snapshot includes affected rows and schema metadata, excludes Auth users/credentials, and is not a tested full restore.
3. `node scripts/backup-home-visits-staging.mjs /tmp/mydox-home-visits-backups --run` creates a new scoped snapshot. Use the configured CLI binary when `supabase` is not on PATH.
4. `node scripts/prepare-home-visits-deployment.mjs` checks the audited rollout prefix and prepares `/tmp/mydox-home-visits-deployment.sql` plus hashes. It performs no DDL. Its transaction applies only the reviewed pending files, recording each exact source in the migration ledger. It recognizes the initial four-version baseline, seven/eight/nine-version intermediate rollouts and completed ten-version history; unexpected histories stop. History/count/checksum guards prevent replay and reject drift even after the rollout is complete.
5. After review and successful local tests, execute that artifact against the explicitly selected staging project. Do not apply `20260910183000` separately. Reload the PostgREST schema and verify every recorded source hash. Do not use root migrations or migration repair to hide mismatch.
6. Build the compatible TanStack frontend/server and run hosted synthetic checks: `npm run test:staging`, `npm run test:home-visits:staging`. The latter removes only its generated users and records. If the preserved `.env` has no server key, an authenticated operator can use `node --env-file=.env scripts/run-staging-tests-private.mjs existing` or `home --browser`; the runner obtains the existing staging credential into process memory and passes it only to the test child, without printing/saving it or editing `.env`. Browser testing requires the development server (the harness imports its Auth client), an isolated CDP Chrome instance, and uses the real hosted staging API.
7. Schedule authenticated POST requests to `/api/internal/home-visits/jobs` using `Authorization: Bearer <HOME_VISIT_JOB_SECRET>` (32+ characters) only after a hosted scheduler is approved. The endpoint runs expiry and leased outbox jobs. Missing configuration returns 503; invalid authentication returns 401. Never put the secret in a URL.
8. Background push remains disabled until credentials, token registration, notification permission, retries and closed-app receipt are verified on an approved test device. A queue row is not a send; an FCM acceptance is not confirmed delivery. Transient send failures can be retried; consumers should deduplicate the supplied event ID. Exactly-once external delivery is not claimed.

Operational rollback is to stop new home bookings/dispatch and disable the gate, preserve existing records and use an additive forward fix. Do not drop clinical/settlement history, rewrite applied SQL, reset the database or restore an old backup over unrelated newer data. Any physical restore is a separate owner-reviewed recovery action.

No production hostname, scheduled worker, store release or installed phone is established by this local change. Capacitor preview requires the running TanStack server; deploying a static bundle alone is insufficient.

The inherited non-doctor scheduled home branch had no working secured backend; it now reports unavailable instead of saving a nurse/therapist home selection as a clinic appointment. Immediate/package service paths are preserved. Full device regression of those services remains a separate acceptance gate.

## Advisor review

After the hosted permission follow-up: zero security errors and zero anonymous security-definer warnings. Fifteen RLS-without-policy informational notices are intentional: clients have no direct grants on those internal home tables and only guarded RPCs may access them. Twenty-six authenticated security-definer warnings cover the deliberately exposed atomic business/authorization RPCs and inherited helpers; their actor checks and grants were reviewed. The existing leaked-password-protection warning is a project Auth setting outside this change.

- [Restricted elevated RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [RLS tables without client policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Password protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

Performance advisors show no missing home-visit/doctor-appointment foreign-key indexes. Remaining notices include inherited RLS evaluation/multiple-policy patterns and unused indexes in a small staging database; unused indexes are not removed merely because the pilot is new.
