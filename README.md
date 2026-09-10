# MyDox — React + Supabase

Consolidated healthcare-aggregator application built from the supplied September 2026 guidance package and the two supplied source code packages.

## Stack

- React 19
- TanStack Router / TanStack Start (React application + server functions)
- Supabase Auth + PostgreSQL + Row Level Security
- Tailwind CSS 4
- Capacitor Android project with a MyDox debug APK preview; see [Android Studio setup](ANDROID_STUDIO.md)

## Major product areas already present

- Patient healthcare marketplace and booking flows
- Doctor/provider workflows, availability and earnings
- Hospital / hub workflows and bed / service coordination
- Care Physician / RMO staffing marketplace
- Mental Wellness screening, booking and admin analytics
- Home physiotherapy booking, visits and admin control room
- Surgery workflows
- Care coordinator workflows
- Dialysis, medical tourism and other care programmes
- Blood bank, special-needs, prosthetics, medicine delivery and community flows
- Live operations, users/roles, locum analytics and credential verification admin screens

## New Care Physician marketplace

The consolidated build persists the richer Care Physician workflow in Supabase:

- 4-step physician profile: qualification, council registration, experience, procedures, duty preferences and Pune locations/hospitals
- Hospital shift/full-time posting with specialty, qualification, minimum experience, required procedures, pay, date/shift, capacity and urgency
- Transparent ranked shortlist
- Hard eligibility gates for qualification, experience and required procedures
- ICU / critical-duty blocking until medical registration is verified
- Admin credential-verification queue at `/admin/credentials`
- Atomic `claim_staffing_job(uuid)` RPC so the final available slot cannot be won by two physicians
- Roster and completed-duty earnings view

## Secure provider/facility onboarding

A client can no longer grant itself a provider/facility/admin role during signup.

- Every new account starts with patient privileges.
- Provider and facility selections create a pending `account_role_requests` record.
- The requested subtype (doctor, Care Physician, ambulance, coordinator, hospital/hub, diagnostic centre, pharmacy or lab) is retained for the correct dashboard.
- A super-admin approves the matching role from `/admin/users`.
- Only then can the account enter provider/facility RLS-protected workflows.
- No hardcoded one-click demo credentials remain in the authentication UI.

For a brand-new Supabase project, create the first super-admin manually using `supabase/manual/BOOTSTRAP_SUPER_ADMIN.sql` after that owner has signed up normally.

## Supabase backend

The `supabase/migrations` folder preserves the source history, including these consolidation migrations:

- `20260907021000_secure_role_requests_and_signup.sql` — safe signup and provider/facility approval requests; removes trust in client-claimed privileged roles
- `20260907022000_scope_role_policies_to_authenticated.sql` — recovered RLS hardening
- `20260907023000_care_physician_marketplace_and_local_capture.sql` — Care Physician profiles, staffing safety gates, atomic claiming and local form capture

The form-capture migration removes the old hidden external backend by keeping captured forms in this same Supabase project under RLS. A further source migration preserves accepted-duty visibility and clears verification when a physician changes registration identity.

The deployed **MyDox Staging** project uses three migrations in `staging/supabase/migrations`, including a fresh baseline that excludes unsafe historical account creation/grants. See [staging setup](staging/README.md) for the exact history. Do not push the root migration directory into this project.

## Setup

1. For a new checkout, copy `.env.example` to `.env`. The existing local checkout is configured; preserve its `.env`.
2. Add your Supabase URL and publishable key.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only — never put it in a `VITE_` variable.
4. The staging schema is already deployed. Follow [staging setup](staging/README.md) for database changes.
5. Install and run:

```bash
npm ci
npm run dev
```

Use Node.js 22.12+ or a compatible newer release. Open `http://127.0.0.1:8081/auth`. The owner-requested [demo accounts](staging/DEMO_ACCOUNTS.md) are ready.

For TypeScript, lint, database tests and a production build:

```bash
npm run check
```

For hosted integration tests against this exact staging project, with its server key in the local `.env`:

```bash
npm run test:staging
```

## Important launch notes

- This is a full web React/TanStack Start app. Several existing features use server functions, so the Android Capacitor folder is a **packaging scaffold**, not a promise that every server-function feature works as an offline/static WebView build. Deploy the web/server application first; then choose a supported native API strategy before Play Store production.
- Confirm the permanent Android application ID before first store release. The recovered shell is normalized to `com.mydox.app` for development.
- If this is an **existing** Supabase project that previously ran the September demo-auth migration, disable/delete any old demo admin Auth users before production. The new migration prevents future automatic privilege assignment but deliberately does not delete existing accounts.
- Review public AI share-token expiry/user binding before production.
- Registration verification confirms the medical registration gate. Procedure capabilities are still self-declared in this MVP unless you add document/evidence verification per procedure.

See [BUILD_STATUS.md](BUILD_STATUS.md) for verification, [GitHub sync](GITHUB_SYNC.md) for the private repository workflow, [MyDox branding](MYDOX_BRANDING.md) for Android details, and `ANALYSIS.md` and `BUILD_NOTES.md` for merge decisions.
