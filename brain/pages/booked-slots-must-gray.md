---
id: booked-slots-must-gray
title: Already-booked appointment times must be greyed out in the slot list
category: decision
status: active
tags: [patient, booking, slots]
created: "2026-09-22T14:20:18"
updated: "2026-09-22T14:20:27"
---

<!-- compiled_truth -->
## What was decided
A time that already has a confirmed/pending/rescheduled `doctor_appointments` row (or an assigned physio visit) must appear in the patient slot list as grey, struck-through, and not clickable. Example: Sat 26 Sept 09:00 AM stays visible but unselectable.

## Why
The picker used to treat an empty `get_provider_slots` result as “every half-hour is free,” and it queried seeded fake doctor ids instead of the real profile UUID used at book time. That let patients re-pick a slot that was already taken.

## How
Resolve the provider UUID the same way booking does. Load occupied times from `get_provider_slots` (`is_available = false`), `doctor_appointments`, and `physio_visits`. `isSlotAvailable` always denies matching `bookedSlots`, even when published hours are missing.

## Blast radius
Patient doctor/therapist “book for later” pickers (`SpecialtyPickerModern` / `SpecialtyPickerSimple`). Does not change urgent broadcast. Patient booking is otherwise frozen except this owner-requested slot rule.


## Timeline

- time: 2026-09-22T14:20:18
  kind: decision
  summary: "Created this page: Already-booked appointment times must be greyed out in the slot list"
  source: "owner request: Sat 26 Sept 09:00 already booked must gray out"
  affects: [booked-slots-must-gray]

- time: 2026-09-22T14:20:27
  kind: decision
  summary: "Owner: already-booked times stay visible but greyed out in the slot list."
  source: chat request 2026-09-22
  affects: [booked-slots-must-gray]
