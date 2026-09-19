import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// Real PostgreSQL execution in memory. Only Supabase's platform-owned Auth schema
// and JWT accessors are fixtures; application tables/policies/triggers are real.
// This does not test GoTrue, PostgREST, Realtime, or concurrent database connections.
const db = new PGlite();
const ids = {
  patient: '10000000-0000-4000-8000-000000000001',
  other: '10000000-0000-4000-8000-000000000002',
  provider: '10000000-0000-4000-8000-000000000003',
  secondProvider: '10000000-0000-4000-8000-000000000004',
  facility: '10000000-0000-4000-8000-000000000005',
};
async function actor(uid, sql, params = [], role = 'authenticated') {
  assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
  return db.transaction(async tx => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [uid ?? '', role]);
    await tx.exec(`set local role ${role}`);
    return tx.query(sql, params);
  });
}
async function signup(id, metadata = {}, email = `${id}@example.invalid`) {
  await db.query('insert into auth.users(id, email, raw_user_meta_data) values ($1, $2, $3)', [id, email, metadata]);
}
before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, phone text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);
  const dir = new URL('../staging/supabase/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
    await db.transaction(tx => readFile(new URL(file, dir), 'utf8').then(sql => tx.exec(sql)));
  }
});
after(() => db.close());

test('fresh staging creates no Auth accounts and leaves no demo signup function', async () => {
  assert.equal((await db.query('select count(*)::int as count from auth.users')).rows[0].count, 0);
  assert.equal((await db.query("select to_regprocedure('public.seed_demo_admin_roles()') as function")).rows[0].function, null);
});

test('fresh baseline refuses an existing schema', async () => {
  const dir = new URL('../staging/supabase/migrations/', import.meta.url);
  const baseline = (await readdir(dir)).find(x => x.endsWith('_careconnect_fresh_baseline.sql'));
  const sql = await readFile(new URL(baseline, dir), 'utf8');
  await assert.rejects(db.transaction(tx => tx.exec(sql)), /requires an empty public schema/);
});

test('every application table has row-level security', async () => {
  const result = await db.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity");
  assert.deepEqual(result.rows, []);
});

test('signup ignores an administrator role in user metadata and a demo admin email', async () => {
  await signup(ids.patient, { role: 'super_admin' }, 'admin1@demo.med');
  const roles = await actor(ids.patient, 'select role from public.user_roles where user_id=$1', [ids.patient]);
  assert.deepEqual(roles.rows, [{ role: 'patient' }]);
});

test('provider and facility signup create pending requests and only patient privileges', async () => {
  await signup(ids.other);
  for (const [id, role, subtype] of [[ids.provider, 'provider', 'care_physician'], [ids.secondProvider, 'provider', 'care_physician'], [ids.facility, 'facility', 'hub']]) {
    await signup(id, { role, subtype });
    assert.deepEqual((await actor(id, 'select role from public.user_roles where user_id=$1', [id])).rows, [{ role: 'patient' }]);
    assert.deepEqual((await actor(id, 'select requested_role, requested_view, status from public.account_role_requests where user_id=$1', [id])).rows, [{ requested_role: role, requested_view: subtype, status: 'pending' }]);
  }
});

test('patient cannot directly grant itself a role or approve its request', async () => {
  await assert.rejects(actor(ids.provider, "insert into public.user_roles(user_id,role) values ($1,'admin')", [ids.provider]), /permission denied|row-level security/);
  await assert.rejects(actor(ids.provider, "update public.account_role_requests set status='approved' where user_id=$1", [ids.provider]), /Only administrators|row-level security/);
});

test('patient role requests and submitted forms are isolated between accounts', async () => {
  assert.deepEqual((await actor(ids.patient, 'select user_id from public.account_role_requests')).rows, []);
  await actor(ids.patient, "insert into public.form_submissions(user_id,form_type,details) values ($1,'test','{}')", [ids.patient]);
  assert.equal((await actor(ids.patient, 'select id from public.form_submissions')).rows.length, 1);
  assert.equal((await actor(ids.other, 'select id from public.form_submissions')).rows.length, 0);
  await assert.rejects(actor(ids.other, "insert into public.form_submissions(user_id,form_type) values ($1,'test')", [ids.patient]), /row-level security/);
});

test('patient cannot create a hospital duty or a physician profile', async () => {
  await assert.rejects(actor(ids.patient, "insert into public.staffing_jobs(facility_id,job_type,title,specialty) values ($1,'shift','Test','Medicine')", [ids.patient]), /row-level security/);
  await assert.rejects(actor(ids.patient, "insert into public.care_physician_profiles(user_id,qualification) values ($1,'mbbs')", [ids.patient]), /row-level security/);
});

