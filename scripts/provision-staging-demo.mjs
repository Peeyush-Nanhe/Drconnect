import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

// Explicit staging fixture setup. Never call this from browser code or a migration.
// Password is supplied to this server process, not saved in source or printed.
const ref = 'pyrlvjeectjikvfksukb';
const url = `https://${ref}.supabase.co`;
if (!process.argv.includes('--run') || process.env.SUPABASE_URL !== url ||
  process.env.VITE_SUPABASE_URL !== url) {
  throw new Error('Use --run with the exact MyDox Staging .env.');
}
const password = process.env.MYDOX_DEMO_PASSWORD;
if (!password || password.length < 12) throw new Error('Set MYDOX_DEMO_PASSWORD in this process (at least 12 characters).');
if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('Staging server and publishable keys are required.');
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const accounts = [
  ['patient1@demo.med', 'Priya Sharma', 'patient', 'patient'],
  ['patient2@demo.med', 'Rahul Verma', 'patient', 'patient'],
  ['medico1@demo.med', 'Dr. Anita Rao', 'provider', 'medico'],
  ['medico2@demo.med', 'Dr. Vikram Iyer', 'provider', 'medico'],
  ['rahul.nair@demo.med', 'Rahul Nair', 'provider', 'therapist'],
  ['hub1@demo.med', 'Demo Hub 1', 'facility', 'hub'],
  ['hub2@demo.med', 'Demo Hub 2', 'facility', 'hub'],
  ['scan1@demo.med', 'Demo Scan Centre 1', 'facility', 'diagnostic'],
  ['scan2@demo.med', 'Demo Scan Centre 2', 'facility', 'diagnostic'],
  ['ambulance1@demo.med', 'Demo Ambulance 1', 'provider', 'ambulance'],
  ['ambulance2@demo.med', 'Demo Ambulance 2', 'provider', 'ambulance'],
  ['pharmacy1@demo.med', 'Demo Pharmacy 1', 'facility', 'pharmacy'],
  ['pharmacy2@demo.med', 'Demo Pharmacy 2', 'facility', 'pharmacy'],
  ['labs1@demo.med', 'Demo Labs 1', 'facility', 'labs'],
  ['labs2@demo.med', 'Demo Labs 2', 'facility', 'labs'],
  ['seva1@demo.med', 'Demo Seva 1', 'provider', 'seva'],
  ['seva2@demo.med', 'Demo Seva 2', 'provider', 'seva'],
  ['coordinator1@demo.med', 'Asha Nair', 'provider', 'coordinator'],
  ['carephysician1@demo.med', 'Dr. Neel Shah', 'provider', 'care_physician'],
  ['admin.demo@careconnect.health', 'Demo Administrator', 'admin', 'admin'],
  ['superadmin.demo@careconnect.health', 'Demo Super Administrator', 'super_admin', 'admin'],
].map(([email, name, role, view]) => ({ email, name, role, view }));
function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}
function expectedRoles(account) {
  return [...new Set(['patient', account.role, ...(account.role === 'super_admin' ? ['admin'] : [])])].sort();
}
try {
  const existing = new Map();
  for (let page = 1; ; page++) {
    const data = ok(await admin.auth.admin.listUsers({ page, perPage: 200 }), 'preflight accounts');
    for (const user of data.users) existing.set(user.email?.toLowerCase(), user);
    if (data.users.length < 200) break;
  }
  // Refuse to take over an account not previously created by this fixture setup.
  for (const account of accounts) {
    const user = existing.get(account.email);
    if (user && (user.app_metadata?.careconnect_demo !== true ||
      user.app_metadata?.staging_project !== ref)) {
      throw new Error(`Existing account is not a marked staging fixture: ${account.email}`);
    }
    if (user) {
      const roles = ok(await admin.from('user_roles').select('role').eq('user_id', user.id), 'preflight roles');
      if (roles.some(row => !expectedRoles(account).includes(row.role))) {
        throw new Error(`Unexpected roles on staging fixture: ${account.email}; review before changing it.`);
      }
    }
  }
  for (const account of accounts) {
    const user = existing.get(account.email);
    const values = {
      password, email_confirm: true,
      user_metadata: { full_name: account.name, role: ['provider', 'facility'].includes(account.role) ? account.role : 'patient', subtype: account.view },
      app_metadata: { careconnect_demo: true, staging_project: ref },
    };
    const data = user
      ? ok(await admin.auth.admin.updateUserById(user.id, values), 'update marked demo account')
      : ok(await admin.auth.admin.createUser({ email: account.email, ...values }), 'create requested demo account');
    account.id = data.user.id;
    ok(await admin.from('profiles').upsert({ id: account.id, full_name: account.name, view: account.view }), 'set demo dashboard');
    ok(await admin.from('user_roles').upsert(expectedRoles(account).map(role => ({ user_id: account.id, role })), { onConflict: 'user_id,role', ignoreDuplicates: true }), 'grant requested demo roles');
  }
  const reviewer = accounts.find(account => account.role === 'super_admin');
  for (const account of accounts.filter(account => ['provider', 'facility'].includes(account.role))) {
    ok(await admin.from('account_role_requests').upsert({
      user_id: account.id, requested_role: account.role, requested_view: account.view,
      status: 'approved', reviewed_by: reviewer.id, reviewed_at: new Date().toISOString(),
    }), 'record owner-authorized demo access approval');
  }
  const coordinator = accounts.find(account => account.view === 'coordinator');
  const priorCoordinator = ok(await admin.from('coordinator_profiles').select('user_id').eq('user_id', coordinator.id).maybeSingle(), 'read demo coordinator profile');
  if (!priorCoordinator) {
    ok(await admin.from('coordinator_profiles').insert({
      user_id: coordinator.id, application_status: 'verified', verified_at: new Date().toISOString(),
      service_area: 'Pune', languages: ['English', 'Hindi', 'Marathi'],
      qualifications: 'Synthetic staging coordinator for workflow testing',
      availability_note: 'Demo account - staging only',
    }), 'initialize demo coordinator');
  }
  // Care Physician medical credentials remain unverified. The user completes
  // the profile and an administrator reviews it through the normal workflow.
  for (const account of accounts) {
    const client = createClient(url, process.env.SUPABASE_PUBLISHABLE_KEY, options);
    try {
      const signed = ok(await client.auth.signInWithPassword({ email: account.email, password }), 'verify demo password sign-in');
      assert.equal(signed.user.id, account.id);
      assert.ok(signed.user.email_confirmed_at);
      const roles = ok(await client.from('user_roles').select('role').eq('user_id', account.id), 'verify own roles').map(row => row.role).sort();
      assert.deepEqual(roles, expectedRoles(account));
      const profile = ok(await client.from('profiles').select('full_name,view').eq('id', account.id).single(), 'verify dashboard profile');
      assert.equal(profile.full_name, account.name); assert.equal(profile.view, account.view);
      const isSuper = ok(await client.rpc('has_role', { _user_id: account.id, _role: 'super_admin' }), 'verify super-admin boundary');
      assert.equal(isSuper, account.role === 'super_admin');
      if (['provider', 'facility'].includes(account.role)) {
        const request = ok(await client.from('account_role_requests').select('status,requested_view').eq('user_id', account.id).single(), 'verify approved request');
        assert.equal(request.status, 'approved'); assert.equal(request.requested_view, account.view);
      }
      if (account.view === 'coordinator') {
        assert.equal(ok(await client.rpc('is_active_coordinator', { _user_id: account.id }), 'verify coordinator access'), true);
      }
      console.log(`PASS ${account.email} -> ${account.view} (${roles.join(', ')})`);
    } finally {
      await client.auth.signOut();
    }
  }
  console.log('All 20 requested staging demo accounts are configured and password logins verified. No invitation or confirmation emails sent.');
} catch (error) {
  console.error(`Demo setup stopped: ${error.message}. Any completed fixtures remain available; rerun safely with the same password after resolving the error.`);
  process.exitCode = 1;
}
