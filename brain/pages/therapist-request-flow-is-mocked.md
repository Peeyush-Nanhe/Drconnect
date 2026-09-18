---
id: therapist-request-flow-is-mocked
title: "Patient 'Therapist' tile (Rahul Nair) request flow is 100% mock UI, disconnected from any backend"
category: project
status: active
tags: [physio, mock-data, auth, legacy]
created: "2026-09-15T17:44:38"
updated: "2026-09-15T18:19:23"
---

<!-- compiled_truth -->
The patient-facing "Therapist" tile (dashboard action "therapist", HEALTH_CARE_SERVICES id "physio" with label "Rahul Nair — Physiotherapist") is entirely a client-side UI simulation with zero backend calls, and separately there is an identity split in the "Rahul Nair" demo login that would break a naive fix. This directly violates the project's "no mock data" constraint (see CLAUDE.md / [[physio-home-visit-feature]]). Three distinct problems, all in src/features/mydox/MyDoxFull.jsx unless noted:

1. NO BACKEND WRITE ON REQUEST. handleDashboardAction "therapist" -> goToService("therapist") -> pick "Rahul Nair" from hardcoded THERAPISTS list (line ~188) -> handleBook -> cat="therapist", prior=PRIOR_MEDICOS.therapist (hardcoded, line 16085) -> since PREF_CATS includes "therapist" but emergency is never true for this category, setRepeatModal(...) (non-emergency branch) -> RepeatProviderModal "Request" button -> onRequest handler (line ~15232) -> setDirectReq(...) (plain useState) -> DirectRequestOverlay renders and after a bare `setTimeout(() => setPhase("accepted"), 3200)` shows "accepted" -> setConfirmedBooking(...) (plain useState). No fetch, no Supabase call, anywhere in this chain for the therapist category. The ONLY branch that calls a real backend function (createCareRequest, a Supabase insert) is the doctor+emergency branch (gated by `emergency && cat === "doctor" && prior` at line ~14702) — therapist can never reach it.

2. "Rahul Nair" demo login is split into two disconnected identities. src/routes/auth.tsx pre-maps the "Rahul Nair" demo button (rahul.nair@demo.med) to actually sign in as `medico1@demo.med` (real profile: "Dr. Anita Rao", subtype medico) because the real rahul.nair@demo.med credentials return HTTP 400 on staging (see git commits 144329f, aecf4b6, 18b1007, 20a9159 — all of which patched *display* (localStorage "mc_user_name", header label, profile overlay) without touching auth identity). Meanwhile scripts/provision-staging-demo.mjs DID provision a separate, real `profiles` row for rahul.nair@demo.med (role provider/therapist) that is now orphaned — nobody's session ever actually authenticates as it. Any name-based lookup (myMedicos.lookupMedicoIdByName("Rahul Nair") -> RPC find_provider_user_id_by_name) would resolve to this orphaned real account, NOT to medico1's uid that the demo "Rahul Nair" persona is actually running as. So even a correctly-wired backend write would land on the wrong account and never show up when someone logs in via the "Rahul Nair" demo button.

3. The provider portal Rahul Nair/medico1 lands in (DoctorApp, MyDoxFull.jsx:7870) does read real data (useLiveDoctorAppointments on doctor_appointments, useLiveCareRequests on care_requests, scoped to session.user.id) — but also concatenates 6 hardcoded mock bookings (DOC_BOOKINGS, incl. "Priya Sharma") into the same list unconditionally, so the portal always *looks* populated regardless of whether any real request exists. This is why the absence of a real appointment wasn't obvious from the UI alone.

Separately (side finding, not a bug but relevant context): the real Supabase-backed home-visit system in this repo (`src/features/mydox/home-visits/api.ts`, hv_* RPCs on `doctor_appointments`, docs/home-visits/) is a DOCTOR-only home-visit feature with no concept of "physiotherapist" as a provider type — it is unrelated to and does not feed physio_visits. And [[physio-home-visit-feature]] (the real physio_visits-backed booking flow I built/fixed) is itself orphaned from the main patient dashboard: grepped the whole file and found no UI element that dispatches `action: "physio"` (the key that maps to /physio/book) — it's only reachable by direct navigation or from physio.visits.tsx's own "Book again" link. So today, patients who tap the visible "Therapist" tile get the fake Rahul Nair flow, while the real, working physio_visits flow sits unlinked from any dashboard tile.

