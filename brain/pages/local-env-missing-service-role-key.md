---
id: local-env-missing-service-role-key
title: "Local .env has an empty SUPABASE_SERVICE_ROLE_KEY, breaking every server function that uses supabaseAdmin"
category: project
status: active
tags: [env, supabase, local-dev, critical]
created: "2026-09-15T19:48:25"
updated: "2026-09-15T19:48:44"
---

<!-- compiled_truth -->
The repo's local .env (gitignored, not committed) has SUPABASE_SERVICE_ROLE_KEY= with an EMPTY value (confirmed: `awk -F= "/^SUPABASE_SERVICE_ROLE_KEY=/{print length(\$2)}" .env` returns 0). This is a local machine/checkout configuration gap, not a code bug, and not something introduced by any of this session's work.

Impact: any server function that lazily imports src/integrations/supabase/client.server and uses supabaseAdmin fails at runtime with "Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY. Connect Supabase in Lovable Cloud." -- but critically, in this app's TanStack Start server-function transport, that thrown error is serialized and returned with an HTTP 200 (the error lives in the response body's "error" field, not the status code), so the client's fetch/network layer sees success while the actual query result is an error. Depending on how the calling code (or React Query) handles that shape, this can present as a permanently stuck loading state rather than a visible error message -- confirmed via automated browser test: /physio/visits showed "Loading your sessions..." forever (getMyPhysioVisits kept returning HTTP 200 with this error payload on every refetch, never settling to an error UI).

This affects far more than physio: supabaseAdmin is used throughout the app for privileged reads/writes (getMyPhysioVisits, getPhysioAdminOverview, assignPhysioVisitTherapist's resolveScope, linkPhysioPartnerUser, linkPhysioTherapistUser, getPhysioTherapistSlots, bookPhysioVisit's preferred-therapist validation, getPhysioPriorProviders, and surely many non-physio features elsewhere in the codebase that follow the same pattern). Anyone testing locally against this same .env will hit the same failure on any of those paths, not just booking.

Confirmed via: started a disposable dev server (port 8083, killed after testing) with Playwright/chromium automation, logged in as the "Patient 1" demo account, booked a physio session (this part succeeded -- bookPhysioVisit only needs context.supabase, not supabaseAdmin), then watched /physio/visits hang forever. Decoded the server function's response body directly (TanStack Start's internal wire format) and found the exact error message above repeating on every poll.

Separately noticed, likely unrelated: the "Patient 1" demo one-click login itself got a 400 invalid_credentials from Supabase auth on the FIRST attempt in this test run, then a second identical request succeeded with 200 -- worth keeping an eye on but not chased further since login did ultimately succeed and this wasn't the reported bug.

FIX (not applied by Claude -- this is a secret, must be set by the project owner, not pasted into chat): open the Supabase dashboard for project pyrlvjeectjikvfksukb ("MyDox Staging") -> Project Settings -> API -> copy the "service_role" secret key -> paste it as the value of SUPABASE_SERVICE_ROLE_KEY in the local .env file -> restart the dev server. This should immediately fix the physio visits list hang and likely several other previously-unexplained "stuck loading" reports in local testing.


## Timeline

- time: 2026-09-15T19:48:25
  kind: decision
  summary: "Created this page: Local .env has an empty SUPABASE_SERVICE_ROLE_KEY, breaking every server function that uses supabaseAdmin"
  source: reproduced via automated browser test 2026-09-15
  affects: [local-env-missing-service-role-key]

- time: 2026-09-15T19:48:44
  kind: decision
  summary: "root cause of the reported physio flow break, confirmed via automated Playwright test"
  source: 2026-09-15
  affects: [local-env-missing-service-role-key]
