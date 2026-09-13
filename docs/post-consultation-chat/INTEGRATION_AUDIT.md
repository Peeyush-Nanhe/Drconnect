# Integration audit and blockers

Source inspection on 2026-09-12, starting commit `2d9d18b4c85e8e8901a0cb7153e001643839e4fb`. This inventory distinguishes existing code from verified integration. See `IMPLEMENTATION_STATUS.md` for executed tests and final release status.

| Capability | Actual existing integration | Gap and accountable owner |
| --- | --- | --- |
| Supabase Auth / database | Real `@supabase/supabase-js`, authenticated server middleware, RLS, hosted staging, immutable UUIDs. | Chat must enforce relationship/episode/current clinician eligibility beyond legacy sender-only inserts. Backend owner. |
| Web deployment | React/TanStack Start, Vite client and Nitro server output. Client uses build-time `VITE_SUPABASE_*`; server uses `SUPABASE_*`. | No production application hostname or hosted chat worker established by this checkout. Deployment owner. |
| Mobile deployment | Capacitor `com.mydox.app` development preview points to the running PC's TanStack server; generated config inspected. | No independent static production API arrangement or native acceptance. Mobile owner. |
| Genuine home completion | `doctor_appointments`, `home_visit_details`, patient arrival acknowledgement, signed `home_visit_encounters`, immutable events, guarded `hv_action`. | Self patient only; verify these actual records when creating episode. Backend owner. |
| Clinic/video completion | Scheduled `doctor_appointments` stores scheduling, cancellation and rescheduling. | No authoritative signed clinic/video encounter completion workflow found. Do not grant benefit from client status or manufacture a booking. Scheduling/clinical owner. |
| Legacy urgent care completion | `care_requests`, client completion update, legacy client-set payment timestamp and test OTP. | These fields are not verified payment/completion evidence. Requires separate secure lifecycle repair before chat eligibility. Scheduling/backend owner. |
| Family/dependent | Some family-plan and guardian display models exist. Home visits explicitly reject dependent booking. | No reviewed current/revoked delegation plus clinical-history scope suitable for chat. Family/privacy/backend owners. |
| Text transport | Existing persisted `chat_messages` and Supabase Postgres Changes subscription. | Name lookup, cleanup, initial fetch gaps, quotas and receipts need canonical repair; transport alone proves no clinical relationship. Chat owner. |
| Attachments | No chat storage bucket/upload/finalise/download implementation, scanner provider or approved quarantine policy found. | Gallery/camera/documents remain disabled; no fake file bubble or public URL. Owner/security/storage owners must approve and configure real pipeline. |
| Location/contact | No explicit authorised chat sharing/finalisation pipeline found. | Consent and quota rules, permissions/cancellation UX and supported platform adapter required. No background tracking. Mobile/chat owner. |
| Audio/video | No approved media SDK, provider credentials, room issuer or verified call-event reconciliation found. | Calls disabled. Need authenticated short-lived session issuer, allowance reservation, backend enforcement, verified connected time, callback idempotency and two-device testing. Owner/media/backend. |
| Recharge | No approved chat merchant catalog, server order creation, signed gateway callback or purchase reconciliation found. Legacy `paid_at` and cash settlement are not gateway verification. | Purchases disabled. No local token refill. Owner/payments/backend. |
| Push | `push.server.ts` implements FCM HTTP v1 transport and delivery audit; `push.functions.ts` has authenticated device-token registration; home visits have a leased notification-job pattern. | No callers acquiring native/web device tokens found; no FCM credentials in inspected environment, no approved channel or hosted chat worker. `sent` means FCM accepted, never proven delivered. Mobile/operations. |
| Prescription | Legacy composer in `MyDoxFull.jsx` issues local state and explicitly labels output demo, not clinical use. Signed home encounter is real but is not an e-prescription. | Structured requested/reviewing/declined can persist. Issued requires an authorised signed prescription record with amendment audit. Do not route to demo composer as issuance. Clinical/backend owner. |
| AI explanation | Existing report/AI helpers belong to other flows. | No approved prescription explanation consent/review contract; payment and AI cannot impersonate a clinician. Disabled. Clinical/privacy/AI owner. |
| Referral | `service_referrals` persists doctor/patient/service/status; separate recommendation UI exists. | New cards must query authorised references and verify participants/context. Legacy mutable participant/status fields and generic admin read policy require focused hardening before clinical reliance. Do not trust embedded message text. Backend/chat owner. |
| Follow-up | Existing appointment selection/navigation exists. | Opening review is not a confirmed appointment; no success toast or booked status until durable validated booking reference. Booking owner. |

