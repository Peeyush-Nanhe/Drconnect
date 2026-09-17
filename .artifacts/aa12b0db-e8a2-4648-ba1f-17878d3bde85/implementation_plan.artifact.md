# Implementation Plan - Nurse/Technician Dashboard and Flow Alignment

Align the Nurse/Technician dashboards and patient-side confirmation logic with the Doctor flow and requirements from the handover document.

## User Review Required

> [!IMPORTANT]
> I am moving the **Nursing and Technician Request Panels** to the very top of the scrollable area in the provider dashboard. I will also update the header to match the styling shown in your screenshot (green gradient, prominent stats).

> [!CAUTION]
> I will implement a `syncTechnician` effect on the patient side. This will watch the `technician_visits` table and automatically transition the \"Request sent\" modal to \"Booking Confirmed\" once a technician accepts, matching the Doctor/Nurse behavior.

## Proposed Changes

### main Dashboard UI (MyDoxFull.jsx)

#### [MODIFY] [DoctorApp](file:///D:/freelance/Drconnect-main/src/features/mydox/MyDoxFull.jsx#L8013)
- **Header Refresh**: Update the `grad` constant and header background to match the emerald green gradient in the screenshot.
- **Dynamic Stats**: Ensure the \"Today\", \"Visits\", and \"Score\" stats are prominently displayed and styled according to the reference.
- **Alert Priority**: Ensure `NurseRequestsPanel` and `TechnicianRequestsPanel` are the first elements in the `flex-1` scrollable area.

#### [MODIFY] [syncTechnician](file:///D:/freelance/Drconnect-main/src/features/mydox/MyDoxFull.jsx)
- **New Effect**: Add a `useEffect` to watch `technician_visits` for the current patient.
- **Modal Transition**: When a technician is assigned (`status === 'assigned'`), update the `confirmedBooking` state to `pending: false` and show the technician's details. This fixes the issue where it stays on \"Request sent\".

---

### Responder Panels

#### [MODIFY] [NurseRequestsPanel.tsx](file:///D:/freelance/Drconnect-main/src/features/mydox/nursing/NurseRequestsPanel.tsx)
- **Notification Enhancement**: Ensure the visual notification for new requests is hard to miss (higher z-index, prominent color).

#### [MODIFY] [TechnicianRequestsPanel.tsx](file:///D:/freelance/Drconnect-main/src/features/mydox/technician/TechnicianRequestsPanel.tsx)
- **Notification Enhancement**: Similar to Nursing, ensure technicians are clearly alerted to new pings.

## Verification Plan

### Automated Tests
- Run `npm run typecheck` to ensure no breaks in the new sync logic.

### Manual Verification
1. **Nurse/Tech Dashboard**: Log in as a Nurse or Medico and verify the requests appear at the top, above other content.
2. **Technician Acceptance Flow**:
   - Book a technician as a patient.
   - Accept the job as a technician.
   - **Crucial**: Verify the patient's modal automatically updates from \"Request sent\" to \"Booking Confirmed\".
3. **Styling**: Compare the dashboard header and stats with the provided screenshot.
