import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, test } from 'node:test';
import { address, consentVersion, createDatabase, providerSettings, workingHours } from './home-visit-fixtures.mjs';

let db, actor, rpc;
before(async () => ({ db, actor, rpc } = await createDatabase()));
after(async () => db?.close());

async function user({ physician = false, approved = true, verified = true, pilot = true, settlement = false } = {}) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [id, `home-test-${id}@example.invalid`, physician ? { role: 'provider', subtype: 'care_physician' } : {}]);
  if (pilot) await db.query('insert into public.home_visit_pilot_participants(user_id,settlement_enabled) values ($1,$2)', [id, settlement]);
  if (physician) {
    if (approved) {
      await db.query("insert into public.user_roles(user_id,role) values ($1,'provider')", [id]);
      await db.query("update public.account_role_requests set status='approved' where user_id=$1", [id]);
      await actor(id, "insert into public.care_physician_profiles(user_id,qualification,experience_years,council_name,council_registration_number) values ($1,'mbbs',5,'Synthetic council','SYNTHETIC-ONLY')", [id]);
      if (verified) await actor(null, 'update public.care_physician_profiles set registration_verified=true where user_id=$1', [id], 'service_role');
    }
    await actor(id, 'insert into public.provider_availability(user_id,is_online,working_hours,timezone) values ($1,true,$2,\'Asia/Kolkata\')', [id, workingHours]);
    if (approved && verified) await rpc(id, 'hv_save_provider_settings', providerSettings);
  }
  return id;
}
async function pair(options = {}) {
  return { patient: await user(options), doctor: await user({ ...options, physician: true }) };
}
function tomorrow(days = 1, hour = 10) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}
async function quote(patient, doctor, options = {}) {
  return rpc(patient, 'hv_quote', { provider_id: doctor, routing: 'named', is_now: false, pincode: address.pincode, start_time: tomorrow(), ...options });
}
async function book(patient, doctor, options = {}) {
  const q = await quote(patient, doctor, options);
  const input = { quote_id: q.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic visit reason' }, consent: true, consent_version: consentVersion };
  return { visit: await rpc(patient, 'hv_create', input), quote: q, input };
}
async function action(id, visit, name, extra = {}) {
  return rpc(id, 'hv_action', { booking_id: visit.id, expected_version: visit.version, action: name, ...extra });
}
async function list(id) {
  return (await actor(id, 'select public.hv_list() as result')).rows[0].result;
}
async function code(patient, visit) {
  return (await actor(patient, 'select public.hv_arrival_code($1) as result', [visit.id])).rows[0].result;
}

test('unapproved real-patient rollout and direct legacy home-visit RPCs are blocked', async () => {
  const outsider = await user({ pilot: false });
  const context = (await actor(outsider, 'select public.hv_context() as result')).rows[0].result;
  assert.equal(context.enabled, false);
  await assert.rejects(rpc(outsider, 'hv_quote', { routing: 'pool', is_now: true, pincode: address.pincode }), /enabled|pilot|approval|available/i);
  await assert.rejects(actor(outsider, "select public.create_home_visit_booking(true,null,'Doctor Home Visit',1,$1,'v1')", [address]), /permission denied|disabled|retired|secure/i);
  const grants = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'hv_%' and has_function_privilege('anon',p.oid,'EXECUTE')`);
  assert.deepEqual(grants.rows, []);
  const schedulingGrants = await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('atomic_book_appointment','cancel_appointment','get_provider_slots','reschedule_appointment')
    and has_function_privilege('anon',p.oid,'EXECUTE')`);
  assert.deepEqual(schedulingGrants.rows, [], 'explicit Supabase default grants must also be revoked from scheduling RPCs');
});

test('disabled accounts receive an empty home-visit list without bypassing authentication or booking policy', async () => {
  const { patient, doctor } = await pair();
  const outsider = await user({ pilot: false });
  const { visit } = await book(patient, doctor);
  assert.ok((await list(patient)).some(row => row.id === visit.id), 'enabled participants keep their scoped visit history');
  assert.deepEqual(await list(outsider), [], 'a disabled account cannot read another participant\'s visit');
  await assert.rejects(quote(outsider, doctor), /enabled|pilot|approval|available/i);

  await db.query('delete from public.home_visit_pilot_participants where user_id=$1', [patient]);
  assert.deepEqual(await list(patient), [], 'removing pilot access also hides previously accessible visits');
  await assert.rejects(quote(patient, doctor), /enabled|pilot|approval|available/i);
  await assert.rejects(actor(null, 'select public.hv_list()'), error => error.code === '42501');
  await assert.rejects(actor(null, 'select public.hv_list()', [], 'anon'), /permission denied/i);
});

