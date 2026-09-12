import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { address, consentVersion, createDatabase, providerSettings, workingHours } from './home-visit-fixtures.mjs';

// Executes real application SQL/RLS in PostgreSQL (PGlite). Auth users and JWTs
// are synthetic fixtures. PGlite is serial: these are NOT independent-session
// race, GoTrue, PostgREST, Realtime, push, mobile, upload or payment proof.
let db, actor, hv;
before(async () => { const f = await createDatabase(); db = f.db; actor = f.actor; hv = f.rpc; });
after(async () => db?.close());
async function rpc(uid, name, input) {
  assert.match(name, /^pc_chat_[a-z_]+$/);
  return (await actor(uid, `select public.${name}(${input === undefined ? '' : '$1::jsonb'}) as result`, input === undefined ? [] : [input])).rows[0].result;
}
async function user({ doctor = false, allow = true, email } = {}) {
  const id = randomUUID();
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)', [id, email ?? `postchat-${id}@example.invalid`, doctor ? { role: 'provider', subtype: 'care_physician' } : {}]);
  await db.query("update public.profiles set full_name='Same Synthetic Name' where id=$1", [id]);
  if (allow) await db.query('insert into public.post_consultation_chat_pilot_participants(user_id) values ($1)', [id]);
  await db.query('insert into public.home_visit_pilot_participants(user_id) values ($1)', [id]);
  if (doctor) {
    await db.query("insert into public.user_roles(user_id,role) values ($1,'provider')", [id]);
    await db.query("update public.account_role_requests set status='approved' where user_id=$1", [id]);
    await actor(id, "insert into public.care_physician_profiles(user_id,qualification,council_name,council_registration_number) values ($1,'mbbs','Synthetic Council','SYNTHETIC-CHAT-ONLY')", [id]);
    await actor(null, 'update public.care_physician_profiles set registration_verified=true where user_id=$1', [id], 'service_role');
    await actor(id, "insert into public.provider_availability(user_id,is_online,working_hours,timezone) values ($1,true,$2,'Asia/Kolkata')", [id, workingHours]);
    await hv(id, 'hv_save_provider_settings', providerSettings);
  }
  return id;
}
async function pair() { return { patient: await user(), doctor: await user({ doctor: true }) }; }
async function action(uid, visit, name, fields = {}) { return hv(uid, 'hv_action', { booking_id: visit.id, expected_version: visit.version, action: name, ...fields }); }
async function consultation(p = null) {
  p ??= await pair();
  const quote = await hv(p.patient, 'hv_quote', { provider_id: p.doctor, routing: 'named', is_now: true, pincode: address.pincode });
  let visit = await hv(p.patient, 'hv_create', { quote_id: quote.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic follow-up test' }, consent: true, consent_version: consentVersion });
  const pending = visit;
  visit = await action(p.doctor, visit, 'accept');
  visit = await action(p.doctor, visit, 'start_travel', { eta_minutes: 20 });
  const issued = (await actor(p.patient, 'select public.hv_arrival_code($1) as result', [visit.id])).rows[0].result;
  visit = await hv(p.doctor, 'hv_verify_arrival', { booking_id: visit.id, expected_version: visit.version, code: issued.code });
  visit = await action(p.doctor, visit, 'start_consultation');
  visit = await action(p.doctor, visit, 'save_encounter', { summary: 'Synthetic signed encounter' });
  visit = await action(p.doctor, visit, 'complete');
  return { ...p, visit, pending };
}
async function open(uid, visit) { return rpc(uid, 'pc_chat_open', { source_kind: 'doctor_appointment', source_id: visit.id }); }
async function send(uid, chat, body, key = randomUUID()) {
  return rpc(uid, 'pc_chat_send', { conversation_id: chat.conversation_id, episode_id: chat.episode_id, body, idempotency_key: key });
}
async function history(uid, chat, options = {}) { return rpc(uid, 'pc_chat_history', { conversation_id: chat.conversation_id, ...options }); }
async function summary(uid, chat) { return rpc(uid, 'pc_chat_open', { conversation_id: chat.conversation_id, episode_id: chat.episode_id }); }

test('rollout is synthetic-only, anonymous/private helpers are denied and no client can enable itself', async () => {
  const outsider = await user({ allow: false });
  const realEmail = await user({ email: `synthetic-${randomUUID()}@example.com` });
  for (const uid of [outsider, realEmail]) {
    const context = await rpc(uid, 'pc_chat_context');
    assert.equal(context.enabled, false);
    assert.equal(context.test_only, true);
    assert.equal(context.attachments_enabled, false);
    assert.equal(context.calls_enabled, false);
    assert.equal(context.payments_enabled, false);
    assert.deepEqual(await rpc(uid, 'pc_chat_inbox'), []);
    await assert.rejects(open(uid, { id: randomUUID() }), /restricted|synthetic/i);
    await assert.rejects(actor(uid, 'insert into public.post_consultation_chat_pilot_participants(user_id) values ($1)', [uid]), /permission denied/i);
  }
  const grants = await db.query(`select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (p.proname like 'pc_chat_%' or p.proname='pc_surgery_member') and has_function_privilege('anon',p.oid,'EXECUTE')`);
  assert.deepEqual(grants.rows, []);
  await assert.rejects(actor(null, 'select public.pc_chat_context()', [], 'anon'), /permission denied/i);
  await assert.rejects(actor(outsider, "update public.post_consultation_chat_policies set patient_message_limit=999"), /permission denied/i);
  await assert.rejects(db.exec("update public.post_consultation_chat_policies set patient_message_limit=999"), /immutable/i);
});

test('genuine home completion creates one canonical episode and inbox discovers it for either participant', async () => {
  const p = await consultation();
  const inbox = await rpc(p.doctor, 'pc_chat_inbox');
  const doctor = inbox.find(row => row.source_id === p.visit.id);
  assert.ok(doctor);
  const patient = await open(p.patient, p.visit);
  assert.equal(patient.conversation_id, doctor.conversation_id);
  assert.equal(patient.episode_id, doctor.episode_id);
  assert.equal(patient.member_role, 'patient');
  assert.equal(doctor.member_role, 'doctor');
  assert.equal(doctor.other_id, p.patient);
  assert.equal(patient.other_id, p.doctor);
  assert.equal(patient.patient_messages_remaining, 25);
  assert.equal(patient.test_only, true);
  assert.equal(new Date(patient.patient_send_until) - new Date(patient.completed_at), 86400000);
  for (let i = 0; i < 3; i++) assert.equal((await open(p.patient, p.visit)).episode_id, patient.episode_id);
  assert.equal((await db.query('select count(*)::int n from public.chat_consultation_episodes where source_id=$1', [p.visit.id])).rows[0].n, 1);
  assert.equal((await history(p.patient, patient)).messages.length, 0);
  await assert.rejects(db.query('update public.chat_conversations set provider_id=$2 where id=$1', [patient.conversation_id, await user()]), /immutable/i);
  await assert.rejects(db.query("update public.chat_consultation_episodes set policy_snapshot='{}' where id=$1", [patient.episode_id]), /immutable/i);
});

test('care requests, unsupported clinic/video completions, dependents and missing signed home evidence cannot grant access', async () => {
  const p = await consultation();
  await assert.rejects(rpc(p.patient, 'pc_chat_open', { source_kind: 'care_request', source_id: randomUUID() }), /not yet integrated|cannot establish/i);
  const clinic = (await db.query(`insert into public.doctor_appointments(provider_id,patient_id,service,mode,start_time,end_time,fee,status,completed_at)
    values ($1,$2,'Synthetic clinic','video',now()-interval '2 days',now()-interval '2 days'+interval '30 minutes',0,'completed',now()) returning id`, [p.doctor, p.patient])).rows[0];
  await assert.rejects(open(p.patient, clinic), /not yet integrated/i);
  await db.query('update public.doctor_appointments set dependent_id=$2 where id=$1', [p.visit.id, randomUUID()]);
  await assert.rejects(open(p.patient, p.visit), /guardian|dependent/i);
  await db.query('update public.doctor_appointments set dependent_id=null where id=$1', [p.visit.id]);
  await db.query('update public.home_visit_encounters set signed_at=null where booking_id=$1', [p.visit.id]);
  await assert.rejects(open(p.patient, p.visit), /signed encounter/i);
  assert.equal((await db.query('select count(*)::int n from public.chat_consultation_episodes where source_id=$1', [p.visit.id])).rows[0].n, 0);
});

test('messages are persisted once with server roles, atomic debit and disabled privacy-safe notification event', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  const key = randomUUID();
  const first = await send(p.patient, chat, 'Synthetic report discussion', key);
  assert.equal(first.sender_id, p.patient); assert.equal(first.sender_role, 'patient');
  assert.equal((await send(p.patient, chat, 'Synthetic report discussion', key)).id, first.id);
  await assert.rejects(send(p.patient, chat, 'Different payload', key), /different message/i);
  const reply = await send(p.doctor, chat, 'Synthetic clinician reply');
  assert.equal(reply.sender_role, 'doctor'); assert.equal(reply.sender_id, p.doctor);
  assert.deepEqual((await history(p.patient, chat)).messages, (await history(p.doctor, chat)).messages);
  const fresh = await summary(p.patient, chat); assert.equal(fresh.patient_messages_remaining, 24);
  const debit = (await db.query('select message_id,actor_id,units from public.chat_message_debits where episode_id=$1', [chat.episode_id])).rows;
  assert.deepEqual(debit, [{ message_id: first.id, actor_id: p.patient, units: 1 }]);
  const jobs = (await db.query('select recipient_id,status,event_kind from public.chat_notification_outbox where conversation_id=$1 order by created_at', [chat.conversation_id])).rows;
  assert.deepEqual(jobs.map(x => x.status), ['disabled', 'disabled']);
  assert.equal(jobs[0].recipient_id, p.doctor);
  assert.equal(jobs[1].recipient_id, p.patient);
  await assert.rejects(rpc(p.patient, 'pc_chat_send', { conversation_id: chat.conversation_id, episode_id: chat.episode_id, body: 'test', idempotency_key: randomUUID(), sender_role: 'doctor' }), /Unsupported/i);
});

test('unrelated patients, ordinary admins and direct table writes cannot bypass membership, quota or prescriptions', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  const outsider = await user(); await db.query("insert into public.user_roles(user_id,role) values ($1,'admin')", [outsider]);
  await send(p.patient, chat, 'Private synthetic message');
  for (const call of [() => summary(outsider, chat), () => history(outsider, chat), () => send(outsider, chat, 'Forged'), () => rpc(outsider, 'pc_chat_ack_read', { conversation_id: chat.conversation_id, through_sequence: 0 }), () => rpc(outsider, 'pc_chat_prescription', { conversation_id: chat.conversation_id, episode_id: chat.episode_id, action: 'request', idempotency_key: randomUUID() })]) await assert.rejects(call(), /access|revoked/i);
  assert.deepEqual((await actor(outsider, 'select id from public.chat_messages where conversation_id=$1', [chat.conversation_id])).rows, []);
  for (const uid of [p.patient, p.doctor, outsider]) {
    await assert.rejects(actor(uid, `insert into public.chat_messages(thread_key,sender_id,recipient_id,body,conversation_id,episode_id,sender_role,idempotency_key)
      values ($1,$2,$3,'Bypass',$4,$5,'patient',$6)`, [`consultation:${chat.conversation_id}`, uid, p.doctor, chat.conversation_id, chat.episode_id, randomUUID()]), /row-level security|permission denied/i);
    await assert.rejects(actor(uid, 'update public.chat_consultation_episodes set patient_messages_used=0 where id=$1', [chat.episode_id]), /permission denied/i);
    await assert.rejects(actor(uid, 'select * from public.chat_message_debits'), /permission denied/i);
    await assert.rejects(actor(uid, 'select * from public.chat_notification_outbox'), /permission denied/i);
  }
  await assert.rejects(actor(p.patient, "insert into public.chat_messages(thread_key,sender_id,recipient_id,body) values ('pair:forged',$1,$2,'Bypass')", [p.patient, p.doctor]), /row-level security/i);
});

