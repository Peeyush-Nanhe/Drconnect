import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// Drives every agreed policy rule as a real transaction against the same
// migrations that are applied on staging.
const db = new PGlite();
const ids = {
  patient: '40000000-0000-4000-8000-000000000001',
  nurseA: '40000000-0000-4000-8000-000000000002',
  nurseB: '40000000-0000-4000-8000-000000000003',
  nurseC: '40000000-0000-4000-8000-000000000004',
  doctor: '40000000-0000-4000-8000-000000000005',
};

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
      [id, `${k}@demo.med`, {}]);
  }
  for (const n of [ids.nurseA, ids.nurseB, ids.nurseC]) {
    await db.query(`insert into public.user_roles(user_id,role) values ($1,'provider')
                    on conflict do nothing`, [n]);
    await db.query(`update public.profiles set view='nurse' where id=$1`, [n]);
  }
  // A doctor on the same roster table. Nursing work must never reach him.
  await db.query(`insert into public.user_roles(user_id,role) values ($1,'provider')
                  on conflict do nothing`, [ids.doctor]);
  await db.query(`update public.profiles set view='medico' where id=$1`, [ids.doctor]);
});
after(() => db.close());

beforeEach(async () => {
  await db.query('delete from public.nursing_engagements');
  await db.query('delete from public.provider_scores');
  await db.query('delete from public.provider_score_events');
});

async function book(days = 7, startOffset = 1) {
  const r = await actor(ids.patient,
    `select * from public.create_nursing_engagement($1::int, current_date + ($2::int), time '09:00')`,
    [days, startOffset]);
  const eng = r.rows[0];
  await db.query('update public.nursing_engagements set primary_nurse_id=$2 where id=$1',
    [eng.id, ids.nurseA]);
  await db.query('update public.nursing_visits set assigned_nurse_id=$2 where engagement_id=$1',
    [eng.id, ids.nurseA]);
  return eng;
}
// The family issues a code, the nurse enters it. There is no other way in.
async function arrive(nurse, visitId) {
  await actor(nurse, `select public.advance_nursing_visit($1,'en_route')`, [visitId]);
  const code = (await actor(ids.patient,
    'select public.issue_nursing_arrival_code($1) as c', [visitId])).rows[0].c;
  await actor(nurse, 'select public.verify_nursing_arrival($1,$2)', [visitId, code]);
  return code;
}
const visits = eng =>
  db.query('select * from public.nursing_visits where engagement_id=$1 order by seq', [eng.id])
    .then(r => r.rows);
const scoreOf = async uid => {
  const r = await db.query(
    `select score from public.provider_scores where user_id=$1
      and period = date_trunc('month', now())::date`, [uid]);
  return r.rows.length ? r.rows[0].score : null;
};

test('a 7-day package creates seven separate days, priced per day', async () => {
  const eng = await book(7);
  const v = await visits(eng);
  assert.equal(v.length, 7);
  assert.equal(eng.total_amount, 5600);
  assert.equal(v[0].payout_amount, 800);
  // Consecutive dates, no gaps.
  for (let i = 1; i < v.length; i++) {
    const gap = (new Date(v[i].visit_date) - new Date(v[i - 1].visit_date)) / 86400000;
    assert.equal(gap, 1);
  }
});

test('family cancels a day: it is cancelled and an extra day is added at the end', async () => {
  const eng = await book(7);
  let v = await visits(eng);
  const day3 = v[2];
  const lastDateBefore = v[6].visit_date;

  await actor(ids.patient, `select * from public.cancel_nursing_visit_by_family($1,'family away')`,
    [day3.id]);

  v = await visits(eng);
  assert.equal(v.length, 8, 'seven paid days are still seven days of care');
  assert.equal(v.find(x => x.id === day3.id).status, 'cancelled_by_family');
  const added = v[7];
  assert.equal(added.replaces_visit_id, day3.id);
  assert.equal(new Date(added.visit_date) - new Date(lastDateBefore), 86400000);
  const e = await db.query('select days_booked, days_scheduled from public.nursing_engagements where id=$1', [eng.id]);
  assert.equal(e.rows[0].days_booked, 7);
  assert.equal(e.rows[0].days_scheduled, 8);
});