test('future home booking survives immediate offline and requires explicit named-doctor acceptance', async () => {
  const { patient, doctor } = await pair();
  await actor(doctor, 'update public.provider_availability set is_online=false where user_id=$1', [doctor]);
  const { visit, quote: q } = await book(patient, doctor);
  assert.equal(visit.status, 'pending');
  assert.equal(visit.provider_id, doctor);
  assert.equal(visit.fee, q.total);
  assert.equal(visit.provider_timezone, 'Asia/Kolkata');
  await assert.rejects(action(patient, visit, 'accept'), /doctor|provider|assigned|authori/i);
  const accepted = await action(doctor, visit, 'accept');
  assert.equal(accepted.status, 'confirmed');
  const patientView = (await list(patient)).find(row => row.id === visit.id);
  const doctorView = (await list(doctor)).find(row => row.id === visit.id);
  for (const view of [patientView, doctorView]) {
    assert.equal(view.id, visit.id);
    assert.equal(view.status, 'confirmed');
    assert.equal(view.address_snapshot.full_address, address.full_address);
    assert.equal(view.fee, q.total);
  }
});

test('immediate request saves complete details without emergency dispatch or automatic acceptance', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor, { is_now: true, start_time: undefined });
  assert.equal(visit.status, 'pending');
  assert.equal(visit.address_snapshot.locality, address.locality);
  assert.equal(visit.address_snapshot.phone, address.phone);
  assert.equal(visit.address_snapshot.reason, 'Synthetic visit reason');
  assert.equal((await list(patient)).find(row => row.id === visit.id).status, 'pending');
  assert.equal((await db.query('select count(*)::int as count from public.care_requests where patient_id=$1', [patient])).rows[0].count, 0);
  await assert.rejects(action(doctor, visit, 'start_travel'), /confirmed|transition|state/i);
});

test('wrong-role, unapproved and unverified providers cannot publish or accept home visits', async () => {
  const { patient, doctor } = await pair();
  const unapproved = await user({ physician: true, approved: false });
  const unverified = await user({ physician: true, verified: false });
  for (const id of [patient, unapproved, unverified]) {
    await assert.rejects(rpc(id, 'hv_save_provider_settings', providerSettings), /doctor|provider|verified|approved|eligible/i);
  }
  const { visit } = await book(patient, doctor);
  for (const id of [patient, unapproved, unverified]) await assert.rejects(action(id, visit, 'accept'), /doctor|provider|verified|approved|eligible|assigned|authori|access denied/i);
});

test('unrelated patient and unassigned doctor cannot read private visit, consent, event or code data', async () => {
  const { patient, doctor } = await pair();
  const other = await user();
  const stranger = await user({ physician: true });
  const { visit } = await book(patient, doctor);
  for (const id of [other, stranger]) {
    assert.equal((await list(id)).some(row => row.id === visit.id), false);
    assert.deepEqual((await actor(id, 'select id from public.doctor_appointments where id=$1', [visit.id])).rows, []);
    await assert.rejects(code(id, visit), /patient|authori|access|found/i);
  }
  const forged = await actor(patient, "update public.doctor_appointments set home_visit_status='completed' where id=$1 returning id", [visit.id]);
  assert.deepEqual(forged.rows, [], 'RLS blocks direct changes even when inherited table grants allow UPDATE');
  assert.equal((await list(patient)).find(row => row.id === visit.id).home_visit_status, 'pending');
  const offer = (await list(doctor)).find(row => row.id === visit.id);
  assert.deepEqual(Object.keys(offer.address_snapshot).sort(), ['locality', 'pincode']);
  assert.equal(offer.patient_id, undefined);
  await action(patient, visit, 'cancel', { reason: 'Synthetic unaccepted cancellation' });
  const cancelledOffer = (await list(doctor)).find(row => row.id === visit.id);
  assert.ok(!cancelledOffer || !cancelledOffer.address_snapshot?.full_address, 'cancellation must not reveal an unaccepted address');
});

test('actor-scoped idempotency and opaque recovery reject changed payload and cross-account replay', async () => {
  const { patient, doctor } = await pair();
  const other = await user();
  const { visit, input } = await book(patient, doctor);
  assert.equal((await rpc(patient, 'hv_create', input)).id, visit.id);
  const recovered = (await actor(patient, 'select public.hv_recover($1) as result', [input.idempotency_key])).rows[0].result;
  assert.equal(recovered.id, visit.id);
  await assert.rejects(rpc(patient, 'hv_create', { ...input, address: { ...input.address, landmark: 'Changed address' } }), /idempoten|payload|different/i);
  await assert.rejects(rpc(other, 'hv_create', input), /quote|actor|owner|authori/i);
  const otherRecovery = (await actor(other, 'select public.hv_recover($1) as result', [input.idempotency_key])).rows[0].result;
  assert.equal(otherRecovery, null);
  assert.equal((await db.query('select count(*)::int as count from public.doctor_appointments where patient_id=$1', [patient])).rows[0].count, 1);
});

