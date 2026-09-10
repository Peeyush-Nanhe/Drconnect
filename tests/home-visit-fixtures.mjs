import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

export const consentVersion = 'home-visit-v1-staging-proposal';
export const address = {
  full_address: 'Synthetic test house, Example Road',
  locality: 'Synthetic test locality',
  pincode: '411001',
  phone: '9999999999',
  landmark: 'Synthetic access information',
};
export const workingHours = Object.fromEntries(
  ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => [day, [{ start: '00:00', end: '23:59' }]]),
);
export const providerSettings = {
  enabled: true,
  coverage_pincodes: ['411001'],
  fee: 500,
  currency: 'INR',
  duration_minutes: 30,
  buffer_before_minutes: 15,
  buffer_after_minutes: 15,
  lead_minutes: 30,
  horizon_days: 30,
  acceptance_minutes: 15,
  timezone: 'Asia/Kolkata',
};

// This is PostgreSQL execution, but PGlite has one serial connection. Race proof
// belongs in scripts/test-home-visits-staging.mjs using independent Auth sessions.
export async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (
      id uuid primary key, email text, phone text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    create publication supabase_realtime;
  `);
  const directory = new URL('../staging/supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter(file => file.endsWith('.sql')).sort()) {
    await db.transaction(async transaction => transaction.exec(await readFile(new URL(file, directory), 'utf8')));
  }
  async function actor(id, sql, params = [], role = 'authenticated') {
    assert.ok(['authenticated', 'anon', 'service_role'].includes(role));
    return db.transaction(async transaction => {
      await transaction.query("select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)", [id ?? '', role]);
      await transaction.exec(`set local role ${role}`);
      return transaction.query(sql, params);
    });
  }
  async function rpc(id, name, input) {
    assert.match(name, /^hv_[a-z_]+$/);
    try {
      return (await actor(id, `select public.${name}($1::jsonb) as result`, [JSON.stringify(input)])).rows[0].result;
    } catch (error) {
      // PGlite attaches SQL parameters to errors. Do not let a test reporter
      // print an issued one-time code or encounter payload on an unexpected failure.
      throw new Error(`${name}: ${error.message}`);
    }
  }
  return { db, actor, rpc };
}
