import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// Covers the guarantees added on top of the original nursing policy set:
// who the work is offered to, what stops it being booked twice, how long a
// reserved day actually is, and what has to be true before money moves.
const db = new PGlite();
const ids = {
  patient:  '50000000-0000-4000-8000-000000000001',
  nurseNear:'50000000-0000-4000-8000-000000000002',
  nurseFar: '50000000-0000-4000-8000-000000000003',
  nurseAlt: '50000000-0000-4000-8000-000000000004',
  doctor:   '50000000-0000-4000-8000-000000000005',
  patient2: '50000000-0000-4000-8000-000000000006',
};
// Pune city centre, and a point well outside any sane home-visit radius.
const PUNE = { lat: 18.5204, lng: 73.8567 };
const FAR  = { lat: 19.0760, lng: 72.8777 }; // Mumbai, ~120km
const MID  = { lat: 18.7400, lng: 73.8567 }; // ~24km north: outside 15km, inside 40km

function actor(uid, sql, params = [], role = 'authenticated') {
  return db.transaction(async tx => {
    await tx.query(
      "select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true)",
      [uid ?? '', role]);
    await tx.exec(`set local role ${role}`);
    return tx.query(sql, params);
  });
}

before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, phone text,
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
  for (const f of (await readdir(dir)).filter(x => x.endsWith('.sql')).sort()) {
    await db.transaction(tx => readFile(new URL(f, dir), 'utf8').then(sql => tx.exec(sql)));
  }
  for (const [k, id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)',
      [id, `${k}@hardening.med`, {}]);
  }
  const nurses = [[ids.nurseNear, PUNE], [ids.nurseAlt, PUNE], [ids.nurseFar, FAR]];
  for (const [id, at] of nurses) {
    await db.query(`insert into public.user_roles(user_id,role) values ($1,'provider')
                    on conflict do nothing`, [id]);
    await db.query(`update public.profiles set view='nurse', lat=$2, lng=$3 where id=$1`,
      [id, at.lat, at.lng]);
  }
  await db.query(`insert into public.user_roles(user_id,role) values ($1,'provider')
                  on conflict do nothing`, [ids.doctor]);
  await db.query(`update public.profiles set view='medico', lat=$2, lng=$3 where id=$1`,
    [ids.doctor, PUNE.lat, PUNE.lng]);
});
after(() => db.close());

beforeEach(async () => {
  await db.query(`update public.profiles set lat=$2, lng=$3 where id = any($1)`,
    [[ids.nurseNear, ids.nurseAlt], PUNE.lat, PUNE.lng]);
  await db.query(`update public.profiles set lat=$2, lng=$3 where id=$1`,
    [ids.nurseFar, FAR.lat, FAR.lng]);
  await db.query('delete from public.nursing_engagements');
  await db.query('delete from public.doctor_appointments');
  await db.query('delete from public.nursing_notification_jobs');
  await db.query('delete from public.provider_scores');
  await db.query('delete from public.provider_score_events');
});

const bookAt = (opts = {}, uid) => actor(uid ?? ids.patient, `
  select * from public.create_nursing_engagement(
    p_days => $1::int, p_start_date => current_date + $2::int,
    p_slot_time => time '09:00', p_lat => $3, p_lng => $4,
    p_idempotency_key => $5)`,
  [opts.days ?? 3, opts.offset ?? 2, opts.lat ?? PUNE.lat, opts.lng ?? PUNE.lng,
   opts.key ?? null]).then(r => r.rows[0]);

const offersFor = id => db.query(
  'select nurse_id from public.nursing_engagement_offers where engagement_id=$1', [id])
  .then(r => r.rows.map(x => x.nurse_id));

// ------------------------------------------------------------------ roster --

test('nursing work is never offered to a doctor', async () => {
  const eng = await bookAt();
  const offered = await offersFor(eng.id);
  assert.ok(offered.includes(ids.nurseNear), 'a nearby nurse was asked');
  assert.ok(!offered.includes(ids.doctor), 'a doctor on the provider roster was not');
});