test('coverage, dependent authority, consent and stale quotes fail atomically', async () => {
  const { patient, doctor } = await pair();
  await assert.rejects(quote(patient, doctor, { pincode: '999999' }), /coverage|service|available|eligible|capacity/i);
  const q = await quote(patient, doctor);
  const input = { quote_id: q.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic reason' }, consent: true, consent_version: consentVersion };
  await assert.rejects(rpc(patient, 'hv_create', { ...input, dependent_id: randomUUID() }), /dependent|family|authori/i);
  await assert.rejects(rpc(patient, 'hv_create', { ...input, consent: false }), /consent/i);
  await assert.rejects(rpc(patient, 'hv_create', { ...input, consent_version: 'invalid' }), /consent/i);
  await assert.rejects(rpc(patient, 'hv_create', { ...input, patient_id: await user() }), /identity|actor|patient|client|unsupported/i);
  await assert.rejects(rpc(patient, 'hv_create', { ...input, address: { ...input.address, pincode: '999999' } }), /coverage|pincode|quote|service/i);
  await rpc(doctor, 'hv_save_provider_settings', { ...providerSettings, fee: 700 });
  await assert.rejects(rpc(patient, 'hv_create', input), /quote|price|fee|changed|stale/i);
  assert.equal((await db.query('select count(*)::int as count from public.doctor_appointments where patient_id=$1', [patient])).rows[0].count, 0);
});

test('client-supplied fees cannot replace the server-reviewed quote', async () => {
  const { patient, doctor } = await pair();
  const q = await quote(patient, doctor);
  const input = { quote_id: q.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic price tampering' }, consent: true, consent_version: consentVersion };
  await assert.rejects(rpc(patient, 'hv_create', { ...input, fee: 1, currency: 'USD' }), /fee|currency|client|quote|server|override/i);
  const visit = await rpc(patient, 'hv_create', input);
  assert.equal(visit.fee, providerSettings.fee);
  assert.equal(visit.currency, providerSettings.currency);
});

test('a real consent-write failure rolls back the appointment, reservation, offers and events together', async () => {
  const { patient, doctor } = await pair();
  const q = await quote(patient, doctor);
  await db.exec(`create function private.home_test_consent_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic consent storage failure'; end $$;
    create trigger home_test_consent_failure before insert on public.home_visit_consents for each row when (new.actor_id='${patient}'::uuid) execute function private.home_test_consent_failure();`);
  try {
    await assert.rejects(rpc(patient, 'hv_create', { quote_id: q.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic failure' }, consent: true, consent_version: consentVersion }), /Synthetic consent storage failure/);
    assert.equal((await db.query('select count(*)::int as count from public.doctor_appointments where patient_id=$1', [patient])).rows[0].count, 0);
    assert.equal((await db.query('select count(*)::int as count from public.home_visit_details where actor_id=$1', [patient])).rows[0].count, 0);
  } finally {
    await db.exec('drop trigger home_test_consent_failure on public.home_visit_consents; drop function private.home_test_consent_failure();');
  }
  assert.ok((await book(patient, doctor)).visit.id, 'rollback releases capacity for a corrected submission');
});

test('server rejects past time, blocked date, DND and invalid occupied intervals', async () => {
  const { patient, doctor } = await pair();
  await assert.rejects(quote(patient, doctor, { start_time: '2000-01-01T10:00:00Z' }), /past|lead|future|time|available/i);
  const start = tomorrow();
  await actor(doctor, 'update public.provider_availability set blocked_dates=ARRAY[$2::date] where user_id=$1', [doctor, start.slice(0, 10)]);
  await assert.rejects(quote(patient, doctor), /blocked|available|working|time/i);
  await actor(doctor, 'update public.provider_availability set blocked_dates=ARRAY[]::date[],dnd_windows=$2 where user_id=$1', [doctor, [{ days: [], start: '15:40', end: '15:45' }]]);
  await assert.rejects(quote(patient, doctor), /DND|available|working|time/i);
  await actor(doctor, 'update public.provider_availability set dnd_windows=\'[]\',working_hours=$2 where user_id=$1', [doctor, {}]);
  await assert.rejects(quote(patient, doctor), /working|available|configured|time/i);
});

test('travel buffers protect pending capacity across home, clinic and video modes', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor);
  const near = new Date(new Date(visit.end_time).getTime() + 5 * 60_000).toISOString();
  await assert.rejects(book(patient, doctor, { start_time: near }), /capacity|conflict|available|reservation/i);
  await assert.rejects(actor(patient, "select public.atomic_book_appointment($1,$2,$3,$4,'Clinic consultation',100)", [doctor, patient, near, new Date(new Date(near).getTime() + 30 * 60_000).toISOString()]), /capacity|conflict|overlap/i);
  await assert.rejects(db.query("insert into public.doctor_appointments(provider_id,patient_id,service,mode,start_time,end_time,fee) values ($1,$2,'Video consultation','video',$3,$4,100)", [doctor, patient, near, new Date(new Date(near).getTime() + 30 * 60_000).toISOString()]), /capacity|conflict|overlap/i);
  const cancelled = await action(patient, visit, 'cancel', { reason: 'Synthetic capacity release' });
  assert.equal(cancelled.home_visit_status, 'cancelled');
  assert.ok((await book(patient, doctor)).visit.id);
});

test('legacy slot discovery is bounded and accounts for home-visit travel buffers', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor);
  const day = tomorrow().slice(0, 10);
  for (const duration of [0, -30, 1000]) await assert.rejects(actor(patient, 'select * from public.get_provider_slots($1,$2::date,$2::date,$3)', [doctor, day, duration]), /duration|range|between|invalid/i);
  await assert.rejects(actor(patient, "select * from public.get_provider_slots($1,$2::date,$2::date+1000,30)", [doctor, day]), /range|62|dates|invalid/i);
  const slots = (await actor(patient, 'select * from public.get_provider_slots($1,$2::date,$2::date,30)', [doctor, day])).rows;
  const earlier = new Date(new Date(visit.start_time).getTime() - 30 * 60_000).getTime();
  const bufferedSlot = slots.find(slot => new Date(slot.start_time).getTime() === earlier);
  assert.ok(bufferedSlot);
  assert.equal(bufferedSlot.is_available, false, 'a slot overlapping only travel buffer is occupied');
});

test('expiry releases only pending capacity and rejects acceptance despite a delayed expiry job', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor);
  await db.query("update public.home_visit_details set pending_deadline=now()-interval '1 minute' where booking_id=$1", [visit.id]);
  await assert.rejects(action(doctor, visit, 'accept'), /expired|deadline|pending|access denied/i);
  const replacement = (await book(patient, doctor)).visit;
  const confirmed = await action(doctor, replacement, 'accept');
  await db.query("update public.home_visit_details set pending_deadline=now()-interval '1 minute' where booking_id=$1", [confirmed.id]);
  assert.equal((await list(patient)).find(row => row.id === confirmed.id).home_visit_status, 'confirmed');
});

