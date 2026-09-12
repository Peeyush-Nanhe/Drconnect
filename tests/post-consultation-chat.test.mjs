import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ChatRecovery, recoverHistory } from '../src/features/mydox/post-consultation-chat/recovery.ts';
import { referenceInput, chatDetails, inboxItem, savedMessage, mergeMessages, retryPayload } from '../src/features/mydox/post-consultation-chat/state.ts';

const summary = {
  conversation_id: 'relationship-1', episode_id: 'visit-2', actor_id: 'doctor-1', member_role: 'doctor',
  other_id: 'patient-1', other_name: 'Same Display Name', other_role: 'patient', consultation_label: 'Home consultation',
  completed_at: '2026-09-12T00:00:00Z', policy_version: 'test-v1', test_only: true,
  patient_messages_remaining: 0, patient_messages_limit: 25, patient_send_until: '2026-09-13T00:00:00Z',
  can_send: true, last_body: 'Persisted text', last_at: '2026-09-12T00:05:00Z', unread_count: 3,
  episodes: [{ episode_id: 'visit-2', consultation_label: 'Home consultation', completed_at: '2026-09-12T00:00:00Z' }],
  prescription_requests: [{ id: 'request-1', episode_id: 'visit-2', status: 'declined', requested_at: '2026-09-12T00:01:00Z', decline_reason: 'Requires an appointment' }],
};
const wire = (id, sequence, extra = {}) => ({ id, sequence_id: sequence, conversation_id: 'relationship-1', episode_id: 'visit-2',
  sender_id: 'patient-1', sender_role: 'patient', body: 'Persisted text', created_at: '2026-09-12T00:05:00Z', idempotency_key: `key-${id}`, ...extra });

test('all entry adapters carry immutable source or canonical episode IDs', () => {
  assert.deepEqual(referenceInput({ source: 'doctor_appointment', sourceId: 'booking-1' }), { source_kind: 'doctor_appointment', source_id: 'booking-1' });
  assert.deepEqual(referenceInput({ source: 'care_request', sourceId: 'request-1' }), { source_kind: 'care_request', source_id: 'request-1' });
  assert.deepEqual(referenceInput({ conversationId: 'relationship-1', episodeId: 'visit-2' }), { conversation_id: 'relationship-1', episode_id: 'visit-2' });
});
test('same-name or renamed counterparts do not change inbox relationship/episode identity', () => {
  const first = inboxItem(summary);
  const changed = inboxItem({ ...summary, other_name: 'Changed Name' });
  assert.equal(first.conversationId, changed.conversationId);
  assert.equal(first.episodeId, changed.episodeId);
  assert.equal(first.counterpartId, changed.counterpartId);
  assert.equal(first.unreadCount, 3);
  assert.notEqual(first.conversationId, inboxItem({ ...summary, conversation_id: 'relationship-2', other_id: 'patient-2' }).conversationId);
});
test('doctor identity and send eligibility use server membership despite exhausted patient allowance', () => {
  const details = chatDetails(summary);
  assert.equal(details.memberRole, 'doctor');
  assert.equal(details.patientMessagesRemaining, 0);
  assert.equal(details.canSend, true);
  assert.equal(details.prescriptionRequests[0].status, 'declined');
  assert.equal(details.prescriptionRequests[0].declineReason, 'Requires an appointment');
});
test('saved transport result never implies delivered or read', () => {
  const own = savedMessage(wire('one', 1), 'patient-1');
  assert.equal(own.status, 'saved');
  assert.equal(own.isOwn, true);
  assert.equal(own.senderRole, 'patient');
  assert.equal(savedMessage(wire('two', 2, { sender_id: 'doctor-1', sender_role: 'doctor' }), 'doctor-1').senderRole, 'doctor');
});
test('lost response reconciliation replaces one pending actor/key without duplicate rows', () => {
  const pending = { ...savedMessage(wire('pending', 0, { idempotency_key: 'stable-key' }), 'patient-1'), id: 'pending:stable-key', status: 'failed', error: 'Lost response' };
  const saved = savedMessage(wire('server-id', 10, { idempotency_key: 'stable-key' }), 'patient-1');
  const other = savedMessage(wire('other-actor', 9, { sender_id: 'doctor-1', sender_role: 'doctor', idempotency_key: 'stable-key' }), 'patient-1');
  const merged = mergeMessages([pending, other], [saved, saved]);
  assert.deepEqual(merged.map(m => m.id), ['other-actor', 'server-id']);
  assert.equal(merged.find(m => m.id === 'server-id').status, 'saved');
  assert.deepEqual(retryPayload(pending), { conversation_id: 'relationship-1', episode_id: 'visit-2', body: 'Persisted text', idempotency_key: 'stable-key' });
});
test('overlapping history pages and reconnect events preserve stable ordering and distinct repeat episodes', () => {
  const older = savedMessage(wire('older', 2, { episode_id: 'visit-1', created_at: '2099-01-01T00:00:00Z' }), 'patient-1');
  const newer = savedMessage(wire('newer', 3, { created_at: '2000-01-01T00:00:00Z' }), 'patient-1');
  assert.deepEqual(mergeMessages([newer], [older, newer]).map(m => [m.id, m.episodeId]), [['older', 'visit-1'], ['newer', 'visit-2']]);
});