test('a nurse outside the radius is not asked while a nearby one exists', async () => {
  const eng = await bookAt();
  const offered = await offersFor(eng.id);
  assert.ok(!offered.includes(ids.nurseFar), '120km away is not a home-visit radius');
});

test('the roster widens rather than leaving a paid booking with nobody', async () => {
  // Nobody within the near radius: only the far nurse can possibly take it.
  await db.query(`update public.profiles set lat=$2, lng=$3 where id = any($1)`,
    [[ids.nurseNear, ids.nurseAlt], MID.lat, MID.lng]);
  const eng = await bookAt({ lat: PUNE.lat, lng: PUNE.lng });
  const offered = await offersFor(eng.id);
  assert.ok(offered.length > 0, 'the second, wider pass found somebody');
});

// -------------------------------------------------------------- duplicates --

test('a double tap returns the original booking instead of charging twice', async () => {
  const first  = await bookAt();
  const second = await bookAt();
  assert.equal(second.id, first.id, 'same package inside the window is the same booking');
  const n = await db.query('select count(*)::int c from public.nursing_engagements');
  assert.equal(n.rows[0].c, 1);
});

test('an idempotency key makes a retry safe even outside the window', async () => {
  const first  = await bookAt({ key: 'checkout-abc' });
  await db.query(
    `update public.nursing_engagements set created_at = now() - interval '1 hour'`);
  const retry = await bookAt({ key: 'checkout-abc' });
  assert.equal(retry.id, first.id);
});

test('a deliberate second booking still goes through', async () => {
  const first = await bookAt({ offset: 2 });
  const later = await bookAt({ offset: 40 });
  assert.notEqual(later.id, first.id);
});

test('a nurse cannot accept two packages covering the same days', async () => {
  const a = await bookAt({ offset: 5 });
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [a.id]);
  const b2 = await actor(ids.patient2, `
    select * from public.create_nursing_engagement(
      p_days => 3, p_start_date => current_date + 5, p_slot_time => time '09:00',
      p_lat => $1, p_lng => $2)`, [PUNE.lat, PUNE.lng]).then(r => r.rows[0]);
  await assert.rejects(
    actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [b2.id]),
    /NURSING_NURSE_BUSY/);
  // The second family is not stranded: another nurse can still take it.
  const won = await actor(ids.nurseAlt,
    'select * from public.accept_nursing_engagement($1)', [b2.id]);
  assert.equal(won.rows[0].primary_nurse_id, ids.nurseAlt);
});

// ------------------------------------------------------------ shift window --

test('a day carries an explicit twelve-hour window, not a guess', async () => {
  const eng = await bookAt();
  const v = await db.query(
    'select shift_start, shift_end from public.nursing_visits where engagement_id=$1 order by seq',
    [eng.id]);
  const { shift_start, shift_end } = v.rows[0];
  assert.ok(shift_start && shift_end);
  assert.equal((new Date(shift_end) - new Date(shift_start)) / 3600000, 12);
});

