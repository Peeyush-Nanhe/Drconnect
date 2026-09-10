# MyDox handover

The consolidated React/TanStack Start app uses Supabase Auth, PostgreSQL and RLS. See [BUILD_STATUS.md](BUILD_STATUS.md) for current verification and remaining work.

## Run locally

Use Node.js 22.12+ or a compatible newer release. The existing checkout already has a configured, ignored `.env`. On a new checkout, copy `.env.example` and supply the staging values privately.

```powershell
npm ci
npm run dev
npm run check
```

Open `http://127.0.0.1:8081/auth`. The 20 owner-requested [demo accounts](staging/DEMO_ACCOUNTS.md) are ready for staging testing.

## Configuration

| Variable | Scope | Purpose |
| --- | --- | --- |
| VITE_SUPABASE_URL | Browser | Supabase URL |
| VITE_SUPABASE_PUBLISHABLE_KEY | Browser | Public API key; RLS still applies |
| VITE_SUPABASE_PROJECT_ID | Browser | Project reference |
| SUPABASE_URL | Server | Same backend URL |
| SUPABASE_PUBLISHABLE_KEY | Server | Public API key for authenticated operations |
| SUPABASE_SERVICE_ROLE_KEY | Server only | Privileged API key; never expose or commit |
| PUSH_DISPATCH_SECRET | Server only | Push-dispatch request authentication |
| FCM_SERVICE_ACCOUNT_JSON | Server only | Optional Firebase push transport |
| LOVABLE_API_KEY | Server only | Optional existing AI gateway |

The source archive excludes the live staging `.env`, installed dependencies and build output. It preserves historical migrations, including an excluded legacy demo-account script; do not deploy that root history to a fresh database.

## Folder map

- `src/routes`: application routes and API handlers.
- `src/features/mydox`: patient, provider, hospital, coordinator, staffing and other product screens.
- `src/lib`: server functions and helpers.
- `src/integrations/supabase`: browser/server clients, Auth middleware and schema types.
- `supabase/migrations`: 66 preserved source migrations for provenance.
- `staging/supabase/migrations`: the three immutable migrations actually deployed to MyDox Staging.
- `staging/source-manifest.json`: baseline source checksums and exclusions.
- `tests`: local PostgreSQL/RLS regression tests.
- `scripts`: baseline verification, hosted integration tests and explicit demo provisioning.
- `android`: MyDox Capacitor project; debug preview build instructions are in [ANDROID_STUDIO.md](ANDROID_STUDIO.md).
- `public`: PWA manifest and icons.

Flutter source was removed from this React-focused deliverable.

## Database and roles

Follow [staging setup](staging/README.md) for CLI commands. Always use `--workdir staging` for this staging database; never push the root history into it. Add a migration instead of editing one already applied.

Every public table needs deliberate grants and RLS. Roles live in `user_roles`; client metadata or localStorage cannot grant them. New public signups receive patient access, with pending provider/facility requests. The super-admin approves those requests. The owner-requested persistent demo accounts were provisioned separately through the Auth Admin API.

The original hidden MyDox form capture has been removed; captured forms now remain in the same project's RLS-protected table.

## Product constraints

- Patient doctor-booking behavior is frozen unless the owner explicitly approves changes.
- Keep real Supabase authentication and RLS; do not add demo/localStorage login bypasses.
- Retain Supabase as the backend.
- Keep synthetic data in Pune and separate from real patient data.
- Do not infer real medical credential verification from a demo profile.

## Release follow-up

Complete browser acceptance tests for bookings, approvals, registration review, rosters, cancellations and earnings. Review the ten remaining authenticated security-definer warnings and performance notices recorded in staging setup. Review AI share-token access and expiry.

AI gateway, push delivery and production email/redirect configuration need separate setup and testing. Before production, replace shared demo access with private accounts.

The app contains server functions. Deploy and validate its web/server components before choosing a supported native API strategy. The Capacitor Android scaffold alone does not validate a production app; confirm the permanent application ID and signing plan.
