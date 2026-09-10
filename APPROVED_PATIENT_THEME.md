# MyDox approved patient theme

Approved by the owner on 9 September 2026: the Stitch design with the personalised greeting, teal-to-cyan-to-pearl backgrounds, shaded icon tiles, soft cards, clinical shortcuts, doctor imagery and floating bottom navigation.

This is the default patient presentation at `/`. The signed-in profile supplies the greeting; it changes with the time of day. The header contains MyDox, the selected care location, notifications and profile access. Its styling also applies to the current Capacitor web preview because it opens this same app.

## Navigation and existing actions

| Section | Contents |
| --- | --- |
| Home | Greeting, emergency access, global search, appointments entry, eight clinical shortcuts, specialty discovery, care cards, assistant and nearby map entry |
| Schedule | Existing bookings, consultation history, records, calendar, doctors/family plan, referrals and AI tools |
| Services | All 36 existing service entries in six searchable, expandable groups |
| Consult | Existing consultation entry, history, chats/care groups and doctor recommendations |
| Profile | Existing profile/settings, records, rewards, notifications, benefits, nearby care, other MyDox areas and sign-out |

Nearby remains accessible from Home and Profile. The previous doctor-booking controls, visit modes, scheduling, pricing, consent, emergency and dispatch handlers are retained. The active-request banner and home card return to tracking without cancelling the request. Specialty chips populate the existing search with the selected specialty.

## Approved examples versus app content

`/stitch-preview` preserves the complete approved sample for reference, labelled **APPROVED THEME · Sample data**, with an **Open MyDox** link. `/design-preview` preserves the earlier comparison.

The main app does not promote Dr. Vishal Shah's sample appointment, the Krishna/Charlotte example identities, their sample prices or the mock checkout into live booking data. Its appointment panel opens My bookings and shows an active request when available. The two illustrated care cards open the existing neurology/cardiology catalogue; their images are decorative and do not identify a listed provider. The original My Doctors/family-plan features remain under Schedule.

This finalises the patient theme and navigation. Existing service implementations retain their current capabilities and any demonstration content; selecting a theme does not implement missing backend services. Detailed legacy booking screens and provider/admin screens retain their existing layouts. No database schema, role, credential, payment processing or deployment changes are included. Previously built APK files are not rebuilt by this change.

## Implementation and validation

- `PatientDashboard.tsx` and `patient-stitch-theme.css`: patient header, navigation and supporting section styles.
- `stitch/StitchPatientHome.tsx`: approved home presentation connected to existing app actions.
- `stitch/StitchPrimitives.tsx` and `clinical-shortcuts.ts`: shared icons, headings and shortcuts used by both the approved sample and the main app.
- `stitch/stitch-preview.css`: shared visual styles; typography and imagery are served locally.
- `MyDoxFull.jsx`: small action/active-request adapters; existing booking logic remains intact.
- `backend.ts`: referral subscriptions now use one channel per hook instance and remove it when the screen unmounts. The former cleanup was returned from an async initializer and never reached React, causing a subscription error when returning to care screens. This follows [Supabase channel cleanup](https://supabase.com/docs/reference/javascript/removechannel); table queries and RLS remain unchanged.

Validation: `npm run check` (TypeScript, lint, 19 database tests and build), plus browser checks for the patient home, bottom navigation, service filtering, specialty search, the existing doctor picker and narrow mobile layout. No care request or payment is submitted during visual verification.
