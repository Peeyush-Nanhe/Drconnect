import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { address, consentVersion, providerSettings, workingHours } from '../tests/home-visit-fixtures.mjs';

// Explicit opt-in hosted API acceptance. GoTrue sessions/PostgREST transactions
// are independent; this does not prove browser UI, Realtime, device, file, call,
// payment, issued-prescription or closed-app notification behavior.
// Run: node --env-file=.env scripts/test-post-consultation-chat-staging.mjs --run
const project = 'pyrlvjeectjikvfksukb';
const approvedUrl = `https://${project}.supabase.co`;
const requiredNames = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missingNames = requiredNames.filter(name => !process.env[name]);
const blocks = [];
if (!process.argv.includes('--run')) blocks.push('Explicit --run is required to create and remove synthetic fixtures.');
if (missingNames.length) blocks.push(`Missing environment variable names: ${missingNames.join(', ')}.`);
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL !== approvedUrl) blocks.push(`SUPABASE_URL must identify approved MyDox Staging project ${project}.`);
if (blocks.length) {
  for (const reason of blocks) console.error(`BLOCKED ${reason}`);
  console.error('No network requests or fixture changes were attempted.');
  process.exit(2);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const users = [];
const sessions = [];
const runId = randomUUID();
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceFiles = [
  'scripts/test-post-consultation-chat-staging.mjs',
  'src/features/mydox/post-consultation-chat/api.ts',
  'src/features/mydox/post-consultation-chat/types.ts',
  'src/features/mydox/post-consultation-chat/state.ts',
  'src/features/mydox/post-consultation-chat/usePostConsultationChat.ts',
  ...(await readdir(new URL('../staging/supabase/migrations/', import.meta.url)))
    .filter(name => name.endsWith('.sql')).sort().map(name => `staging/supabase/migrations/${name}`),
];
const hash = createHash('sha256');
for (const filename of sourceFiles) hash.update(filename).update('\0').update(await readFile(new URL(`../${filename}`, import.meta.url))).update('\0');
const sourceHash = hash.digest('hex');
const names = [
  'independent synthetic Auth sessions and gated context',
  'genuine home visit completion opens one canonical conversation and episode',
  'patient sends and treating doctor replies with identical API history after fresh login',
  'member unread acknowledgement is monotonic and visible to the correct inbox',
  'unrelated accounts and direct table writes cannot bypass clinical membership or quota',
  'simultaneous duplicate keys and lost responses create one message and debit',
  'independent sessions racing for the final patient credit commit exactly once',
  'clinician replies remain free after patient quota exhaustion',
  'prescription request review and decline are recorded without issuing a prescription',
  'revocation denies both participants and message RLS with existing tokens',
];
const results = names.map(name => ({ name, status: 'NOT RUN' }));
const cleanup = [];
console.log(`Post-consultation API acceptance: environment=${project}; commit=${commit}; source_sha256=${sourceHash}; run=${runId}; started=${new Date().toISOString()}`);

// Never print API result objects, tokens, passwords, clinical bodies or Auth
// exception payloads. Error reports contain operation labels and codes only.
function data(result, label) {
  if (result.error) throw new Error(`${label} failed (${result.error.code ?? 'API_ERROR'})`);
  return result.data;
}
async function rpc(user, name, args = {}) { return data(await user.sb.rpc(name, args), name); }
async function chat(user, name, input) { return rpc(user, name, input === undefined ? {} : { p_input: input }); }
async function check(index, fn) {
  try {
    await fn();
    results[index].status = 'PASS';
    console.log(`PASS ${results[index].name}`);
  } catch (error) {
    results[index].status = 'FAIL';
    console.error(`FAIL ${results[index].name} (${error instanceof assert.AssertionError ? 'ASSERTION_FAILED' : 'API_OR_SETUP_ERROR'})`);
    throw error;
  }
}
async function login(record) {
  const sb = createClient(url, key, options);
  const signed = data(await sb.auth.signInWithPassword({ email: record.email, password: record.password }), 'synthetic sign-in');
  assert.equal(signed.user.id, record.id);
  assert.ok(signed.session);
  // Identity is authorised by the service. This decoded ID only demonstrates
  // that the test generated separate sessions; it is never an access decision.
  const sessionId = JSON.parse(Buffer.from(signed.session.access_token.split('.')[1], 'base64url').toString()).session_id;
  assert.ok(sessionId);
  sessions.push(sb);
  return { ...record, sb, sessionId };
}
async function makeUser(physician = false) {
  const record = {
    email: `postchat-test-${runId}-${users.length}@example.invalid`,
    password: randomBytes(32).toString('base64url'), physician,
  };
  const created = data(await admin.auth.admin.createUser({
    email: record.email, password: record.password, email_confirm: true,
    user_metadata: physician ? { role: 'provider', subtype: 'care_physician', full_name: 'Synthetic follow-up doctor' } : { full_name: 'Synthetic follow-up patient' },
  }), 'create run-owned synthetic Auth fixture');
  record.id = created.user.id;
  users.push(record); // Record identity before any later setup can fail.
  const signed = await login(record);
  data(await admin.from('home_visit_pilot_participants').insert({ user_id: record.id }), 'allow run-owned home-visit fixture');
  data(await admin.from('post_consultation_chat_pilot_participants').insert({ user_id: record.id }), 'allow run-owned follow-up fixture');
  if (physician) {
    data(await admin.from('user_roles').insert({ user_id: record.id, role: 'provider' }), 'approve synthetic provider role');
    data(await admin.from('account_role_requests').update({ status: 'approved' }).eq('user_id', record.id), 'approve synthetic physician subtype');
    data(await signed.sb.from('care_physician_profiles').insert({ user_id: record.id, qualification: 'mbbs', experience_years: 5, council_name: 'Synthetic test council', council_registration_number: 'SYNTHETIC-POSTCHAT-ONLY' }), 'create synthetic credential fixture');
    data(await admin.from('care_physician_profiles').update({ registration_verified: true }).eq('user_id', record.id), 'verify synthetic credential fixture');
    data(await signed.sb.from('provider_availability').insert({ user_id: record.id, is_online: true, working_hours: workingHours, timezone: 'Asia/Kolkata' }), 'publish synthetic availability');
    await rpc(signed, 'hv_save_provider_settings', { p_settings: providerSettings });
  }
  return signed;
}
async function action(user, visit, name, fields = {}) {
  return rpc(user, 'hv_action', { p_input: { booking_id: visit.id, expected_version: visit.version, action: name, ...fields } });
}
async function history(user, conversationId) {
  const messages = []; let before;
  do {
    const page = await chat(user, 'pc_chat_history', { conversation_id: conversationId, limit: 100, ...(before ? { before_sequence: before } : {}) });
    messages.unshift(...page.messages);
    before = page.next_before_sequence;
  } while (before != null);
  return messages;
}
function sendInput(summary, body, idempotencyKey = randomUUID()) {
  return { conversation_id: summary.conversation_id, episode_id: summary.episode_id, body, idempotency_key: idempotencyKey };
}
async function summary(user, view) {
  return chat(user, 'pc_chat_open', { conversation_id: view.conversation_id, episode_id: view.episode_id });
}
async function denied(result, label, expectedCode) {
  assert.ok(result.error, `${label} must reject the operation`);
  if (expectedCode) assert.equal(result.error.code, expectedCode, `${label} must return the access-revocation code`);
}

try {
  let patient, doctor, other, secondPatient, secondDoctor, visit, view;
  await check(0, async () => {
    patient = await makeUser(); doctor = await makeUser(true); other = await makeUser();
    secondPatient = await login(patient); secondDoctor = await login(doctor);
    assert.notEqual(patient.sessionId, secondPatient.sessionId);
    assert.notEqual(doctor.sessionId, secondDoctor.sessionId);
    const context = await chat(patient, 'pc_chat_context');
    assert.equal(context.enabled, true); assert.equal(context.test_only, true);
    assert.equal(context.policy_version, 'synthetic-home-followup-v1');
    for (const feature of ['attachments_enabled', 'calls_enabled', 'payments_enabled', 'prescription_issuance_enabled', 'notifications_enabled']) assert.equal(context[feature], false);
    assert.deepEqual(await chat(patient, 'pc_chat_inbox'), []);
  });
  await check(1, async () => {
    const quote = await rpc(patient, 'hv_quote', { p_input: { provider_id: doctor.id, routing: 'named', is_now: true, pincode: address.pincode } });
    visit = await rpc(patient, 'hv_create', { p_input: { quote_id: quote.quote_id, idempotency_key: randomUUID(), address: { ...address, reason: 'Synthetic follow-up acceptance fixture' }, consent: true, consent_version: consentVersion } });
    await denied(await patient.sb.rpc('pc_chat_open', { p_input: { source_kind: 'doctor_appointment', source_id: visit.id } }), 'pending consultation chat');
    visit = await action(doctor, visit, 'accept');
    visit = await action(doctor, visit, 'start_travel', { eta_minutes: 20 });
    const issued = await rpc(patient, 'hv_arrival_code', { p_booking_id: visit.id });
    visit = await rpc(doctor, 'hv_verify_arrival', { p_input: { booking_id: visit.id, expected_version: visit.version, code: issued.code } });
    visit = await action(doctor, visit, 'start_consultation');
    visit = await action(doctor, visit, 'save_encounter', { summary: 'Synthetic signed follow-up test encounter' });
    visit = await action(doctor, visit, 'complete');
    assert.equal(visit.home_visit_status, 'completed');
    const doctorInbox = await chat(doctor, 'pc_chat_inbox');
    const discovered = doctorInbox.find(item => item.source_id === visit.id);
    assert.ok(discovered, 'clinician inbox must discover a completed encounter before the patient opens chat');
    view = await chat(patient, 'pc_chat_open', { source_kind: 'doctor_appointment', source_id: visit.id });
    const repeated = await chat(secondPatient, 'pc_chat_open', { source_kind: 'doctor_appointment', source_id: visit.id });
    assert.equal(view.conversation_id, discovered.conversation_id);
    assert.equal(view.episode_id, discovered.episode_id);
    assert.equal(repeated.episode_id, view.episode_id);
    assert.equal(view.patient_messages_remaining, 25);
    const episodes = data(await admin.from('chat_consultation_episodes').select('id').eq('source_id', visit.id), 'verify synthetic episode cardinality');
    assert.equal(episodes.length, 1);
  });
  await check(2, async () => {
    const first = await chat(patient, 'pc_chat_send', sendInput(view, 'Synthetic patient follow-up message'));
    assert.equal(first.sender_id, patient.id); assert.equal(first.sender_role, 'patient');
    assert.equal((await history(doctor, view.conversation_id))[0].id, first.id);
    const reply = await chat(doctor, 'pc_chat_send', sendInput(view, 'Synthetic treating-clinician reply'));
    assert.equal(reply.sender_id, doctor.id); assert.equal(reply.sender_role, 'doctor');
    data(await patient.sb.auth.signOut({ scope: 'local' }), 'end first synthetic patient session');
    data(await doctor.sb.auth.signOut({ scope: 'local' }), 'end first synthetic clinician session');
    patient = await login(patient); doctor = await login(doctor);
    assert.notEqual(patient.sessionId, secondPatient.sessionId);
    assert.deepEqual(await history(patient, view.conversation_id), await history(doctor, view.conversation_id));
    assert.equal((await history(patient, view.conversation_id)).length, 2);
    assert.equal((await summary(patient, view)).patient_messages_remaining, 24);
  });
  await check(3, async () => {
    const messages = await history(doctor, view.conversation_id);
    assert.equal((await summary(doctor, view)).unread_count, 1);
    const latest = messages.at(-1).sequence_id;
    await chat(doctor, 'pc_chat_ack_read', { conversation_id: view.conversation_id, through_sequence: latest });
    const replay = await chat(secondDoctor, 'pc_chat_ack_read', { conversation_id: view.conversation_id, through_sequence: messages[0].sequence_id });
    assert.equal(replay.last_read_sequence, latest);
    assert.equal((await summary(doctor, view)).unread_count, 0);
    assert.equal((await summary(patient, view)).unread_count, 1);
    await chat(patient, 'pc_chat_ack_read', { conversation_id: view.conversation_id, through_sequence: latest });
    const inbox = await chat(secondPatient, 'pc_chat_inbox');
    assert.equal(inbox.find(item => item.conversation_id === view.conversation_id).unread_count, 0);
    await denied(await other.sb.rpc('pc_chat_ack_read', { p_input: { conversation_id: view.conversation_id, through_sequence: latest } }), 'outsider read acknowledgement', '42501');
  });
  await check(4, async () => {
    for (const name of ['pc_chat_open', 'pc_chat_history']) await denied(await other.sb.rpc(name, { p_input: { conversation_id: view.conversation_id } }), `outsider ${name}`, '42501');
    await denied(await other.sb.rpc('pc_chat_send', { p_input: sendInput(view, 'Rejected outsider fixture') }), 'outsider send', '42501');
    const rows = data(await other.sb.from('chat_messages').select('id').eq('conversation_id', view.conversation_id), 'outsider message RLS');
    assert.deepEqual(rows, []);
    await denied(await patient.sb.from('chat_messages').insert({ thread_key: `consultation:${view.conversation_id}`, sender_id: patient.id, recipient_id: doctor.id, body: 'Rejected direct fixture', conversation_id: view.conversation_id, episode_id: view.episode_id, sender_role: 'patient', idempotency_key: randomUUID() }), 'direct canonical message');
    await denied(await patient.sb.from('chat_messages').insert({ thread_key: `pair:${patient.id}:${doctor.id}`, sender_id: patient.id, recipient_id: doctor.id, body: 'Rejected legacy bypass fixture' }), 'legacy arbitrary pair');
    await denied(await patient.sb.from('chat_consultation_episodes').update({ patient_messages_used: 0 }).eq('id', view.episode_id), 'quota reset');
  });
  await check(5, async () => {
    const input = sendInput(view, 'Synthetic same-key concurrent message');
    const parallel = await Promise.all([patient, secondPatient].map(user => user.sb.rpc('pc_chat_send', { p_input: input })));
    const first = data(parallel[0], 'first concurrent duplicate'); const second = data(parallel[1], 'second concurrent duplicate');
    assert.equal(first.id, second.id);
    const messageRows = data(await admin.from('chat_messages').select('id').eq('sender_id', patient.id).eq('idempotency_key', input.idempotency_key), 'count duplicate synthetic messages');
    const debits = data(await admin.from('chat_message_debits').select('message_id,units').eq('message_id', first.id), 'count duplicate synthetic debits');
    assert.equal(messageRows.length, 1); assert.deepEqual(debits, [{ message_id: first.id, units: 1 }]);
    const remaining = (await summary(patient, view)).patient_messages_remaining;
    assert.equal((await chat(secondPatient, 'pc_chat_send', input)).id, first.id, 'same request reconciles a lost response');
    assert.equal((await summary(patient, view)).patient_messages_remaining, remaining);
    const changed = await patient.sb.rpc('pc_chat_send', { p_input: { ...input, body: 'Changed duplicate payload' } });
    await denied(changed, 'changed duplicate payload'); assert.match(changed.error.message, /different message/i);
  });
  await check(6, async () => {
    let remaining = (await summary(patient, view)).patient_messages_remaining;
    while (remaining > 1) {
      await chat(patient, 'pc_chat_send', sendInput(view, `Synthetic allowance fixture ${remaining}`));
      remaining--;
    }
    assert.equal((await summary(secondPatient, view)).patient_messages_remaining, 1);
    const inputs = [sendInput(view, 'Synthetic final credit device one'), sendInput(view, 'Synthetic final credit device two')];
    const parallel = await Promise.all([patient, secondPatient].map((user, i) => user.sb.rpc('pc_chat_send', { p_input: inputs[i] })));
    assert.equal(parallel.filter(result => !result.error).length, 1);
    const rejection = parallel.find(result => result.error); assert.ok(rejection); assert.match(rejection.error.message, /exhausted/i);
    const winner = data(parallel.find(result => !result.error), 'winning final-credit send');
    const winnerInput = inputs[parallel.findIndex(result => !result.error)];
    assert.equal((await chat(secondPatient, 'pc_chat_send', winnerInput)).id, winner.id, 'committed retry works after exhaustion');
    const persisted = data(await admin.from('chat_consultation_episodes').select('patient_messages_used,patient_message_limit').eq('id', view.episode_id).single(), 'verify final server quota');
    assert.equal(persisted.patient_messages_used, 25); assert.equal(persisted.patient_message_limit, 25);
    const debits = data(await admin.from('chat_message_debits').select('message_id,units').eq('episode_id', view.episode_id), 'verify bounded ledger');
    assert.equal(debits.length, 25); assert.equal(debits.reduce((sum, row) => sum + row.units, 0), 25);
    assert.equal((await summary(patient, view)).can_send, false);
  });
  await check(7, async () => {
    assert.equal((await summary(doctor, view)).can_send, true);
    const reply = await chat(secondDoctor, 'pc_chat_send', sendInput(view, 'Synthetic free clinician reply after exhaustion'));
    assert.equal(reply.sender_role, 'doctor');
    assert.equal((await summary(patient, view)).patient_messages_remaining, 0);
    const charged = data(await admin.from('chat_message_debits').select('message_id').eq('message_id', reply.id), 'check clinician reply debit absence');
    assert.deepEqual(charged, []);
    assert.deepEqual(await history(patient, view.conversation_id), await history(doctor, view.conversation_id));
  });
  await check(8, async () => {
    const input = { conversation_id: view.conversation_id, episode_id: view.episode_id };
    const request = await chat(patient, 'pc_chat_prescription', { ...input, action: 'request', idempotency_key: randomUUID() });
    assert.equal(request.status, 'requested');
    const reviewed = await chat(doctor, 'pc_chat_prescription', { ...input, action: 'review', request_id: request.id });
    assert.equal(reviewed.status, 'reviewing');
    await denied(await doctor.sb.rpc('pc_chat_prescription', { p_input: { ...input, action: 'issue', request_id: request.id } }), 'unsigned prescription issuance');
    const declined = await chat(doctor, 'pc_chat_prescription', { ...input, action: 'decline', request_id: request.id, reason: 'Synthetic clinician decline fixture' });
    assert.equal(declined.status, 'declined');
    const audit = data(await admin.from('chat_prescription_events').select('to_status').eq('request_id', request.id).order('created_at'), 'read synthetic request audit');
    assert.deepEqual(audit.map(row => row.to_status), ['requested', 'reviewing', 'declined']);
    const outbox = data(await admin.from('chat_notification_outbox').select('status').eq('conversation_id', view.conversation_id), 'verify truthful disabled notifications');
    assert.ok(outbox.length > 0); assert.ok(outbox.every(row => row.status === 'disabled'));
  });
  await check(9, async () => {
    data(await admin.from('post_consultation_chat_pilot_participants').update({ revoked_at: new Date().toISOString() }).eq('user_id', patient.id), 'revoke only the run-owned synthetic patient');
    for (const user of [patient, secondPatient, doctor, secondDoctor]) {
      await denied(await user.sb.rpc('pc_chat_history', { p_input: { conversation_id: view.conversation_id } }), 'revoked history with existing access token', '42501');
      await denied(await user.sb.rpc('pc_chat_send', { p_input: sendInput(view, 'Rejected revoked fixture') }), 'revoked send with existing access token', '42501');
      const rows = data(await user.sb.from('chat_messages').select('id').eq('conversation_id', view.conversation_id), 'revoked message RLS');
      assert.deepEqual(rows, []);
    }
  });
} catch (error) {
  // Assertion internals and API payloads can contain clinical or Auth values.
  console.error(`Acceptance stopped (${error instanceof assert.AssertionError ? 'ASSERTION_FAILED' : 'API_OR_SETUP_ERROR'}); unexecuted checks remain NOT RUN.`);
  process.exitCode = 1;
} finally {
  // Discover by newly created patient IDs so a lost create/open response cannot
  // strand unknown fixture IDs. Never run a global delete or change shared policy.
  const patientIds = users.filter(user => !user.physician).map(user => user.id);
  let cleanupSucceeded = true;
  async function remove(table, field, ids) {
    if (!ids.length) return;
    data(await admin.from(table).delete().in(field, ids), `cleanup ${table}`);
  }
  try {
    const conversations = patientIds.length ? data(await admin.from('chat_conversations').select('id').in('patient_id', patientIds), 'discover run-owned conversations') : [];
    const conversationIds = conversations.map(row => row.id);
    const episodes = conversationIds.length ? data(await admin.from('chat_consultation_episodes').select('id').in('conversation_id', conversationIds), 'discover run-owned episodes') : [];
    const requests = conversationIds.length ? data(await admin.from('chat_prescription_requests').select('id').in('conversation_id', conversationIds), 'discover run-owned prescription requests') : [];
    await remove('chat_notification_outbox', 'conversation_id', conversationIds);
    await remove('chat_prescription_events', 'request_id', requests.map(row => row.id));
    await remove('chat_prescription_requests', 'conversation_id', conversationIds);
    await remove('chat_message_debits', 'episode_id', episodes.map(row => row.id));
    await remove('chat_messages', 'conversation_id', conversationIds);
    await remove('chat_member_receipts', 'conversation_id', conversationIds);
    await remove('chat_consultation_episodes', 'conversation_id', conversationIds);
    await remove('chat_conversations', 'id', conversationIds);
    await remove('post_consultation_chat_pilot_participants', 'user_id', users.map(user => user.id));
    await remove('doctor_appointments', 'patient_id', patientIds);
    cleanup.push({ step: 'run-owned chat and home-visit fixtures', status: 'PASS' });
  } catch {
    cleanupSucceeded = false; process.exitCode = 1;
    cleanup.push({ step: 'run-owned chat and home-visit fixtures', status: 'FAIL' });
    console.error(`FAIL synthetic fixture cleanup; preserve run ${runId} for scoped reconciliation. Auth fixtures are retained if clinical cleanup is incomplete.`);
  }
  for (const sb of sessions) {
    try { await sb.removeAllChannels(); await sb.auth.signOut({ scope: 'local' }); }
    catch { /* Continue cleanup; credentials were never persisted to disk. */ }
  }
  if (cleanupSucceeded) {
    for (const user of users) {
      const result = await admin.auth.admin.deleteUser(user.id);
      if (result.error) {
        cleanupSucceeded = false; process.exitCode = 1;
        console.error(`FAIL synthetic Auth cleanup (${result.error.code ?? 'API_ERROR'}); run=${runId}.`);
      }
    }
    cleanup.push({ step: 'run-owned synthetic Auth accounts', status: cleanupSucceeded ? 'PASS' : 'FAIL' });
  }
  for (const name of ['Browser UI/Realtime and physical-device restart/resume', 'Private report upload and recipient download', 'Verified recharge and real calls', 'Signed prescription issuance and closed-app notification delivery']) {
    results.push({ name, status: 'NOT RUN' });
  }
  console.log(JSON.stringify({ environment: project, commit, source_sha256: sourceHash, run_id: runId, completed_at: new Date().toISOString(), results, cleanup, synthetic_users_created: users.length }));
}
