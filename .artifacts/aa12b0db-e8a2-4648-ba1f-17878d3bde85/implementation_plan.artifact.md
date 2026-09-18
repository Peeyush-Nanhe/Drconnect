# Implementation Plan - Align Nurse UI with Physiotherapist Portal

The goal is to update the Nurse portal (`nurse.tsx`) to match the layout, features, and styling of the Physiotherapist portal (`physio.therapist.tsx`), ensuring consistency across the care staff modules while adhering to the handover specifications.

## User Review Required

> [!IMPORTANT]
> This change will transition the Nurse portal to use the "Unified Broadcast" UI for live requests, while keeping the dedicated `NurseRequestsPanel` for existing engagement-style bookings.

## Proposed Changes

### [Component Name]

#### [MODIFY] [nurse.tsx](file:///D:/freelance/Drconnect-main/src/routes/nurse.tsx)
- Add "Profile & settings" and "Log out" buttons to the header.
- Implement the `activeLiveCareRequest` alert UI for real-time broadcasts.
- Update the stats cards to include "To confirm" and "Completed (30d)" metrics.
- Expand the profile form to include:
  - Council registration number
  - Recent courses & certifications
  - Special interests
  - DND (Quiet hours) preferences
  - Travel radius and minimum pay settings.
- Standardize the `signOut` logic to match the Physio portal.

#### [MODIFY] [StaffUI.tsx](file:///D:/freelance/Drconnect-main/src/features/careteam/StaffUI.tsx)
- Ensure the `Stat` component handles the "emerald" vs "slate" tones correctly for the header.

## Verification Plan

### Manual Verification
- Log in as a Nurse and verify:
  - Header buttons ("Log out", "Profile") work as expected.
  - Profile form contains all new fields from the handover spec.
  - Stats in the header are correctly displayed in the emerald theme.
- Trigger a mock broadcast request to verify the "⚡ Live Incoming Broadcast" alert appears at the top.