test('a family cancellation costs the nurse no points', async () => {
  const eng = await book(7);
  const v = await visits(eng);
  await actor(ids.patient, `select public.cancel_nursing_visit_by_family($1,'not today')`, [v[2].id]);
  assert.equal(await scoreOf(ids.nurseA), null, 'no score row created, so nothing was deducted');
});

test('notice of 12 hours or more: no penalty at release', async () => {
  const eng = await book(7, 3);            // day 1 is three days out
  const v = await visits(eng);
  await actor(ids.nurseA, `select public.release_nursing_visit($1,'family emergency')`, [v[0].id]);
  assert.equal(await scoreOf(ids.nurseA), null, 'proper notice is free');
  const after = (await visits(eng))[0];
  assert.equal(after.status, 'seeking_cover');
  assert.equal(after.assigned_nurse_id, null);
  assert.equal(after.original_nurse_id, ids.nurseA);
});

test('notice under 12 hours costs 5 points immediately', async () => {
  const eng = await book(7, 0);            // today, 09:00
  const v = await visits(eng);
  // Force the slot to two hours from now so the notice window is genuinely short.
  await db.query(
    `update public.nursing_engagements set slot_time = (now() + interval '2 hours')::time where id=$1`,
    [eng.id]);
  await db.query('update public.nursing_visits set visit_date = current_date where id=$1', [v[0].id]);
  await actor(ids.nurseA, `select public.release_nursing_visit($1,'unwell')`, [v[0].id]);
  assert.equal(await scoreOf(ids.nurseA), 95, '100 - 5 for late notice');
});

test('a released day is broadcast to other nurses, and the first to accept wins', async () => {
  const eng = await book(7, 3);
  const v = await visits(eng);
  await actor(ids.nurseA, `select public.release_nursing_visit($1,'leave')`, [v[0].id]);

  const offers = await db.query(
    'select nurse_id from public.nursing_visit_offers where visit_id=$1', [v[0].id]);
  const offered = offers.rows.map(r => r.nurse_id);
  assert.ok(offered.includes(ids.nurseB) && offered.includes(ids.nurseC));
  assert.ok(!offered.includes(ids.nurseA), 'the nurse who released it is not re-offered it');

  await actor(ids.nurseB, 'select public.accept_nursing_visit($1)', [v[0].id]);
  await assert.rejects(
    actor(ids.nurseC, 'select public.accept_nursing_visit($1)', [v[0].id]),
    /NURSING_ALREADY_TAKEN/);
});

test("the substitute is paid that day and the original nurse loses it", async () => {
  const eng = await book(7, 3);
  const v = await visits(eng);
  assert.equal(v[0].payout_to, null);
  await actor(ids.nurseA, `select public.release_nursing_visit($1,'leave')`, [v[0].id]);
  await actor(ids.nurseB, 'select public.accept_nursing_visit($1)', [v[0].id]);

  const covered = (await visits(eng))[0];
  assert.equal(covered.assigned_nurse_id, ids.nurseB);
  assert.equal(covered.payout_to, ids.nurseB, "the day's money follows the work");
  assert.equal(covered.payout_amount, 800);
  assert.equal(covered.original_nurse_id, ids.nurseA, 'who lost it stays on the record');
});

