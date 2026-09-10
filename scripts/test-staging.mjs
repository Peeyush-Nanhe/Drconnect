import { createClient } from '@supabase/supabase-js';
import { randomUUID, randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

// Explicit opt-in to this isolated staging project. Never target production.
const ref = 'pyrlvjeectjikvfksukb';
if (!process.argv.includes('--run') || process.env.SUPABASE_URL !== `https://${ref}.supabase.co`) {
  throw new Error('Use --run with the MyDox Staging .env only. This creates and removes synthetic test records.');
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key || !secret) throw new Error('Staging browser and server keys are required.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const anon = createClient(url, key, options);
const users = [];
let formId, familyPlanId, jobId;
const runId = randomUUID();
const results = [];
function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function check(name, fn) {
  await fn();
  results.push(name);
  console.log(`PASS ${name}`);
}
async function createUser(kind) {
  const email = `careconnect-${runId}-${kind}@example.invalid`;
  const password = randomBytes(30).toString('base64url');
  const role = kind.startsWith('provider') ? 'provider' : kind === 'facility' ? 'facility' : 'patient';
  const created = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, subtype: role === 'provider' ? 'care_physician' : role === 'facility' ? 'hub' : 'patient', full_name: `Staging test ${kind}` } }), 'create test account');
  const sb = createClient(url, key, options);
  const user = { id: created.user.id, email, password, sb, role };
  users.push(user); // Register immediately so cleanup covers a failed sign-in.
  ok(await sb.auth.signInWithPassword({ email, password }), 'sign in test account');
  return user;
}