test('approved providers can create profiles but cannot verify themselves', async () => {
  for (const id of [ids.provider, ids.secondProvider]) {
    await db.query("insert into public.user_roles(user_id,role) values ($1,'provider')", [id]);
    await actor(id, "insert into public.care_physician_profiles(user_id,qualification,experience_years,procedures,council_name,council_registration_number) values ($1,'mbbs',5,ARRAY['intubation'],'Test Council','TEST-123')", [id]);
    await assert.rejects(actor(id, 'update public.care_physician_profiles set registration_verified=true where user_id=$1', [id]), /administrator/);
  }
});

let jobId;
test('verified hospital can post a duty; an unverified physician is blocked from ICU', async () => {
  await db.query("insert into public.user_roles(user_id,role) values ($1,'facility')", [ids.facility]);
  jobId = (await actor(ids.facility, "insert into public.staffing_jobs(facility_id,job_type,title,specialty,qualification,experience_years,duty_type,required_procedures,capacity) values ($1,'shift','Test ICU duty','Medicine','mbbs',2,'icu',ARRAY['intubation'],1) returning id", [ids.facility])).rows[0].id;
  await assert.rejects(actor(ids.provider, 'select * from public.claim_staffing_job($1)', [jobId]), /Registration verification pending/);
  assert.equal((await db.query('select count(*)::int as count from public.staffing_assignments')).rows[0].count, 0);
});

test('qualified physician claims the final slot; second physician cannot claim it', async () => {
  for (const id of [ids.provider, ids.secondProvider]) {
    await actor(null, 'update public.care_physician_profiles set registration_verified=true where user_id=$1', [id], 'service_role');
  }
  assert.equal((await actor(ids.provider, 'select * from public.claim_staffing_job($1)', [jobId])).rows[0].assignment_status, 'accepted');
  await assert.rejects(actor(ids.secondProvider, 'select * from public.claim_staffing_job($1)', [jobId]), /no longer open|already filled/);
  assert.equal((await db.query("select count(*)::int as count from public.staffing_assignments where job_id=$1 and status='accepted'", [jobId])).rows[0].count, 1);
});

test('physician still sees its assigned duty after the final slot is filled', async () => {
  assert.equal((await actor(ids.provider, 'select id from public.staffing_jobs where id=$1', [jobId])).rows.length, 1);
  assert.equal((await actor(ids.secondProvider, 'select id from public.staffing_jobs where id=$1', [jobId])).rows.length, 0);
  assert.equal((await actor(ids.other, 'select id from public.staffing_jobs where id=$1', [jobId])).rows.length, 0);
  assert.equal((await actor(ids.facility, 'select id from public.staffing_jobs where id=$1', [jobId])).rows.length, 1);
});

test('editing a verified registration number requires verification again', async () => {
  await actor(ids.provider, "update public.care_physician_profiles set council_registration_number='CHANGED-456' where user_id=$1", [ids.provider]);
  const result = await actor(ids.provider, 'select registration_verified, verified_at from public.care_physician_profiles where user_id=$1', [ids.provider]);
  assert.deepEqual(result.rows, [{ registration_verified: false, verified_at: null }]);
});

test('qualification changes also invalidate verification; availability edits preserve it', async () => {
  await actor(null, 'update public.care_physician_profiles set registration_verified=true where user_id=$1', [ids.provider], 'service_role');
  await actor(ids.provider, 'update public.care_physician_profiles set is_available=false where user_id=$1', [ids.provider]);
  assert.equal((await actor(ids.provider, 'select registration_verified from public.care_physician_profiles where user_id=$1', [ids.provider])).rows[0].registration_verified, true);
  await actor(ids.provider, "update public.care_physician_profiles set qualification='md' where user_id=$1", [ids.provider]);
  assert.equal((await actor(ids.provider, 'select registration_verified from public.care_physician_profiles where user_id=$1', [ids.provider])).rows[0].registration_verified, false);
});

test('anonymous callers cannot claim duties or call the private membership helper', async () => {
  await assert.rejects(actor(null, 'select * from public.claim_staffing_job($1)', [jobId], 'anon'), /permission denied/);
  await assert.rejects(actor(null, 'select private.has_staffing_assignment($1)', [jobId], 'anon'), /permission denied/);
});

test('family plan lookup cannot expose another patient through an RPC', async () => {
  await actor(ids.patient, "insert into public.family_physician_plans(patient_id,doctor_name) values ($1,'Test Doctor')", [ids.patient]);
  assert.equal((await actor(ids.patient, 'select (public.get_active_family_plan($1)).patient_id as patient_id', [ids.patient])).rows[0].patient_id, ids.patient);
  assert.equal((await actor(ids.other, 'select (public.get_active_family_plan($1)).patient_id as patient_id', [ids.patient])).rows[0].patient_id, null);
  await assert.rejects(actor(null, 'select public.get_active_family_plan($1)', [ids.patient], 'anon'), /permission denied/);
});

