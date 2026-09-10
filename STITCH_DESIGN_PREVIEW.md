# MyDox · Stitch design preview

The owner approved this theme on 9 September 2026. It is now the default patient presentation at `/`; see [Approved patient theme](APPROVED_PATIENT_THEME.md). Open `/stitch-preview` for the preserved sample, labelled **APPROVED THEME · Sample data**. Its **Open MyDox** link opens the main app. The earlier comparison remains at `/design-preview`.

## Source and adaptation

Based on the owner's `stitch_healthcare_super_app_platform.zip` supplied September 9, 2026. Its five screens cover the healthcare hub, doctor scheduler, diagnostics, doctor chat with an in-chat care plan, and patient checkout. The export's cyan gradients, soft lavender surfaces, photographs, Plus Jakarta Sans typography, rounded cards and floating bottom navigation inform this React implementation.

The export has overlapping headers, a stretched appointment image, clipped service labels and an incorrect image in one doctor card. These were corrected during the port. Branding is MyDox; sample location is Pune and all example prices are in INR. Unsupported accreditation, security, insurance, discount and refund claims from the export are not presented as facts about MyDox. Its clinical prescription text is replaced with an explicitly illustrative care-plan layout.

The September 9 gradient refinement follows the owner's three teal reference screenshots: a deep teal header fades through cyan into pearl, cards use translucent directional shading, and service icon tiles combine soft colour gradients with gradient SVG strokes. The same palette extends to doctor profiles, selected consultation modes, diagnostics, chat, checkout and bottom navigation. Icon gradients use stable React IDs and CSS colours; they remain decorative to assistive technology. This refinement changes presentation only.

## Interactive review paths

- **Doctor consult → profile → consultation mode → date/time → patient details → checkout.** Fees update with mode; changing the date clears the selected time. Patient selection, location, visit time and payment preference can be changed.
- **Lab tests / Scans & MRI → categories/search → add/remove tests → review basket → checkout.** The basket and checkout total reflect exactly the selected examples. Imaging retains its centre-visit label.
- **Consult → sample care plan → Review these tests.** This populates the illustrative test basket. Typed chat messages stay in local memory and are labelled as preview messages.
- **Services → expandable category → individual service.** All 36 current service entries remain discoverable across six categories. Services beyond the five imported screen designs show focused informational placeholders.
- **Home → saved doctor → Profile → Saved doctors.** Favorites are local to the current sample session.
- **Open MyDox** opens the main app with the approved patient theme.

## Boundaries

This is a separate frontend prototype with local React state. It imports no Auth, database, server API, analytics, booking, payment, geolocation or messaging clients. Refreshing resets its data. It does not create appointments, process payments, send messages, upload prescriptions or dispatch emergency services. Completion confirms only that the sample checkout was reviewed. Example patient fields should be used for design review.

Doctor profiles, experience, prices, dates and availability are illustrative. Home collection preferences do not implement provider eligibility or real service filtering. Phone/video calling, clinical advice, insurance, document upload/extraction, production checkout and the other service workflows require separate implementation after design selection.

## Assets and implementation

`src/features/mydox/stitch/` contains the React sample, data and styles. `src/routes/stitch-preview.tsx` registers the route with no-index metadata. The sample and main patient home now share headings, gradient icons, clinical shortcuts and visual styles; they keep separate data and action handling.

Images and fonts are served locally from `public/design/stitch/`. Doctor photos use the exact image URLs referenced by the uploaded export (recorded in `asset-sources.json`); the patient avatar is the PNG included in the ZIP. Plus Jakarta Sans font files are accompanied by their original SIL Open Font License. There is no runtime CDN or downloaded script dependency in this preview.

## Verification

Run `npm run check` for TypeScript, lint, the existing database tests and a production build. Browser review covers the consultation-to-checkout path, family and payment selection, diagnostic totals and filters, care-plan basket, local chat, service search, location selection, and responsive layout. The main app's existing patient/backend workflows are unchanged.
