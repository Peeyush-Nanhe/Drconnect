# Post-consultation chat implementation plan and inspection

Inspection date: 2026-09-12. Starting commit: `2d9d18b4c85e8e8901a0cb7153e001643839e4fb`, branch `main`, repository `https://github.com/Peeyush-Nanhe/Drconnect`. Final build, deployment and acceptance results belong in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), not this pre-change inventory.

The owner requested implementation of the whole module. A gated text implementation is an intermediate result; it does not complete attachments, verified recharge, real calls, clinical prescribing or the founder demonstration. Real-patient use and unresolved monetisation must remain disabled. The owner must approve any reduced release scope.

## Inspection and preservation

Read `AGENTS.md`, `README.md`, `BUILD_NOTES.md`, `package.json`, `staging/README.md`, `.env.example`, `ANDROID_STUDIO.md`, home-visit operations and the actual active chat/backend code. `.env` was inspected programmatically for variable names and URL hostnames only; no secret values were printed.

At task start, unfinished local edits existed in `MyDoxFull.jsx`, `MyBookingsOverlay.tsx`, `home-visits/HomeVisitBooking.tsx`, `routes/bookings.tsx`, `routes/home-visits.tsx`, plus untracked `TwoWayChatModal.tsx`. These are team work, not a clean baseline. Preserve unrelated hunks; changes to shared files must be limited to the requested chat entry points and integration repair.

Patient doctor-booking behaviour remains frozen. Home visits, clinic scheduling, ambulance, staffing, groups, reels, records and referrals must retain their navigation. Do not rewrite their migration history or broadly refactor `MyDoxFull.jsx`.

## Historical findings compared with the current checkout

These findings were reproduced by source inspection in the task-start checkout; they are not claims of an executed browser exploit or an assessment of the final implementation.

| Recovered claim | Task-start finding |
| --- | --- |
| Chat opens with doctor name only | Confirmed in `HistoryCompletedActions`, `MedChatOverlay`, `HomeChatsSection`, `DoctorChatsSection` and `DoctorLiveInbox`; the latter discards the available immutable `other_id`. |
| `useRealtimeChat(dname)` | Active hook resolves the first profile matching a name, then uses an ID-derived pair key. The persisted table has genuine sender/recipient UUIDs, but name discovery is ambiguous and no consultation is authorised. |
| Local/sample fallback | The unfinished `TwoWayChatModal` seeds three messages and persists clinical text under a name-derived localStorage key. It swallows send failure and returns to local mode. Empty and failed live histories are not trustworthy. |
| Role confusion and quota simulation | `TwoWayChatModal` allows a patient/doctor display-role toggle and derives sender labels from it; quota/recharge/calls are React state. Self messages and database events are marked read without a recipient acknowledgement. |
| Static inboxes | `PAST_DOCTORS`, `PAST_PATIENTS` and static unread/typing labels are present. Real `useChatInbox` exists separately but hardcodes unread to zero, without persisted unread receipts. |
| Fake sharing/calls/recharge | No approved upload/scanner, call SDK/provider or verified payment-order integration is present. The active unfinished modal replenishes local counters and shows a call state. Historical descriptive “Photo shared” text is not a file. |
| Unsupported security/availability | Active modal claims online and active sync without verified presence/transport state. No audited end-to-end encryption implementation was found. |
| Subscription cleanup/recovery | The legacy hook returns cleanup from inside an async initializer, so the effect does not call it. It subscribes after fetching and has no cursor recovery or actor-scoped idempotency. The unfinished modal listens to all accessible `chat_messages` and appends events without checking the selected thread. |
| Referral booking correctness | `RecommendedByDoctorCard` marks a recommendation booked before slot selection. Another handler trusts a browser event and persists a pending referral in unscoped localStorage. |

## Environment and migration ownership

Approved staging is project `pyrlvjeectjikvfksukb`; web browser and server URL hostnames in this checkout both resolve to `pyrlvjeectjikvfksukb.supabase.co`. Project names alone are insufficient authorisation. Only `staging/supabase/migrations` owns this project's history. Root `supabase/migrations` is preserved historical provenance.