test('a late successful response cannot restore history after access revocation', async () => {
  const recovery = new ChatRecovery();
  const beforeRevocation = recovery.capture();
  recovery.confirmHistory(beforeRevocation, [1]);
  let finishRequest;
  const request = recoverHistory(() => new Promise(resolve => { finishRequest = resolve; }), 1, () => recovery.isCurrent(beforeRevocation));
  recovery.invalidate();
  finishRequest({ messages: [wire('late', 2)], next_before_sequence: null });
  assert.equal(await request, null);
  assert.equal(recovery.confirmHistory(beforeRevocation, [2]), false);
  assert.equal(recovery.authorised, false);
  assert.equal(recovery.historyBoundary, null);
  const revalidation = recovery.capture();
  assert.equal(recovery.confirmHistory(revalidation, [2]), true);
  assert.equal(recovery.authorised, true);
});

test('an isolated send response cannot skip multiple pages of missed recipient messages', async () => {
  const recovery = new ChatRecovery();
  const generation = recovery.capture();
  recovery.confirmHistory(generation, [900]);
  const local = mergeMessages([savedMessage(wire('known', 900), 'patient-1')], [savedMessage(wire('own-send', 1001, { sender_id: 'patient-1' }), 'patient-1')]);
  assert.equal(Math.max(...local.map(message => message.sequence)), 1001);
  assert.equal(recovery.historyBoundary, 900);
  const requested = [];
  const serverRows = Array.from({ length: 102 }, (_, index) => wire(`server-${index + 900}`, index + 900));
  const result = await recoverHistory(async before => {
    requested.push(before);
    const candidates = serverRows.filter(message => before == null || message.sequence_id < before);
    const page = candidates.slice(-50);
    return { messages: page, next_before_sequence: candidates.length > page.length ? page[0].sequence_id : null };
  }, recovery.historyBoundary, () => recovery.isCurrent(generation));
  assert.equal(requested.length, 3);
  assert.deepEqual([...new Set(result.messages.map(message => message.sequence_id))].sort((a, b) => a - b), serverRows.map(message => message.sequence_id));
  recovery.confirmHistory(generation, result.messages.map(message => message.sequence_id));
  assert.equal(recovery.historyBoundary, 1001);
});

test('a non-advancing pagination cursor is rejected instead of looping indefinitely', async () => {
  let calls = 0;
  await assert.rejects(recoverHistory(async () => {
    calls += 1;
    return { messages: [wire('latest', 100)], next_before_sequence: 100 };
  }, 1, () => true), /did not advance/);
  assert.equal(calls, 2);
});
