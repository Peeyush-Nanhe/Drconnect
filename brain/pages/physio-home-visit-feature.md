---
id: physio-home-visit-feature
title: "Home Physiotherapy home-visit feature: build status vs spec"
category: project
status: active
tags: [physio, home-visits, supabase]
created: "2026-09-15T16:53:58"
updated: "2026-09-15T19:24:25"
---

<!-- compiled_truth -->
Home Physiotherapy booking now has TWO real, Supabase-backed paths on /physio/book, both typecheck-clean as of 2026-09-15:

1. "Any available therapist" (original path, unchanged): bookPhysioVisit inserts status='requested', no therapist_id; a partner assigns via assignPhysioVisitTherapist in /admin/physio, then progresses the visit through en_route/in_progress/completed/no_show/cancelled. "Assignment is the partner's job" still applies to this path only.
2. "Pick a specific therapist" (new, added 2026-09-15): patient browses verified+active therapists (getPhysioTherapistRoster, favourites-sorted via physio_favorite_therapists), picks one, sees a real slot picker (SlotPickerCalendarStandalone + getPhysioTherapistSlots wrapping the existing get_provider_slots RPC), and books directly via bookPhysioVisitWithTherapist -> atomic_book_physio_visit (new SECURITY DEFINER RPC). This inserts with status='assigned' immediately -- no partner step, mirrors the doctor flow exactly (atomic_book_appointment also confirms instantly, no accept/decline anywhere in this app for scheduled bookings). Reuses the doctor flow's provider_availability table and private.hv_lock/private.hv_busy conflict guard as-is (hv_busy already cross-checks physio_visits, so no new trigger was needed). Fee is computed server-side from therapy_type inside the RPC (better than the doctor RPC's own client-trusted-fee gap).

HARD PREREQUISITE for path 2: a physio_therapists row needs a real linked user_id (via new linkPhysioTherapistUser, admin-or-owning-partner) AND that account needs provider_availability configured (via the existing, unmodified /provider/availability page -- confirmed role-agnostic, already lists "Physiotherapist" as a service). Since physio_therapists has zero rows in the live DB (pyrlvjeectjikvfksukb), path 2 has never been click-tested end-to-end -- this is the same standing "empty roster" blocker noted earlier, now blocking two features instead of one.

Superseded/retired (2026-09-15, one turn after being added): the "Same provider as before?" confirm-time popup (ProviderPickerModal) and preferredTherapistId-hint flow are removed from physio.book.tsx's UI -- therapist choice is now an upfront step, not a post-hoc hint. The underlying physio_favorite_therapists table/functions were kept and repurposed (roster sort); preferred_therapist_id column and its admin-console hint UI were left in place, unused by the new path but still serving the unchanged "any available" path's admin hint.

Everything else from the prior compiled_truth (deferred items: profile FKs, server-side fee check on the OLD path only now since the new path already has it, 4-step wizard restructure, automated tests; the separate legacy mock "Therapist" tile in MyDoxFull.jsx pointing at a fake Rahul-Nair flow, unrelated to physio_visits) still stands unchanged -- see therapist-request-flow-is-mocked for that separate mock-flow issue, and auth-demo-login-identity-remap for a broader identity-mismatch bug found while investigating a doctor-dashboard-calendar report (still unconfirmed/unfixed, unrelated to physio specifically).


## Timeline

- time: 2026-09-15T16:53:58
  kind: decision
  summary: "Created this page: Home Physiotherapy home-visit feature: build status vs spec"
  source: codebase audit 2026-09-15
  affects: [physio-home-visit-feature]

- time: 2026-09-15T16:54:17
  kind: decision
  summary: initial audit vs spec
  source: codebase audit 2026-09-15
  affects: [physio-home-visit-feature]

- time: 2026-09-15T16:55:05
  kind: evidence
  summary: "Confirmed against live DB (project pyrlvjeectjikvfksukb, 'MyDox Staging', the one this repo's .env actually points to): physio_visits_urgency_check CHECK constraint is exactly (urgency = ANY ('planned','urgent')). physio_visits table has 0 rows total. bookPhysioVisit still writes 'routine' for non-urgent (physio-patient.functions.ts:217), so every non-urgent booking attempt has been failing with a Postgres check-violation and nothing has ever landed in the table. This is CONFIRMED, not just plausible, and is the top-priority fix."
  affects: [physio-home-visit-feature]

- time: 2026-09-15T17:15:23
  kind: decision
  summary: "Implemented the 'bug fix + core workflows' scope (user-approved plan, no code changes to lat/lng, area picker, profile FKs, fee integrity, or tests):
