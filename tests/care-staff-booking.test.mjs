import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';

// Section 12 of the care-staff handover, as executable checks.
const db = new PGlite();
const ids = {
  patient: '60000000-0000-4000-8000-000000000001',
  nurseNear: '60000000-0000-4000-8000-000000000002',
  nurseAlso: '60000000-0000-4000-8000-000000000003',
  nurseFar: '60000000-0000-4000-8000-000000000004',
  nurseWrongSkill: '60000000-0000-4000-8000-000000000005',
  admin: '60000000-0000-4000-8000-000000000006',
  facility: '60000000-0000-4000-8000-000000000007',
};
const PUNE = { lat: 18.5204, lng: 73.8567 };
const NEAR = { lat: 18.5362, lng: 73.8930 };   // Koregaon Park, ~4km
const FAR = { lat: 19.0760, lng: 72.8777 };    // Mumbai, ~120km

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
    await db.query('insert into auth.users(id,email) values ($1,$2)', [id, `${k}@care.med`]);
  }
  await db.query(`insert into public.user_roles(user_id,role) values ($1,'admin')
                  on conflict do nothing`, [ids.admin]);

  const roster = [
    [ids.nurseNear, 'Pooja', ['icu', 'general_ward'], NEAR],
    [ids.nurseAlso, 'Sunita', ['icu'], NEAR],
    [ids.nurseFar, 'Meera', ['icu'], FAR],
    [ids.nurseWrongSkill, 'Anita', ['maternity'], NEAR],
  ];
  for (const [uid, name, skills, at] of roster) {
    await db.query(`insert into public.user_roles(user_id,role) values ($1,'provider')
                    on conflict do nothing`, [uid]);
    await db.query(`
      insert into public.nurses (user_id, full_name, skills, areas, city,
        verified, active, is_online, lat, lng, travel_radius_km, hospital_duty)
      values ($1,$2,$3,'{}',$6, true, true, true, $4, $5, 11, true)`,
      [uid, name, skills, at.lat, at.lng, at === FAR ? 'Mumbai' : 'Pune']);
  }
});
after(() => db.close());

beforeEach(async () => {
  await db.query('delete from public.unified_bookings');
  await db.query('delete from public.provider_reliability_events');
  await db.query(`update public.nurses set is_online = true, active = true, verified = true`);
  await db.query(`update public.booking_matching_settings set
    initial_radius_km = 4, expansion_step_km = 1, expansion_interval_minutes = 1,
    max_radius_km = 11, offer_expiry_minutes = 10, minimum_reliability_score = 40,
    max_active_jobs = 3, provider_cancellation_penalty = 10 where id = 1`);
});

const bookICU = (opts = {}) => actor(ids.patient, `
  select * from public.server_create_unified_booking(
    p_service_type => 'nurse_home_care', p_provider_role => 'nurse',
    p_title => 'ICU trained nurse at home', p_service_code => $1,
    p_priority => $2, p_estimated_earnings => $3,
    p_address => '14 Lane 6, Koregaon Park', p_area => 'Koregaon Park',
    p_lat => $4, p_lng => $5, p_description => 'Father post-discharge')`,
  [opts.skill ?? 'icu', opts.priority ?? 'routine', opts.pay ?? 1200,
   opts.lat ?? PUNE.lat, opts.lng ?? PUNE.lng]).then(r => r.rows[0]);

const offersOf = id => db.query(
  `select provider_id, status from public.booking_offers where booking_id=$1`, [id])
  .then(r => r.rows);

// ------------------------------------------------------------- matching ----

test('a request is offered to qualifying nurses within the starting radius', async () => {
  const b = await bookICU();
  assert.equal(b.status, 'offered');
  const got = (await offersOf(b.id)).map(o => o.provider_id);
  assert.ok(got.includes(ids.nurseNear));
  assert.ok(got.includes(ids.nurseAlso));
  assert.equal(b.current_radius_km, '4');
});

