# Doctor Home Visit acceptance report — 10 September 2026

**The enabled synthetic staging scope passed end-to-end acceptance.** Real-patient use, production/mobile release and the disabled integrations below are not complete. Final hosted run completed at `2026-09-10T14:40:08.382Z`.

## What is delivered

Self-booked Doctor Home Visit Now and Later use one real Supabase appointment ID. The implemented journey includes complete address/contact/reason, reviewed server quote and visit-linked consent, explicit doctor acceptance, both dashboards, travel, patient-issued check-in, clinician-authored signed encounter, follow-up, completion, separately recorded cash receipt, cancellation, disputes and true rescheduling. The original booking survives a failed, declined or expired replacement.

The existing React/TanStack application and Supabase Auth/RLS are retained. Focused modules intercept Doctor Home Visit before the legacy simulation. Clinic/video and other services keep their existing entry points. Shared capacity checks include travel, active home visits and relevant dispatch/staffing/surgery/physio assignments. Overdue travel is admitted against actual server time; agreed appointment timestamps remain unchanged.

**Real-patient access remains off.** Synthetic test participants and synthetic cash permission exist only during the hosted harness and are removed afterward. This is an implemented and tested staging scope, not a production or Android release.

## Build and environment

- Intake commit: `f22b6e74ff0ae40729c622f04e5cd1878bbecaeb` on `Dev`. All twelve commits ahead of `origin/main` were preserved.
- Tested application/schema source SHA-256: `0b154beb425bb35cbe0cd7f02e59e1d1a503b452a79320f2baa65c7f5cac13a7`. The hash covers `src`, staging migrations and package/lock files, allowing the tested working tree to be identified before its final commit. Test logs also record the intake Git commit; that commit alone does not contain this implementation.
- Local: macOS, Node `26.0.0`, npm `11.12.1`, PGlite, TypeScript, ESLint, Vite/TanStack build.
- Hosted: explicitly approved MyDox Staging `pyrlvjeectjikvfksukb`, real Supabase Auth and PostgREST, independent authenticated sessions for races.
- Browser: isolated headless Chrome contexts against `http://127.0.0.1:8081/home-visits`, using the deployed staging database/API. Patient timezone `America/New_York`; doctor timezone `Asia/Kolkata`.
- Browser reloads and independent API logins were tested. These are not physical-device, installed-APK, closed-app notification or hosted-production-frontend tests.

## Executed checks

| Check | Result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS — locked dependency installation; no lockfile change |
| `npm run check` | PASS — TypeScript, ESLint (0 errors, 137 warnings), 20 core database + 28 home database + 2 worker + 6 notification database tests, production build |
| Existing staging Auth/API suite | PASS — 12 checks, including independent-session staffing claim regression |
| Home-visit hosted API suite | PASS — 13 checks, including eight independent-session races, overdue travel and audited replacement expiry |
| Browser through real staging API | PASS — seven milestones spanning Now and Later, rejected-form correction, explicit acceptance, reloads, timezone agreement, secure arrival, signed record, cash receipt, rescheduling and cancellation |
| Scheduler endpoint without configuration | PASS — local POST returns 503 and no job work is performed |
| Staging history and cleanup | PASS — all ten migration versions/source checksums match; zero synthetic home users, original-suite users or pilot participants remain |

Only documentation/evidence changed after the final source fingerprint was tested. Detailed local output is `/tmp/mydox-home-check-final.log`; hosted output is `/tmp/mydox-existing-hosted-private.log` and `/tmp/mydox-home-hosted-final.log`. These private transient logs are not required to read the committed outcome record.

The original staging commands stopped before fixture creation because the preserved `.env` has an empty server key. They were then run through `scripts/run-staging-tests-private.mjs`, which passes the existing staging credential from the authenticated CLI to the child process in memory. No credential was printed, saved, reset, placed in the browser or added to `.env`.