## Required attachment pipeline

No disconnected validator or unused upload stub is counted as implementation. Before enabling actual selection/sharing:

1. An authenticated server operation checks current actor, patient/delegation, conversation, episode and allowed attachment type/quota; binds a one-use upload intent to immutable identities.
2. Bounded bytes enter a private quarantine bucket. Validate declared extension/MIME against content and size; filenames and supplied object keys must not decide storage identity. A header signature alone does not establish safe content.
3. An approved scanner receives the quarantined object and records a verified verdict. Failed/unknown/pending objects are never downloadable. Do not claim scanning from a simulated verdict.
4. Finalisation rechecks current access and atomically binds uploader/conversation/patient/message, persists the message and charges any approved unit once. A failed upload consumes no unit.
5. A bounded authorised download rechecks current access; safe response headers and rendering prevent active-content execution. Object references cannot cross threads or expose public listing.
6. Approved cleanup removes failed/orphaned/quarantined objects after a defined TTL without deleting committed clinical records contrary to retention policy. Test permission denial, cancelled capture, oversized/mislabelled/unsafe files, interrupted upload and revoked access.

Supabase private bucket access depends on storage RLS. Signed URLs remain bearer capabilities until expiry; where immediate revocation is required, use a reauthorising download proxy or another approved control, not a long-lived link. These requirements follow [Supabase storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [serving private files](https://supabase.com/docs/guides/storage/serving/downloads).

## Push and privacy

Message creation should persist an outbox row in the same transaction; until integration approval, it stays disabled and is not described as delivered. A future worker needs leased claims, bounded retries/backoff, stable event IDs, current-recipient checks, revoked token handling and privacy-safe bodies. A generic “New follow-up message” can deep-link by opaque conversation/episode IDs after login and renewed permission checks. Never put clinical text, clinician specialty, diagnosis or patient name in a lock-screen payload by default.

Exactly-once external push delivery is not established by transactionally queued events. Provider acceptance and confirmed device receipt are separate outcomes. Test the chosen channel with the actual recipient app closed, including denied permission, restart, duplicate callback and revoked session/delegation cases.

## Protected feature boundaries and residual findings

Group/reel expansion is out of scope. Shared chat entry points must not show another patient's messages or make these separate features vanish; unsupported legacy/name-only entry points should give a truthful unavailable state. Legacy group/reel demos outside the follow-up module are not evidence of real group/video transport.

The old referral table lets participant updates affect fields beyond a narrow status transition, and its SELECT policy includes ordinary admin/super-admin. Chat must not inherit that broad access. Existing record UI contains demos and broader account policies; opening a canonical chat never grants full-chart access. These inherited findings are release blockers where a new flow depends on them, not a reason to globally rewrite unrelated RLS.

The existing authentication screen contains a one-click synthetic patient login with a literal password in client source. The screenshot runner used that existing owner-established fixture without printing the credential or changing the account, then verified trusted staging fixture metadata. This inherited configuration requires owner/security review before real-patient production; it is not a secure production Auth onboarding design and was not introduced by this chat repair.

The reviewed [Supabase changelog](https://supabase.com/changelog) includes explicit Data API grant changes and protected Realtime schema changes. New objects need deliberate grants and RLS; no migration should modify the locked `realtime` schema. The relevant Storage and Postgres API documentation was checked during this task.