test('a nurse without the requested skill is never offered the job', async () => {
  const b = await bookICU({ skill: 'icu' });
  const got = (await offersOf(b.id)).map(o => o.provider_id);
  assert.ok(!got.includes(ids.nurseWrongSkill), 'maternity is not ICU');
});

test('a city match reaches past the radius, by design', async () => {
  // Section 7.2 qualifies on radius OR area OR city, so a nurse in the same
  // city is a candidate even when she is far outside the current radius.
  // Worth knowing: in a single-city roster the radius stops narrowing anything.
  await db.query(`update public.nurses set city = 'Pune' where user_id = $1`, [ids.nurseFar]);
  const b = await bookICU();
  const got = (await offersOf(b.id)).map(o => o.provider_id);
  assert.ok(got.includes(ids.nurseFar), '120km away, but same city');
  await db.query(`update public.nurses set city = 'Mumbai' where user_id = $1`, [ids.nurseFar]);
});

test('an offline nurse receives nothing', async () => {
  await db.query(`update public.nurses set is_online = false where user_id = $1`, [ids.nurseAlso]);
  const b = await bookICU();
  const got = (await offersOf(b.id)).map(o => o.provider_id);
  assert.ok(!got.includes(ids.nurseAlso));
});

test('a nurse whose minimum pay is above the fee is skipped', async () => {
  await db.query(`update public.nurses set minimum_pay = 5000 where user_id = $1`, [ids.nurseAlso]);
  const b = await bookICU({ pay: 1200 });
  const got = (await offersOf(b.id)).map(o => o.provider_id);
  assert.ok(!got.includes(ids.nurseAlso));
  await db.query(`update public.nurses set minimum_pay = 0 where user_id = $1`, [ids.nurseAlso]);
});

test('quiet hours hold a routine job back but an emergency still gets through', async () => {
  // A window that certainly contains now, whatever the clock says.
  await db.query(`update public.nurses
     set dnd_enabled = true, dnd_start = '00:00', dnd_end = '23:59',
         dnd_allow_emergency = true where user_id = $1`, [ids.nurseAlso]);

  const routine = await bookICU();
  assert.ok(!(await offersOf(routine.id)).map(o => o.provider_id).includes(ids.nurseAlso));

  const urgent = await bookICU({ priority: 'emergency' });
  assert.ok((await offersOf(urgent.id)).map(o => o.provider_id).includes(ids.nurseAlso));

  await db.query(`update public.nurses set dnd_enabled = false where user_id = $1`, [ids.nurseAlso]);
});

test('reliability below the minimum takes a nurse out of the roster', async () => {
  await db.query(`insert into public.provider_reliability_events
    (provider_id, event_type, score_delta, note) values ($1,'test',-50,'drop below 40')`,
    [ids.nurseAlso]);
  const score = await db.query('select public.provider_reliability_score($1) s', [ids.nurseAlso]);
  assert.equal(score.rows[0].s, 30);
  const b = await bookICU();
  assert.ok(!(await offersOf(b.id)).map(o => o.provider_id).includes(ids.nurseAlso));
});

test('the radius widens with elapsed time, not with call count', async () => {
  const b = await bookICU({ lat: PUNE.lat, lng: PUNE.lng });
  // Nobody new appears when the matcher is simply called again.
  await actor(null, 'select public.match_unified_booking($1)', [b.id], 'service_role');
  const first = await db.query(
    'select current_radius_km from public.unified_bookings where id=$1', [b.id]);
  assert.equal(first.rows[0].current_radius_km, '4');

  // Six minutes later the search is at 10 km.
  await db.query(`update public.unified_bookings
     set search_started_at = now() - interval '6 minutes' where id=$1`, [b.id]);
  await actor(null, 'select public.match_unified_booking($1)', [b.id], 'service_role');
  const later = await db.query(
    'select current_radius_km, status from public.unified_bookings where id=$1', [b.id]);
  assert.equal(later.rows[0].current_radius_km, '10');
});