test('patient quota exhaustion leaves clinician replies free and idempotent lost-response recovery valid', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  let last; let key;
  for (let i = 0; i < 25; i++) { key = randomUUID(); last = await send(p.patient, chat, `Synthetic message ${i}`, key); }
  await assert.rejects(send(p.patient, chat, 'No remaining credit'), /exhausted/i);
  assert.equal((await send(p.patient, chat, 'Synthetic message 24', key)).id, last.id);
  const patient = await summary(p.patient, chat); assert.equal(patient.can_send, false); assert.equal(patient.patient_messages_remaining, 0);
  assert.equal((await summary(p.doctor, chat)).can_send, true);
  await send(p.doctor, chat, 'Free reply after quota exhaustion');
  assert.equal((await db.query('select count(*)::int n from public.chat_message_debits where episode_id=$1', [chat.episode_id])).rows[0].n, 25);
});

test('server expiry denies patient sends while preserving permitted history and clinician replies', async () => {
  const p = await consultation();
  // Clock boundary fixture on authoritative completed data before its immutable
  // policy snapshot is created; this is not a client completion path.
  await db.query("update public.doctor_appointments set completed_at=now()-interval '24 hours' where id=$1", [p.visit.id]);
  const chat = await open(p.patient, p.visit);
  assert.equal(chat.can_send, false);
  await assert.rejects(send(p.patient, chat, 'Expired patient send'), /expired/i);
  await send(p.doctor, chat, 'Permitted asynchronous clinician reply');
  assert.equal((await history(p.patient, chat)).messages.length, 1);
});

