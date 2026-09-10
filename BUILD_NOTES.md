# MyDox — consolidated build notes

## Merge basis

- **Base:** the September 6 source package because it has the newest Supabase migrations and newer Mental Wellness, staffing, admin and physiotherapy work.
- **Recovered workflow:** richer Care Physician/RMO profile, procedure capability, Pune preference and transparent matching concepts from the older source.
- **Release/security guidance:** applied the handover's vendor-independent Vite direction, Android ID cleanup, database-first approach and external-data-egress warning.

## Added / changed

1. Standard Vite/TanStack/Tailwind configuration replaces `@lovable.dev/vite-tanstack-config`.
2. Existing MCP integration is intentionally retained.
3. `account_role_requests` makes provider/facility signup a pending request instead of a client-granted privilege.
4. Signup always starts at patient privileges; super-admin approval grants provider/facility access.
5. Removed hardcoded one-click demo credentials from the auth UI and removed automatic admin grants from the final signup trigger.
6. Added manual first-owner bootstrap template at `supabase/manual/BOOTSTRAP_SUPER_ADMIN.sql`.
7. `care_physician_profiles` persists physician qualifications, council registration, experience, procedure capabilities, interests and preferences.
8. `staffing_jobs.required_procedures` persists hospital clinical requirements.
9. `claim_staffing_job(uuid)` provides an atomic final-slot acceptance path.
10. PostgreSQL guards enforce qualification, experience, required procedures, availability and ICU registration gates.
11. `/admin/credentials` provides admin registration verification/revocation.
12. Hidden external MyDox form capture was removed; `mcCapture()` now writes to the same Supabase project's `form_submissions` table under RLS.
13. Recovered RLS hardening scopes legacy `has_role()` policies to authenticated users.
14. Supabase TypeScript definitions were extended for the new tables, role-request table, staffing column and RPC.
15. Flutter source was removed from this deliverable to keep it a React-focused handoff.
16. Recovered Android/Capacitor shell uses `com.mydox.app` consistently as a development application ID.

## Run

```bash
cp .env.example .env
npm ci
npm run dev
```

MyDox Staging is already deployed. Its migration history lives in `staging/supabase/migrations`; do not push the root history into it. See [staging setup](staging/README.md) before database changes.

Then run:

```bash
npm run check
```

## Mobile packaging caution

Current verification is recorded in [BUILD_STATUS.md](BUILD_STATUS.md): 19 local database tests, 12 hosted integration checks and 20 owner-requested demo account logins pass. The app runs at `http://127.0.0.1:8081/auth`.

The Android debug preview APK now builds and installs. It loads the running server on the development PC; see `ANDROID_STUDIO.md`. Existing TanStack Start server functions require a deployed server/API path for production and are not automatically supplied by a static Capacitor WebView. Full mobile acceptance testing remains pending.

## Production checklist

- If upgrading an existing database, disable/delete any old demo admin Auth users that an already-applied legacy migration may have created.
- For a fresh database, sign up the owner normally and use the manual super-admin bootstrap SQL once.
- Approve provider/facility access requests from the super-admin users screen; do not bypass the role-request flow.
- Confirm permanent Android application ID and signing strategy.
- Review AI share-token lifetime/access controls.
- Keep service-role and push/FCM secrets server-only.
- Verify medical-registration evidence before approving Care Physician critical-duty access.
- If you need per-procedure credential verification, add evidence/approval fields rather than relying on self-declaration.
- Run migrations and `npm run check` against a staging environment before live patient use.
