# Home-visit list HTTP 400 fix

On 2026-09-12, an authenticated account outside the home-visit rollout received HTTP 400 from `POST /rest/v1/rpc/hv_list`, with code `P0001` and message `Home visits are disabled pending approved pilot policies`. The list called the mutation-oriented `private.hv_actor()` guard. The history panel requested this list unconditionally, including on its 12-second refresh.

Migration `20260912070431_home_visit_list_unavailable_state.sql` is applied to MyDox Staging (`pyrlvjeectjikvfksukb`). The list now checks authentication explicitly and returns `[]` for a disabled account. Enabled participants retain the original ownership, accepted-doctor and pending-offer scope. Anonymous callers cannot execute the function; an authenticated database role without a user receives `42501`. The migration SQL MD5 matches hosted history: `250064e6ccff86fcb261ba51f0902ffd`.

The history panel checks `hv_context` before loading visits or mounting provider settings. Disabled accounts see the server's policy reason as a normal status. Real failures remain visible, transient refresh errors preserve mounted forms, and account changes clear the previous view.

## Verification

- `npm run check` passed in an isolated checkout of `84c6a5c` plus only this fix: TypeScript, lint (0 errors, 131 existing warnings), 20 core database tests, 37 home-visit tests, 23 chat tests, and build. The five unrelated unfinished workspace files were excluded. Tested application and migration bytes match the committed task files.
- The new database regression covers an enabled participant's existing visit, an unrelated disabled account, access revocation after booking, anonymous access, and missing authentication. Quote creation remains denied outside the rollout.
- [Before](evidence/hv-list/before.json): the actual staging HTTP request reproduced 400 and the exact policy exception using an existing marked demo patient.
- [After](evidence/hv-list/after.json): the actual endpoint returned 200 and `[]` for that same account. The isolated local app on port 8084 used real staging Auth and RPCs. Loading history, clicking Refresh, focusing the window and waiting through polling produced context requests with zero list/settings requests, zero error alerts, and no stuck loading indicator. Source hashes identify the application changes over the report's base commit; `sourceChangedDuringRun` is false.
- [Policy panel screenshot](evidence/hv-list/after.png) contains only the unavailable home-visit panel.
- [Database verification](evidence/hv-list/database-verification.json) confirms unchanged definitions for quote, create, action, context and rollout guards. Real-patient and pay-at-visit flags remain false; the pilot allowlist remains empty.

The browser harness is `scripts/test-home-visit-list-browser.mjs`; run it with the private ignored staging `.env`, a local app, and isolated Chrome remote debugging on port 9334. `--url=http://127.0.0.1:8084` selects the app. `--expect-before` documents the old endpoint behavior and is expected to fail after deployment. Reports omit credentials, authorization headers and visit rows. The hosted verification is read-only and does not claim an enabled home-visit lifecycle run or a production release.

The post-change security advisor has no errors or anonymous security-definer warnings. Existing findings remain: 24 RLS-enabled tables with no client policies, 26 authenticated security-definer RPCs and disabled leaked-password protection. The guarded RPC design and denied direct-table access are unchanged. See [RLS guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