test('read acknowledgement is per actual member, monotonic and scoped to displayed conversation messages', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  const one = await send(p.patient, chat, 'First unread'); const two = await send(p.patient, chat, 'Second unread');
  assert.equal((await summary(p.doctor, chat)).unread_count, 2);
  assert.equal((await summary(p.patient, chat)).unread_count, 0);
  const read = await rpc(p.doctor, 'pc_chat_ack_read', { conversation_id: chat.conversation_id, through_sequence: two.sequence_id });
  assert.equal(read.last_read_sequence, two.sequence_id);
  assert.equal((await rpc(p.doctor, 'pc_chat_ack_read', { conversation_id: chat.conversation_id, through_sequence: one.sequence_id })).last_read_sequence, two.sequence_id);
  assert.equal((await summary(p.doctor, chat)).unread_count, 0);
  await assert.rejects(rpc(p.doctor, 'pc_chat_ack_read', { conversation_id: chat.conversation_id, through_sequence: Number(two.sequence_id) + 999999 }), /displayed message/i);
  const messages = (await history(p.doctor, chat)).messages;
  assert.equal(Object.hasOwn(messages[0], 'delivered_at'), false);
  assert.equal(Object.hasOwn(messages[0], 'read_at'), false);
});

test('stable history pagination and after-sequence recovery neither drop nor duplicate saved messages', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  const saved = []; for (let i = 0; i < 7; i++) saved.push(await send(p.doctor, chat, `History ${i}`));
  const latest = await history(p.patient, chat, { limit: 3 });
  assert.deepEqual(latest.messages.map(m => m.id), saved.slice(4).map(m => m.id));
  const older = await history(p.patient, chat, { limit: 3, before_sequence: latest.next_before_sequence });
  assert.deepEqual(older.messages.map(m => m.id), saved.slice(1, 4).map(m => m.id));
  const first = await history(p.patient, chat, { limit: 3, before_sequence: older.next_before_sequence });
  assert.deepEqual(first.messages.map(m => m.id), [saved[0].id]); assert.equal(first.next_before_sequence, null);
  const gap = await history(p.patient, chat, { limit: 2, after_sequence: saved[1].sequence_id });
  assert.deepEqual(gap.messages.map(m => m.id), saved.slice(2, 4).map(m => m.id));
});

