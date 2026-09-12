# MyDox build status

Updated 2026-09-07. The consolidated app is connected to isolated hosted staging. Production release and full workflow acceptance testing remain pending.

## Environment

- Project: **MyDox Staging** (`pyrlvjeectjikvfksukb`), Mumbai (`ap-south-1`).
- Organization: `kunal110284-sys's Org`. The owner approved the quoted **$10/month** project cost on the Pro plan.
- Local app: `http://127.0.0.1:8081/auth`; start with `npm run dev`.
- Auth Site URL: `http://127.0.0.1:8081`; allowed redirect: `http://127.0.0.1:8081/ /////**`.
- The local ignored `.env` contains the staging configuration. The server secret is excluded from Git and the source archive.
- Both pre-existing active Supabase projects were left unchanged.

## Database deployment

The remote history matches these immutable files in `staging/supabase/migrations`:

1. `20260907094744_careconnect_fresh_baseline.sql`
2. `20260907095735_restrict_staging_function_access.sql`
3. `20260907103546_rename_seed_hubs_mydox.sql`

All **50 public application tables have RLS enabled**. The fresh baseline seeds no Auth users. It combines 64 of the 66 preserved source migrations, excluding a hardcoded source-account role grant and historical administrator creation with an embedded password. Enum values are declared at creation for atomic execution. **Do not push the root migration history into staging.** See [staging setup](staging/README.md).

## Demo access

See [MyDox branding](MYDOX_BRANDING.md) for the web/native rename, Android compilation results and APK deployment limits. See [GitHub sync](GITHUB_SYNC.md) for the connected private repository and synchronization commands.

At the owner's explicit request, **20 demo accounts** were provisioned separately through the server-side Auth Admin API. Every password login and role/profile mapping passed verification. The supplied shared demo password is not embedded in the new setup script or browser code.

- Sixteen provider/facility access requests are approved.
- The coordinator fixture has approved coordinator access.
- The admin account has `admin`; the super-admin has both `admin` and `super_admin`.
- Care Physician registration is still unverified; complete the profile and review credentials through the normal workflow.
- No invitation or confirmation emails were sent to the dummy addresses.

See [demo accounts](staging/DEMO_ACCOUNTS.md) for the roster and sign-in links. These are staging fixtures; set up a private owner account before production.

## Fixes and verification

- Provider/facility signup records pending approval requests and grants patient access only.
- Assigned physicians can still read their accepted duties after the final slot fills.
- Changing qualification or registration identity clears prior medical-registration verification; availability edits preserve it.
- Family-plan functions obey patient RLS.
- Submitted coordinators cannot read patient queues or approve themselves; approved coordinator access also requires a provider role.
- Anonymous privileged-function access and direct trigger-function execution are restricted.
- Auth input labels were added and a guest-browsing link that returned straight to login was removed.
- Removed the two outer dashboard headers requested by the owner, including the top map/admin links, account text and MyDox/role/Switch row. Existing profile-menu sign-out remains available.
- The super-admin user list displays all 20 accounts. Server network access is required to validate Auth tokens. Loading failures now remain visible, global notifications are mounted, and role selectors display each account's highest role.
- Windows build fixes and same-project form capture are retained.

Completed checks:

- `npm run check`: TypeScript, ESLint, **19 local database tests** and client/server production build pass. ESLint retains 130 inherited warnings and no errors.
- `npm run test:staging`: **12 hosted integration checks** pass, covering real Auth, persistence after sign-out/sign-in, role boundaries, patient isolation, ICU eligibility and two simultaneous final-slot claims.
- The five temporary integration-test accounts and their records were removed; a separate SQL check verified cleanup before creating the requested persistent demo accounts.
- All **20 persistent demo account logins** passed, with correct profile views and role grants.
- Security advisors: no errors, no anonymous security-definer warnings; ten authenticated business-helper warnings remain for review.

## Remaining work

- Browser acceptance testing across bookings, approvals, credentials, rosters, cancellations and earnings. Patient doctor-booking behavior remains frozen.
- Review authenticated helper access, inherited RLS performance advisories and AI share-token access/lifetime; see the remediation links in [staging setup](staging/README.md).
- Configure/test optional AI, push and email delivery; deploy the web/server app and configure production Auth URLs and monitoring.
- Android debug APK builds with the MyDox label and `com.mydox.app`; see [Android Studio setup](ANDROID_STUDIO.md). Complete hosted server/mobile release configuration and signing before production distribution.