test('cancellation is version checked, recorded with reason and cannot resurrect a terminal visit', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor);
  const accepted = await action(doctor, visit, 'accept');
  await assert.rejects(action(patient, visit, 'cancel', { reason: 'Stale browser action' }), /version|stale|changed/i);
  const cancelled = await action(patient, accepted, 'cancel', { reason: 'Synthetic cancellation' });
  assert.equal(cancelled.home_visit_status, 'cancelled');
  await assert.rejects(action(doctor, cancelled, 'accept'), /state|transition|pending|cancelled|available/i);
  await assert.rejects(action(doctor, cancelled, 'start_travel'), /state|transition|confirmed|cancelled/i);
  const events = (await db.query('select kind,reason from public.home_visit_events where booking_id=$1', [visit.id])).rows;
  assert.ok(events.some(event => event.reason === 'Synthetic cancellation'));
});

async function travelling(options = {}) {
  const { patient, doctor } = await pair(options);
  let { visit } = await book(patient, doctor, { is_now: true, start_time: undefined });
  visit = await action(doctor, visit, 'accept');
  visit = await action(doctor, visit, 'start_travel', { eta_minutes: 20 });
  return { patient, doctor, visit };
}

test('arrival is patient-issued, hashed at rest, visit bound and separate from consultation', async () => {
  const { patient, doctor, visit } = await travelling();
  assert.equal(visit.home_visit_status, 'en_route');
  assert.equal(visit.arrival_otp ?? null, null);
  await assert.rejects(code(doctor, visit), /patient|authori|access/i);
  await assert.rejects(action(doctor, visit, 'start_consultation'), /arrival|arrived|check|state|transition/i);
  const issued = await code(patient, visit);
  assert.ok(typeof issued.code === 'string' && /^\d{6}$/.test(issued.code), 'patient receives a six-digit server code');
  const secret = (await db.query('select * from public.home_visit_arrival_secrets where booking_id=$1', [visit.id])).rows[0];
  assert.ok(secret.code_hash);
  assert.equal(JSON.stringify(secret).includes(issued.code), false, 'stored material must not contain the plaintext code');
  assert.equal((await actor(patient, 'select arrival_otp from public.doctor_appointments where id=$1', [visit.id])).rows[0].arrival_otp, null);
  const reported = await action(doctor, visit, 'report_arrival');
  assert.equal(reported.home_visit_status, 'arrived');
  assert.equal(reported.arrived_at, null, 'doctor report alone does not acknowledge patient check-in');
  await assert.rejects(action(doctor, reported, 'start_consultation'), /acknowledge|arrival|patient/i);
  const arrived = await rpc(doctor, 'hv_verify_arrival', { booking_id: visit.id, expected_version: reported.version, code: issued.code });
  assert.equal(arrived.home_visit_status, 'arrived');
  const replay = await rpc(doctor, 'hv_verify_arrival', { booking_id: visit.id, expected_version: arrived.version, code: issued.code });
  assert.equal(replay.ok, false);
  assert.equal((await action(doctor, arrived, 'start_consultation')).home_visit_status, 'in_consultation');
});