test('same names and renamed doctor labels never mix identities; repeat visits retain distinct episodes without resetting old allowance', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  await send(p.patient, chat, 'First visit message');
  await actor(p.doctor, "update public.profiles set full_name='Renamed Synthetic Clinician' where id=$1", [p.doctor]);
  assert.equal((await summary(p.patient, chat)).other_name, 'Renamed Synthetic Clinician');
  // Release already completed scheduling buffer only in this serial fixture.
  await db.query("update public.doctor_appointments set start_time=now()-interval '2 days',end_time=now()-interval '2 days'+interval '30 minutes' where id=$1", [p.visit.id]);
  const repeat = await consultation(p); const second = await open(p.patient, repeat.visit);
  assert.equal(chat.conversation_id, second.conversation_id); assert.notEqual(chat.episode_id, second.episode_id);
  assert.equal((await summary(p.patient, chat)).patient_messages_remaining, 24);
  assert.equal(second.patient_messages_remaining, 25);
  assert.equal(second.episodes.length, 2);
  const another = await consultation(); const unrelated = await open(another.patient, another.visit);
  assert.notEqual(chat.conversation_id, unrelated.conversation_id);
  await assert.rejects(rpc(p.patient, 'pc_chat_send', { conversation_id: chat.conversation_id, episode_id: unrelated.episode_id, body: 'Wrong episode', idempotency_key: randomUUID() }), /episode/i);
});

