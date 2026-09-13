import { createClient } from '@supabase/supabase-js';

const ref = 'pyrlvjeectjikvfksukb';
const url = process.env.SUPABASE_URL || `https://${ref}.supabase.co`;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required in environment variables.');
  process.exit(1);
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);

const dummyAccounts = [
  {
    email: 'nurse.dummy@careconnect.health',
    name: 'Dummy Nurse Leela',
    role: 'provider',
    view: 'medico'
  },
  {
    email: 'hospital.dummy@careconnect.health',
    name: 'Dummy City Hospital',
    role: 'facility',
    view: 'hub'
  }
];

function ok(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function seed() {
  console.log('Seeding dummy accounts...');
  const password = process.env.MYDOX_DEMO_PASSWORD || 'DummyPassword123!';

  for (const account of dummyAccounts) {
    // Check if user already exists
    let existingUser = null;
    const { data: { users }, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;

    existingUser = users.find(u => u.email?.toLowerCase() === account.email.toLowerCase());

    const values = {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: account.name,
        role: account.role,
        subtype: account.view
      },
      app_metadata: {
        careconnect_demo: true,
        is_dummy: true,
        staging_project: ref
      },
    };

    const data = existingUser
      ? ok(await admin.auth.admin.updateUserById(existingUser.id, values), `Update dummy account ${account.email}`)
      : ok(await admin.auth.admin.createUser({ email: account.email, ...values }), `Create dummy account ${account.email}`);

    const userId = data.user.id;

    // Upsert profile
    ok(await admin.from('profiles').upsert({ id: userId, full_name: account.name, view: account.view }), `Set profile for ${account.email}`);

    // Grant roles (always grant patient, plus specific role)
    const rolesToGrant = ['patient', account.role];
    ok(await admin.from('user_roles').upsert(rolesToGrant.map(role => ({ user_id: userId, role })), { onConflict: 'user_id,role', ignoreDuplicates: true }), `Grant roles to ${account.email}`);

    // Record approved role request
    ok(await admin.from('account_role_requests').upsert({
      user_id: userId,
      requested_role: account.role,
      requested_view: account.view,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    }), `Approve role request for ${account.email}`);

    console.log(`Successfully configured ${account.email} with password: ${password}`);
  }
  console.log('Seeding completed successfully.');
}

async function cleanup() {
  console.log('Cleaning up all dummy accounts...');
  let count = 0;

  for (let page = 1; ; page++) {
    const { data: { users }, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    if (!users || users.length === 0) break;

    const dummies = users.filter(u => u.app_metadata?.is_dummy === true);
    for (const dummy of dummies) {
      console.log(`Deleting dummy user: ${dummy.email}`);
      await admin.auth.admin.deleteUser(dummy.id);
      count++;
    }

    if (users.length < 200) break;
  }

  console.log(`Cleanup completed. Deleted ${count} dummy accounts.`);
}

const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--cleanup') ? 'cleanup' : null;

if (mode === 'seed') {
  await seed();
} else if (mode === 'cleanup') {
  await cleanup();
} else {
  console.error('Please specify either --seed or --cleanup flag.');
  process.exit(1);
}