test('wrong codes persist rate limits; expiry and code regeneration cannot bypass exhausted attempts', async () => {
  const { patient, doctor, visit } = await travelling();
  const issued = await code(patient, visit);
  let current = visit;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const result = await rpc(doctor, 'hv_verify_arrival', { booking_id: visit.id, expected_version: current.version, code: '0000' });
    assert.equal(result.ok, false);
    assert.equal((await db.query('select attempts from public.home_visit_arrival_secrets where booking_id=$1', [visit.id])).rows[0].attempts, attempt);
    current = (await list(doctor)).find(row => row.id === visit.id);
  }
  const blocked = await rpc(doctor, 'hv_verify_arrival', { booking_id: visit.id, expected_version: current.version, code: issued.code });
  assert.equal(blocked.ok, false);
  await assert.rejects(code(patient, visit), /attempt|limit|locked|support/i);
  const second = await travelling();
  const expired = await code(second.patient, second.visit);
  await db.query("update public.home_visit_arrival_secrets set expires_at=now()-interval '1 minute' where booking_id=$1", [second.visit.id]);
  assert.equal((await rpc(second.doctor, 'hv_verify_arrival', { booking_id: second.visit.id, expected_version: second.visit.version, code: expired.code })).ok, false);
  assert.equal((await list(second.patient)).find(row => row.id === second.visit.id).home_visit_status, 'en_route');
});

async function consultation(options = {}) {
  const result = await travelling(options);
  const issued = await code(result.patient, result.visit);
  let visit = await rpc(result.doctor, 'hv_verify_arrival', { booking_id: result.visit.id, expected_version: result.visit.version, code: issued.code });
  visit = await action(result.doctor, visit, 'start_consultation');
  return { ...result, visit };
}

test('only assigned clinician can sign a saved encounter before completion; payment stays separate', async () => {
  const { patient, doctor, visit } = await consultation();
  await assert.rejects(action(patient, visit, 'save_encounter', { summary: 'Forged patient summary' }), /doctor|provider|assigned|authori/i);
  await assert.rejects(action(doctor, visit, 'complete'), /summary|encounter|record/i);
  await assert.rejects(action(doctor, visit, 'save_encounter', { summary: ' ' }), /summary|required/i);
  const signed = await action(doctor, visit, 'save_encounter', { summary: 'Synthetic consultation summary', follow_up: 'Synthetic follow-up' });
  assert.ok(signed.clinical_notes.signed_at);
  assert.equal(signed.clinical_notes.author_id, doctor);
  const completed = await action(doctor, signed, 'complete');
  assert.equal(completed.home_visit_status, 'completed');
  assert.equal(completed.payment_settlement, null);
  assert.equal((await list(patient)).find(row => row.id === visit.id).clinical_notes.summary, 'Synthetic consultation summary');
  await assert.rejects(action(doctor, completed, 'save_encounter', { summary: 'Silent replacement' }), /sign|amend|complete|state|transition|consulting/i);
  const amended = await action(doctor, completed, 'amend_encounter', { summary: 'Synthetic corrected summary', reason: 'Synthetic documented correction' });
  assert.equal(amended.clinical_notes.summary, 'Synthetic consultation summary', 'original signed record is preserved');
  assert.equal(amended.clinical_notes.amendments.length, 1);
});

