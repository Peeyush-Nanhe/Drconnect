# Post-consultation chat configuration and operations

Real-patient use is **disabled**. Commercial rules, actual attachments, calls, payment, closed-app delivery and signed prescribing remain subject to the blockers in [BUSINESS_POLICY_DECISIONS.md](BUSINESS_POLICY_DECISIONS.md) and [INTEGRATION_AUDIT.md](INTEGRATION_AUDIT.md). The owner has not approved a reduced release scope. Consult [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for exact code/test/deployment status before any rollout.

## Environment identity

| Surface | Inspected configuration |
| --- | --- |
| Repository | `https://github.com/Peeyush-Nanhe/Drconnect`, `main` |
| Approved staging project | `pyrlvjeectjikvfksukb` |
| Browser backend hostname | `pyrlvjeectjikvfksukb.supabase.co`, from `VITE_SUPABASE_URL` |
| Server backend hostname | `pyrlvjeectjikvfksukb.supabase.co`, from `SUPABASE_URL` |
| Android identity | `com.mydox.app` |
| Generated Android development preview | PC server at `http://10.0.2.2:8081`; USB variant uses forwarded `http://127.0.0.1:8081` |
| Production application/server/mobile origin | Not established by this work |

Only variable names are listed below; configure actual values through approved secret handling. Never print credentials or commit `.env`.

| Variable name | Use and exposure |
| --- | --- |
| `VITE_SUPABASE_URL` | Browser build-time project URL; public project metadata. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser publishable key only; never service-role/secret key. |
| `VITE_SUPABASE_PROJECT_ID` | Existing browser project reference. |
| `SUPABASE_URL` | Server project URL; must match approved target. |
| `SUPABASE_PUBLISHABLE_KEY` | Authenticated server/client public configuration. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/operator-only test/worker credential; not configured in the inspected root `.env`; never expose to web/mobile. |
| `FCM_SERVICE_ACCOUNT_JSON` | Existing optional server-only FCM transport credential; absent in inspected environment. Does not by itself implement native token registration or delivery. |
| `PUSH_DISPATCH_SECRET` | Existing optional server dispatch endpoint credential, if used; inspect endpoint requirements before configuration. |
| `HOME_VISIT_JOB_SECRET` | Existing home-visit worker only; does not configure a chat worker. |
| `MYDOX_ANDROID_PREVIEW` | Existing preview selector: emulator or USB; not a production server deployment. |
| `MYDOX_ENABLE_DEMO_LOGIN`, `MYDOX_DEMO_PASSWORD`, `MYDOX_DEMO_SPECIAL_PASSWORD` | Existing compatibility/demo login configuration. Values are not test evidence and must not appear in screenshots/logs. |
| `VITE_ENABLE_DEV_TOOLS` | Existing development tooling flag. |

No call, payment, scanner or chat-worker credentials are invented. The corresponding provider decision must come first.

## Verification commands

```sh
npm ci
npm run check
npm run test:post-consultation-chat:staging
```

The final command requires the approved staging server test key and creates/removes only run-scoped synthetic accounts and visits. It exercises independently authenticated duplicate-send and last-credit races; missing configuration exits `BLOCKED` before network access. The browser harness is `scripts/test-post-consultation-chat-browser.mjs`; it expects a running local app and an isolated Chrome CDP endpoint on port 9333. Use `--url=http://127.0.0.1:8081 --existing-demo --demo-button` only with the existing marked staging demo account. It captures gated states, not a successful eligible consultation. See [validation evidence](evidence/validation.json).

## Controlled staging rollout

1. Inspect `git status`, fetch origin and reconcile safely; preserve team changes. Verify project reference and actual hosted migration history before any remote write. Similar names do not identify the target.
2. Apply only reviewed additive files from `staging/supabase/migrations`. Preserve already-applied SQL and `source-manifest.json` checksums. Do not apply the root source history or fresh baseline to the existing project.
3. Keep policies test-only and the pilot allowlist empty by default. Synthetic test accounts require explicit service-approved fixture registration; an ordinary client cannot enable itself. Do not create privileged users merely to bypass clinical eligibility.
4. Run `npm run check`, the declared chat tests and existing hosted suites with synthetic cleanup. An installed package/build is not a deployed server; serial SQL tests are not two-session race evidence.
5. If hosted credentials are missing, configure `SUPABASE_SERVICE_ROLE_KEY` through the approved server-only secret workflow. The test runner does not retrieve this credential itself. Report unavailable authentication instead of claiming hosted tests passed.
6. Deploy the reviewed web **and server** output to the approved staging host. Confirm runtime/build project URL consistency and Auth redirects. Record commit/build ID and deployed migration versions.
7. Capture actual browser/device evidence using independent patient/doctor sessions. The synthetic home visit must pass its real lifecycle, then patient history, chat, doctor inbox and restart must agree on immutable IDs. Label screenshots of unavailable/gated state as such.
8. Owner policy approval, completion prerequisites, integration provider decisions, closed-app/device evidence, security review and explicit release-scope approval are required before enabling real-patient access.

## Operation, failure and reconciliation

Sending is pending until the authenticated save returns or the same idempotency key reconciles. A lost response must retry the same key and payload. Changing text creates a distinct operation after resolving the previous unknown outcome. A rejected message consumes no unit; doctor text consumes none. Device clocks and message-list length do not establish expiry or remaining credits.

Keep permitted history readable on allowance expiry. On membership/credential revocation, reject writes server-side and refresh/close client state without relying on initial subscription admission. Polling or reconnect refresh recovers missed rows; an online label is not a doctor response promise.

Notification outbox state is not delivery. Disabled jobs remain disabled until an approved provider, token registration, leased worker and privacy-safe deep-link path exist. Do not run the unrelated public push dispatcher as an unauthorised clinical-message broadcast. A future notification worker must separate queued/provider-accepted/device-delivered outcomes and minimise logs.

Prescription request is not approval, diagnosis or medicine advice. Reviewing/declined states may persist; issuing must reference the authorised signed prescription, with audited amendments. Follow-up and referral review must lead to ordinary availability/price/confirmation and must not claim a booking from opening a card.

## Rollback and data protection

For a send-only rollback, use a reviewed additive migration to revoke `EXECUTE` on `public.pc_chat_send(jsonb)` and `public.pc_chat_prescription(jsonb)` from `authenticated`; keep authorised open/history/read paths. Canonical direct table writes are already denied. Do not restore the old name-based/local-message UI. Revoking a conversation or pilot participant is an access/safety action that also hides its history and is not a billing-expiry mechanism. The current empty allowlist needs no rollback mutation. Disable future notification delivery separately if implemented later. Do not drop messages, reset live databases, replay the baseline, rewrite applied migration text or restore old backups over unrelated newer work.

Any legacy-message reconciliation must record original IDs, the unambiguous consultation/participant evidence, reviewer and decision. Ambiguous name-based localStorage content must never be imported by matching display labels. A patient changing names does not change identity.

Support access remains an explicit least-privilege feature requiring approved scope and audit; ordinary admin status must not open every clinical thread. No end-to-end encryption promise is made without an audited implementation. Supabase RLS provides access enforcement; it does not establish end-to-end encryption.