The Android generated development configuration uses `com.mydox.app` and loads `http://10.0.2.2:8081`. The USB variant uses the PC server through `127.0.0.1:8081`. These previews therefore use the running web/server app's backend. No production mobile/server origin is established. A bundled static WebView does not provide TanStack Start server functions.

The existing baseline and manifest are immutable. New chat schema belongs in additive staging migrations only, with explicit grants, RLS, guarded functions and tests. Do not reset or replay the baseline against the existing hosted schema.

## Schema inspected and implementation direction

Existing `chat_messages` contains UUID sender/recipient, `thread_key`, body and server creation time, with participant SELECT and sender-only INSERT checks. It has no clinical relationship, completion evidence, quota, idempotency or receipt model. Keep it and add canonical metadata; do not assign old messages by display name. Legacy rows remain restricted unless evidence supports reviewed reconciliation with an audit trail.

The proposed relationship key contains immutable patient, doctor and organisation scope where an actual organisation relationship exists. `chat_consultation_episodes` explicitly preserves the selected encounter; repeating an open/completion must link the same episode and allowance. No clinic identity is fabricated from a display label.

The additive implementation introduces `post_consultation_chat_policies`, `post_consultation_chat_pilot_participants`, `chat_conversations`, `chat_consultation_episodes`, `chat_member_receipts`, `chat_message_debits`, `chat_prescription_requests`, `chat_prescription_events` and `chat_notification_outbox`. Policy and episode snapshots are immutable. Exact RPC signatures are in the migration; the dedicated `post-consultation-chat/types.ts` and `api.ts` describe the JSON contracts. The legacy generated whole-database types were not regenerated.

Eligible implementation scope is self-booked, genuinely completed home visits with persisted patient arrival acknowledgement, assigned eligible doctor, signed encounter and completion event. Legacy `care_requests` payment/OTP/completion fields can be changed by old workflows and do not prove eligibility. Scheduled clinic/video has no authoritative completion/signing workflow. Both remain unavailable as new chat eligibility sources until repaired without changing booking semantics.

Family/dependent access remains disabled because no reviewed backend guardian/delegation and historical-access scope exists. A name or UI family selector must never impersonate a patient.

## Delivery gates

| Gate | Required implementation and evidence |
| --- | --- |
| A — inspect | Environment/project identity, immutable migration inventory, reproduced source findings, policy decisions and explicit prerequisites. |
| B — identity/text/inbox | Verified canonical episode creation; current actor/member/doctor checks; no sample fallback; atomic idempotent save/debit; paginated stable history; shared inbox adapter; no name routing; account cleanup. |
| C — files/receipts/recovery | Real recipient acknowledgement for read state; recover events with polling/refetch; transactional privacy-safe outbox. Actual files require private quarantined storage, scanner, cleanup and authorised finalisation/download; absent integration remains blocked. |
| D — commerce/calls | Owner-approved versioned policy, authenticated payment callbacks and immutable purchase snapshots, real short-lived authorised media sessions and provider time accounting. No local substitute. |
| E — clinical/actions/acceptance | Real structured request/review/decline; clinician-issued signed record before issued state; authorised referral review and separately confirmed booking; independent sessions, browser/mobile and regression evidence. |

Run declared `npm run check` and relevant chat suites. Hosted tests must use independent synthetic authenticated sessions and remove only their generated fixtures. Serial PGlite tests do not prove hosted concurrency. Screenshots must come from the actual tested build and state what they show. Failed, blocked and unexecuted acceptance cases remain clearly labelled.

Integration ownership and operational prerequisites are recorded in [INTEGRATION_AUDIT.md](INTEGRATION_AUDIT.md), [ROLE_ACTION_MATRIX.md](ROLE_ACTION_MATRIX.md), [BUSINESS_POLICY_DECISIONS.md](BUSINESS_POLICY_DECISIONS.md) and [OPERATIONS.md](OPERATIONS.md).