1. Fixed the urgency bug: booking now writes 'planned' instead of 'routine' in both src/routes/physio.book.tsx and src/lib/physio-patient.functions.ts:bookPhysioVisit. Confirmed via a rolled-back live-DB insert that 'planned' satisfies physio_visits_urgency_check.
2. Added patient cancel flow: cancelPhysioVisit in physio-patient.functions.ts + Cancel UI on /physio/visits for any visit still in the UPCOMING set, with an optional reason.
3. Added the operator workflow to /admin/physio: assignPhysioVisitTherapist and updatePhysioVisitStatus in physio-admin.functions.ts (transition table requested->assigned->en_route->in_progress(+checked_in_at)->completed(+checked_out_at)/no_show/cancelled(+cancelled_at+reason)), all writing through context.supabase so the existing RLS policies (not app logic) are the actual authorization boundary. buildOverview now also returns board[].status/therapistId and a top-level roster array so the UI can render per-row action buttons.
IMPORTANT CAVEAT discovered during verification: the live DB (project pyrlvjeectjikvfksukb) currently has ZERO rows in physio_partners, physio_therapists, and physio_partner_areas. There is also no admin UI to create partner/therapist rows (only linkPhysioPartnerUser exists, which links a user_id to an *existing* partner row). This means the operator console has nothing to assign against until someone seeds at least one partner + area + verified/active therapist via SQL — that seeding, and a partner/therapist-creation UI, is out of scope for this pass and still needed before this feature is demoable end-to-end."
  affects: [physio-home-visit-feature]

- time: 2026-09-15T17:15:45
  kind: decision
  summary: "post-implementation status: bug fix + core workflows done"
  source: implementation 2026-09-15
  affects: [physio-home-visit-feature]

- time: 2026-09-15T18:29:22
  kind: decision
  summary: "Added a real \"Same provider as before?\" step to /physio/book, per the user sharing a Lovable.dev design reference (see therapist-request-flow-is-mocked for the mock version this was modeled on). Migration: physio_visits.preferred_therapist_id (nullable, FK to physio_therapists, ON DELETE SET NULL) + new table physio_favorite_therapists (patient_id, therapist_id, unique pair, RLS \"patients manage own favourite therapists\" scoped to patient_id = auth.uid()). Applied to project pyrlvjeectjikvfksukb and confirmed live (column exists, RLS enabled, policy present).

New server functions in physio-patient.functions.ts: getPhysioPriorProviders (GET) returns the union of the patient own favourites + their most recent completed-visit therapist, each with a personal past-visit count and personal average rating, using context.supabase for own-row reads and supabaseAdmin only for the physio_therapists name/verified/active lookup (patients still cannot SELECT physio_therapists directly under RLS -- same pattern as the existing getMyPhysioVisits). togglePhysioFavoriteTherapist (POST) enforces a max of 2 favourites. bookPhysioVisit now accepts an optional preferredTherapistId -- validated server-side against physio_therapists (must be verified+active) and silently dropped to null if invalid, so a stale preference can never block a booking.

UI: physio.book.tsx now shows a ProviderPickerModal (styled after the Lovable reference) after Confirm, but ONLY when getPhysioPriorProviders returns a non-empty list -- first-time bookers with no prior/favourite therapist skip the modal entirely and book exactly as before. \"Request [name]\" books with that preferredTherapistId; \"Find anyone available\" books with null; both otherwise proceed identically to the pre-existing submit.

Important boundary preserved: this is a soft hint only, NOT patient-driven assignment. It does not change the \"assignment is the partner's job, never the patient's\" rule -- partner still calls assignPhysioVisitTherapist to actually set therapist_id. admin.physio.tsx now shows \"Requested: {name}\" above the Assign dropdown for a requested visit with a preferredTherapistId, and pre-selects that therapist in the dropdown if still verified/active -- partner can still pick anyone else. This was a deliberate, user-confirmed resolution of a real conflict between the Lovable design (which implies direct-to-therapist requests) and the original spec constraint; the user chose \"lightweight preference\" over building a full accept/decline/broadcast pipeline for therapists (which does not exist and was explicitly declined as too large for now).

