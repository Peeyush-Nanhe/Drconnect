# Research Findings - Technician & Nurse Flow Audit

I have audited the code and database for Technician and Nurse booking flows, specifically for \"Urgent\" (Now) and \"Book for Later\" (Scheduled) scenarios.

## 1. Technician Flow

### Urgent (Emergency / Now)
- **Code Path**: `SpecialtyPickerModern` -> `handleBook` -> `bookSvc` -> `actions.book` -> `createCareRequest`.
- **Database**: Entries are inserted into the `care_requests` table with the `emergency` flag set to `true`.
- **Status**: **Working properly** (code-wise), though no recent entries were found in the database.

### Book for Later (Scheduled)
- **Code Path**: `SpecialtyPickerModern` -> `onBook` -> `handleBook` -> `proceedNormal` -> `atomic_book_appointment`.
- **Issue Found**: ⚠️ **Broken in UI**. The scheduled booking flow requires a provider ID, but the UI currently hides the provider selection panel for Technicians. This results in an \"Invalid provider selected\" error when trying to book.
- **Database**: No recent entries found because of the UI bug.

---

## 2. Nurse Flow

### Urgent (Emergency / Now)
- **Code Path**: Follows the same path as Technicians -> `care_requests`.
- **Status**: **Working properly** (code-wise), though no recent entries found.

### Book for Later (Scheduled)
- **Code Path**: `SpecialtyPickerModern` -> `onBook` -> `handleBook` -> `proceedNormal` -> `create_nursing_engagement`.
- **Database**: Entries are inserted into `nursing_engagements` and `nursing_visits`. I confirmed that visits (e.g., \"Seq: 1, Date: 2026-09-15\") are correctly created for each engagement.
- **Status**: ✅ **Working properly**.
- **Issue Found**: ⚠️ **Hardcoded Location**. The coordinates for new nursing engagements are currently hardcoded to Koregaon Park (18.5362, 73.8930) in the frontend.

---

## 3. Database Entry Verification Results
I ran a custom check script against the staging database:
- **Technician Profiles**: 0 found with \"Technician\" specialty. (Need to verify if any users are onboarded as techs).
- **Recent Technician Reqs**: 0 found.
- **Recent Technician Apps**: 0 found.
- **Recent Nurse Reqs**: 0 found.
- **Recent Nursing Engagements**: **5 found**. (Confirmed working).

## Recommendations
1.  **Enable Provider Selection**: Modify the UI to allow selecting a Technician/Therapist for scheduled visits.
2.  **Fix Location Hardcoding**: Pass the actual user location/area to the Nursing Engagement RPC.
3.  **Onboard Demo Techs**: Ensure there are demo technician accounts available for testing the flow.