test('the radius never passes the configured maximum', async () => {
  const b = await bookICU();
  await db.query(`update public.unified_bookings
     set search_started_at = now() - interval '5 hours' where id=$1`, [b.id]);
  await actor(null, 'select public.match_unified_booking($1)', [b.id], 'service_role');
  const r = await db.query('select current_radius_km from public.unified_bookings where id=$1', [b.id]);
  assert.equal(r.rows[0].current_radius_km, '11');
});

test('an admin change to the starting radius applies to the next request', async () => {
  await actor(ids.admin,
    `select public.admin_update_matching_settings('{"initial_radius_km": 2}'::jsonb)`);
  const b = await bookICU();
  assert.equal(b.current_radius_km, '2');
});

test('a patient cannot edit the matching settings', async () => {
  await assert.rejects(
    actor(ids.patient, `select public.admin_update_matching_settings('{"max_radius_km": 500}'::jsonb)`),
    /BOOKING_FORBIDDEN/);
});

// -------------------------------------------------------------- privacy ----

test('a pending offer carries no patient identity', async () => {
  await bookICU();
  const r = await actor(ids.nurseNear, 'select * from public.list_my_booking_offers()');
  const offer = r.rows[0];
  assert.ok(offer, 'the nurse can see the offer');
  assert.equal(offer.area, 'Koregaon Park');
  assert.ok(Number(offer.earnings) > 0);
  const text = JSON.stringify(offer);
  assert.ok(!text.includes('Lane 6'), 'no street address');
  assert.ok(!/patient_name|patient_phone|address|"lat"|"lng"|description/.test(text),
    'no identity, coordinates or clinical notes in a pending offer');
});

test('the full address unlocks only for the nurse who accepted', async () => {
  const b = await bookICU();
  await assert.rejects(
    actor(ids.nurseNear, 'select public.get_my_assigned_booking($1)', [b.id]),
    /BOOKING_FORBIDDEN/);

  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);
  const full = await actor(ids.nurseNear, 'select public.get_my_assigned_booking($1) d', [b.id]);
  assert.match(full.rows[0].d.address, /Lane 6/);
  assert.ok(full.rows[0].d.maps_url.includes('google.com/maps'));

  // The nurse who lost still cannot read it.
  await assert.rejects(
    actor(ids.nurseAlso, 'select public.get_my_assigned_booking($1)', [b.id]),
    /BOOKING_FORBIDDEN/);
});

// ----------------------------------------------------------- acceptance ----

test('exactly one of two simultaneous accepts wins', async () => {
  const b = await bookICU();
  const results = await Promise.allSettled([
    actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]),
    actor(ids.nurseAlso, 'select public.server_accept_unified_booking_offer($1)', [b.id]),
  ]);
  const won = results.filter(r => r.status === 'fulfilled');
  const lost = results.filter(r => r.status === 'rejected');
  assert.equal(won.length, 1, 'one winner');
  assert.equal(lost.length, 1, 'one told the job is gone');
  assert.match(String(lost[0].reason), /BOOKING_ALREADY_TAKEN|BOOKING_NOT_OFFERED/);

  const rest = await offersOf(b.id);
  assert.equal(rest.filter(o => o.status === 'pending').length, 0, 'no offer left hanging');
  assert.equal(rest.filter(o => o.status === 'accepted').length, 1);
});

test('a nurse who was never offered the job cannot claim it', async () => {
  const b = await bookICU();
  await assert.rejects(
    actor(ids.nurseFar, 'select public.server_accept_unified_booking_offer($1)', [b.id]),
    /BOOKING_NOT_OFFERED/);
});

test('an expired offer cannot be accepted', async () => {
  const b = await bookICU();
  await db.query(`update public.booking_offers set expires_at = now() - interval '1 minute'
                   where booking_id = $1`, [b.id]);
  await assert.rejects(
    actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]),
    /BOOKING_OFFER_EXPIRED/);
});

// ------------------------------------------------------------- lifecycle ---

