# MyDox: IT team handover

Prepared 7 September 2026 for the project owner, Dr Kunal. This is the current React + Supabase development baseline. Read this file first; it supersedes older statements about failed dependency installation or the Android shell being unbuilt.

## What you are receiving

The handover ZIP contains the complete versioned source in `MyDox/`, database migrations and tests, Android Gradle sources, a staging configuration template, demo login instructions, verification evidence, a file checksum manifest, and the MyDox emulator preview APK. It excludes live `.env` files, privileged keys, Android signing keys, dependencies, caches, and Git history.

This is a React 19 / TanStack Start application with a Node server, Supabase Auth/PostgreSQL/RLS, Tailwind CSS and a Capacitor 7 Android project. It is not a Flutter project. Android Studio opens the `MyDox/android` folder. Edit web features in `MyDox/src`; Android Studio alone does not run the Node server.

Private source repository: https://github.com/kunal110284-sys/MyDox, branch `main`. The outer handover's `RELEASE_INFO.json` identifies the exact source commit. The ZIP is a snapshot; later GitHub changes do not alter it.

## New-PC setup, in order

1. Extract the entire ZIP to a short local path, such as `C:\Dev\MyDox-Handover`. Avoid opening files inside the ZIP or placing the project in a cloud-synchronized folder.
2. Install Git, a compatible Node.js version, Android Studio, and JDK 17. Node 26.2.0 was used for the verified build; the documented minimum is Node 22.12+. Use `npm ci` with the supplied lockfile. Do not upgrade dependencies during initial reproduction.
3. In Android Studio's SDK Manager install Android SDK Platform 35, Build Tools 35.0.0, Platform Tools, and an emulator system image. SDK license acceptance is handled by the developer. The Gradle wrapper is included: Gradle 8.11.1 / Android Gradle Plugin 8.7.2. Initial dependency downloads require internet access.
4. Open PowerShell in the extracted `MyDox` directory. Run `Copy-Item ..\handover\MyDox-staging.env.example .env` and fill the privileged server key privately. The template already supplies the browser-safe staging URL/key. Do not put the secret key in any `VITE_` variable.
5. Run `npm ci`, then `npm run dev`. Keep that terminal running. Open `http://127.0.0.1:8081/auth` and use a demo account from the handover's `handover/DEMO_ACCESS.md`.
6. In a second terminal at the same project root, run `npm run check`. Expected result: TypeScript passes; lint has 130 inherited warnings and no errors; all 19 database tests pass; client/server bundles build.
7. With the server still running, run `npm run android:prepare:preview`. This generates ignored Capacitor assets and Gradle plugin files needed by a fresh checkout. Do this before opening/importing Android on a new PC.
8. In Android Studio choose **File > Open**, select the extracted `MyDox/android` folder, and open it in a new project window. Select JDK 17 for Gradle if prompted. Wait for Gradle sync, select `app` and `debug`, choose an emulator, and press Run.
9. To create the debug APK from the project root, run `npm run android:apk:preview`. Output: `android/app/build/outputs/apk/debug/app-debug.apk`.

If `JAVA_HOME` or `ANDROID_HOME` is needed, point it at that new PC's actual JDK/SDK directories. Do not copy the original PC's paths. The prepare script detects the usual Windows SDK location and creates ignored `android/local.properties` when absent. A fresh source extraction has no `.output` directory; skipping client asset copying during server-preview sync is expected.

## Android behavior and limits

The app label and splash branding are **MyDox**. Application ID/namespace/Java package: `com.mydox.app`. Current Android versionCode is 3 and versionName is 1.2; the npm package version is independently 0.9.0. Confirm release versioning with the owner before publication.

The supplied APK is a debug emulator preview. It loads `http://10.0.2.2:8081`, the emulator's route to the development PC. It needs the MyDox server on that same PC. It does not connect to the original owner's PC after being moved. It is not a standalone phone release or a Play Store artifact.

For an authorized USB-connected phone, `npm run android:apk:usb` builds a preview that uses `http://127.0.0.1:8081`. Use `adb -s <device-id> reverse tcp:8081 tcp:8081` and install the resulting APK on that selected device. Keep USB forwarding and the server active. See `ANDROID_STUDIO.md` for commands.

Debug APK assembly, identity, signature and emulator installation passed. Full Android runtime acceptance is pending: the first startup attempt found the PC server stopped; after restart, the installed emulator's System UI became unresponsive. The emulator was closed. Android Studio's command-line project opening also encountered its existing session `.port` lock; import the extracted project through File > Open on the new PC. These are recorded limits, not completed mobile acceptance tests.