test('a nurse part-way through her shift is not marked absent', async () => {
  const eng = await bookAt();
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);
  const v = (await db.query(
    'select id from public.nursing_visits where engagement_id=$1 order by seq', [eng.id])).rows[0];
  // Seven hours in, five to go. The old sweeper wrote this off after six.
  await db.query(`update public.nursing_visits
                     set shift_start = now() - interval '7 hours',
                         shift_end   = now() + interval '5 hours' where id=$1`, [v.id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  const after = await db.query('select status from public.nursing_visits where id=$1', [v.id]);
  assert.equal(after.rows[0].status, 'scheduled');
  const score = await db.query('select 1 from public.provider_score_events where user_id=$1',
    [ids.nurseNear]);
  assert.equal(score.rows.length, 0, 'and loses no points for being at work');
});

test('a day nobody touched is written off once the shift has actually ended', async () => {
  const eng = await bookAt();
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);
  const v = (await db.query(
    'select id from public.nursing_visits where engagement_id=$1 order by seq', [eng.id])).rows[0];
  await db.query(`update public.nursing_visits
                     set shift_start = now() - interval '20 hours',
                         shift_end   = now() - interval '8 hours' where id=$1`, [v.id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  const after = await db.query('select status from public.nursing_visits where id=$1', [v.id]);
  assert.equal(after.rows[0].status, 'missed');
});

// ---------------------------------------------------------------- arrival ---

async function assigned() {
  const eng = await bookAt({ offset: 0 });
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);
  const v = (await db.query(
    'select * from public.nursing_visits where engagement_id=$1 order by seq', [eng.id])).rows[0];
  return { eng, visit: v };
}

test('a nurse cannot close a day without a verified arrival', async () => {
  const { visit } = await assigned();
  await assert.rejects(
    actor(ids.nurseNear, `select public.advance_nursing_visit($1,'completed')`, [visit.id]),
    /NURSING_ARRIVAL_REQUIRED/);
  const row = await db.query('select payout_to from public.nursing_visits where id=$1', [visit.id]);
  assert.equal(row.rows[0].payout_to, ids.nurseNear,
    'payout was assigned on accept but the day is still open');
});

test('arrival cannot be self-declared', async () => {
  const { visit } = await assigned();
  await assert.rejects(
    actor(ids.nurseNear, `select public.advance_nursing_visit($1,'arrived')`, [visit.id]),
    /NURSING_BAD_STATUS/);
});

test('the family code is what marks arrival, and a wrong one does not', async () => {
  const { visit } = await assigned();
  await actor(ids.nurseNear, `select public.advance_nursing_visit($1,'en_route')`, [visit.id]);
  const code = (await actor(ids.patient,
    'select public.issue_nursing_arrival_code($1) as c', [visit.id])).rows[0].c;
  assert.match(code, /^[0-9]{6}$/);

  const wrong = code === '000000' ? '111111' : '000000';
  await assert.rejects(
    actor(ids.nurseNear, 'select public.verify_nursing_arrival($1,$2)', [visit.id, wrong]),
    /NURSING_CODE_WRONG/);

  await actor(ids.nurseNear, 'select public.verify_nursing_arrival($1,$2)', [visit.id, code]);
  const row = await db.query('select status, arrived_at from public.nursing_visits where id=$1',
    [visit.id]);
  assert.equal(row.rows[0].status, 'arrived');
  assert.ok(row.rows[0].arrived_at);

  await actor(ids.nurseNear, `select public.advance_nursing_visit($1,'completed')`, [visit.id]);
  const done = await db.query('select status from public.nursing_visits where id=$1', [visit.id]);
  assert.equal(done.rows[0].status, 'completed');
});

test('only the family can issue the code, and only the assigned nurse can spend it', async () => {
  const { visit } = await assigned();
  await actor(ids.nurseNear, `select public.advance_nursing_visit($1,'en_route')`, [visit.id]);
  await assert.rejects(
    actor(ids.nurseAlt, 'select public.issue_nursing_arrival_code($1)', [visit.id]),
    /NURSING_FORBIDDEN/);
  const code = (await actor(ids.patient,
    'select public.issue_nursing_arrival_code($1) as c', [visit.id])).rows[0].c;
  await assert.rejects(
    actor(ids.nurseAlt, 'select public.verify_nursing_arrival($1,$2)', [visit.id, code]),
    /NURSING_FORBIDDEN/);
});

test('the address opens two hours before the shift, not at offer time', async () => {
  const eng = await bookAt({ offset: 6 });
  await assert.rejects(
    actor(ids.nurseNear, 'select public.nursing_visit_directions($1)',
      [(await db.query('select id from public.nursing_visits where engagement_id=$1 order by seq',
        [eng.id])).rows[0].id]),
    /NURSING_FORBIDDEN|NURSING_TOO_EARLY/);

  const { visit } = await assigned();
  await db.query(`update public.nursing_visits set shift_start = now() + interval '30 minutes'
                   where id=$1`, [visit.id]);
  const dir = await actor(ids.nurseNear, 'select public.nursing_visit_directions($1) as d',
    [visit.id]);
  assert.ok(dir.rows[0].d.maps_url.includes('google.com/maps'));
});

// ----------------------------------------------------------- slot blocking --

async function makeBookableDoctorNurse() {
  await db.query(`
    insert into public.provider_availability (user_id, is_online, timezone, working_hours)
    values ($1, true, 'Asia/Kolkata', $2::jsonb)
    on conflict (user_id) do update set working_hours = excluded.working_hours,
      is_online = true`,
    [ids.nurseNear, JSON.stringify(Object.fromEntries(
      ['mon','tue','wed','thu','fri','sat','sun']
        .map(d => [d, [{ start: '09:00', end: '17:00' }]])))]);
}

test('a reserved nursing shift removes that day from the slot list', async () => {
  await makeBookableDoctorNurse();
  const day = 4;
  const before = await actor(ids.patient, `
    select (count(*) filter (where is_available))::int free
      from public.get_provider_slots($1, current_date + $2::int, current_date + $2::int, 30)`,
    [ids.nurseNear, day]);
  assert.ok(before.rows[0].free > 0, 'the day is bookable to begin with');

  const eng = await bookAt({ offset: day, days: 1 });
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);

  const after = await actor(ids.patient, `
    select (count(*) filter (where is_available))::int free
      from public.get_provider_slots($1, current_date + $2::int, current_date + $2::int, 30)`,
    [ids.nurseNear, day]);
  assert.equal(after.rows[0].free, 0, 'the whole reserved day is gone');
});

