# Book Doctor Implementation Plan
Prepared: 10 September 2026

## 1. Findings
- **Repository State**: The project is a Vite + React + TanStack Start app with a Supabase backend and a Capacitor mobile wrapper. No active git repository was detected in the base directory.
- **Environment**: Target STAGING project is `pyrlvjeectjikvfksukb`. Secrets and URL are present in `.env`.
- **Build Status**: Baseline checks (`npm run check`) pass successfully. The frontend components include legacy files like `MyDoxFull.jsx` and new structured files like `backend.ts`.
- **Audit Defect Confirmation**:
  - `proceedNormal()` handles `spec.scheduled` by short-circuiting and updating local state only, skipping `bookSvc()` (lines ~13705-13723 in `MyDoxFull.jsx`).
  - `actions.book` falls back to simulated states when errors occur instead of resolving cleanly.
  - `SlotPickerCalendar.jsx` implements pseudo-random unavailability via `isSlotUnavailable()` instead of querying the backend.
  - `createCareRequest()` in `backend.ts` lacks scheduled booking semantics, and `care_requests` is designed for live urgent broadcast rather than named future appointments.

## 2. Schema Mapping
- **Current schema**: `care_requests` handles immediate/broadcast requests. `provider_availability` manages weekly working hours and blocked dates but has no materialized slots or conflict-checking reservation mechanism.
- **Proposed schema**:
  - `doctor_appointments`: Table to store explicitly scheduled future bookings. It will store provider ID, patient ID, start/end timestamps (with timezone), status, mode (e.g., in-person), location, agreed fee, and idempotency key.
  - `provider_availability` will continue to store the doctor's published rules, but we will introduce a mechanism or helper function to generate or validate real availability against existing `doctor_appointments`.

## 3. Migration Strategy
- Create a new migration script in `staging/supabase/migrations/`.
- **Tables**: Create `doctor_appointments`.
- **Functions/RPCs**: Create `book_doctor_appointment` to execute an atomic transaction validating schedule capacity, checking non-overlapping constraints, and inserting the record with idempotency handling.
- **RLS Policies**: Apply least-privilege read/update access so patients can see their own bookings and doctors can see their assigned appointments.

## 4. Enabled Scope
- Self-booking, in-person consultation appointments.
- Capacity: 1 patient per doctor per interval.
- Explicitly published provider availability (if working hours not set, no availability is displayed).

## 5. Assumptions and Acceptance Gates
- Assume timezone handling will default to `Asia/Kolkata` for the Pune pilot.
- Re-use `provider_availability` for generating the available slots dynamically in the frontend rather than materializing empty slot records in the DB, but validate them transactionally via RPC upon booking.

**Gate A Complete**: Repository and target environment identified. Missing path and database model documented.
