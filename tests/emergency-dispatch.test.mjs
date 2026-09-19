import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// Executes the dispatch RPCs for real. The replay suite in database.test.mjs
// only proves the schema builds; it never calls a function, which is how a
// broken RAISE statement reached the browser.
const db = new PGlite();
const ids = {
  patient: '20000000-0000-4000-8000-000000000001',
  crewA: '20000000-0000-4000-8000-000000000002',
  crewB: '20000000-0000-4000-8000-000000000003',
  doctor: '20000000-0000-4000-8000-000000000004',
  facility: '20000000-0000-4000-8000-000000000005',
};
const PUNE = { lat: 18.5362, lng: 73.8939 };

function actor(uid, sql, params = [], role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true)",
      [uid ?? '', role],
    );
    await tx.exec(`set local role ${role}`);
    return tx.query(sql, params);
  });
}
const signup = (id, email) =>
  db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [id, email, {}]);

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
      created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.role', true),'') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);
  const dir = new URL('../staging/supabase/migrations/', import.meta.url);
  for (const file of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
    await db.transaction(tx => readFile(new URL(file, dir), 'utf8').then(sql => tx.exec(sql)));
  }

  for (const [key, id] of Object.entries(ids)) await signup(id, `${key}@demo.med`);

  // Dispatch ships switched OFF. An admin turns it on with
  // set_emergency_dispatch_enabled(true); the fixture sets the row directly.
  await db.query('update public.emergency_settings set dispatch_enabled = true where id = 1');

  // Two crews online in range, one hospital that can take a cardiac case, one
  // cardiologist on its roster.
  await db.query(
    `update public.profiles set view='ambulance', lat=$2, lng=$3, last_seen_at=now() where id=$1`,
    [ids.crewA, PUNE.lat + 0.003, PUNE.lng + 0.003]);
  await db.query(
    `update public.profiles set view='ambulance', lat=$2, lng=$3, last_seen_at=now() where id=$1`,
    [ids.crewB, PUNE.lat + 0.006, PUNE.lng + 0.006]);
  await db.query(
    `update public.profiles set specialty='Cardiology', lat=$2, lng=$3 where id=$1`,
    [ids.doctor, PUNE.lat - 0.004, PUNE.lng - 0.004]);
  await db.query(
    `update public.profiles set phone='+919820000001', blood_group='O+',
       allergies=array['Penicillin'], conditions=array['Hypertension'],
       medications=array['Telmisartan'],
       emergency_contact_1_name='Spouse', emergency_contact_1_phone='+919820000002'
     where id=$1`, [ids.patient]);
  for (const crew of [ids.crewA, ids.crewB]) {
    await db.query(
      `insert into public.account_role_requests(user_id,requested_role,requested_view,status)
       values ($1,'provider','ambulance','approved') on conflict do nothing`, [crew]);
  }
  await db.query(
    `insert into public.hospitals(name, area, lat, lng, emergency, emergency_mode, owner_id,
                                  er_beds_available, has_icu, has_ot, has_cath_lab, has_blood_bank, specialties)
     values ('Test Cardiac Hospital','Koregaon Park',$1,$2,true,true,$3,4,true,true,true,true,array['Cardiology'])`,
    [PUNE.lat - 0.005, PUNE.lng - 0.009, ids.facility]);
  const h = await db.query(`select id from public.hospitals where name='Test Cardiac Hospital'`);
  await db.query(
    `insert into public.hospital_emergency_specialists(hospital_id,category,doctor_id,priority,in_house,active)
     values ($1,'cardiac',$2,1,true,true)`, [h.rows[0].id, ids.doctor]);
});
after(() => db.close());

const openCase = () =>
  actor(ids.patient,
    `select * from public.create_emergency_case('cardiac', $1::jsonb, $2, $3, 20, now(), 'ambulance')`,
    [JSON.stringify([{ q: 'When did the pain start?', a: '<30 min' }]), PUNE.lat, PUNE.lng]);

test('a patient can open a case, and the profile supplies phone and contacts', async () => {
  const r = await openCase();
  const c = r.rows[0];
  assert.equal(c.category, 'cardiac');
  assert.equal(c.status, 'searching');
  assert.equal(c.transport_mode, 'ambulance');
  // Never typed on the emergency screen; read from the profile server-side.
  assert.equal(c.patient_phone, '+919820000001');
  assert.equal(c.contact_1_phone, '+919820000002');
  assert.equal(c.blood_group, 'O+');
  assert.equal(Number(c.search_radius_km), 4);
});

test('a second tap returns the same case rather than dispatching twice', async () => {
  const first = await openCase();
  const second = await openCase();
  assert.equal(first.rows[0].id, second.rows[0].id);
});

test('every crew in range is paged, plus the hospital and its on-call specialist', async () => {
  const c = (await openCase()).rows[0];
  const t = await db.query(
    `select target_kind, count(*)::int as n from public.emergency_dispatch_targets
      where case_id=$1 group by target_kind order by target_kind`, [c.id]);
  const byKind = Object.fromEntries(t.rows.map(r => [r.target_kind, r.n]));
  assert.equal(byKind.ambulance, 2, 'both crews alerted at once');
  assert.equal(byKind.hospital, 1);
  assert.equal(byKind.doctor, 1);
});

