import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { createDatabase } from './home-visit-fixtures.mjs';

// These checks execute the deployed SQL functions in PostgreSQL. PGlite uses
// one connection: repeated claims prove lease exclusion, not parallel SKIP LOCKED
// behavior or external push delivery. No network requests or real users are used.
let db, actor, bookingId, eventId;
const recipient = randomUUID();

before(async () => {
  ({ db, actor } = await createDatabase());
  await db.query('insert into auth.users(id,email) values ($1,$2)', [recipient, `jobs-${recipient}@example.invalid`]);
  bookingId = (await db.query(`insert into public.doctor_appointments
    (patient_id,service,mode,start_time,end_time,fee,currency,status,home_visit_status)
    values ($1,'Synthetic notification fixture','home_visit',now()+interval '1 day',now()+interval '1 day 30 minutes',0,'INR','pending','pending')
    returning id`, [recipient])).rows[0].id;
  const quoteId = (await db.query(`insert into public.home_visit_quotes
    (actor_id,routing,is_now,pincode,start_time,end_time,fee,currency,provider_timezone,config,candidates,expires_at)
    values ($1,'pool',true,'411001',now(),now()+interval '30 minutes',0,'INR','Asia/Kolkata','{}','{}',now()+interval '1 hour')
    returning id`, [recipient])).rows[0].id;
  await db.query(`insert into public.home_visit_details
    (booking_id,quote_id,actor_id,patient_id,routing,is_now,pending_deadline,idempotency_key,payload_hash)
    values ($1,$2,$3,$3,'pool',true,now()+interval '1 day',$4,'synthetic-fixture-only')`, [bookingId, quoteId, recipient, randomUUID()]);
  eventId = (await db.query(`insert into public.home_visit_events
    (booking_id,actor_id,kind,version) values ($1,$2,'synthetic_notification_test',1) returning id`, [bookingId, recipient])).rows[0].id;
  await db.query('insert into public.home_visit_operations_members(user_id) values ($1)', [recipient]);
});
beforeEach(async () => {
  await db.exec('delete from public.home_visit_notification_jobs');
});
after(async () => db?.close());

async function seedJob({ status = 'pending', attempts = 0, lease = null, dueSeconds = -1, lockSeconds = null } = {}) {
  const result = await db.query(`insert into public.home_visit_notification_jobs
    (booking_id,event_id,recipient_id,channel,status,attempts,dedupe_key,available_at,lease_token,locked_at)
    values ($1,$2,$3,'push',$4,$5,$6,now()+make_interval(secs=>$7),$8,
      case when $9::integer is null then null else now()+make_interval(secs=>$9) end)
    returning id`, [bookingId, eventId, recipient, status, attempts, randomUUID(), dueSeconds, lease, lockSeconds]);
  return result.rows[0].id;
}
async function claim(limit = 20) {
  return (await actor(null, 'select public.hv_claim_notifications($1) as jobs', [limit], 'service_role')).rows[0].jobs;
}
async function finish(job, sent, error = null) {
  return actor(null, 'select public.hv_finish_notification($1,$2,$3,$4)', [job.id, job.lease_token, sent, error], 'service_role');
}
async function saved(id) {
  return (await actor(null, 'select * from public.home_visit_notification_jobs where id=$1', [id], 'service_role')).rows[0];
}

test('only service-role workers can claim or finish notification jobs', async () => {
  const id = await seedJob();
  for (const role of ['anon', 'authenticated']) {
    const uid = role === 'anon' ? null : recipient;
    await assert.rejects(actor(uid, 'select public.hv_claim_notifications(1)', [], role), /permission denied/i);
    await assert.rejects(actor(uid, 'select public.hv_finish_notification($1,$2,true,null)', [id, randomUUID()], role), /permission denied/i);
    await assert.rejects(actor(uid, 'select * from public.home_visit_notification_jobs', [], role), /permission denied/i);
  }
  const jobs = await claim(1);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].id, id);
  assert.match(jobs[0].lease_token, /^[0-9a-f-]{36}$/);
});

