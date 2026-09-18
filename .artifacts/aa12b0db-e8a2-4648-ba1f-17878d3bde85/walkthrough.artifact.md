# Walkthrough - Nurse and Technician UI Alignment

I have updated the Nurse and Technician portals to match the high-fidelity design of the Physiotherapist portal, ensuring a consistent and professional experience across all care staff roles.

## Changes Made

### High-Fidelity Header & Stats
- **Standardized Header**: Both the Nurse and Technician dashboards now feature a rich **emerald green gradient header** with "Profile & settings" and "Log out" buttons pinned for easy access.
- **Bold Stat Cards**: Redesigned the "Today", "Visits", and "Score" cards to be bold and prominent, matching the reference screenshot from the handover.
- **Role-Specific Metrics**:
  *   **Nurses**: See "Upcoming" and "Open jobs" stats.
  *   **Technicians**: See "Upcoming" and "Open requests" stats.

### Real-Time Broadcast Alerts
- **⚡ Live Incoming Broadcast**: Implemented the high-impact alert UI for both roles. When a real-time request (Now) is made, staff will see a pulsing alert with the patient's area and potential earnings.
- **Specialty Matching**:
  *   Nurses are matched with "Nursing" requests.
  *   Technicians are matched with "Diagnostic" requests.

### Expanded Handover Profile
- **Nurse & Tech Profile Updates**: The profile forms now include all mandatory fields specified in the handover doc:
  *   **Council Registration**: Added field for registration numbers.
  *   **Availability & Pay**: Added "Travel radius", "Minimum pay", and "Working days" selection.
  *   **Quiet Hours (DND)**: Added auto-offline window preferences with emergency override.
  *   **Professional Growth**: Added "Recent courses" and "Special interests" text areas.
- **Updated Data Layer**: Modified `nurse.functions.ts` and `technician.functions.ts` to support saving and loading these new fields from the database.

## Verification Results

### Manual Test Path
1. **Login**: Log in as a Nurse or Technician using the one-click demo buttons.
2. **Dashboard**: Verify the header is emerald green and the stats cards are large and bold.
3. **Profile**: Go to the "My profile" tab and verify all new fields (radius, pay, DND, etc.) are present and savable.
4. **Live Alert**: Trigger a mock care request for "Nursing" or "Diagnostic" and verify the pulsing broadcast alert appears at the top of the dashboard.