test('the stage ladder only goes forward, one rung at a time', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);

  // Cannot jump straight to finished.
  await assert.rejects(
    actor(ids.nurseNear, `select public.server_transition_unified_booking($1,'completed')`, [b.id]),
    /BOOKING_BAD_STATUS/);

  for (const s of ['en_route', 'arrived', 'in_progress', 'completed']) {
    await actor(ids.nurseNear,
      `select public.server_transition_unified_booking($1,$2)`, [b.id, s]);
  }
  const done = await db.query('select status from public.unified_bookings where id=$1', [b.id]);
  assert.equal(done.rows[0].status, 'completed');

  const trail = await db.query(
    `select status from public.booking_status_history where booking_id=$1 order by created_at`, [b.id]);
  const stamps = trail.rows.map(r => r.status);
  for (const s of ['searching', 'offered', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed']) {
    assert.ok(stamps.includes(s), `trail stamps ${s}`);
  }
});

test('somebody else cannot move a job they were not assigned', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);
  await assert.rejects(
    actor(ids.nurseAlso, `select public.server_transition_unified_booking($1,'en_route')`, [b.id]),
    /BOOKING_FORBIDDEN/);
});

// ---------------------------------------------------------- cancellation ---

test('a provider cancelling reopens the search and excludes themselves', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);
  await actor(ids.nurseNear,
    `select public.server_cancel_unified_booking($1,'Family emergency')`, [b.id]);

  const after = await db.query(
    'select status, assigned_provider_id, current_radius_km from public.unified_bookings where id=$1',
    [b.id]);
  assert.ok(['searching', 'offered', 'expanded'].includes(after.rows[0].status));
  assert.equal(after.rows[0].assigned_provider_id, null);

  const mine = (await offersOf(b.id)).find(o => o.provider_id === ids.nurseNear);
  assert.equal(mine.status, 'declined', 'the matcher cannot come back to them');

  const score = await db.query('select public.provider_reliability_score($1) s', [ids.nurseNear]);
  assert.equal(score.rows[0].s, 70, 'a ten point penalty was recorded');

  // The other nurse is still a live candidate.
  const live = (await offersOf(b.id)).filter(o => o.status === 'pending');
  assert.ok(live.length > 0, 'somebody else is being asked');
});

test('a patient cancelling ends the booking rather than reopening it', async () => {
  const b = await bookICU();
  await actor(ids.patient, `select public.server_cancel_unified_booking($1,'No longer needed')`, [b.id]);
  const after = await db.query('select status from public.unified_bookings where id=$1', [b.id]);
  assert.equal(after.rows[0].status, 'cancelled');
  assert.equal((await offersOf(b.id)).filter(o => o.status === 'pending').length, 0);
});

test('declining removes that nurse from the round without ending the search', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, `select public.server_decline_unified_booking_offer($1,'Busy')`, [b.id]);
  const mine = (await offersOf(b.id)).find(o => o.provider_id === ids.nurseNear);
  assert.equal(mine.status, 'declined');
  const after = await db.query('select status from public.unified_bookings where id=$1', [b.id]);
  assert.notEqual(after.rows[0].status, 'cancelled');
});

// -------------------------------------------------------------- tracking ---

test('location is only accepted during an active job, and gives the patient an ETA', async () => {
  const b = await bookICU();
  await assert.rejects(
    actor(ids.nurseNear, 'select public.set_provider_live_location($1,$2,$3)',
      [b.id, NEAR.lat, NEAR.lng]),
    /BOOKING_FORBIDDEN/);

  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);

  const before = await actor(ids.patient, 'select public.get_booking_live_tracks($1) t', [b.id]);
  assert.equal(before.rows[0].t.shared, false, 'nothing shared yet');

  await actor(ids.nurseNear, 'select public.set_provider_live_location($1,$2,$3)',
    [b.id, NEAR.lat, NEAR.lng]);
  const track = await actor(ids.patient, 'select public.get_booking_live_tracks($1) t', [b.id]);
  assert.equal(track.rows[0].t.shared, true);
  assert.ok(Number(track.rows[0].t.distance_km) > 0);
  assert.ok(Number(track.rows[0].t.eta_minutes) > 0);
});

