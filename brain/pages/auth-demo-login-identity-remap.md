---
id: auth-demo-login-identity-remap
title: auth.tsx demo-login email remap causes booked provider_id to mismatch the doctor dashboard session
category: project
status: active
tags: [auth, doctor-appointments, demo-accounts, identity]
created: "2026-09-15T18:41:49"
updated: "2026-09-15T18:42:16"
---

<!-- compiled_truth -->
Root cause candidate for "patient books a future date+slot with a doctor, doctor dashboard calendar never shows it": the same identity-mismatch pattern already found for the physiotherapy "Rahul Nair" flow (see therapist-request-flow-is-mocked) also affects real, backend-wired DOCTOR scheduled bookings via atomic_book_appointment / doctor_appointments -- this is a broader, systemic issue in src/routes/auth.tsx's demo login, not confined to physiotherapy.

Confirmed mechanism (src/routes/auth.tsx):
- The manual typed-email sign-in path (~line 227-234) silently remaps "rahul.nair@demo.med" or "therapist1@demo.med" to actually authenticate as "medico1@demo.med" instead (kept as a workaround for the real rahul.nair@demo.med account returning HTTP 400 on staging -- see commits 144329f, 412af5a).
- The one-click "Therapist (Rahul Nair)" demo BUTTON (DEMO_BUTTONS, ~line 75; handleQuickDemoLogin ~179-206) has NO such remap and signs in with rahul.nair@demo.med directly -- a DIFFERENT real auth.uid() than the manual-entry path.
- Either way, the displayed name shown in the doctor dashboard header comes only from localStorage's mc_user_name (set at login), never synced back to profiles.full_name -- so the UI always looks correct ("Rahul Nair") regardless of which underlying auth.uid()/profiles.id the session actually is.

Why this breaks doctor scheduled bookings specifically: the patient-side doctor roster (_liveMedicoRoster/refreshLiveProviders, MyDoxFull.jsx ~500-526) is built from real profiles rows and passes the real profiles.id as p_provider_id into atomic_book_appointment (MyDoxFull.jsx ~14588-14600, confirmed real RPC, not mock -- inserts into doctor_appointments with provider_id, patient_id, start_time, end_time, service, fee). useLiveDoctorAppointments (src/features/mydox/backend.ts:243-281) and doctor_appointments' RLS ("Doctors can read assigned appointments" USING auth.uid() = provider_id) both correctly scope by session auth.uid() -- no date-range bug, no timezone bug, no RLS bug, no status filter excluding new rows found anywhere in this path (checked all migrations touching doctor_appointments including the 20260912103133 rollback). If the patient selected a doctor profile whose id doesn't equal whatever auth.uid() the doctor-side login actually resolved to (e.g. patient booked the roster entry for the real rahul.nair@demo.med profile, but the doctor logged in via the manual-entry path which actually authenticates as medico1@demo.med, or vice versa), the row is written successfully but is invisible to that dashboard session -- no error surfaced anywhere.

Also found: the doctor dashboard's calendar widget (BookingCalendar via DOC_BOOKINGS, MyDoxFull.jsx ~7891-7936) mixes real data (useLiveDoctorAppointments) with 6 hardcoded same-day/next-day-only filler rows (calBk offsets -1..1 day) -- for a booking on an arbitrary future date like 18 Sep, those filler rows are irrelevant noise, not the cause, but worth knowing this component is not purely real.

Separately noticed (secondary, not diagnosed further): supabase/migrations/ (config.toml project lseinzwireqqfeajubgm) has no history past the initial commit, while all real booking/RLS migrations (atomic_book_appointment, book_doctor_for_later, provider-discovery RLS fixes) live only under staging/supabase/migrations/ (project mydox-staging) -- and the actually-configured runtime project in this repo's .env (VITE_SUPABASE_PROJECT_ID=pyrlvjeectjikvfksukb) matches NEITHER of those two config.toml project ids. Worth flagging to whoever owns deploys/migrations -- unclear which migration history is authoritative for the live DB.

NOT YET CONFIRMED: which exact doctor account the patient selected, and which login method/account was used on the doctor-dashboard side, for this specific bug report (18 Sep booking). Asked the user to confirm before proposing a fix. If confirmed as this mechanism, the real fix is to stop remapping rahul.nair@demo.med to medico1@demo.med in auth.tsx and instead either repair the real rahul.nair@demo.med credentials on staging, or make BOTH the button and the manual-entry path resolve to the exact same account consistently.


## Timeline

- time: 2026-09-15T18:41:49
  kind: decision
  summary: "Created this page: auth.tsx demo-login email remap causes booked provider_id to mismatch the doctor dashboard session"
  source: codebase audit 2026-09-15
  affects: [auth-demo-login-identity-remap]

- time: 2026-09-15T18:42:16
  kind: decision
  summary: traced from a doctor-dashboard-calendar bug report
  source: codebase audit 2026-09-15
  affects: [auth-demo-login-identity-remap]
