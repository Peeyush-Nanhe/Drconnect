# MyDox interactive patient design preview

Open `http://127.0.0.1:8081/design-preview` while the existing development server is running (`npm run dev`). This is an isolated, publicly accessible design review route. The current app is still at `/`.

This sample explores the owner's September 7–8 reference screenshots: compact consultation choices, readable specialty cards, expandable service groups, a location picker, and booking progress. It uses MyDox's five sections: Home, Services, My Care, Nearby, and Profile.

## What to try

1. Choose Clinic visit, Video consult, or Home visit from Home.
2. Search a specialty, choose an example doctor, select a date and time, and optionally change the example patient.
3. Review the visit, use Edit visit details to go back, and select Finish sample.
4. Tap the area in the header, search for Wakad or another Pune area, and select it.
5. Open Services, expand one of six groups, search the existing 36 service entries, and open a service.
6. Explore My Care, Nearby, and Profile using the bottom navigation.

## Review boundaries

All preview interactions use local React state. The page creates no appointments, orders, payments, messages, account changes, or emergency dispatches. Refresh resets the sample. Doctor details, fees, availability, patient profiles, and appointments are illustrative. The map is an illustration; current location simulates a selection without requesting GPS access. Location selection changes the prototype labels only.

The doctor booking sequence is interactive. Other services open a generic focused page or a sample panel; they are layout demonstrations, not completed service workflows. The actual patient booking components and backend are not modified by this preview. Clinic/video/home eligibility is not enforced in sample data. Production integration and real data filtering require a separate implementation decision after review.

## Files

- `src/routes/design-preview.tsx`: isolated route and no-index metadata.
- `src/features/mydox/preview/PatientDesignPreview.tsx`: sample screens and interactions.
- `src/features/mydox/preview/patient-design-preview.css`: styles scoped to the preview.
- `src/features/mydox/patient-services.ts`: existing service catalogue reused without changes.

## Validation

- TypeScript, lint, existing database tests, and production build through `npm run check`.
- Browser walkthrough: consultation modes, specialty search, doctor selection, date/time selection, patient selection, review/edit/completion, location search, service expansion/detail, all five tabs, and Escape closing a modal.
- Responsive checks at 320, 390, and 1024 CSS pixels; no document horizontal overflow and navigation remains inside the viewport.
- No browser runtime errors observed in the preview.