test('cash settlement requires configured authority and exact quote; replay cannot issue duplicate receipts', async () => {
  const { patient, doctor, visit } = await consultation({ settlement: true });
  const signed = await action(doctor, visit, 'save_encounter', { summary: 'Synthetic encounter' });
  const completed = await action(doctor, signed, 'complete');
  const payment = { method: 'cash', amount: completed.total, currency: completed.currency, reference: 'synthetic-receipt' };
  await assert.rejects(action(patient, completed, 'record_settlement', payment), /doctor|provider|assigned|authori/i);
  await assert.rejects(action(doctor, completed, 'record_settlement', { ...payment, amount: completed.total + 1 }), /amount|quote|match/i);
  await assert.rejects(action(doctor, completed, 'record_settlement', { ...payment, method: 'gateway' }), /method|cash|payment/i);
  const paid = await action(doctor, completed, 'record_settlement', payment);
  assert.equal(paid.payment_settlement.status, 'recorded_pay_at_visit');
  assert.equal(paid.payment_settlement.actor_id, doctor);
  assert.equal(paid.payment_settlement.amount, completed.total);
  await assert.rejects(action(doctor, completed, 'record_settlement', payment), /version|stale|changed|already/i);
  assert.equal((await db.query('select count(*)::int as count from public.home_visit_settlements where booking_id=$1', [visit.id])).rows[0].count, 1);
  const defaultContext = (await actor(await user(), 'select public.hv_context() as result')).rows[0].result;
  assert.equal(defaultContext.pay_at_visit_enabled, false);
  assert.equal(defaultContext.online_payment_enabled, false);
});

test('unapproved settlement and unsupported payment/no-show callbacks cannot change clinical or payment state', async () => {
  const { patient, doctor, visit } = await consultation();
  const signed = await action(doctor, visit, 'save_encounter', { summary: 'Synthetic unpaid encounter' });
  const completed = await action(doctor, signed, 'complete');
  await assert.rejects(action(doctor, completed, 'record_settlement', { method: 'cash', amount: completed.total, currency: completed.currency }), /not enabled|authorised/i);
  for (const name of ['payment_success', 'refund', 'no_show']) await assert.rejects(action(patient, completed, name), /Unsupported/);
  const persisted = (await list(patient)).find(row => row.id === visit.id);
  assert.equal(persisted.payment_settlement, null);
  assert.equal(persisted.home_visit_status, 'completed');
  assert.equal(persisted.clinical_notes.summary, 'Synthetic unpaid encounter');
});

test('reschedule holds preserve the accepted original until explicit acceptance and release a declined replacement', async () => {
  const { patient, doctor } = await pair();
  let { visit } = await book(patient, doctor);
  visit = await action(doctor, visit, 'accept');
  const originalStart = visit.start_time;
  const replacement = await quote(patient, doctor, { start_time: tomorrow(2), booking_id: visit.id });
  let pending = await action(patient, visit, 'request_reschedule', { quote_id: replacement.quote_id, reason: 'Synthetic reschedule' });
  assert.equal(pending.start_time, originalStart);
  assert.ok(pending.reschedule);
  await assert.rejects(book(patient, doctor, { start_time: tomorrow(2) }), /conflict|capacity|available/i);
  const declined = await action(doctor, pending, 'decline_reschedule', { reason: 'Synthetic decline' });
  assert.equal(declined.start_time, originalStart);
  assert.equal(declined.reschedule, null);
  const fresh = await quote(patient, doctor, { start_time: tomorrow(2), booking_id: visit.id });
  pending = await action(patient, declined, 'request_reschedule', { quote_id: fresh.quote_id, reason: 'Synthetic reschedule retry' });
  const accepted = await action(doctor, pending, 'accept_reschedule');
  assert.equal(accepted.start_time, fresh.start_time);
  assert.equal(accepted.id, visit.id);
  assert.equal(accepted.reschedule, null);
  assert.ok((await book(patient, doctor)).visit.id, 'old capacity is released after accepted replacement');
});

test('private consent is server-authored, audit events append only, and disabled notifications never claim delivery', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor);
  const consent = (await db.query('select * from public.home_visit_consents where booking_id=$1', [visit.id])).rows[0];
  assert.equal(consent.actor_id, patient);
  assert.equal(consent.patient_id, patient);
  assert.equal(consent.version, consentVersion);
  assert.equal(consent.scope, 'home_visit_and_visit_record');
  assert.ok(consent.accepted_at);
  for (const table of ['home_visit_consents', 'home_visit_events', 'home_visit_arrival_secrets', 'home_visit_encounters']) {
    await assert.rejects(actor(patient, `select * from public.${table}`), /permission denied/);
  }
  const jobs = (await db.query('select status from public.home_visit_notification_jobs where booking_id=$1', [visit.id])).rows;
  assert.ok(jobs.length > 0);
  assert.ok(jobs.every(job => job.status === 'disabled'));
});

