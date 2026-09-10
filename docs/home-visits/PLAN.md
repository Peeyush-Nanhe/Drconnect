# Doctor Home Visit Implementation Plan

Prepared: 10 September 2026  
Branch: `Dev` (Working tree clean)  
Baseline Status: `npm run check` PASSED (Typecheck, Lint, 19 DB Tests, Build)

## 1. Branch Audit & Environment
- **Repository Branch**: `Dev`
- **Target Staging Environment**: `pyrlvjeectjikvfksukb`
- **Baseline Verification**: Ran `npm run check` synchronously — built clean with 0 TypeScript/Lint/DB errors.

## 2. Current Capabilities & Remaining Gaps

### Existing Capabilities
1. `doctor_appointments` table & RPCs (`get_provider_slots`, `atomic_book_appointment`, `cancel_appointment`, `reschedule_appointment`) exist in migration files `20260910131000_book_doctor_for_later.sql` and `20260910141736_phase_f_reschedule.sql`.
2. `HomeVisitConsentGate.jsx` and `HOME_VISIT_CONSENT` text versioning exist.
3. Base `care_requests` handles immediate urgent dispatch.

### Remaining Gaps
1. **Home Visit Lifecycle Extension**: `doctor_appointments` and `care_requests` lack the explicit lifecycle states (`requested/pending` → `confirmed` → `en_route` → `arrived` → `in_consultation` → `completed`).
2. **Arrival Verification**: No server-generated OTP check-in mechanism to transition from `arrived` to `in_consultation` securely without client spoofing or static `0000` bypasses.
3. **Address Snapshot & Consent Linking**: Address snapshot (address, landmark, pincode) and consent metadata must be stored atomically with the booking.
4. **Doctor Travel & Acceptance**: Visit Now immediate requests need atomic provider acceptance (`accept_home_visit_now`) with conflict checking against scheduled commitments and travel buffers.
5. **Clinical Record & Completion**: Transition from `in_consultation` to `completed` requires saving a clinical encounter record.
6. **Settlement**: Recorded pay-at-visit settlement must be stored truthfully upon visit completion.

---

## 3. Schema Mapping & Proposed Migration

Create `staging/supabase/migrations/20260910183000_doctor_home_visit_flow.sql`:
- Extend `doctor_appointments` and `care_requests` to store:
  - `home_visit_status`: `pending`, `confirmed`, `en_route`, `arrived`, `in_consultation`, `completed`, `cancelled`, `declined`, `expired`, `no_show`.
  - `address_snapshot`: JSONB storing full address, pincode, landmark, contact phone.
  - `arrival_otp`: TEXT (6-digit hashed OTP generated on `en_route`/`arrived`).
  - `otp_attempts`: INT (rate limiting attempts).
  - `clinical_notes`: JSONB (saved encounter summary).
  - `payment_settlement`: JSONB (recorded collection details).
  - `consent_version`: TEXT.
  - `consent_timestamp`: TIMESTAMPTZ.

- RPCs:
  1. `create_home_visit_booking`: Atomic RPC to create Visit Now or Book for Later home visit with consent and address snapshot.
  2. `accept_home_visit_booking`: Atomic provider claim/acceptance RPC with overlap and travel buffer checks.
  3. `update_home_visit_travel`: Doctor starts travel, sets `en_route` and ETA, generates arrival OTP.
  4. `verify_home_visit_arrival`: Verifies patient OTP, transitions to `in_consultation`.
  5. `complete_home_visit_encounter`: Saves clinical notes and completes visit with settlement record.

---

## 4. Proposed Implementation Steps & Acceptance Gates

### Gate A: Architecture & Audit (COMPLETE)
- Created `docs/home-visits/PLAN.md`.
- Baseline check verified clean build.

### Gate B: Database Migration & Security
- Add additive migration `20260910183000_doctor_home_visit_flow.sql`.
- Apply strict RLS: Patients see own bookings; assigned providers see assigned visits; unauthorized users cannot read OTP or private addresses.

### Gate C: Core Service Integration
- Update `src/features/mydox/backend.ts` and `src/lib/` to invoke new atomic RPCs for Visit Now and Book for Later home visits.
- Connect consent recording in `HomeVisitConsentGate.jsx` to atomic booking.

### Gate D: Patient & Doctor UI Workflows
- **Patient View**: Address input, self/dependent selector, consent gate, Visit Now / Book for Later choice, live status tracking (Confirmed → En Route → Arrival OTP display → In Consultation → Completion Receipt).
- **Doctor View**: Request accept dialog, "Start Travel" action, Arrival Code verification input, Clinical encounter note form, Complete & Record Payment action.

### Gate E: Automated Testing & Verification
- Add automated PGlite integration tests in `tests/database.test.mjs` testing:
  - Atomic booking & concurrency checks.
  - OTP verification rate-limiting & invalid code rejection.
  - Role-based authorization & RLS security.
- Run `npm run check` to ensure TypeScript, Linting, 19+ DB tests, and Vite build pass 100%.

---

## 5. Acceptance Criteria Checklist
- [ ] Self-booking and authorized dependent booking.
- [ ] Full address snapshot and consent saved atomically.
- [ ] Both Visit Now and Book for Later paths work with real database persistence.
- [ ] Explicit doctor acceptance with capacity & travel buffer checks.
- [ ] En route status with travel tracking/ETA.
- [ ] Secure server-generated OTP arrival check-in.
- [ ] Clinical encounter note mandatory before visit completion.
- [ ] Truthful settlement recording on completion.
- [ ] Automated tests pass (`npm run check`).