Machine-readable individual test outcomes, build identifiers and blocked integrations are recorded in [acceptance-2026-09-10.json](acceptance-2026-09-10.json). Local SQL tests establish transaction/permission behavior; only the hosted independent-session tests are race evidence.

## Required acceptance gates

`PASS` applies to the stated executed scope. Split statuses identify a disabled or unexecuted portion of a larger requirement.

| Gate | Status | Evidence and limit |
| --- | --- | --- |
| 1. Publish, save pending, explicit confirmation | PASS | Local SQL and hosted provider configuration, quote/create and acceptance; browser saves and confirms both paths. |
| 2. Immediate persistence, no automatic acceptance | PASS | Complete address/contact/reason and consent persist; no emergency request is created; browser waiting remains pending. |
| 3. Same identity/details after restart | PASS | Independent patient/doctor API sessions and browser reloads retain canonical ID, address, fee, status and saved records. Physical-device restart remains gate 17. |
| 4. Role, verification, coverage and dependent denial | PASS | Direct SQL/API actor checks; patient/unapproved/unverified provider rejected; unsupported dependent and out-of-coverage booking rejected atomically. |
| 5. Confidentiality | PASS / BLOCKED | Patient/unassigned-doctor private booking, consent, event and code denial tested. Document sharing/storage is disabled; document-access acceptance is BLOCKED. |
| 6. Scheduled capacity and travel | PASS / NOT RUN | Local clinic/video and buffer regressions; simultaneous hosted same-slot requests produce one reservation. Independent races against every other service's assignment adapter are NOT RUN. |
| 7. Cross-mode and immediate races | PASS | Hosted two-doctor/one-request, one-doctor/two-request and immediate-versus-scheduled races. Overdue starts tested in both orders and concurrent sessions; near-future commitment prevents late admission. |
| 8. Idempotency and response recovery | PASS | Same-key simultaneous submissions return one ID; changed payload and cross-account replay fail. An independent session recovers the saved request after the first response is disregarded. Browser opaque recovery storage is actor-scoped; actual network-packet loss during a physical restart is NOT RUN. |
| 9. Invalid time/coverage/quote/consent | PASS | Local server tests reject past time, blocked day, DND, stale settings/fee, altered client fee, invalid intervals, coverage and missing consent. |
| 10. Failure integrity | PASS | A real failing consent-write trigger rolls back appointment/offers/reservation/events; direct action failure preserves state. Browser rejected submission preserves an editable form and corrected submission succeeds. |
| 11. Cancellation/expiry races | PASS | Hosted independent-session accept/cancel and expired accept/worker races; confirmed visits survive expiry. Terminal transitions/version checks prevent resurrection. |
| 12. Offline and timezone | PASS | Immediate Offline retains future availability/appointments; NY patient and Kolkata doctor display the same provider-time appointment instant. |
| 13. Arrival integrity | PASS / NOT RUN | Server-issued code, hash-at-rest, patient-only retrieval, well-formed incorrect and cross-visit codes, persistent failed attempts, expiration, consumption and replay denial tested. Browser uses explicit doctor travel and patient acknowledgement; GPS/location spoof testing is NOT RUN because location is disabled. |
| 14. Clinical completion and persistence | PASS | Assigned clinician and acknowledged arrival required; no completion without nonempty saved summary; signed original plus reasoned amendments; restart persistence. Revoked credentials block a new consultation while already-started care remains documentable. |
| 15. True rescheduling | PASS | Failed/declined/expired replacement preserves original, releases replacement and rejects stale acceptance. Successful acceptance atomically swaps capacity. Browser confirms accepted replacement and cancellation across both dashboards. |
| 16. Payment integrity | PASS / BLOCKED | Authorised exact-amount cash collection, unpaid clinical completion, denied patient settlement, duplicate receipt rejection and truthful receipt labels tested. Gateway orders, signed/duplicate/late callbacks and verified refunds are BLOCKED; unsupported action denial is not gateway verification. |
| 17. Device/notification reliability | BLOCKED | Local worker tests cover leases, retries/backoff, stale acknowledgements, missing/partial transport and exhausted jobs. Open-app refresh/reload works. No attached Android device, valid configured push credentials, deployed scheduler or closed-app receipt evidence. Location sharing is disabled. |
| 18. Other-service regression | NOT RUN (full acceptance) | Original Auth/RLS/staffing suites, clinic/video capacity regressions, generic null-home-state regression, typecheck/lint/build pass. Full ambulance, surgery, diagnostics, nursing, therapy and RMO browser/device journeys were not executed; these are not claimed passed. |

