# Roadmap

- [x] Analyze uploaded Care Connect Hub codebase and compare features, UI/UX, and workflows.
- [x] Exclude Firebase implementation and patient doctor-booking changes.
- [x] Produce and approve a phased integration plan that preserves the existing Lovable Cloud backend.
- [x] Add the secure backend foundation for care programs, coordinator cases, and hospital staffing.
- [x] Port Dialysis and Medical Tourism patient flows.
- [x] Port Health Coordinator case workflows.
- [x] Port Care Physician/RMO hospital staffing workflows.
- [x] Integrate the new modules with search, bookings, auth, and role views.
- [x] Verify the integrated flows and preserve patient doctor-booking regressions.
- [x] Add device-token storage and a secured push dispatch endpoint for the native app.
- [ ] Study the MyDox Mental Wellness module spec + prototype uploads (in progress).
- [ ] Plan and build the Mental Wellness module: 4 track cards, screeners (PHQ-9/GAD-7), team recommendation, anchor booking, care_team model, coordinator queue with SLA, verification gate (NMC/RCI/SMHA), measurement loop.
- [x] Add Admin Console hub (/admin) with Mental Wellness console and Care Physician Locum Control Room.
- [x] Add Home Physiotherapy Control Room (/admin/physio) with partner-scoped third-party access.
- [x] Add patient physio visit view (/physio/visits) + booking page (/physio/book).
- [x] Redesigned hub locum/RMO request as tap-first quick-post (duty type, shift, qualification, ward presets); RMO app gained duty badges + filters.
- [x] Flutter native app scaffold (flutter_app/): Supabase auth, patient home, bookings list + create (realtime), FCM push token registration; shares existing Lovable Cloud backend.
