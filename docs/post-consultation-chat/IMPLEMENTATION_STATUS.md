# Post-consultation chat implementation status

Recorded 2026-09-12. **The full requested module is incomplete. Real-patient chat is disabled, and no reduced release scope has been approved.** This implementation is a gated intermediate result. It does not satisfy the founder demonstration or authorise a text-only release.

## Code, tests and deployment

| Delivery category | Recorded result |
| --- | --- |
| CODE WRITTEN | Canonical consultation identity, authenticated text persistence and inboxes, synthetic versioned allowance, actor-scoped idempotency/debits, visible-message read acknowledgement, recovery, prescription request/review/decline and corrected referral review navigation. Actual files, payments, calls, notification delivery and signed prescription issuance remain unavailable. |
| LOCALLY TESTED | Clean `npm ci` and `npm run check` passed in an isolated checkout matching the implementation commit: TypeScript, lint (0 errors; 131 inherited warnings), 20 core database tests, 36 home-visit tests, 23 chat tests (14 SQL + 9 adapter/recovery), and the production Vite/Nitro build. Total: 79 tests. Dependency installation reported one low-severity audit finding; no dependency versions were changed. |
| DEPLOYED | Additive database migration `20260912063350_post_consultation_chat` applied only to approved staging `pyrlvjeectjikvfksukb`. No production application publishing, production migration, native release or complete hosted web/server deployment was performed. |
| END-TO-END VERIFIED | Limited browser/authentication and gated negative-access smoke only; see the evidence below. No eligible patient–doctor exchange across independent devices, genuine file transfer, paid recharge, media call, signed issuance or closed-app notification was verified. |

Repository: `https://github.com/Peeyush-Nanhe/Drconnect`, branch `main`. Starting commit: `2d9d18b4c85e8e8901a0cb7153e001643839e4fb`. Implementation source commit: `88bcec1bcf19b7c2880f5b25386a521021a025e2`. All 18 changed code/test/configuration files were compared byte-for-byte with the isolated candidate before commit. The separate handover documentation commit carries this report; final push confirmation is reported in the handover message. Browser evidence records its working-tree source hashes; the starting commit alone does not identify those uncommitted sources.

Applied SQL SHA-256: `eed6163497724fe93a63b38ed11429aa9365067fa34ceb6316bab0212e6b4abb`. Hosted stored-statement MD5: `e695df8b37c97978cc46e3631c2ce774`, matched to local SQL. The deployment inspection found zero pilot allowlist entries, zero canonical conversations and zero RLS gaps in the newly added chat tables. This is scoped schema inspection, not proof that every existing application table is free of security defects. Historical SQL and source-manifest checksums were preserved.

Final aggregate validation passed: 20 core database tests, 36 home-visit tests and 23 chat tests, alongside TypeScript, lint and the Vite/Nitro build. The original mixed working-tree build also passed the same 79 tests; its two additional lint warnings came from the preserved unfinished review edits. [Validation record](evidence/validation.json) binds the checked source hashes to the implementation commit. Hosted full fixture/race tests remain blocked by missing `SUPABASE_SERVICE_ROLE_KEY` in the approved local test environment. No accounts were reset or privileged users created to bypass that prerequisite.

## Capability status

“Implemented and tested” below always includes the stated test scope. A local serial database test does not establish independent hosted sessions, real Realtime delivery or native-device behaviour.