test('operations access is explicitly scoped and excludes address, clinical notes, consent and OTP', async () => {
  const { patient, doctor } = await pair();
  const { visit } = await book(patient, doctor);
  const coordinator = await user();
  await assert.rejects(actor(coordinator, 'select public.hv_operations()'), /permission/i);
  await db.query('insert into public.home_visit_operations_members(user_id) values ($1)', [coordinator]);
  const operations = (await actor(coordinator, 'select public.hv_operations() as result')).rows[0].result;
  const row = operations.find(row => row.booking_id === visit.id);
  assert.ok(row);
  for (const key of ['address_snapshot', 'clinical_notes', 'patient_id', 'consent', 'code', 'arrival_otp']) assert.equal(key in row, false);
  await assert.rejects(code(coordinator, visit), /patient|active/i);
});

async function overdueVisit(patient, doctor, days, hoursAgo) {
  let { visit } = await book(patient, doctor, { start_time: tomorrow(days) });
  visit = await action(doctor, visit, 'accept');
  // Advance only this synthetic appointment's clock. Production mutation RPCs
  // cannot change agreed times this way; this represents a confirmed visit left
  // unstarted after its original slot passed, without sleeping for several hours.
  await db.query(`update public.doctor_appointments
    set start_time=now()-make_interval(hours=>$2),
        end_time=now()-make_interval(hours=>$2)+interval '30 minutes'
    where id=$1`, [visit.id, hoursAgo]);
  return (await list(patient)).find(row => row.id === visit.id);
}

test('disjoint overdue bookings cannot give one doctor two active home visits in either start order', async () => {
  for (const newerFirst of [true, false]) {
    const { patient, doctor } = await pair();
    const older = await overdueVisit(patient, doctor, 1, 4);
    const newer = await overdueVisit(patient, doctor, 2, 2);
    const [first, second] = newerFirst ? [newer, older] : [older, newer];
    const active = await action(doctor, first, 'start_travel');
    assert.equal(active.home_visit_status, 'en_route');
    await assert.rejects(action(doctor, second, 'start_travel'), /active home visit|capacity|conflict/i);
    const rows = (await list(patient)).filter(row => [older.id, newer.id].includes(row.id));
    assert.equal(rows.filter(row => row.home_visit_status === 'en_route').length, 1);
    assert.equal(rows.find(row => row.id === second.id).home_visit_status, 'confirmed');
    assert.equal(rows.find(row => row.id === first.id).start_time, first.start_time, 'actual admission must preserve the agreed appointment instant');
  }
});

test('late travel reserves from server time and cannot overrun a near-future commitment', async () => {
  const { patient, doctor } = await pair();
  const overdue = await overdueVisit(patient, doctor, 1, 4);
  const safeTz = new Date().getUTCHours() < 12 ? 'UTC' : 'Pacific/Honolulu';
  await actor(doctor, 'update public.provider_availability set timezone=$1 where user_id=$2', [safeTz, doctor]);
  await rpc(doctor, 'hv_save_provider_settings', { ...providerSettings, timezone: safeTz, lead_minutes: 0 });
  const soon = new Date(Date.now() + 20 * 60_000).toISOString();
  let { visit: future } = await book(patient, doctor, { start_time: soon });
  future = await action(doctor, future, 'accept');
  await assert.rejects(action(doctor, overdue, 'start_travel'), /current|upcoming|capacity|conflict/i);
  for (const id of [overdue.id, future.id]) {
    assert.equal((await list(patient)).find(row => row.id === id).home_visit_status, 'confirmed');
  }
  await action(patient, future, 'cancel', { reason: 'Release the synthetic near-future reservation' });
  const admitted = await action(doctor, overdue, 'start_travel');
  assert.equal(admitted.home_visit_status, 'en_route');
  assert.equal(admitted.start_time, overdue.start_time);
});

test('revoked credentials block a new consultation while preserving documentation of care already started', async () => {
  const { patient, doctor, visit } = await travelling();
  const issued = await code(patient, visit);
  let current = await rpc(doctor, 'hv_verify_arrival', { booking_id: visit.id, expected_version: visit.version, code: issued.code });
  await actor(null, 'update public.care_physician_profiles set registration_verified=false where user_id=$1', [doctor], 'service_role');
  await assert.rejects(action(doctor, current, 'start_consultation'), /authorised|verified|registration/i);
  assert.equal((await db.query('select count(*)::int as count from public.home_visit_encounters where booking_id=$1', [visit.id])).rows[0].count, 0);
  assert.equal((await list(patient)).find(row => row.id === visit.id).home_visit_status, 'arrived');
  await actor(null, 'update public.care_physician_profiles set registration_verified=true where user_id=$1', [doctor], 'service_role');
  current = await action(doctor, current, 'start_consultation');
  await actor(null, 'update public.care_physician_profiles set registration_verified=false where user_id=$1', [doctor], 'service_role');
  current = await action(doctor, current, 'save_encounter', { summary: 'Synthetic record of care already started' });
  current = await action(doctor, current, 'complete');
  assert.equal(current.home_visit_status, 'completed');
  assert.equal(current.clinical_notes.summary, 'Synthetic record of care already started');
});