test('serial bounded claims exclude leased, deferred and disabled jobs', async () => {
  const firstId = await seedJob({ dueSeconds: -30 });
  const secondId = await seedJob({ dueSeconds: -20 });
  const deferredId = await seedJob({ dueSeconds: 3600 });
  const disabledId = await seedJob({ status: 'disabled' });
  const first = await claim(1);
  const second = await claim(1);
  assert.deepEqual(first.map(job => job.id), [firstId]);
  assert.deepEqual(second.map(job => job.id), [secondId]);
  assert.notEqual(first[0].lease_token, second[0].lease_token);
  assert.deepEqual(await claim(), []);
  assert.equal((await saved(firstId)).attempts, 1);
  assert.equal((await saved(secondId)).attempts, 1);
  assert.equal((await saved(deferredId)).attempts, 0);
  assert.equal((await saved(disabledId)).status, 'disabled');
});

test('a failed finish persists backoff and does not immediately reclaim the job', async () => {
  const id = await seedJob();
  const [job] = await claim();
  await finish(job, false, 'Synthetic transport unavailable');
  const failed = await saved(id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempts, 1);
  assert.equal(failed.lease_token, null);
  assert.equal(failed.sent_at, null);
  assert.equal(failed.last_error, 'Synthetic transport unavailable');
  const delay = (await db.query('select extract(epoch from available_at-now())::float as seconds from public.home_visit_notification_jobs where id=$1', [id])).rows[0].seconds;
  assert.ok(delay > 50 && delay <= 60, `Expected approximately 60 seconds of initial retry backoff, received ${delay}`);
  assert.deepEqual(await claim(), []);
  await db.query("update public.home_visit_notification_jobs set available_at=now()-interval '1 second' where id=$1", [id]);
  const [retry] = await claim();
  assert.equal(retry.id, id);
  assert.equal(retry.attempts, 2);
  assert.notEqual(retry.lease_token, job.lease_token);
});

test('an expired worker lease is replaced and a stale worker cannot finish it', async () => {
  const id = await seedJob();
  const [oldJob] = await claim();
  await db.query("update public.home_visit_notification_jobs set locked_at=now()-interval '6 minutes' where id=$1", [id]);
  const [newJob] = await claim();
  assert.equal(newJob.id, id);
  assert.equal(newJob.attempts, 2);
  assert.notEqual(newJob.lease_token, oldJob.lease_token);
  await assert.rejects(finish(oldJob, true), /lease is stale/i);
  const row = await saved(id);
  assert.equal(row.status, 'processing');
  assert.equal(row.lease_token, newJob.lease_token);
  assert.equal(row.sent_at, null);
  await finish(newJob, false, 'Synthetic retry failure');
  assert.equal((await saved(id)).status, 'failed');
});

test('a sent job is final for workers and duplicate finish cannot overwrite it', async () => {
  const id = await seedJob();
  const [job] = await claim();
  await finish(job, true);
  const sent = await saved(id);
  assert.equal(sent.status, 'sent');
  assert.ok(sent.sent_at);
  assert.equal(sent.last_error, null);
  assert.equal(sent.lease_token, null);
  await db.query("update public.home_visit_notification_jobs set locked_at=now()-interval '6 minutes',available_at=now()-interval '1 minute' where id=$1", [id]);
  assert.deepEqual(await claim(), []);
  await assert.rejects(finish(job, false, 'Late callback'), /lease is stale/i);
  assert.equal((await saved(id)).status, 'sent');
  assert.equal((await saved(id)).attempts, 1);
});

test('a fifth abandoned attempt becomes an operations-visible failure without a sixth send', async () => {
  const lease = randomUUID();
  const id = await seedJob({ status: 'processing', attempts: 5, lease, lockSeconds: -360 });
  assert.deepEqual(await claim(), []);
  const failed = await saved(id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.attempts, 5);
  assert.equal(failed.lease_token, null);
  assert.equal(failed.last_error, 'Notification worker lease exhausted');
  await assert.rejects(finish({ id, lease_token: lease }, true), /lease is stale/i);
  assert.deepEqual(await claim(), []);
  const operations = (await actor(recipient, 'select public.hv_operations() as rows')).rows[0].rows;
  assert.equal(operations.find(row => row.booking_id === bookingId)?.failed_notifications, 1);
});