test('the block is enforced, not just displayed', async () => {
  await makeBookableDoctorNurse();
  const day = 7;
  const eng = await bookAt({ offset: day, days: 1 });
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);
  const start = (await db.query(
    `select shift_start from public.nursing_visits where engagement_id=$1`, [eng.id]))
    .rows[0].shift_start;

  await assert.rejects(db.query(`
    insert into public.doctor_appointments
      (provider_id, patient_id, service, start_time, end_time, fee, status)
    values ($1,$2,'Consult', $3::timestamptz + interval '2 hours',
            $3::timestamptz + interval '2 hours 30 minutes', 500, 'confirmed')`,
    [ids.nurseNear, ids.patient, start]),
    /reserved nursing shift/);
});

test('a nurse cannot take a shift over an appointment already in the diary', async () => {
  const day = 9;
  const at = (await db.query(
    `select (current_date + $1::int + time '10:00') at time zone 'Asia/Kolkata' as t`, [day])).rows[0].t;
  await db.query(`
    insert into public.doctor_appointments
      (provider_id, patient_id, service, start_time, end_time, fee, status)
    values ($1,$2,'Consult',$3,$3::timestamptz + interval '30 minutes',500,'confirmed')`,
    [ids.nurseNear, ids.patient, at]);

  const eng = await bookAt({ offset: day, days: 1 });
  await assert.rejects(
    actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]),
    /NURSING_NURSE_BUSY/);
});

// ----------------------------------------------------------- notifications --

test('every offer lands in the outbox exactly once', async () => {
  const eng = await bookAt();
  const jobs = await db.query(`
    select kind, recipient_id from public.nursing_notification_jobs
     where engagement_id=$1`, [eng.id]);
  const offered = await offersFor(eng.id);
  assert.equal(jobs.rows.length, offered.length);
  assert.ok(jobs.rows.every(j => j.kind === 'nursing.offer.broadcast'));

  // Re-broadcasting must not produce a second push for the same nurse.
  await actor(null, 'select public.broadcast_nursing_engagement($1)', [eng.id], 'service_role');
  const again = await db.query(
    'select count(*)::int c from public.nursing_notification_jobs where engagement_id=$1', [eng.id]);
  assert.equal(again.rows[0].c, offered.length);
});