Current TanStack Start output contains server functions and no standalone client `index.html`. A production mobile app needs a hosted server/API and a supported bundled mobile frontend. Do not copy server bundles or privileged keys into Capacitor. The release build deliberately rejects the current server-preview configuration. Cleartext HTTP is allowed only in debug. The owner must retain the production signing key and approve store publication.

## Supabase environment and access

| Setting | Current value |
| --- | --- |
| Project | MyDox Staging |
| Project reference | `pyrlvjeectjikvfksukb` |
| Region | Mumbai, `ap-south-1` |
| Organization | `kunal110284-sys's Org` |
| API URL | `https://pyrlvjeectjikvfksukb.supabase.co` |
| Auth Site URL | `http://127.0.0.1:8081` |
| Allowed local redirect | `http://127.0.0.1:8081/**` |

The owner approved the quoted $10/month staging project charge on the Pro plan. This records that approval, not a new price estimate. The previous active projects were not modified. Do not use another similarly named project.

The project owner should grant the IT team appropriate GitHub/Supabase access through those services. No account invitations or collaborator changes are included in this package. Obtain the staging server secret privately from the owner or the authorized Supabase API Keys page. Save it only in the new PC's ignored `.env` or the deployment provider's secret store. Public configuration in the handover does not provide server-admin access.

`VITE_SUPABASE_*` values are browser-visible. `SUPABASE_SERVICE_ROLE_KEY`, `PUSH_DISPATCH_SECRET`, `FCM_SERVICE_ACCOUNT_JSON` and `LOVABLE_API_KEY` are server-only. AI gateway, Firebase push transport and production email delivery remain optional/unconfigured work. Supabase remains the primary database and authentication service; Firebase is only an optional push transport here.

## Database change procedure

All 50 public application tables have RLS enabled. The existing staging database is already deployed. Connecting a new developer PC does not require recreating or resetting it.

Only `staging/supabase/migrations` owns the deployed history:

1. `20260907094744_careconnect_fresh_baseline.sql`
2. `20260907095735_restrict_staging_function_access.sql`
3. `20260907103546_rename_seed_hubs_mydox.sql`

These files and their checksums are immutable. The root `supabase/migrations` directory preserves 66 historical/consolidation files; two old account-grant/account-creation scripts were excluded when the fresh baseline was assembled. Do not push that root history to staging. `staging/source-manifest.json` and `scripts/build-staging-baseline.mjs` explain and verify the source selection.

Use the Supabase CLI with `--workdir staging`, following `staging/README.md`: link to the exact project, list migrations, create a new migration, test it locally, inspect `db push --dry-run`, then deliberately apply the reviewed change. Do not edit the baseline, reset the shared database, or use migration repair to conceal a mismatch. The baseline is for an empty database, not an existing app database.

The staging integration and demo provisioning scripts are deliberately guarded to this exact project. A future separate environment requires an explicit provisioning plan and updated guards; do not bypass them casually. This ZIP contains reproducible schema and seed history, not an export of hosted Auth users, database records or Storage objects. Arrange backups/restores through Supabase when needed.

## Changes already delivered

The September 6 source was used as the base; the richer Care Physician/RMO profile and matching workflow was recovered from the older package. Newer mental wellness, coordinator, staffing, physiotherapy and admin work was retained.

- Real Supabase authentication and persistence; patient-only signup with pending provider/facility approval requests.
- Server/DB role enforcement, super-admin role management, and protected medical registration approval.
- Persistent physician qualifications, procedures, experience and location preferences, plus hospital staffing requirements and ranked matching.
- Database eligibility gates and atomic final-slot claiming. Accepted duties remain visible after a job fills.
- Editing medical identity/qualifications revokes prior verification; availability edits preserve it.
- Patient-scoped family-plan access; approved coordinator access requires the provider role and verified coordinator profile.
- Hidden external form capture replaced with same-project RLS-protected `form_submissions` storage.
- Global notifications, accessible auth fields, and explicit admin-user loading errors. Admin role selectors show the highest role.
- Twenty owner-requested persistent demo accounts, sixteen approved provider/facility requests and the admin/super-admin consoles.
- Official MyDox branding across UI, metadata, native identifiers, splash and icons. Eleven branded hub names renamed without changing relationships. Home-visit consent uses `home-visit-v2-mydox`.
- Removed the owner-specified outer top bars: live map/admin links, email/role/sign-out row and brand/role/Switch row. Profile-menu sign-out remains.
- Reproducible Windows build, private GitHub connection, guarded sync commands and Android debug preview build scripts.

Historical migration names, database/local-storage identifiers and the exact demo emails selected by the owner remain compatibility records. Do not perform a global search-and-replace across those identifiers. Patient doctor-booking behavior is frozen unless the owner explicitly authorizes a change.

## Verification and acceptance work