test('revoked membership or clinician verification immediately denies RPC and message RLS access', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  await send(p.patient, chat, 'Before revocation');
  await db.query('update public.post_consultation_chat_pilot_participants set revoked_at=now() where user_id=$1', [p.patient]);
  for (const uid of [p.patient, p.doctor]) {
    await assert.rejects(history(uid, chat), error => error.code === '42501' && /revoked|unavailable/i.test(error.message));
    assert.deepEqual((await actor(uid, 'select id from public.chat_messages where conversation_id=$1', [chat.conversation_id])).rows, []);
  }
  await db.query('update public.post_consultation_chat_pilot_participants set revoked_at=null where user_id=$1', [p.patient]);
  await actor(null, 'update public.care_physician_profiles set registration_verified=false where user_id=$1', [p.doctor], 'service_role');
  await assert.rejects(send(p.doctor, chat, 'After credential revocation'), /revoked|unavailable/i);
});

test('structured prescription requests require patient ownership and clinician review, never payment or unsigned issuance', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit);
  const base = { conversation_id: chat.conversation_id, episode_id: chat.episode_id };
  const key = randomUUID(); const requested = await rpc(p.patient, 'pc_chat_prescription', { ...base, action: 'request', idempotency_key: key });
  assert.equal(requested.status, 'requested'); assert.equal(requested.requested_by, p.patient);
  assert.equal((await rpc(p.patient, 'pc_chat_prescription', { ...base, action: 'request', idempotency_key: key })).id, requested.id);
  await assert.rejects(rpc(p.patient, 'pc_chat_prescription', { ...base, action: 'review', request_id: requested.id }), /clinician/i);
  assert.equal((await rpc(p.doctor, 'pc_chat_prescription', { ...base, action: 'review', request_id: requested.id })).status, 'reviewing');
  await assert.rejects(rpc(p.doctor, 'pc_chat_prescription', { ...base, action: 'issue', request_id: requested.id }), /not integrated/i);
  const declined = await rpc(p.doctor, 'pc_chat_prescription', { ...base, action: 'decline', request_id: requested.id, reason: 'Synthetic clinician decision' });
  assert.equal(declined.status, 'declined'); assert.equal(declined.reviewed_by, p.doctor);
  assert.equal((await rpc(p.doctor, 'pc_chat_prescription', { ...base, action: 'decline', request_id: requested.id, reason: 'Synthetic clinician decision' })).id, declined.id);
  await assert.rejects(rpc(p.doctor, 'pc_chat_prescription', { ...base, action: 'decline', request_id: requested.id, reason: 'Different terminal decision' }), /final/i);
  const events = (await db.query('select actor_id,to_status from public.chat_prescription_events where request_id=$1 order by created_at', [requested.id])).rows;
  assert.deepEqual(events, [{ actor_id: p.patient, to_status: 'requested' }, { actor_id: p.doctor, to_status: 'reviewing' }, { actor_id: p.doctor, to_status: 'declined' }]);
  assert.equal((await summary(p.patient, chat)).patient_messages_remaining, 25, 'request has no invented price or message debit');
});