test('a named nurse gets a different notification from a broadcast', async () => {
  const eng = await actor(ids.patient, `
    select * from public.create_nursing_engagement(
      p_days => 2, p_start_date => current_date + 3, p_slot_time => time '09:00',
      p_lat => $1, p_lng => $2, p_nurse_id => $3)`,
    [PUNE.lat, PUNE.lng, ids.nurseNear]).then(r => r.rows[0]);
  const jobs = await db.query(
    'select kind, recipient_id from public.nursing_notification_jobs where engagement_id=$1',
    [eng.id]);
  assert.equal(jobs.rows.length, 1);
  assert.equal(jobs.rows[0].kind, 'nursing.offer.preferred');
  assert.equal(jobs.rows[0].recipient_id, ids.nurseNear);
});

test('both sides are told when a package is taken', async () => {
  const eng = await bookAt();
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);
  const kinds = (await db.query(
    `select kind from public.nursing_notification_jobs where engagement_id=$1`, [eng.id]))
    .rows.map(r => r.kind);
  assert.ok(kinds.includes('nursing.assigned.patient'));
  assert.ok(kinds.includes('nursing.assigned.nurse'));
});

test('an unfilled package tells the family who paid for it', async () => {
  const eng = await bookAt({ offset: 0 });
  await db.query(
    `update public.nursing_engagements set start_date = current_date - 1 where id=$1`, [eng.id]);
  await actor(null, 'select public.nursing_sweep_unfilled()', [], 'service_role');
  const job = await db.query(`
    select recipient_id from public.nursing_notification_jobs
     where engagement_id=$1 and kind='nursing.unfilled'`, [eng.id]);
  assert.equal(job.rows[0].recipient_id, ids.patient);
});

test('the worker leases a job and backs off on failure', async () => {
  await bookAt();
  const claimed = await actor(null, 'select * from public.nursing_notification_claim(5)',
    [], 'service_role');
  assert.ok(claimed.rows.length > 0);
  const job = claimed.rows[0];
  assert.equal(job.status, 'processing');
  assert.equal(job.attempts, 1);

  await actor(null, 'select public.nursing_notification_settle($1,$2,false,$3)',
    [job.id, job.lease_token, 'push token rejected'], 'service_role');
  const after = await db.query(
    'select status, available_at, last_error from public.nursing_notification_jobs where id=$1',
    [job.id]);
  assert.equal(after.rows[0].status, 'pending');
  assert.ok(new Date(after.rows[0].available_at) > new Date(), 'retry is scheduled, not immediate');
});

// --------------------------------------------------------- policy safety ---

test('a nurse can read her own shifts without tripping policy recursion', async () => {
  const eng = await bookAt({ offset: 2 });
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);

  // Both directions of the engagement/visit policy pair, as the app reads them.
  const shifts = await actor(ids.nurseNear,
    'select id, visit_date from public.nursing_visits where assigned_nurse_id = $1',
    [ids.nurseNear]);
  assert.ok(shifts.rows.length > 0, 'the nurse sees her days');

  const eng2 = await actor(ids.nurseNear,
    'select id from public.nursing_engagements where id = $1', [eng.id]);
  assert.equal(eng2.rows.length, 1, 'and the booking behind them');

  const asPatient = await actor(ids.patient,
    'select id from public.nursing_visits where engagement_id = $1', [eng.id]);
  assert.ok(asPatient.rows.length > 0, 'the family sees the days too');
});

test('an unrelated nurse still sees none of it', async () => {
  const eng = await bookAt({ offset: 2 });
  await actor(ids.nurseNear, 'select public.accept_nursing_engagement($1)', [eng.id]);
  // nurseFar is outside the roster radius, so she was never offered this one.
  const seen = await actor(ids.nurseFar,
    'select id from public.nursing_visits where engagement_id = $1', [eng.id]);
  assert.equal(seen.rows.length, 0);
});