| Capability | Status | Scope and limitation |
| --- | --- | --- |
| Canonical self-booked home-consultation relationship/episode | Implemented and tested. | Local verified home lifecycle requires assigned eligible doctor, consumed arrival acknowledgement, signed encounter and genuine completion event. Repeated opens do not duplicate episodes or allowances. Staging installed; eligible hosted flow not exercised. |
| Legacy care-request and scheduled clinic/video eligibility | Blocked. | Existing completion/payment fields do not establish a sufficiently trustworthy clinical completion workflow. Those source references are rejected, not granted benefits from client status. |
| Guardian/dependent/delegated chat | Blocked. | No approved delegation and historical-access policy. Dependents are denied; actual caregiver attribution is not invented. |
| Membership, clinician role, least privilege and direct-write protection | Implemented and tested. | Local participant/outsider/admin tests plus limited authenticated staging negative-access checks. Revocation invalidates client request generations; stale successful results cannot restore cleared data. Hosted subscription revocation across two clients remains unverified. |
| Patient/doctor text and durable history | Implemented and tested. | Local authenticated RPC persistence, correct roles and equal participant histories. Actual two-party browser/device exchange and restart remain unverified. |
| Completed-history, home and doctor inbox UI | Implemented but not tested. | Source integration and limited gated browser smoke completed. Eligible consultation-to-canonical-thread/unread flows on two authenticated clients remain untested. Doctor follow-up inbox is outside urgent Online/Offline rendering. |
| Stable pagination, lost-response retry and reconnect recovery | Implemented and tested. | Local adapter and asynchronous recovery tests. A saved result reconciles the original actor/key; isolated own sends do not advance the fetched-history boundary. Actual network interruption/device recovery remains unverified. |
| Read watermark storage | Implemented and tested. | Local per-member monotonic acknowledgement with scoped message sequence. UI acknowledges a visible received saved message; a save is never labelled delivered/read. Actual two-device visibility behaviour remains untested. |
| Expiring presence/typing and recipient-device delivery receipts | Not implemented. | Availability is shown as unknown; no fabricated typing, online clinician guarantee or delivery ticks. |
| Synthetic server allowance and immutable policy snapshot | Implemented and tested. | Test-only 24-hour/25-patient-message fixture, atomic debit, expiry and free clinician replies. It is not an approved commercial policy. |
| Real allowance rules and commercial plan catalogue | Blocked. | Owner decisions A–G remain unresolved. No production benefits, prices or cross-doctor access are inferred. |
| Verified recharge/payment/refund/dispute reconciliation | Blocked. | No approved provider/catalogue/callback integration. Recharge is unavailable; no local credits or pretend purchase success. |
| Gallery, camera, documents, explicit contact/location sharing | Blocked. | Approved storage/quarantine/content validation/scanning/download/finalisation and quota decisions are missing. No descriptive message is presented as a file. |
| Real audio/video calls and provider time accounting | Blocked. | Approved media provider/credentials and admission/metering policy are missing. Calls are unavailable. |
| Transactional notification outbox | Implemented and tested. | Local message/outbox/debit atomicity and privacy-safe references. Jobs are disabled. |
| Notification worker, approved recipient channel and closed-app delivery | Blocked. | No approved chat worker/provider/token-registration/deep-link delivery path. Open-app refresh is not background delivery. |
| Structured prescription request/review/decline | Implemented and tested. | Local patient/clinician authority and audited states; no fee or patient message debit is invented. UI is implemented; eligible two-client use unverified. |
| Signed prescription issuance and AI explanation | Blocked. | Issuance must connect to authorised signed clinical records and amendment audit. AI consent/review integration is absent and no AI response impersonates a doctor. |
| Referral review and separate booking confirmation | Implemented but not tested. | Review & pick slot refetches an authorised referral by immutable ID and patient ownership, then opens ordinary review. Removed eager `booked` updates, immediate `actions.book` and unscoped clinical preselection persistence. Complete provider/slot/price confirmation regression remains unexecuted. Chat-linked referral cards lack an approved canonical referral integration. |
| Follow-up/book-again | Implemented but not tested. | Existing separate booking navigation is preserved; chat does not claim a newly booked appointment. End-to-end regressions on each existing booking route remain unexecuted. |
| Scoped support and retention/reconciliation tooling | Blocked. | Owner-approved retention/access and support delegation policy is missing. Ordinary support/admin status does not grant new canonical clinical-chat access. |
| Audited end-to-end encryption | Not implemented. | Unsupported encryption banners were removed. Authenticated API access and RLS are implemented; they are not an E2EE claim. |

## Acceptance matrix

Allowed results are PASS, FAIL, BLOCKED and NOT RUN. Narrow local passes do not promote an unexecuted complete acceptance case to PASS. Hosted/device results below describe the requested full case unless explicitly qualified.