test('the active home guard leaves generic appointments with no home status unchanged', async () => {
  const { patient, doctor } = await pair();
  const start = tomorrow();
  const end = new Date(new Date(start).getTime() + 30 * 60_000).toISOString();
  const result = await db.query(`insert into public.doctor_appointments
    (provider_id,patient_id,service,start_time,end_time,fee,home_visit_status)
    values ($1,$2,'Synthetic clinic regression',$3,$4,0,null)
    returning mode,home_visit_status,status`, [doctor, patient, start, end]);
  assert.deepEqual(result.rows, [{ mode: 'in-person', home_visit_status: null, status: 'confirmed' }]);
});

test('expired replacement holds preserve the original and emit one versioned audit with notification jobs', async () => {
  const { patient, doctor } = await pair();
  let { visit } = await book(patient, doctor);
  visit = await action(doctor, visit, 'accept');
  const originalStart = visit.start_time;
  const replacement = await quote(patient, doctor, { booking_id: visit.id, start_time: tomorrow(2) });
  const proposed = await action(patient, visit, 'request_reschedule', { quote_id: replacement.quote_id, reason: 'Synthetic expiring replacement' });
  await db.query("update public.home_visit_reschedule_holds set expires_at=now()-interval '1 minute' where booking_id=$1", [visit.id]);

  const expire = async ids => (await actor(null, 'select public.hv_expire_pending(100,$1::uuid[]) as changes', [ids], 'service_role')).rows[0].changes;
  assert.equal(await expire([randomUUID()]), 0, 'fixture-scoped expiry must not touch another booking');
  assert.equal((await db.query('select count(*)::int as count from public.home_visit_reschedule_holds where booking_id=$1', [visit.id])).rows[0].count, 1);
  assert.equal(await expire([visit.id]), 1);
  const current = (await list(patient)).find(row => row.id === visit.id);
  assert.equal(current.home_visit_status, 'confirmed');
  assert.equal(current.start_time, originalStart);
  assert.equal(current.reschedule, null);
  assert.equal(current.version, proposed.version + 1);
  await assert.rejects(action(doctor, proposed, 'accept_reschedule'), /changed|version|stale/i);
  assert.equal(await expire([visit.id]), 0);
  const events = (await db.query("select id,version from public.home_visit_events where booking_id=$1 and kind='reschedule_expired'", [visit.id])).rows;
  assert.equal(events.length, 1);
  assert.equal(events[0].version, current.version);
  const jobs = (await db.query('select recipient_id,status from public.home_visit_notification_jobs where event_id=$1 order by recipient_id', [events[0].id])).rows;
  assert.deepEqual(jobs.map(job => job.recipient_id).sort(), [patient, doctor].sort());
  assert.ok(jobs.every(job => job.status === 'disabled'), 'auditing expiry must not pretend disabled notifications were sent');
  await assert.rejects(book(patient, doctor), /capacity|available|reservation/i);
  assert.ok((await book(patient, doctor, { start_time: tomorrow(2) })).visit.id, 'only replacement capacity was released');
});

test('well-formed incorrect and different-visit codes fail without consuming the correct code', async () => {
  const first = await travelling();
  const second = await travelling();
  const firstCode = await code(first.patient, first.visit);
  let secondCode = await code(second.patient, second.visit);
  // Independent short codes may coincidentally be equal. Request a fresh second
  // code after advancing only its fixture cooldown so this check is deterministic.
  for (let attempt = 0; firstCode.code === secondCode.code && attempt < 3; attempt++) {
    await db.query("update public.home_visit_arrival_secrets set issued_at=now()-interval '2 minutes' where booking_id=$1", [second.visit.id]);
    secondCode = await code(second.patient, second.visit);
  }
  assert.notEqual(firstCode.code, secondCode.code);
  const incorrect = String((Number(firstCode.code) + 1) % 1_000_000).padStart(6, '0');
  const wrong = await rpc(first.doctor, 'hv_verify_arrival', { booking_id: first.visit.id, expected_version: first.visit.version, code: incorrect });
  assert.equal(wrong.ok, false);
  assert.equal(wrong.attempts_remaining, 4);
  const otherVisit = await rpc(second.doctor, 'hv_verify_arrival', { booking_id: second.visit.id, expected_version: second.visit.version, code: firstCode.code });
  assert.equal(otherVisit.ok, false);
  assert.equal(otherVisit.attempts_remaining, 4);
  const correct = await rpc(second.doctor, 'hv_verify_arrival', { booking_id: second.visit.id, expected_version: second.visit.version, code: secondCode.code });
  assert.equal(correct.home_visit_status, 'arrived');
});