test('a stranger cannot watch somebody else travel', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);
  await assert.rejects(
    actor(ids.nurseFar, 'select public.get_booking_live_tracks($1)', [b.id]),
    /BOOKING_FORBIDDEN/);
});

// ----------------------------------------------------- duties and ratings --

test('a venue posts a nurse duty and matching nurses are notified', async () => {
  const duty = await actor(ids.patient, `
    select * from public.post_facility_nurse_duty(
      $1, 'icu', 'night', now() + interval '1 day', 12, 1500, 'routine', 'Koregaon Park', 'Pune')`,
    [ids.facility]).then(r => r.rows[0]);
  assert.equal(duty.service_type, 'nurse_duty');
  assert.equal(duty.owner_facility_id, ids.facility);
  assert.ok((await offersOf(duty.id)).length > 0, 'nurses were asked');
});

test('a duty posted with an unknown skill code is refused at source', async () => {
  // The handover's known pitfall: ward_general instead of general_ward.
  await assert.rejects(
    actor(ids.patient, `
      select public.post_facility_nurse_duty(
        $1, 'ward_general', 'night', now() + interval '1 day', 12, 1500)`, [ids.facility]),
    /CARE_UNKNOWN_SKILL/);
});

test('a nurse profile cannot be saved with a skill outside the catalogue', async () => {
  await assert.rejects(
    db.query(`update public.nurses set skills = '{ward_general}' where user_id=$1`, [ids.nurseNear]),
    /CARE_UNKNOWN_SKILL/);
});

test('a rating is stored and moves the reliability score', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);
  for (const s of ['en_route', 'arrived', 'in_progress', 'completed']) {
    await actor(ids.nurseNear, `select public.server_transition_unified_booking($1,$2)`, [b.id, s]);
  }
  await actor(ids.patient, `
    select public.server_submit_unified_booking_review($1, 5::smallint, 5::smallint,
      5::smallint, 5::smallint, 5::smallint, true, 'Very good')`, [b.id]);

  const r = await db.query('select overall from public.booking_reviews where booking_id=$1', [b.id]);
  assert.equal(r.rows[0].overall, 5);
  const score = await db.query('select public.provider_reliability_score($1) s', [ids.nurseNear]);
  assert.equal(score.rows[0].s, 82);
});

test('a job cannot be rated before it is finished', async () => {
  const b = await bookICU();
  await actor(ids.nurseNear, 'select public.server_accept_unified_booking_offer($1)', [b.id]);
  await assert.rejects(
    actor(ids.patient, 'select public.server_submit_unified_booking_review($1, 5::smallint)', [b.id]),
    /BOOKING_NOT_COMPLETE/);
});

test('an admin adjustment needs a written reason and lands in the history', async () => {
  await assert.rejects(
    actor(ids.admin, `select public.admin_adjust_provider_reliability($1, 5, '')`, [ids.nurseNear]),
    /BOOKING_REASON_REQUIRED/);

  const s = await actor(ids.admin,
    `select public.admin_adjust_provider_reliability($1, -15, 'Repeated late arrivals') s`,
    [ids.nurseNear]);
  assert.equal(s.rows[0].s, 65);
  const ev = await db.query(
    `select note, actor_id from public.provider_reliability_events
      where provider_id=$1 and event_type='manual_adjustment'`, [ids.nurseNear]);
  assert.equal(ev.rows[0].actor_id, ids.admin);
});

// ------------------------------------------------------------- scheduler ---

test('the scheduled tick expires stale offers and keeps searching', async () => {
  const b = await bookICU();
  await db.query(`update public.booking_offers set expires_at = now() - interval '1 minute'
                   where booking_id=$1`, [b.id]);
  const out = await actor(null, 'select public.unified_booking_tick() t', [], 'service_role');
  assert.ok(out.rows[0].t.offers_expired >= 1);
});
