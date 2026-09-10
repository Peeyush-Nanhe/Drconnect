# MyDox patient navigation redesign

The visual direction described below was superseded on 9 September 2026 by the [approved Stitch patient theme](APPROVED_PATIENT_THEME.md), now active at `/`. The updated bottom navigation is Home, Schedule, Services, Consult and Profile; Nearby remains accessible from Home and Profile. This document records the earlier integration and its existing workflow preservation.

Updated 8 September 2026. The owner's references called for a calm teal and white interface, grouped services, and bottom navigation. The redesign is implemented in the running React app. Figma editing tools were unavailable in this session; no Figma file was created.

## Navigation and feature map

| Tab | Contents |
| --- | --- |
| Home | Greeting, emergency entry, doctor booking, global search, four everyday shortcuts, bookings, Ask AI, care program and community shortcuts |
| Services | Searchable directory of 36 entries in six expandable categories; only one category is expanded during normal browsing |
| My Care | All-module bookings, consultation history, health records, calendar, expandable doctors/family plan, chats/care groups, referrals and AI tools |
| Nearby | Existing interactive hub map, doctor search, hospital admission, diagnostics and ambulance/SOS |
| Profile | Existing health profile, records, rewards, notifications, family/insurance benefits, community programs, provider links, clinic demo, admin sign-in and sign-out |

Service categories are Doctors & specialists; Tests & scans; Care at home; Care programs; Hospitals & urgent care; Community & benefits. Their complete inventory lives in `src/features/mydox/patient-services.ts`.

The existing doctor, scan, nursing and other provider picker is revealed only after choosing a service. The same visit modes, prices, schedules, consent gates, preferred-provider behavior and booking handlers remain in use. Referrals, AI recommendations, records and rebooking entry points also reveal the picker. The bottom tabs return to the service groups without cancelling an active request; the active-request tracking banner remains available.

## Visual system

- Primary teal `#126e82`, text `#183b43`, secondary text `#617880`, canvas `#f5f9fa`, borders `#e0ebed`.
- Existing Plus Jakarta Sans typography, with system sans-serif fallback.
- Soft 17–25px card corners, restrained shadows, consistent line icons and a teal hero illustration made from CSS and icons.
- Fixed bottom navigation within the app frame, a separately scrolling content area, safe-area spacing, keyboard focus indicators, native disclosure elements and reduced-motion support.
- The patient footer was removed because it added an extra page scroll below the bottom navigation. Admin access remains under Profile → More from MyDox.

## Implementation

- `PatientDashboard.tsx`: presentation, bottom navigation, searchable service groups and expandable care sections.
- `patient-services.ts`: service names, category membership and action identifiers.
- `patient-dashboard.css`: patient-only visual styles and responsive layout.
- `MyDoxFull.jsx`: adapter to existing actions/overlays and conditional display of the original booking controls.
- `src/routes/index.tsx`: patient footer visibility.

The provider/admin dashboards and detailed legacy service overlays retain their existing designs. This change reorganizes patient navigation; it does not turn existing demonstration features into production services. For example, Surgery & procedures retains its existing informational action. No database migrations, credential changes or production deployment are part of this redesign.

## Verification

`npm run check` covers TypeScript, lint, the 19 existing database checks and the production build. Browser review used the patient demo session and verified:

- All five bottom tabs and the six expandable groups, containing all 36 directory entries.
- One expanded service group at a time; filtering services and clearing the filter.
- Doctor and scan entry points opening the original visit-mode and specialty controls.
- Medicine delivery opening the existing order form without submitting an order.
- Doctors/family-plan disclosure, the nearby map, and profile controls.
- 320px and 390px phone widths and a 1024px desktop viewport; no horizontal document overflow, with navigation inside the app frame.

No real care requests or payments were submitted during visual verification. APK packaging still follows `ANDROID_STUDIO.md`: the current USB preview requires the local web server and ADB port forwarding. This redesign does not create a standalone offline APK.