## Deployment and recovery evidence

All ten versions in [staging/README.md](../../staging/README.md#applied-migrations) are deployed. Four additive corrective migrations implement the secured lifecycle (`183100`), hosted grants/indexes (`183200`), actual-time travel capacity and consultation authorization (`183300`), and audited replacement expiry (`183400`). Exact SHA-256 values are recorded in the JSON evidence. The compatible frontend and server passed the local build and browser journey; no production frontend hostname was deployed or verified.

Applied historical migrations and `staging/source-manifest.json` are unchanged. New migration files were created through the CLI and ordered after the inherited `183000` version before application. The two previously unapplied historical files were deployed in the same transaction as the secure replacement, so their unsafe intermediate RPCs were not exposed between commits.

Diff review found one extra blank line at the end of applied migration `183200`. It is retained to preserve the verified source checksum; the whitespace check passes with only `blank-at-eof` excluded. The changed-file credential-literal scan found no secrets. `.env`, Supabase telemetry, dependencies and generated build output are excluded from the commit.

A completed Supabase physical backup from 10 September 00:43 UTC was verified. Private scoped snapshots were taken before each rollout under `/tmp/mydox-home-visits-backups` with restricted permissions. A full CLI `pg_dump` was blocked by missing Docker/Podman; the scoped snapshots are not claimed to be a complete tested restore. No database reset, history repair, forced push, password reset or unrelated fixture cleanup was performed.

The security advisor reports no errors or anonymously executable elevated RPC warnings. Intentional internal deny-client tables and guarded authenticated business RPCs remain advisory notices; the pre-existing Auth leaked-password-protection setting remains an owner/project follow-up. Details and remediation links are in [OPERATIONS.md](OPERATIONS.md#advisor-review).

## Remaining blockers and owner decisions

| Priority | Remaining work before enabling the relevant scope |
| --- | --- |
| Release blocker | Approve real-patient service coverage/suitability and clinician-reviewed help copy, consent/terms, duration/buffers/hours, acceptance/cancellation/no-show policy, support path and pay-at-visit policy. Production access and global cash permission remain false. |
| Release blocker | Deploy the compatible TanStack frontend/server at an approved origin, configure its Auth redirects and scheduler, and verify the installed Android build and real-phone restart/resume/reconnect behavior. No phone was attached. |
| Release blocker for notifications | Choose/approve a channel and provide working credentials/token registration; test denied permissions, offline/closed app, retry and receipt on the intended device. Polling and an outbox row are not background delivery. |
| Disabled feature | Authorised dependents and private document sharing need relationship/record authorization and private storage. UI/API refuse these operations today. |
| Disabled feature | Coordinator inaccessible-phone override and no-show require approved evidence, narrow authorization and dispute procedures. No universal override or automatic completion exists. |
| Disabled feature | Online payment/refund requires the approved gateway and authenticated callback integration. Cash receipt means recorded collection, not gateway verification; disputes never imply a refund. |
| Regression gate | Execute the full supported-device journeys for other services before a wider release. The inherited non-doctor scheduled-home branch was not a working secured path and now reports unavailable rather than creating a clinic appointment for a home selection; its existing immediate/package paths remain. |

Environment-variable names, state/permission matrix, worker setup and non-destructive recovery steps are in [OPERATIONS.md](OPERATIONS.md). Initial defects and schema mapping are in [PLAN.md](PLAN.md).