test('first crew to accept wins and the second is refused', async () => {
  const c = (await openCase()).rows[0];
  const won = await actor(ids.crewA, `select * from public.accept_emergency_case($1,'ambulance')`, [c.id]);
  assert.equal(won.rows[0].ambulance_id, ids.crewA);
  assert.equal(won.rows[0].status, 'ambulance_en_route');
  await assert.rejects(
    actor(ids.crewB, `select * from public.accept_emergency_case($1,'ambulance')`, [c.id]),
    /EMERGENCY_ALREADY_TAKEN/);
});

test('the assigned crew posts GPS and an ETA comes back; nobody else can', async () => {
  // One live case per patient, so clear the one the previous test locked in.
  await db.query(`update public.emergency_cases set status='cancelled' where status<>'cancelled'`);
  const c = (await openCase()).rows[0];
  await actor(ids.crewA, `select public.accept_emergency_case($1,'ambulance')`, [c.id]);
  const ping = await actor(ids.crewA,
    `select * from public.post_emergency_ambulance_ping($1,$2,$3,15,null,30,now())`,
    [c.id, PUNE.lat + 0.02, PUNE.lng + 0.02]);
  assert.ok(ping.rows[0].eta_seconds > 0);
  await assert.rejects(
    actor(ids.crewB, `select public.post_emergency_ambulance_ping($1,$2,$3,15,null,30,now())`,
      [c.id, PUNE.lat, PUNE.lng]),
    /EMERGENCY_FORBIDDEN/);
});

test('hospital accepts with a bed, then the specialist accepts', async () => {
  const c = (await openCase()).rows[0];
  const h = await actor(ids.facility,
    `select * from public.accept_emergency_case($1,'hospital',null,'Red Bay 2')`, [c.id]);
  assert.equal(h.rows[0].bed_label, 'Red Bay 2');
  const d = await actor(ids.doctor, `select * from public.accept_emergency_case($1,'doctor')`, [c.id]);
  assert.equal(d.rows[0].doctor_id, ids.doctor);
});

test('self-transport pages no crew and refuses an ambulance accept', async () => {
  await db.query(`update public.emergency_cases set status='cancelled' where status<>'cancelled'`);
  const c = (await actor(ids.patient,
    `select * from public.create_emergency_case('cardiac','[]'::jsonb,$1,$2,20,now(),'self')`,
    [PUNE.lat, PUNE.lng])).rows[0];
  const crews = await db.query(
    `select count(*)::int as n from public.emergency_dispatch_targets
      where case_id=$1 and target_kind='ambulance'`, [c.id]);
  assert.equal(crews.rows[0].n, 0);
  await assert.rejects(
    actor(ids.crewA, `select public.accept_emergency_case($1,'ambulance')`, [c.id]),
    /EMERGENCY_NO_AMBULANCE/);
});

test('the background worker widens the radius once the interval has passed', async () => {
  await db.query(`update public.emergency_cases set status='cancelled' where status<>'cancelled'`);
  const c = (await openCase()).rows[0];
  // Too early: the server's own clock says no.
  await actor(null, 'select public.emergency_tick()', [], 'service_role');
  let now = await db.query('select search_radius_km from public.emergency_cases where id=$1', [c.id]);
  assert.equal(Number(now.rows[0].search_radius_km), 4);
  // Backdate past the 22 second step and it moves exactly one step.
  await db.query(
    `update public.emergency_cases set radius_expanded_at = now() - interval '30 seconds' where id=$1`, [c.id]);
  await actor(null, 'select public.emergency_tick()', [], 'service_role');
  now = await db.query('select search_radius_km from public.emergency_cases where id=$1', [c.id]);
  assert.equal(Number(now.rows[0].search_radius_km), 5);
});

test('the specialist page escalates through its waves to an area broadcast', async () => {
  await db.query(`update public.emergency_cases set status='cancelled' where status<>'cancelled'`);
  const c = (await openCase()).rows[0];
  assert.equal(c.doctor_wave, 1, 'starts with the hospital on-call doctor');
  for (const wave of [2, 3]) {
    await db.query(
      `update public.emergency_cases set doctor_wave_at = now() - interval '30 seconds' where id=$1`, [c.id]);
    await actor(ids.patient, 'select public.escalate_emergency_specialists($1)', [c.id]);
    const r = await db.query('select doctor_wave from public.emergency_cases where id=$1', [c.id]);
    assert.equal(r.rows[0].doctor_wave, wave);
  }
});

test('anonymous callers cannot reach any dispatch RPC', async () => {
  await assert.rejects(
    actor(null, `select public.create_emergency_case('cardiac','[]'::jsonb,18.5,73.8)`, [], 'anon'),
    /permission denied/);
  await assert.rejects(
    actor(null, `select public.list_emergency_dispatch_queue('ambulance')`, [], 'anon'),
    /permission denied/);
});

test('a patient cannot write the dispatch tables directly', async () => {
  await assert.rejects(
    actor(ids.patient, 'delete from public.emergency_cases'), /permission denied/);
  await assert.rejects(
    actor(ids.patient, 'delete from public.emergency_dispatch_targets'), /permission denied/);
});