test('a no-show with nobody informed costs 10 points', async () => {
  const eng = await book(7, 0);
  const v = await visits(eng);
  // Push the day into the past so the sweeper picks it up.
  await db.query(
    `update public.nursing_visits set visit_date = current_date - 1 where id=$1`, [v[0].id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  assert.equal((await visits(eng))[0].status, 'missed');
  assert.equal(await scoreOf(ids.nurseA), 90, '100 - 10 for absence without notice');
});

test('proper notice but no cover found still costs 5, not 10', async () => {
  const eng = await book(7, 3);
  const v = await visits(eng);
  await actor(ids.nurseA, `select public.release_nursing_visit($1,'leave')`, [v[0].id]);
  assert.equal(await scoreOf(ids.nurseA), null);
  await db.query(`update public.nursing_visits set visit_date = current_date - 1 where id=$1`, [v[0].id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  assert.equal(await scoreOf(ids.nurseA), 95);
});

test('a covered day never penalises anyone', async () => {
  const eng = await book(7, 3);
  const v = await visits(eng);
  await actor(ids.nurseA, `select public.release_nursing_visit($1,'leave')`, [v[0].id]);
  await actor(ids.nurseB, 'select public.accept_nursing_visit($1)', [v[0].id]);
  await arrive(ids.nurseB, v[0].id);
  await actor(ids.nurseB, `select public.advance_nursing_visit($1,'completed')`, [v[0].id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  assert.equal(await scoreOf(ids.nurseA), null);
  assert.equal(await scoreOf(ids.nurseB), null);
});

test('every deduction is logged with a reason the nurse can read', async () => {
  const eng = await book(7, 0);
  const v = await visits(eng);
  await db.query(`update public.nursing_visits set visit_date = current_date - 1 where id=$1`, [v[0].id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  const log = await actor(ids.nurseA,
    'select delta, reason from public.provider_score_events order by created_at desc');
  assert.equal(log.rows[0].delta, -10);
  assert.match(log.rows[0].reason, /without notice/i);
});

test('scores are private to the provider they belong to', async () => {
  const eng = await book(7, 0);
  const v = await visits(eng);
  await db.query(`update public.nursing_visits set visit_date = current_date - 1 where id=$1`, [v[0].id]);
  await actor(null, 'select public.nursing_tick()', [], 'service_role');
  const mine = await actor(ids.nurseA, 'select * from public.provider_scores');
  assert.equal(mine.rows.length, 1);
  const theirs = await actor(ids.nurseB, 'select * from public.provider_scores');
  assert.equal(theirs.rows.length, 0, "another nurse cannot read someone else's score");
});

test('the patient cannot release a day, and a nurse cannot cancel one', async () => {
  const eng = await book(7, 3);
  const v = await visits(eng);
  await assert.rejects(
    actor(ids.patient, `select public.release_nursing_visit($1,'x')`, [v[0].id]),
    /NURSING_FORBIDDEN/);
  await assert.rejects(
    actor(ids.nurseA, `select public.cancel_nursing_visit_by_family($1,'x')`, [v[0].id]),
    /NURSING_FORBIDDEN/);
});

test('anonymous callers cannot reach the nursing RPCs', async () => {
  await assert.rejects(
    actor(null, `select public.create_nursing_engagement(7, current_date + 1)`, [], 'anon'),
    /permission denied/);
});

test('a new package is offered to nurses, not silently confirmed', async () => {
  const eng = (await actor(ids.patient,
    `select * from public.create_nursing_engagement(7::int, current_date + 2, time '09:00')`)).rows[0];
  assert.equal(eng.assignment_state, 'seeking_nurse', 'nobody has accepted yet');
  assert.equal(eng.primary_nurse_id, null);
  const offers = await db.query(
    'select nurse_id from public.nursing_engagement_offers where engagement_id=$1', [eng.id]);
  assert.equal(offers.rows.length, 3, 'all three nurses were told');
});

test('first nurse to accept takes the package; the others are refused', async () => {
  const eng = (await actor(ids.patient,
    `select * from public.create_nursing_engagement(3::int, current_date + 2, time '09:00')`)).rows[0];
  const won = await actor(ids.nurseB, 'select * from public.accept_nursing_engagement($1)', [eng.id]);
  assert.equal(won.rows[0].primary_nurse_id, ids.nurseB);
  assert.equal(won.rows[0].assignment_state, 'assigned');
  await assert.rejects(
    actor(ids.nurseC, 'select public.accept_nursing_engagement($1)', [eng.id]),
    /NURSING_ALREADY_TAKEN/);
  const days = await db.query(
    'select count(*)::int n from public.nursing_visits where engagement_id=$1 and assigned_nurse_id=$2',
    [eng.id, ids.nurseB]);
  assert.equal(days.rows[0].n, 3, 'accepting the package assigns every day');
});

test('an unaccepted package is marked unfilled once its start passes', async () => {
  const eng = (await actor(ids.patient,
    `select * from public.create_nursing_engagement(2::int, current_date, time '09:00')`)).rows[0];
  await db.query(
    `update public.nursing_engagements set start_date = current_date - 1 where id=$1`, [eng.id]);
  await actor(null, 'select public.nursing_sweep_unfilled()', [], 'service_role');
  const after = await db.query(
    'select assignment_state from public.nursing_engagements where id=$1', [eng.id]);
  assert.equal(after.rows[0].assignment_state, 'unfilled',
    'the patient has paid, so this must surface rather than sit as active');
});


// --- nothing is booked until a nurse accepts (20260913160000) --------------

const bookWith = (nurse, days = 3) => actor(ids.patient,
  `select * from public.create_nursing_engagement($2::int, current_date + 2, time '09:00',
     'General Duty Nurse', null, null, null, $1::uuid)`, [nurse, days]).then(r => r.rows[0]);

test('asking for a nurse by name does NOT book her - it asks her', async () => {
  const eng = await bookWith(ids.nurseB);
  assert.equal(eng.assignment_state, 'seeking_nurse');
  assert.equal(eng.primary_nurse_id, null, 'nobody is assigned until somebody accepts');
  assert.equal(eng.preferred_nurse_id, ids.nurseB);
  const v = await db.query(
    'select assigned_nurse_id from public.nursing_visits where engagement_id=$1', [eng.id]);
  assert.ok(v.rows.every(r => r.assigned_nurse_id === null));
});

test('the requested nurse is asked alone, before anyone else', async () => {
  const eng = await bookWith(ids.nurseB);
  const offers = await db.query(
    'select nurse_id from public.nursing_engagement_offers where engagement_id=$1', [eng.id]);
  assert.equal(offers.rows.length, 1, 'asked alone, before anyone else');
  assert.equal(offers.rows[0].nurse_id, ids.nurseB);
});

test('she accepts, and only then is it booked', async () => {
  const eng = await bookWith(ids.nurseB);
  const done = await actor(ids.nurseB, 'select * from public.accept_nursing_engagement($1)', [eng.id]);
  assert.equal(done.rows[0].primary_nurse_id, ids.nurseB);
  assert.equal(done.rows[0].assignment_state, 'assigned');
  const v = await db.query(
    'select assigned_nurse_id from public.nursing_visits where engagement_id=$1', [eng.id]);
  assert.ok(v.rows.every(r => r.assigned_nurse_id === ids.nurseB));
});

test('she declines, and it opens to everyone straight away', async () => {
  const eng = await bookWith(ids.nurseB);
  await actor(ids.nurseB, 'select public.decline_nursing_engagement($1)', [eng.id]);
  const offers = await db.query(
    'select nurse_id from public.nursing_engagement_offers where engagement_id=$1', [eng.id]);
  assert.ok(offers.rows.length > 1, 'no waiting out the grace period after a decline');
  const others = await actor(ids.nurseC, 'select id from public.list_nursing_engagement_offers()');
  assert.ok(others.rows.some(r => r.id === eng.id));
});

test('silence opens it to everyone only after the timeout', async () => {
  const eng = await bookWith(ids.nurseB);
  await actor(ids.patient, 'select public.escalate_nursing_engagement($1)', [eng.id]);
  let offers = await db.query(
    'select 1 from public.nursing_engagement_offers where engagement_id=$1', [eng.id]);
  assert.equal(offers.rows.length, 1, 'too early: still hers alone');

  await db.query(
    `update public.nursing_engagements set broadcast_after = now() - interval '1 minute' where id=$1`,
    [eng.id]);
  await actor(ids.patient, 'select public.escalate_nursing_engagement($1)', [eng.id]);
  offers = await db.query(
    'select 1 from public.nursing_engagement_offers where engagement_id=$1', [eng.id]);
  assert.ok(offers.rows.length > 1);
});

test('a nurse who was not asked cannot grab a requested booking early', async () => {
  const eng = await bookWith(ids.nurseB);
  const seen = await actor(ids.nurseC, 'select id from public.list_nursing_engagement_offers()');
  assert.ok(!seen.rows.some(r => r.id === eng.id), 'it is not in her queue yet');
});

test('a patient cannot request someone who is not a provider', async () => {
  await assert.rejects(bookWith(ids.patient, 1), /NURSING_BAD_NURSE/);
});