test('submitting a coordinator application does not grant access to the patient queue', async () => {
  await actor(ids.other, "insert into public.coordinator_profiles(user_id,application_status) values ($1,'submitted')", [ids.other]);
  assert.equal((await actor(ids.other, 'select public.is_active_coordinator($1) as allowed', [ids.other])).rows[0].allowed, false);
  await assert.rejects(actor(ids.other, "update public.coordinator_profiles set application_status='verified' where user_id=$1", [ids.other]), /administrator/);
});

test('verified coordinator access requires an approved provider role', async () => {
  await actor(null, "update public.coordinator_profiles set application_status='verified',verified_at=now() where user_id=$1", [ids.other], 'service_role');
  assert.equal((await actor(ids.other, 'select public.is_active_coordinator($1) as allowed', [ids.other])).rows[0].allowed, false);
  await db.query("insert into public.user_roles(user_id,role) values ($1,'provider')", [ids.other]);
  assert.equal((await actor(ids.other, 'select public.is_active_coordinator($1) as allowed', [ids.other])).rows[0].allowed, true);
});

test('no privileged public function is executable anonymously and trigger functions are not RPCs', async () => {
  const result = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and
      (has_function_privilege('anon',p.oid,'EXECUTE')
        or (p.prorettype='trigger'::regtype and has_function_privilege('authenticated',p.oid,'EXECUTE')))`);
  assert.deepEqual(result.rows, []);
});

test('retired home-visit RPCs cannot bypass the canonical secured lifecycle', async () => {
  for (const name of ['create_home_visit_booking', 'accept_home_visit_booking', 'start_doctor_travel', 'verify_home_visit_arrival', 'complete_home_visit_encounter']) {
    const result = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=$1 and has_function_privilege('authenticated',p.oid,'EXECUTE')`, [name]);
    assert.deepEqual(result.rows, [], `${name} must not remain a client bypass`);
  }
});

test('consultation passcode generation and OTP verification lifecycle', async () => {
  const providerId = '20000000-0000-4000-8000-000000000001';
  await signup(providerId, { role: 'provider' }, 'test.otp.doc@example.invalid');
  const patientId = ids.patient;

  // Insert a test appointment
  const aptResult = await actor(patientId, `
    insert into public.doctor_appointments(id, provider_id, patient_id, service, mode, start_time, end_time, fee, status)
    values (gen_random_uuid(), $1, $2, 'General Consultation', 'video', now() + interval '10 days', now() + interval '10 days 30 minutes', 500, 'confirmed')
    returning id;
  `, [providerId, patientId], 'service_role');
  const aptId = aptResult.rows[0].id;

  // 1. Patient or system ensures consultation passcode
  const ensureRes = await actor(ids.patient, `select public.ensure_consultation_passcode($1, '4921') as result`, [aptId]);
  assert.equal(ensureRes.rows[0].result.success, true);
  assert.equal(ensureRes.rows[0].result.otp, '4921');

  // Idempotent: calling again returns the same OTP
  const repeatRes = await actor(ids.patient, `select public.ensure_consultation_passcode($1) as result`, [aptId]);
  assert.equal(repeatRes.rows[0].result.otp, '4921');

  // 2. Doctor attempts verification with incorrect OTP -> fails
  const wrongRes = await actor(providerId, `select public.verify_consultation_otp($1, '1234', 'test notes') as result`, [aptId]);
  assert.equal(wrongRes.rows[0].result.success, false);
  assert.match(wrongRes.rows[0].result.error, /Incorrect verification code/);

  // Status remains confirmed
  const checkMid = await actor(providerId, `select status from public.doctor_appointments where id = $1`, [aptId]);
  assert.equal(checkMid.rows[0].status, 'confirmed');

  // 3. Doctor enters correct OTP shared by patient -> succeeds and marks completed
  const rightRes = await actor(providerId, `select public.verify_consultation_otp($1, '4921', 'Prescribed paracetamol 500mg') as result`, [aptId]);
  assert.equal(rightRes.rows[0].result.success, true);
  assert.equal(rightRes.rows[0].result.status, 'completed');

  // Status is now completed, completed_at is set, clinical notes recorded
  const checkFinal = await actor(providerId, `select status, completed_at, clinical_notes from public.doctor_appointments where id = $1`, [aptId]);
  assert.equal(checkFinal.rows[0].status, 'completed');
  assert.ok(checkFinal.rows[0].completed_at);
  assert.equal(checkFinal.rows[0].clinical_notes.summary, 'Prescribed paracetamol 500mg');
});

// Detailed home-visit policy, persistence and lifecycle checks live in
// home-visits.test.mjs. Real independent-session races run in the staging suite.