| # | Requested acceptance case | Local result and evidence | Hosted/device result and remaining gate |
| --- | --- | --- | --- |
| 1 | Genuine eligible completion opens one canonical thread/episode without duplicate benefits | PASS for verified self-booked home consultations: canonical-open/inbox DB tests. BLOCKED for care-request and clinic/video completion. | BLOCKED: no independent eligible hosted fixture run; other completion prerequisites remain unresolved. |
| 2 | Patient sends, correct doctor replies, both retain history after restart and second-device login | PASS for authenticated persistence, role identity and equal participant history in the local DB suite. | BLOCKED: full synthetic patient/doctor sessions and restart/second-device test require approved fixture access. |
| 3 | Homepage, completed history and doctor inbox agree on canonical IDs and unread state | PASS for immutable source adapters, shared inbox mapping and per-member DB watermarks. | NOT RUN for an eligible thread. PASS only for existing authenticated patient's gated/empty inbox and Previous consultations navigation in browser smoke. |
| 4 | Same names, renamed doctors, repeat consultations and dependents never mix identities | PASS for same-name IDs, renamed labels, distinct repeat episodes and denied dependent eligibility. | BLOCKED: family delegation/history scope is not implemented; two-device profile/episode flow not run. |
| 5 | Unrelated users cannot read/send/download/subscribe/prescribe; revocation/session changes close access | PASS for local RPC/RLS/privilege denial and late-result invalidation. PASS for limited authenticated staging arbitrary-open/send/direct-insert/ledger denial. | BLOCKED for complete storage/Realtime/delegation/device matrix. Files and delegated access are disabled, not silently accepted. |
| 6 | Clinician replies use correct identity and remain free when patient quota is exhausted | PASS: local role, last patient unit, expiry and clinician reply tests. | NOT RUN on independent hosted patient/doctor clients. |
| 7 | Period boundaries, genuine eligibility, repeat visits and expiry follow approved server-time rules | PASS for clearly marked immutable synthetic fixture and boundary tests. | BLOCKED: commercial decisions A–G are unapproved. No production free-period meaning is claimed. |
| 8 | Concurrent last-credit sends, duplicates and lost responses cause one debit/message | PASS for local duplicate/payload-mismatch/rollback/reconciliation behaviour. | BLOCKED for actual two-session concurrency. Serial PGlite is not a race test. |
| 9 | Real files reach intended recipient; invalid, unsafe, oversized and cross-thread files fail | NOT RUN: actual attachment pipeline is absent and UI unavailable. | BLOCKED: approved scanner/quarantine/storage/finalisation/download and quota integration. |
| 10 | Real two-device calls and all join/usage/concurrency/disconnect outcomes are accurate | NOT RUN: no simulated call is counted. | BLOCKED: approved media integration and policy/device tests. |
| 11 | Forged, wrong-amount, duplicated, late or replayed payments cannot issue false credits/receipts | NOT RUN: payment/recharge implementation is absent and disabled. | BLOCKED: approved payment provider/catalogue/webhook verification. |
| 12 | Unknown purchases and approved reversals reconcile without losing history | NOT RUN: purchase/refund ledger integration is absent. | BLOCKED: commercial refund/dispute/reconciliation decisions and provider. |
| 13 | Delivered/read are backed by recipient events; presence does not promise clinical response | PASS for local scoped monotonic read watermark; message adapters expose Saved only. | NOT RUN for actual recipient visibility/device acknowledgements. Presence and per-message delivery claims are disabled. |
| 14 | Approved notifications work with app closed and do not leak clinical content | PASS only for local disabled outbox event/recipient references and transactional rollback. | BLOCKED: no enabled notification channel/worker; closed-app delivery not tested. |
| 15 | Prescription request can be appropriately issued/declined; AI/payment cannot approve | PASS for local request/review/decline, role denial, audit and rejecting unsigned issue. | BLOCKED for full acceptance: signed issuing and AI integration missing; two-party UI untested. |
| 16 | Referral review never prematurely marks a service booked | NOT RUN as a complete user-flow test. Source review confirms eager status writes and immediate booking calls removed; authorised ID refetch opens review only. | NOT RUN: provider availability, price review and final confirmation require dedicated regression execution. |
| 17 | Send failure, reconnect, blocked channels, logout and refresh never substitute demo/false success | PASS for local same-key reconciliation, pagination gap recovery, invalidation and no delivered/read inference. PASS for browser authenticated reload/sign-out smoke. | BLOCKED for full interrupted two-client exchange/channel failure matrix; no sample messages are used as fallback. |
| 18 | Booking, home visit, ambulance, groups, records and provider workflows retain working behaviour | PASS for targeted local surgical-role chat regression. All 20 core database and 36 home-visit regression tests passed in the isolated candidate. Source review preserves unrelated entry points and unfinished user work. | NOT RUN for comprehensive browser/native regressions. No blanket booking, ambulance, group, reel or clinical-record device-pass claim. |

## Browser evidence and actual flow notes

The existing marked staging patient was used without changing the account. The browser loaded the actual local web/server application at `http://127.0.0.1:8084`, connected to approved staging. [Browser smoke record](evidence/candidate/browser-smoke.json) records nine narrow PASS checks, capture time, source hashes and scope:

1. Signed-out application redirects to sign-in; existing staged patient authenticates.
2. Staging context reports rollout and unfinished integrations disabled; arbitrary clinical open/send/direct-insert and privileged ledger access are denied.
3. Patient home and chat inbox render a truthful gated/empty state. Previous consultations remains reachable.
4. A completed legacy consultation opens the actual modal with server denial, a disabled composer and no sample messages; [gated modal capture](evidence/candidate/04-completed-item-chat-gated.png).
5. Authenticated reload works; sign-out removes patient navigation.