Since the live DB still has zero physio_therapists rows (noted earlier in this page), getPhysioPriorProviders will always return [] today -- verified typecheck-clean, but the modal itself will not visibly appear until either a partner creates therapists and a patient completes at least one visit, or a patient favourites one manually via the API. No browser click-through was performed (consistent with the earlier \"you will test manually\" decision)."
  affects: [physio-home-visit-feature, therapist-request-flow-is-mocked]

- time: 2026-09-15T19:23:38
  kind: reversal
  summary: "Retired the \"Same provider as before?\" confirm-time popup and its preferredTherapistId-hint UI wiring from src/routes/physio.book.tsx (added just one turn earlier). Reason: the user asked to rebuild physio booking to match the doctor scheduled-booking flow instead -- picking a specific therapist is now an explicit, EARLY step in the booking form (before date/time), so a confirm-time \"same provider as before\" popup no longer fits the shape of the flow. physio_favorite_therapists (the heart/favourite table) and getPhysioPriorProviders/togglePhysioFavoriteTherapist are NOT removed -- they are kept and repurposed to sort favourites to the top of the new therapist-picker list in getPhysioTherapistRoster. The preferred_therapist_id column on physio_visits and the ProviderPickerModal-triggering logic in bookPhysioVisit are left in place too (harmless, still used by the untouched \"any available therapist\" fallback path) -- only the physio.book.tsx UI wiring for the popup itself was removed, not the underlying data model."
  affects: [physio-home-visit-feature]

- time: 2026-09-15T19:24:01
  kind: decision
  summary: "Added a real direct-slot booking path to /physio/book, mirroring the doctor scheduled-booking flow (atomic_book_appointment / provider_availability / get_provider_slots), per explicit user request to make physiotherapist booking work the same way. This is a SIGNIFICANT reversal of the earlier spec rule \"assignment is the partner's job, never the patient's\" -- that rule now only applies to the FALLBACK \"any available therapist\" path (bookPhysioVisit, unchanged, still status=requested until a partner assigns via assignPhysioVisitTherapist). A patient can now also pick a specific verified+active therapist directly and book one of their real open slots, which inserts with status=\"assigned\" immediately, no partner step at all -- exactly like a doctor booking, which also confirms instantly with no accept/decline.

Migration (project pyrlvjeectjikvfksukb, applied and confirmed): (1) new RLS SELECT policy \"patients browse verified therapists\" on physio_therapists (USING verified AND active) -- patients could not read this table at all before. (2) new SECURITY DEFINER function atomic_book_physio_visit(...), modeled directly on atomic_book_appointment: ownership check, field validation, looks up physio_therapists (must be verified+active, must have a linked user_id), looks up provider_availability for that user_id (must be is_online, slot must fit inside that weekday's working_hours), then reuses the EXISTING private.hv_lock/private.hv_busy advisory-lock conflict guard (already built for doctor_appointments and already includes physio_visits in its conflict predicate, so this gives correct therapist-vs-therapist and therapist-vs-doctor conflict checking for free, no new trigger needed) before inserting. Fee is computed SERVER-SIDE from therapy_type inside the RPC (a deliberate improvement over the doctor RPC's own known gap of trusting a client-supplied fee). Grants confirmed: no anon EXECUTE, matches atomic_book_appointment's lockdown pattern.

Critical new prerequisite for a therapist to be bookable this way: physio_therapists.user_id must point at a real signed-up account (added linkPhysioTherapistUser in physio-admin.functions.ts, admin-or-owning-partner-only, mirrors the existing linkPhysioPartnerUser), AND that account must have configured provider_availability (via /provider/availability, src/routes/provider.availability.tsx -- confirmed this route is already generic/keyed only by auth.uid() with no role gating, and its own DEFAULT_SERVICES list already includes \"Physiotherapist\", so it is reused as-is with zero changes). Since the live DB still has zero physio_therapists rows, the direct-slot path has nothing to show yet and cannot be click-tested end to end -- this is the same standing blocker noted earlier in this page, now also blocking the new path, not just the operator console.

New/changed server functions: physio-patient.functions.ts gained getPhysioTherapistRoster (GET, lists verified+active therapists, favourites sorted first via physio_favorite_therapists), getPhysioTherapistSlots (GET, resolves therapistId to user_id via supabaseAdmin -- never exposed to the client -- then wraps the existing get_provider_slots RPC, fully reused with zero changes since it was already provider-type-agnostic), and bookPhysioVisitWithTherapist (POST, thin wrapper around atomic_book_physio_visit). physio-admin.functions.ts gained linkPhysioTherapistUser. src/routes/physio.book.tsx was restructured: therapy type -> pick a specific therapist OR \"Any available therapist\" -> (if specific) a real slot picker (reusing SlotPickerCalendarStandalone from src/features/mydox/SlotPickerCalendar.tsx as-is, same component/behavior the doctor flow uses, including its known limitation that the UI does not grey out unavailable slots -- enforcement is server-side in the RPC, exactly matching how the doctor flow actually behaves today) or (if \"any available\") the original free-text date/time input, unchanged.

Next step when resuming: seed at least one physio_therapists row with a linked real user_id + a provider_availability row (via /provider/availability) to actually click-test the new direct-slot path end to end; also worth deciding later whether physio_visits should get its own overlap-enforcing BEFORE INSERT trigger (like check_appointment_overlap on doctor_appointments) for defense-in-depth against any future code path that might insert/update therapist_id + scheduled_at outside atomic_book_physio_visit -- not done now since the only two paths that can set therapist_id today (assignPhysioVisitTherapist and this new RPC) both already go through validated app-layer or RPC logic."
  affects: [physio-home-visit-feature, therapist-request-flow-is-mocked, auth-demo-login-identity-remap]

- time: 2026-09-15T19:24:25
  kind: decision
  summary: post direct-slot-booking rebuild
  source: implementation 2026-09-15
  affects: [physio-home-visit-feature]
