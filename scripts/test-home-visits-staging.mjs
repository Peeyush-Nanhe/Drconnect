import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { address, consentVersion, providerSettings, workingHours } from '../tests/home-visit-fixtures.mjs';
import { homeVisitsBuildId } from './home-visits-build-id.mjs';

// This suite sends simultaneous requests through separately authenticated GoTrue
// sessions and PostgREST transactions. PGlite tests do not prove these races.
const ref = 'pyrlvjeectjikvfksukb';
if (!process.argv.includes('--run') || process.env.SUPABASE_URL !== `https://${ref}.supabase.co`) {
  throw new Error('Use --run with the approved MyDox Staging .env only. This creates and removes synthetic fixtures.');
}
const { SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: key, SUPABASE_SERVICE_ROLE_KEY: secret } = process.env;
if (!key || !secret) throw new Error('SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY are required.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const runId = randomUUID();
const users = [];
const sessions = [];
const outcomes = [];
const build = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceHash = await homeVisitsBuildId();
console.log(`Home-visit API acceptance: environment=${ref}; commit=${build}; source_sha256=${sourceHash}; started=${new Date().toISOString()}`);

function data(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function rpc(user, name, input) {
  return data(await user.sb.rpc(name, input), name);
}
async function check(name, fn) {
  try {
    await fn();
    outcomes.push({ name, status: 'PASS' });
    console.log(`PASS ${name}`);
  } catch (error) {
    outcomes.push({ name, status: 'FAIL' });
    throw error;
  }
}
async function session(user) {
  const sb = createClient(url, key, options);
  data(await sb.auth.signInWithPassword({ email: user.email, password: user.password }), 'sign in synthetic account');
  sessions.push(sb);
  return { ...user, sb };
}
async function user(physician = false, settlement = false) {
  const email = `home-test-${runId}-${users.length}@example.invalid`;
  const password = randomBytes(30).toString('base64url');
  const created = data(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: physician ? { role: 'provider', subtype: 'care_physician', full_name: 'Synthetic home-visit doctor' } : { full_name: 'Synthetic home-visit patient' } }), 'create synthetic account');
  const record = { id: created.user.id, email, password, physician };
  users.push(record);
  const signed = await session(record);
  data(await admin.from('home_visit_pilot_participants').insert({ user_id: signed.id, settlement_enabled: settlement }), 'allow synthetic participant');
  if (physician) {
    data(await admin.from('user_roles').insert({ user_id: signed.id, role: 'provider' }), 'approve synthetic doctor role');
    data(await admin.from('account_role_requests').update({ status: 'approved' }).eq('user_id', signed.id), 'approve synthetic doctor subtype');
    data(await signed.sb.from('care_physician_profiles').insert({ user_id: signed.id, qualification: 'mbbs', experience_years: 5, council_name: 'Synthetic council', council_registration_number: 'SYNTHETIC-ONLY' }), 'save synthetic physician');
    data(await admin.from('care_physician_profiles').update({ registration_verified: true }).eq('user_id', signed.id), 'verify synthetic registration');
    data(await signed.sb.from('provider_availability').insert({ user_id: signed.id, is_online: true, timezone: 'Asia/Kolkata', working_hours: workingHours }), 'publish synthetic working hours');
    await rpc(signed, 'hv_save_provider_settings', { p_settings: providerSettings });
  }
  return signed;
}
function tomorrow(days = 1, hour = 10) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}
async function quote(patient, doctor, extra = {}) {
  return rpc(patient, 'hv_quote', { p_input: { provider_id: doctor?.id, routing: doctor ? 'named' : 'pool', is_now: false, pincode: address.pincode, start_time: tomorrow(), ...extra } });
}
function input(q) {
  return { quote_id: q.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic visit reason' }, consent: true, consent_version: consentVersion };
}
async function book(patient, doctor, extra) {
  const q = await quote(patient, doctor, extra);
  const submission = input(q);
  return { visit: await rpc(patient, 'hv_create', { p_input: submission }), input: submission };
}
function actionInput(visit, action, extra = {}) {
  return { p_input: { booking_id: visit.id, expected_version: visit.version, action, ...extra } };
}
async function action(user, visit, name, extra = {}) {
  return rpc(user, 'hv_action', actionInput(visit, name, extra));
}
async function ownVisit(user, id) {
  return (await rpc(user, 'hv_list')).find(visit => visit.id === id);
}

try {
  const patient = await user(false, true);
  const other = await user();
  const d1 = await user(true, true);
  const d2 = await user(true);
  let scheduled;
  if (!process.argv.includes('--browser-only')) {
    await check('scheduled booking persists across independent second-device sessions and explicit acceptance', async () => {
      data(await d1.sb.from('provider_availability').update({ is_online: false }).eq('user_id', d1.id), 'turn immediate dispatch offline');
      scheduled = (await book(patient, d1)).visit;
      assert.equal(scheduled.home_visit_status, 'pending');
      scheduled = await action(d1, scheduled, 'accept');
      assert.equal(scheduled.home_visit_status, 'confirmed');
      const patientDevice2 = await session(patient);
      const doctorDevice2 = await session(d1);
      for (const view of await Promise.all([ownVisit(patientDevice2, scheduled.id), ownVisit(doctorDevice2, scheduled.id)])) {
        assert.equal(view.id, scheduled.id);
        assert.equal(view.home_visit_status, 'confirmed');
        assert.equal(view.address_snapshot.full_address, address.full_address);
        assert.equal(view.total, scheduled.total);
      }
      data(await d1.sb.from('provider_availability').update({ is_online: true }).eq('user_id', d1.id), 'restore immediate dispatch');
    });
    await check('unrelated users, patient acceptance and direct Data API writes cannot bypass privacy', async () => {
      assert.equal(await ownVisit(other, scheduled.id), undefined);
      assert.equal(await ownVisit(d2, scheduled.id), undefined);
      assert.ok((await other.sb.rpc('hv_arrival_code', { p_booking_id: scheduled.id })).error);
      assert.ok((await d1.sb.rpc('hv_arrival_code', { p_booking_id: scheduled.id })).error);
      const forged = await patient.sb.from('doctor_appointments').update({ status: 'completed' }).eq('id', scheduled.id).select('id');
      assert.ok(forged.error || forged.data.length === 0, 'direct update must not modify a booking');
      assert.equal((await ownVisit(patient, scheduled.id)).home_visit_status, 'confirmed');
      assert.ok((await patient.sb.rpc('hv_action', actionInput(scheduled, 'accept'))).error);
      for (const table of ['home_visit_consents', 'home_visit_events', 'home_visit_encounters', 'home_visit_arrival_secrets']) {
        const result = await other.sb.from(table).select('*').limit(1);
        assert.ok(result.error || result.data.length === 0, `private ${table} must not be readable`);
      }
    });
    await check('simultaneous duplicate submissions return one ID; lost-response recovery uses another session', async () => {
      const q = await quote(patient, d1, { start_time: tomorrow(2) });
      const submission = input(q);
      const device2 = await session(patient);
      const results = await Promise.all([patient, device2].map(caller => caller.sb.rpc('hv_create', { p_input: submission })));
      const first = data(results[0], 'first idempotent submission');
      const second = data(results[1], 'parallel idempotent submission');
      assert.equal(first.id, second.id);
      assert.equal((await rpc(device2, 'hv_recover', { p_key: submission.idempotency_key })).id, first.id);
      assert.equal(await rpc(other, 'hv_recover', { p_key: submission.idempotency_key }), null);
      assert.ok((await patient.sb.rpc('hv_create', { p_input: { ...submission, address: { ...submission.address, landmark: 'changed' } } })).error);
    });
    await check('two independent patients racing for the same slot produce exactly one reservation', async () => {
      const [qa, qb] = await Promise.all([quote(patient, d1, { start_time: tomorrow(3) }), quote(other, d1, { start_time: tomorrow(3) })]);
      const results = await Promise.all([patient.sb.rpc('hv_create', { p_input: input(qa) }), other.sb.rpc('hv_create', { p_input: input(qb) })]);
      assert.equal(results.filter(result => !result.error).length, 1);
      assert.equal(results.filter(result => result.error).length, 1);
    });
    await check('two doctors accepting the same pool request produce exactly one assigned doctor', async () => {
      const { visit } = await book(patient, null, { is_now: true, start_time: undefined });
      assert.equal(visit.home_visit_status, 'pending');
      const results = await Promise.all([d1, d2].map(doctor => doctor.sb.rpc('hv_action', actionInput(visit, 'accept'))));
      assert.equal(results.filter(result => !result.error).length, 1);
      const winner = data(results.find(result => !result.error), 'winning acceptance');
      assert.equal(winner.home_visit_status, 'confirmed');
      const persisted = await ownVisit(patient, visit.id);
      assert.equal(persisted.provider_id, winner.provider_id);
      await action(patient, persisted, 'cancel', { reason: 'Synthetic race cleanup' });
    });
    await check('one doctor accepting conflicting immediate requests through two sessions wins only once', async () => {
      const a = (await book(patient, null, { is_now: true, start_time: undefined })).visit;
      const b = (await book(other, null, { is_now: true, start_time: undefined })).visit;
      const device2 = await session(d1);
      const results = await Promise.all([d1.sb.rpc('hv_action', actionInput(a, 'accept')), device2.sb.rpc('hv_action', actionInput(b, 'accept'))]);
      assert.equal(results.filter(result => !result.error).length, 1);
      assert.equal(results.filter(result => result.error).length, 1);
      for (const [owner, visit] of [[patient, a], [other, b]]) await action(owner, await ownVisit(owner, visit.id), 'cancel', { reason: 'Synthetic race cleanup' });
    });
    await check('cancellation-versus-acceptance race has one committed transition and no resurrection', async () => {
      const { visit } = await book(patient, d2, { start_time: tomorrow(4) });
      const results = await Promise.all([patient.sb.rpc('hv_action', actionInput(visit, 'cancel', { reason: 'Synthetic cancellation' })), d2.sb.rpc('hv_action', actionInput(visit, 'accept'))]);
      assert.equal(results.filter(result => !result.error).length, 1);
      const current = await ownVisit(patient, visit.id);
      assert.ok(['confirmed', 'cancelled'].includes(current.home_visit_status));
      assert.ok((await d2.sb.rpc('hv_action', actionInput(visit, 'accept'))).error);
      if (current.home_visit_status === 'confirmed') await action(patient, current, 'cancel', { reason: 'Synthetic race cleanup' });
    });
    await check('immediate acceptance versus scheduled insertion shares one doctor capacity lock', async () => {
      await rpc(d2, 'hv_save_provider_settings', { p_settings: { ...providerSettings, lead_minutes: 0 } });
      const immediate = (await book(patient, null, { is_now: true, start_time: undefined })).visit;
      const start = new Date(Date.now() + 20 * 60_000).toISOString();
      const future = await quote(other, d2, { start_time: start });
      const results = await Promise.all([d2.sb.rpc('hv_action', actionInput(immediate, 'accept')), other.sb.rpc('hv_create', { p_input: input(future) })]);
      assert.equal(results.filter(result => !result.error).length, 1);
      assert.equal(results.filter(result => result.error).length, 1);
      await action(patient, await ownVisit(patient, immediate.id), 'cancel', { reason: 'Synthetic race cleanup' });
      if (!results[1].error) await action(other, results[1].data, 'cancel', { reason: 'Synthetic race cleanup' });
      await rpc(d2, 'hv_save_provider_settings', { p_settings: providerSettings });
    });
    const lateDoctor = await user(true);
    async function overduePair() {
      const visits = [];
      for (const [days, hoursAgo] of [[8, 4], [9, 2]]) {
        let visit = (await book(patient, lateDoctor, { start_time: tomorrow(days) })).visit;
        visit = await action(lateDoctor, visit, 'accept');
        const start = Date.now() - hoursAgo * 60 * 60_000;
        data(await admin.from('doctor_appointments').update({ start_time: new Date(start).toISOString(), end_time: new Date(start + 30 * 60_000).toISOString() }).eq('id', visit.id).eq('patient_id', patient.id), 'age only the synthetic accepted appointment');
        visits.push(await ownVisit(patient, visit.id));
      }
      return visits;
    }
    await check('overdue visits cannot both start travel, in either order or through concurrent doctor sessions', async () => {
      for (const order of [[1, 0], [0, 1]]) {
        const visits = await overduePair();
        const first = await action(lateDoctor, visits[order[0]], 'start_travel');
        assert.equal(first.home_visit_status, 'en_route');
        assert.ok((await lateDoctor.sb.rpc('hv_action', actionInput(visits[order[1]], 'start_travel'))).error);
        for (const visit of visits) await action(patient, await ownVisit(patient, visit.id), 'cancel', { reason: 'Synthetic late-travel cleanup' });
      }
      const visits = await overduePair();
      const secondDevice = await session(lateDoctor);
      const results = await Promise.all([lateDoctor.sb.rpc('hv_action', actionInput(visits[0], 'start_travel')), secondDevice.sb.rpc('hv_action', actionInput(visits[1], 'start_travel'))]);
      assert.equal(results.filter(result => !result.error).length, 1);
      const persisted = await Promise.all(visits.map(visit => ownVisit(patient, visit.id)));
      assert.equal(persisted.filter(visit => visit.home_visit_status === 'en_route').length, 1);
      for (const visit of persisted) await action(patient, visit, 'cancel', { reason: 'Synthetic concurrent late-travel cleanup' });
    });
    await check('starting an overdue visit rechecks current time against the next confirmed commitment', async () => {
      const overdue = await overduePair();
      await action(patient, overdue[1], 'cancel', { reason: 'Synthetic capacity setup' });
      await rpc(lateDoctor, 'hv_save_provider_settings', { p_settings: { ...providerSettings, lead_minutes: 0 } });
      const nextStart = new Date(Date.now() + 20 * 60_000).toISOString();
      let next = (await book(patient, lateDoctor, { start_time: nextStart })).visit;
      next = await action(lateDoctor, next, 'accept');
      assert.ok((await lateDoctor.sb.rpc('hv_action', actionInput(overdue[0], 'start_travel'))).error);
      assert.equal((await ownVisit(patient, overdue[0].id)).home_visit_status, 'confirmed');
      assert.equal((await ownVisit(patient, next.id)).home_visit_status, 'confirmed');
      for (const visit of [overdue[0], next]) await action(patient, await ownVisit(patient, visit.id), 'cancel', { reason: 'Synthetic future-commitment cleanup' });
    });
    await check('delayed expiry and acceptance race cannot confirm an expired request or expire a confirmed one', async () => {
      const pending = (await book(patient, d2, { start_time: tomorrow(5) })).visit;
      data(await admin.from('home_visit_details').update({ pending_deadline: new Date(Date.now() - 60_000).toISOString() }).eq('booking_id', pending.id), 'age synthetic pending deadline');
      const results = await Promise.all([d2.sb.rpc('hv_action', actionInput(pending, 'accept')), admin.rpc('hv_expire_pending', { p_limit: 100, p_booking_ids: [pending.id] })]);
      assert.ok(results[0].error);
      data(results[1], 'expire pending reservations');
      data(await admin.rpc('hv_expire_pending', { p_limit: 100, p_booking_ids: [pending.id] }), 'retry expiry after SKIP LOCKED contention');
      assert.equal((await ownVisit(patient, pending.id)).home_visit_status, 'expired');
      let confirmed = (await book(patient, d2, { start_time: tomorrow(5) })).visit;
      confirmed = await action(d2, confirmed, 'accept');
      data(await admin.from('home_visit_details').update({ pending_deadline: new Date(Date.now() - 60_000).toISOString() }).eq('booking_id', confirmed.id), 'age confirmed synthetic deadline');
      data(await admin.rpc('hv_expire_pending', { p_limit: 100, p_booking_ids: [pending.id, confirmed.id] }), 'repeat expiry job');
      assert.equal((await ownVisit(patient, confirmed.id)).home_visit_status, 'confirmed');
    });
    await check('failed, declined and expired rescheduling retain the original; accepted replacement releases only old capacity', async () => {
      let current = await ownVisit(patient, scheduled.id);
      const originalStart = current.start_time;
      const replacement = await quote(patient, d1, { start_time: tomorrow(6), booking_id: current.id });
      const conflict = (await book(other, d1, { start_time: tomorrow(6) })).visit;
      assert.ok((await patient.sb.rpc('hv_action', actionInput(current, 'request_reschedule', { quote_id: replacement.quote_id, reason: 'Synthetic conflict' }))).error);
      assert.equal((await ownVisit(patient, current.id)).start_time, originalStart);
      await action(other, conflict, 'cancel', { reason: 'Release synthetic conflict' });
      current = await action(patient, current, 'request_reschedule', { quote_id: replacement.quote_id, reason: 'Synthetic replacement' });
      assert.equal(current.start_time, originalStart);
      current = await action(d1, current, 'decline_reschedule', { reason: 'Synthetic decline' });
      assert.equal(current.start_time, originalStart);
      const expiringQuote = await quote(patient, d1, { start_time: tomorrow(6), booking_id: current.id });
      const expiring = await action(patient, current, 'request_reschedule', { quote_id: expiringQuote.quote_id, reason: 'Synthetic expiring replacement' });
      data(await admin.from('home_visit_reschedule_holds').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('booking_id', current.id), 'age only the synthetic replacement hold');
      data(await admin.rpc('hv_expire_pending', { p_limit: 100, p_booking_ids: [current.id] }), 'expire synthetic replacement hold');
      current = await ownVisit(patient, current.id);
      assert.equal(current.start_time, originalStart);
      assert.equal(current.home_visit_status, 'confirmed');
      assert.equal(current.reschedule, null);
      assert.equal(current.version, expiring.version + 1);
      let expiryEvents = data(await admin.from('home_visit_events').select('id').eq('booking_id', current.id).eq('kind', 'reschedule_expired'), 'read synthetic replacement expiry event');
      assert.equal(expiryEvents.length, 1);
      const expiryJobs = data(await admin.from('home_visit_notification_jobs').select('status,recipient_id').eq('event_id', expiryEvents[0].id), 'read replacement expiry outbox');
      assert.equal(expiryJobs.length, 2);
      assert.ok(expiryJobs.every(job => job.status === 'disabled'));
      assert.deepEqual(expiryJobs.map(job => job.recipient_id).sort(), [patient.id, d1.id].sort());
      data(await admin.rpc('hv_expire_pending', { p_limit: 100, p_booking_ids: [current.id] }), 'retry synthetic replacement expiry');
      expiryEvents = data(await admin.from('home_visit_events').select('id').eq('booking_id', current.id).eq('kind', 'reschedule_expired'), 'read retried synthetic replacement expiry');
      assert.equal(expiryEvents.length, 1);
      assert.equal((await ownVisit(patient, current.id)).version, current.version);
      assert.ok((await d1.sb.rpc('hv_action', actionInput(expiring, 'accept_reschedule'))).error);
      const fresh = await quote(patient, d1, { start_time: tomorrow(6), booking_id: current.id });
      current = await action(patient, current, 'request_reschedule', { quote_id: fresh.quote_id, reason: 'Synthetic approved replacement' });
      current = await action(d1, current, 'accept_reschedule');
      assert.equal(current.id, scheduled.id);
      assert.equal(new Date(current.start_time).toISOString(), new Date(fresh.start_time).toISOString());
      assert.ok((await book(other, d1)).visit.id);
    });
    await check('travel, patient-only code, consultation, signed record and truthful cash settlement persist', async () => {
      let visit = (await book(patient, d1, { is_now: true, start_time: undefined })).visit;
      visit = await action(d1, visit, 'accept');
      visit = await action(d1, visit, 'start_travel', { eta_minutes: 20 });
      assert.equal(visit.home_visit_status, 'en_route');
      assert.equal('code' in visit, false);
      const issued = await rpc(patient, 'hv_arrival_code', { p_booking_id: visit.id });
      const failed = await rpc(d1, 'hv_verify_arrival', { p_input: { booking_id: visit.id, expected_version: visit.version, code: '0000' } });
      assert.equal(failed.ok, false);
      visit = await ownVisit(d1, visit.id);
      visit = await rpc(d1, 'hv_verify_arrival', { p_input: { booking_id: visit.id, expected_version: visit.version, code: issued.code } });
      assert.equal(visit.home_visit_status, 'arrived');
      visit = await action(d1, visit, 'start_consultation');
      assert.ok((await d1.sb.rpc('hv_action', actionInput(visit, 'complete'))).error);
      visit = await action(d1, visit, 'save_encounter', { summary: 'Synthetic clinical encounter summary', follow_up: 'Synthetic follow-up instruction' });
      visit = await action(d1, visit, 'complete');
      assert.equal(visit.home_visit_status, 'completed');
      assert.equal(visit.payment_settlement, null);
      assert.ok((await patient.sb.rpc('hv_action', actionInput(visit, 'record_settlement', { amount: visit.total, currency: visit.currency, method: 'cash' }))).error);
      visit = await action(d1, visit, 'record_settlement', { amount: visit.total, currency: visit.currency, method: 'cash', reference: `synthetic-${runId}` });
      assert.equal(visit.payment_settlement.status, 'recorded_pay_at_visit');
      assert.equal((await ownVisit(await session(patient), visit.id)).clinical_notes.summary, 'Synthetic clinical encounter summary');
      assert.ok((await d1.sb.rpc('hv_action', actionInput(visit, 'start_travel'))).error);
    });
  }
  if (process.argv.includes('--browser') || process.argv.includes('--browser-only')) {
    await check('visible browser UI uses the deployed API for both home-visit paths', async () => {
      const { runHomeVisitBrowser } = await import('./test-home-visits-browser.mjs');
      await runHomeVisitBrowser({ url: process.env.MYDOX_TEST_APP_URL ?? 'http://127.0.0.1:8081', patient: { email: patient.email, password: patient.password }, doctor: { email: d1.email, password: d1.password }, doctorId: d1.id, pincode: address.pincode, date: tomorrow(7).slice(0, 10) });
    });
  }
  for (const name of ['Real-phone and Capacitor restart/resume/location permission acceptance', 'Closed-app notification delivery and retry with approved credentials', 'Online gateway signed-callback and refund integration']) {
    outcomes.push({ name, status: 'BLOCKED' });
    console.log(`BLOCKED ${name}: device/integration/owner configuration required; API tests do not establish this result.`);
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  // Restrict every deletion to IDs created by this invocation. No demo/real rows
  // and no global policy settings are changed by this test program.
  for (const record of users.filter(record => !record.physician)) {
    const result = await admin.from('doctor_appointments').delete().eq('patient_id', record.id);
    if (result.error) { console.error(`Cleanup failed for synthetic appointments: ${result.error.message}`); process.exitCode = 1; }
  }
  for (const sb of sessions) await sb.auth.signOut({ scope: 'local' });
  for (const record of users) {
    const result = await admin.auth.admin.deleteUser(record.id);
    if (result.error) { console.error(`Cleanup failed for synthetic Auth account: ${result.error.message}`); process.exitCode = 1; }
  }
  console.log(JSON.stringify({ environment: ref, commit: build, source_sha256: sourceHash, completed_at: new Date().toISOString(), results: outcomes, cleanup_attempted_for_synthetic_users: users.length }));
}