Actual captures: [signed-out auth](evidence/candidate/01-signed-out-auth.png), [patient home](evidence/candidate/02-authenticated-patient-home.png), [patient inbox](evidence/candidate/02-authenticated-patient-inbox.png) and [Previous consultations](evidence/candidate/03-previous-consultations-gated.png). These are screenshots of the tested local application using staging; they are not evidence of a deployed production application or the completed founder demonstration.

No browser screenshot is a substitute for a completed consultation or a real reply. The allowlist stayed empty and no canonical conversations were generated during this smoke. No real file, recharge, call, issued prescription or background notification was produced.

## Source and preservation notes

- `TwoWayChatModal.tsx` uses authenticated `post-consultation-chat` adapters, a dark modal, explicit pending/Saved/failure/retry states, same-key reconciliation and in-memory drafts cleared on actor/context changes. It removes demo seeding, display-role switching, unprotected broadcasts, name-derived localStorage messages, fake quota/calls/recharge/read/typing and unsupported E2EE copy.
- `MyDoxFull.jsx` connects immutable completed-care-request references, canonical home/doctor inbox rows and completed home history. Name-only hub/lab/referral entry points cannot open a clinical conversation. Static patient/doctor chat rows and local chat countdown promises were retired; group/reel navigation remains separate.
- `MyBookingsOverlay.tsx`, `routes/bookings.tsx` and `home-visits/HomeVisitPanel.tsx` pass immutable source IDs and expose completed home consultations without changing booking creation/completion rules. Existing unrelated unfinished review/navigation/home-visit edits remain outside completed chat work.
- `recovery.ts` and its asynchronous tests address two audited defects: late successful responses after revocation, and unseen-page gaps caused by using a newly saved outgoing message as the reconnect boundary.
- The additive staging migration reuses `chat_messages`, creates guarded canonical episode/allowance/receipt/outbox/request records and preserves separately authorised surgical-role chat. Old ambiguous name-based clinical messages are not reassigned to new relationships.

## Remaining severity and ownership

| Severity | Remaining work | Owner |
| --- | --- | --- |
| Critical release gate | Independent hosted patient/doctor sessions, privacy/permission/concurrency testing, restart/mobile evidence and explicit approved release scope. No real-patient activation before these gates. | Engineering lead, QA, security and product owner |
| Critical release gate | Authoritative clinic/video/care-request completion evidence; guardian/delegation consent and historical access. Do not infer either from names or client status. | Clinical workflow/backend owner and clinical governance |
| High | Commercial policy A–G, immutable approved catalogue, verified payment/callback/reversal accounting, response expectations and availability wording. | Product/finance owner, payments engineer, clinical governance |
| High | Private file validation/quarantine/scanner/finalisation/download pipeline and revoked-access handling. | Storage/security engineer and approved scanning provider |
| High | Server-authorised actual media rooms, reserve/reconcile metering and two-device permission/background tests. | Media provider owner, backend and mobile engineers |
| High | Privacy-safe notification worker, authenticated deep links, registered recipient devices and closed-app provider/device evidence. | Notifications/backend/mobile owner |
| High | Authorised signed prescription issuing, audited amendments and any separately consented/reviewed AI explanation. | Clinical-record/prescribing owner |
| High | Retention, blocking/suspension, caregiver revocation, scoped support and reviewed legacy-message reconciliation. | Privacy/security, clinical governance and product owner |
| High | Existing legacy referral clinical identity/immutability and broader record-access policies need review before attaching legacy referrals to canonical chat; source navigation repair alone does not repair all historical rows. | Referral/backend and security owners |
| Medium | Full actual UI regression across referrals/book-again, clinic/video booking, home visits, ambulance, staffing, groups, reels and records; production Android/server deployment arrangement. | QA and application/mobile owners |

Configuration variable **names only**, deployment arrangements and additive rollback guidance are in [OPERATIONS.md](OPERATIONS.md). Owner decisions are in [BUSINESS_POLICY_DECISIONS.md](BUSINESS_POLICY_DECISIONS.md); source/schema findings and role/action gates are in [PLAN.md](PLAN.md), [INTEGRATION_AUDIT.md](INTEGRATION_AUDIT.md) and [ROLE_ACTION_MATRIX.md](ROLE_ACTION_MATRIX.md). Rollback must preserve clinical history and ledger records and must not replay, rewrite or reset applied data.