test('failed persistence rolls back message, debit, quota and notification together before retrying the same key', async () => {
  const p = await consultation(); const chat = await open(p.patient, p.visit); const key = randomUUID();
  await db.exec(`create function private.pc_test_failure() returns trigger language plpgsql as $$ begin raise exception 'Synthetic outbox failure'; end $$;
    create trigger pc_test_failure before insert on public.chat_notification_outbox for each row execute function private.pc_test_failure();`);
  try { await assert.rejects(send(p.patient, chat, 'Retry after rollback', key), /Synthetic outbox failure/); }
  finally { await db.exec('drop trigger pc_test_failure on public.chat_notification_outbox; drop function private.pc_test_failure();'); }
  assert.equal((await history(p.patient, chat)).messages.length, 0);
  assert.equal((await summary(p.patient, chat)).patient_messages_remaining, 25);
  assert.ok((await send(p.patient, chat, 'Retry after rollback', key)).id);
  assert.equal((await summary(p.patient, chat)).patient_messages_remaining, 24);
});

test('authorised surgical-role chat remains usable while arbitrary recipients and expired sends are rejected', async () => {
  const facility = await user(); const doctor = await user({ doctor: true }); const outsider = await user();
  const booking = (await db.query("insert into public.surgery_bookings(facility_id,patient_name,procedure,status) values ($1,'Synthetic patient','Synthetic surgery','confirmed') returning id", [facility])).rows[0].id;
  const role = (await db.query("insert into public.surgery_booking_roles(booking_id,role,assigned_to,status,chat_expires_at) values ($1,'surgeon',$2,'accepted',now()+interval '1 hour') returning id", [booking, doctor])).rows[0].id;
  const insert = (uid, recipient) => actor(uid, "insert into public.chat_messages(thread_key,sender_id,recipient_id,body) values ($1,$2,$3,'Synthetic surgical coordination') returning id", [`surgery:${role}`, uid, recipient]);
  assert.ok((await insert(facility, doctor)).rows[0].id);
  assert.ok((await insert(doctor, facility)).rows[0].id);
  assert.equal((await actor(doctor, 'select id from public.chat_messages where thread_key=$1', [`surgery:${role}`])).rows.length, 2);
  await assert.rejects(insert(facility, outsider), /row-level security/i);
  await assert.rejects(insert(outsider, doctor), /row-level security/i);
  await db.exec('alter table public.surgery_booking_roles disable trigger user');
  try { await db.query("update public.surgery_booking_roles set chat_expires_at=now()-interval '1 second' where id=$1", [role]); }
  finally { await db.exec('alter table public.surgery_booking_roles enable trigger user'); }
  await assert.rejects(insert(doctor, facility), /row-level security/i);
  assert.equal((await actor(doctor, 'select id from public.chat_messages where thread_key=$1', [`surgery:${role}`])).rows.length, 2, 'expiry does not hide authorised surgical history');
});
