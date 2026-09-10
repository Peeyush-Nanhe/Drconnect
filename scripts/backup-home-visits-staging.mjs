import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Recovery evidence for the additive home-visit rollout. This is a scoped data
// snapshot, not a substitute for Supabase's physical backup or a tested pg_dump.
// Auth users, credentials and device tokens are deliberately excluded.
const project = 'pyrlvjeectjikvfksukb';
const cli = process.env.SUPABASE_CLI_BIN || 'supabase';
const directory = resolve(process.argv.slice(2).find(arg => !arg.startsWith('--')) || '/tmp/mydox-home-visits-backups');
if (!process.argv.includes('--run')) throw new Error('Use --run to snapshot the approved staging project.');
mkdirSync(directory, { recursive: true, mode: 0o700 });
const sql = `begin transaction isolation level repeatable read read only;
select jsonb_build_object(
  'project', '${project}', 'captured_at', now(),
  'migrations', (select jsonb_agg(to_jsonb(m)) from supabase_migrations.schema_migrations m),
  'columns', (select jsonb_agg(to_jsonb(c)) from information_schema.columns c where table_schema in ('public','private')),
  'constraints', (select jsonb_agg(jsonb_build_object('table', conrelid::regclass::text, 'name', conname, 'definition', pg_get_constraintdef(oid))) from pg_constraint where connamespace in ('public'::regnamespace,'private'::regnamespace)),
  'functions', (select jsonb_agg(pg_get_functiondef(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'),
  'triggers', (select jsonb_agg(pg_get_triggerdef(t.oid)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and not t.tgisinternal),
  'policies', (select jsonb_agg(to_jsonb(p)) from pg_policies p where schemaname in ('public','private')),
  'grants', (select jsonb_agg(to_jsonb(g)) from information_schema.role_table_grants g where table_schema in ('public','private')),
  'indexes', (select jsonb_agg(to_jsonb(i)) from pg_indexes i where schemaname in ('public','private')),
  'doctor_appointments', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.doctor_appointments a),
  'provider_availability', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.provider_availability a),
  'care_requests', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.care_requests a),
  'staffing_assignments', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.staffing_assignments a),
  'staffing_jobs', (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from public.staffing_jobs a)
) as snapshot;
commit;`;
const queryPath = join(directory, 'snapshot-query.sql');
writeFileSync(queryPath, sql, { mode: 0o600 });
const result = execFileSync(cli, ['db', 'query', '--linked', '--project-ref', project, '--file', queryPath], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const start = result.indexOf('{');
const parsed = JSON.parse(result.slice(start));
const snapshot = parsed.rows?.[0]?.snapshot;
if (snapshot?.project !== project || !Array.isArray(snapshot.migrations)) throw new Error('Snapshot response did not include the expected project and history.');
const content = JSON.stringify(snapshot, null, 2);
const path = join(directory, `before-home-visits-${Date.now()}.json`);
writeFileSync(path, content, { mode: 0o600 });
console.log(JSON.stringify({ path, sha256: createHash('sha256').update(content).digest('hex'), bytes: Buffer.byteLength(content), migrationCount: snapshot.migrations.length }));