No fix has been applied yet — this is audit-only, pending a user decision on direction (see append-timeline for options discussed).


## Timeline

- time: 2026-09-15T17:44:38
  kind: decision
  summary: "Created this page: Patient 'Therapist' tile (Rahul Nair) request flow is 100% mock UI, disconnected from any backend"
  source: codebase audit 2026-09-15
  affects: [therapist-request-flow-is-mocked]

- time: 2026-09-15T17:45:01
  kind: decision
  summary: confirmed via code audit 2026-09-15
  source: codebase audit 2026-09-15
  affects: [therapist-request-flow-is-mocked]

- time: 2026-09-15T17:50:15
  kind: decision
  summary: "User chose: point the Therapist tile physiotherapy option at /physio/book rather than wiring the mock modal into the real doctor backend (which would have also required fixing the Rahul Nair identity split first).

Discovered a nuance before implementing: the Therapist category (activeTab === \"therapist\") in MyDoxFull.jsx actually covers 5 distinct sub-specialties via the THERAPISTS array (id \"physio\" = Rahul Nair, plus \"speech\", \"psycho\", \"occup\", \"resp\" - none of which have any real backend). Redirecting the whole category tile would have silently dropped the (equally mock, out-of-scope) speech/psycho/occupational/respiratory therapist booking options. Instead, intercepted surgically inside handleBook(spec, fromOverlay) in MyDoxFull.jsx (~line 14668): if activeTab is \"therapist\" and spec.id is \"physio\", window.location.assign(\"/physio/book\") and return - placed before any of the existing prior/favourite/RepeatProviderModal logic runs. Only the physiotherapist selection now redirects to the real physio_visits flow; the other 4 therapist sub-types are untouched and remain the pre-existing mock simulation (unchanged, still out of scope).

Net effect: there are now two dashboard paths into the real /physio/book flow - the pre-existing \"Home physiotherapy\" tile under \"Care at home\" (action key \"physio\", see physio-home-visit-feature) and this new interception on the Therapist tile Rahul Nair option. Did not touch the Rahul Nair demo-login identity split (medico1@demo.med vs the orphaned real rahul.nair@demo.med profile) since it is no longer on the critical path for this specific bug - physio_visits own therapist roster is unrelated to the doctor/medico auth system entirely. That identity split still exists and would need separate attention if anything else in the app relies on a name-based lookup resolving to the real rahul.nair@demo.med account. Typecheck clean after the change (tsc --noEmit passes)."
  affects: [therapist-request-flow-is-mocked, physio-home-visit-feature]

- time: 2026-09-15T18:19:23
  kind: reversal
  summary: "Reverted the handleBook redirect (spec.id === \"physio\" -> window.location.assign(\"/physio/book\")) added in the previous session turn. User clarified via a Lovable.dev design reference that they want the \"Same provider as before?\" / favourites-first request modal (RepeatProviderModal, the exact UI this page documents as mock) to remain part of the physiotherapy booking flow -- specifically, to appear after the patient taps Confirm on /physio/book -- rather than being bypassed entirely. So the fix direction changes from \"route around the mock modal\" to \"make the mock modal real\": wire it to actual favourite/preferred-therapist data and a real backend action, triggered from the real /physio/book confirm step instead of from the legacy Therapist tile. Not yet implemented -- currently investigating how to reconcile this with the existing project spec rule \"assignment is the partner's job, never the patient's\" (see physio-home-visit-feature) before writing any code, since letting a patient \"Request\" a specific named therapist directly conflicts with that rule and with the current RLS model (only partner/admin can write physio_visits.therapist_id)."
  affects: [therapist-request-flow-is-mocked, physio-home-visit-feature]
