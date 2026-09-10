import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processHomeVisitJobs } from '../src/lib/home-visits-jobs.ts';

test('notification jobs never turn absent, partial or failed transport into sent', async () => {
  const jobs = Array.from({ length: 5 }, (_, id) => ({ id: String(id), booking_id: 'booking', recipient_id: 'recipient', channel: 'push', lease_token: String(id) }));
  const finishes = [];
  let expired = false;
  const result = await processHomeVisitJobs({
    expire: async () => { expired = true; },
    claim: async () => { assert.ok(expired); return jobs; },
    send: async job => {
      if (job.id === '0') return { targeted: 0, sent: 0, failed: 0, skipped: 0 };
      if (job.id === '1') return { targeted: 2, sent: 1, failed: 1, skipped: 0 };
      if (job.id === '2') return { targeted: 1, sent: 0, failed: 0, skipped: 1 };
      if (job.id === '3') throw new Error('secret device token must not leak');
      return { targeted: 1, sent: 1, failed: 0, skipped: 0 };
    },
    finish: async (job, sent, error) => finishes.push({ lease: job.lease_token, sent, error }),
  });
  assert.deepEqual(result, { claimed: 5, sent: 1, failed: 4 });
  assert.deepEqual(finishes.map(x => x.sent), [false, false, false, false, true]);
  assert.ok(!JSON.stringify(finishes).includes('secret device token'));
});

test('failed job acknowledgement is surfaced so the persisted lease can recover', async () => {
  await assert.rejects(processHomeVisitJobs({
    expire: async () => {},
    claim: async () => [{ id: 'job', channel: 'push', lease_token: 'lease' }],
    send: async () => ({ targeted: 1, sent: 1, failed: 0, skipped: 0 }),
    finish: async () => { throw new Error('database unavailable'); },
  }), /database unavailable/);
});