Completed: `npm run check` (19 tests, no lint errors), 12 hosted integration checks, all 20 demo password logins and role/profile mappings, independent cleanup checks for temporary test fixtures, MyDox branding review, Android resource/Java compilation and debug assembly, APK signature/ID/label checks, and normal GitHub push with matching remote/local commit. Privileged-key exclusion is checked before packaging.

The 19 local tests use PGlite; they do not replace real Auth/PostgREST/concurrency tests. `npm run test:staging` creates five temporary synthetic accounts, runs the 12 checks, and removes its own records; it preserves the persistent demo roster. It needs the privileged key in the local `.env` and must target only the designated staging project.

A separate source extraction with no prior build output successfully generated Capacitor assets and Cordova Gradle files. This structural portability check reused the already installed dependency tree; the receiving PC must still run its own `npm ci` and build.

The IT team should record browser and device evidence for patient booking/persistence/cancellation, provider availability and earnings, facility requests, coordinator queue access, admin approval/rejection, credential verification/revocation, physician eligibility and concurrent claiming, rosters, physiotherapy, mental wellness, medicine delivery, maps and consent flows. Existing screens are not proof that every external integration is complete. Do not introduce real patient data during staging testing.

Security advisors reported zero errors, no anonymous definer warnings and ten authenticated business-helper warnings. Review their grants, identity checks, search paths and row scope. Performance notices include foreign-key indexes and RLS planning; exact observations and remediation links are in `staging/README.md`. AI share-token access/expiry also needs review.

## Recommended development order

1. Reproduce the web build and demo logins on the new PC; import/sync the Android project and complete emulator/USB smoke testing.
2. Complete the role-by-role acceptance matrix and fix demonstrated workflow defects, retaining the booking freeze and server-side authorization.
3. Review remaining security/performance findings and create targeted, regression-tested migrations.
4. Implement and test needed AI, push/email and other external integrations. Configure deployment secrets privately.
5. Select and validate a server hosting target and production mobile frontend/API approach. Build success alone is not a deployment configuration; no production host/start command has been validated in this handover.
6. Configure production Auth URLs, private owner credentials, backup/restore, monitoring and release signing; remove shared demo access from production. Complete device acceptance before the owner approves distribution.

## GitHub collaboration on the new PC

For ongoing team development, obtain repository access and clone `https://github.com/kunal110284-sys/MyDox.git`. A clone includes history/remotes; the ZIP intentionally does not. Prefer feature branches and reviewed pull requests for multiple developers. Review/fetch before editing, use normal pulls/pushes, and never overwrite unfinished work or force-push shared history.

The supplied `sync:status`, `sync:pull` and `sync:push` commands are guarded to the private repository and `main`; they refuse dirty or divergent work. They will not work in an uninitialized ZIP extraction. `sync:push` runs the project checks first. For a team clone using feature branches, use normal Git branch/PR commands.

A hourly sync is active in the original Codex task/PC. It does not transfer with the ZIP, does not auto-commit unfinished edits, and does not deploy web code, APKs or database migrations. See `GITHUB_SYNC.md`.

## Troubleshooting and file map

| Symptom | First check |
| --- | --- |
| `npm ci` fails | Supported Node version, network access and unmodified lockfile |
| Port 8081 occupied | Identify its existing server; do not kill an unrelated process |
| Missing environment/admin errors | Correct staging `.env`, server key and server internet access |
| Capacitor missing assets/plugin folder | Run `npm run android:prepare:preview` from `MyDox`, with its server running |
| Missing Android SDK/JDK | SDK 35, JDK 17, local SDK path and Gradle sync |
| Blank/error APK page | Correct emulator/USB build mode, PC server running, forwarding for USB |
| Emulator hangs | Use a supported stable emulator image on a sufficiently resourced PC or an authorized USB test device |
| Release build refused | Development preview is still selected; complete the production mobile architecture first |
| Git sync refuses changes | Review/commit intended work or resolve divergence; no forced overwrite |

Use `src/routes` for navigation/API handlers; `src/features/mydox` for product screens; `src/lib` for server functions; `src/integrations/supabase` for clients/Auth/types; `staging` for deployed DB history; `tests` and `scripts` for verification; `android` for native code; and `public` for artwork/PWA assets. `MyDoxFull.jsx` remains a large legacy component: decompose it incrementally after acceptance coverage, preserving behavior.

Companion documents: `README.md`, `README_HANDOVER.md`, `ANDROID_STUDIO.md`, `BUILD_STATUS.md`, `MYDOX_BRANDING.md`, `GITHUB_SYNC.md`, `staging/README.md`, `staging/DEMO_ACCOUNTS.md`, `ANALYSIS.md` and `BUILD_NOTES.md`.