try {
  const setup = await Promise.allSettled(['patient', 'other', 'provider1', 'provider2', 'facility'].map(createUser));
  const failedSetup = setup.find(result => result.status === 'rejected');
  if (failedSetup) throw failedSetup.reason;
  const [patient, other, p1, p2, facility] = setup.map(result => result.value);
  await check('five synthetic users sign in through Supabase Auth', async () => {
    for (const user of users) assert.equal(ok(await user.sb.auth.getUser(), 'validate user').user.id, user.id);
  });
  await check('provider/facility signup grants only patient access and preserves pending requests', async () => {
    for (const user of [p1, p2, facility]) {
      assert.deepEqual(ok(await user.sb.from('user_roles').select('role').eq('user_id', user.id), 'read own roles'), [{ role: 'patient' }]);
      const request = ok(await user.sb.from('account_role_requests').select('status,requested_role').eq('user_id', user.id).single(), 'read request');
      assert.equal(request.status, 'pending'); assert.equal(request.requested_role, user.role);
    }
  });
  await check('a patient cannot grant itself administrator access or approve a request', async () => {
    assert.ok((await p1.sb.from('user_roles').insert({ user_id: p1.id, role: 'admin' })).error);
    assert.ok((await p1.sb.from('account_role_requests').update({ status: 'approved' }).eq('user_id', p1.id)).error);
  });
  await check('submitted data persists after logout and login', async () => {
    formId = ok(await patient.sb.from('form_submissions').insert({ user_id: patient.id, form_type: 'staging_integration_test', details: { runId } }).select('id').single(), 'save form').id;
    ok(await patient.sb.auth.signOut(), 'sign out');
    ok(await patient.sb.auth.signInWithPassword({ email: patient.email, password: patient.password }), 'sign back in');
    assert.equal(ok(await patient.sb.from('form_submissions').select('id').eq('id', formId).single(), 'read saved form').id, formId);
  });
  await check('another patient cannot read or overwrite the saved form', async () => {
    assert.deepEqual(ok(await other.sb.from('form_submissions').select('id').eq('id', formId), 'read another patient form'), []);
    assert.ok((await other.sb.from('form_submissions').insert({ user_id: patient.id, form_type: 'forbidden' })).error);
  });
  await check('family-plan RPC respects patient isolation', async () => {
    familyPlanId = ok(await patient.sb.from('family_physician_plans').insert({ patient_id: patient.id, doctor_name: 'Synthetic Staging Doctor' }).select('id').single(), 'create test plan').id;
    const own = ok(await patient.sb.rpc('get_active_family_plan', { _patient_id: patient.id }), 'own plan RPC');
    assert.equal(own.id, familyPlanId);
    const unrelated = ok(await other.sb.rpc('get_active_family_plan', { _patient_id: patient.id }), 'other patient plan RPC');
    assert.ok(unrelated === null || unrelated?.id == null);
  });
  await check('a submitted coordinator application has no patient-queue privileges', async () => {
    ok(await other.sb.from('coordinator_profiles').insert({ user_id: other.id, application_status: 'submitted' }), 'submit coordinator application');
    assert.equal(ok(await other.sb.rpc('is_active_coordinator', { _user_id: other.id }), 'coordinator authorization'), false);
    assert.ok((await other.sb.from('coordinator_profiles').update({ application_status: 'verified' }).eq('user_id', other.id)).error);
  });
  for (const user of [p1, p2, facility]) {
    ok(await admin.from('user_roles').insert({ user_id: user.id, role: user.role }), 'approve synthetic role');
    ok(await admin.from('account_role_requests').update({ status: 'approved' }).eq('user_id', user.id), 'approve synthetic request');
  }
  for (const user of [p1, p2]) {
    ok(await user.sb.from('care_physician_profiles').insert({ user_id: user.id, qualification: 'mbbs', experience_years: 5, procedures: ['intubation'], council_name: 'Synthetic test council', council_registration_number: 'TEST-ONLY' }), 'save test physician');
  }
  jobId = ok(await facility.sb.from('staffing_jobs').insert({ facility_id: facility.id, job_type: 'shift', title: `Synthetic ICU test ${runId}`, specialty: 'Medicine', qualification: 'mbbs', experience_years: 2, duty_type: 'icu', required_procedures: ['intubation'], capacity: 1 }).select('id').single(), 'post test duty').id;
  await check('unverified doctors cannot claim ICU duties or verify themselves', async () => {
    assert.match((await p1.sb.rpc('claim_staffing_job', { _job_id: jobId })).error?.message ?? '', /Registration verification pending/);
    assert.ok((await p1.sb.from('care_physician_profiles').update({ registration_verified: true }).eq('user_id', p1.id)).error);
  });
  for (const user of [p1, p2]) ok(await admin.from('care_physician_profiles').update({ registration_verified: true }).eq('user_id', user.id), 'verify synthetic profile');
  let winner, loser;
  await check('two simultaneous claims produce exactly one accepted final-slot assignment', async () => {
    const claims = await Promise.all([p1, p2].map(user => user.sb.rpc('claim_staffing_job', { _job_id: jobId })));
    assert.equal(claims.filter(result => !result.error).length, 1);
    assert.equal(claims.filter(result => result.error).length, 1);
    winner = claims[0].error ? p2 : p1; loser = winner === p1 ? p2 : p1;
    const rows = ok(await admin.from('staffing_assignments').select('provider_id,status').eq('job_id', jobId), 'read final assignments');
    assert.deepEqual(rows, [{ provider_id: winner.id, status: 'accepted' }]);
  });
  await check('filled duty remains visible to its doctor and hospital, not unrelated users', async () => {
    assert.equal(ok(await winner.sb.from('staffing_jobs').select('id').eq('id', jobId), 'winner roster').length, 1);
    assert.equal(ok(await facility.sb.from('staffing_jobs').select('id').eq('id', jobId), 'hospital roster').length, 1);
    assert.equal(ok(await loser.sb.from('staffing_jobs').select('id').eq('id', jobId), 'unrelated roster').length, 0);
  });
  await check('editing registration identity revokes its previous verification', async () => {
    const row = ok(await winner.sb.from('care_physician_profiles').update({ council_registration_number: 'CHANGED-TEST' }).eq('user_id', winner.id).select('registration_verified,verified_at').single(), 'edit registration');
    assert.deepEqual(row, { registration_verified: false, verified_at: null });
  });
  await check('anonymous requests cannot call privileged staffing or family-plan RPCs', async () => {
    assert.ok((await anon.rpc('claim_staffing_job', { _job_id: jobId })).error);
    assert.ok((await anon.rpc('get_active_family_plan', { _patient_id: patient.id })).error);
  });
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
} finally {
  // All IDs are generated in this run. Remove only those synthetic records.
  for (const [table, id] of [['form_submissions', formId], ['family_physician_plans', familyPlanId], ['staffing_jobs', jobId]]) {
    if (id) {
      const result = await admin.from(table).delete().eq('id', id);
      if (result.error) { console.error(`Cleanup failed for synthetic ${table}: ${result.error.message}`); process.exitCode = 1; }
    }
  }
  for (const user of users) {
    await user.sb.auth.signOut();
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) { console.error(`Cleanup failed for synthetic test account: ${result.error.message}`); process.exitCode = 1; }
  }
  console.log(`${results.length} hosted integration checks passed; cleanup attempted for ${users.length} synthetic users.`);
}
