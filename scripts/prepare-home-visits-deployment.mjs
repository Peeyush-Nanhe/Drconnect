import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Prepare a reviewed, all-or-nothing rollout. The two historical pending files
// must not expose their unsafe intermediate RPCs between separate commits.
// This script only reads staging and writes a private SQL artifact; it does not
// apply DDL. Execute the artifact only after backup and the acceptance checks.
const project = 'pyrlvjeectjikvfksukb';
const cli = process.env.SUPABASE_CLI_BIN || 'supabase';
const rollout = [
  '20260910141736_phase_f_reschedule.sql',
  '20260910183000_doctor_home_visit_flow.sql',
  '20260910183100_secure_home_visit_lifecycle.sql',
  '20260910183200_home_visit_hosted_permissions.sql',
  '20260910183300_home_visit_active_capacity.sql',
  '20260910183400_home_visit_hold_expiry_audit.sql',
];
const expected = ['20260907094744', '20260907095735', '20260907103546', '20260910131000'];
const query = "select version,name,md5(array_to_string(statements,E'\\n')) as checksum from supabase_migrations.schema_migrations order by version";
const result = execFileSync(cli, ['db', 'query', '--linked', '--project-ref', project, query], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const rows = JSON.parse(result.slice(result.indexOf('{'))).rows;
const versions = rows.map(row => row.version);
const complete = [...expected, ...rollout.map(name => name.split('_')[0])];
if (JSON.stringify(versions) !== JSON.stringify(complete.slice(0, versions.length)) || ![4, 7, 8, 9, 10].includes(versions.length)) throw new Error('Staging migration history differs from the reviewed rollout. Re-audit; do not repair history.');
for (const name of rollout) {
  const applied = rows.find(row => row.version === name.split('_')[0]);
  if (!applied) continue;
  const source = readFileSync(new URL(`../staging/supabase/migrations/${name}`, import.meta.url), 'utf8');
  if (applied.checksum !== createHash('md5').update(source).digest('hex')) throw new Error(`Applied source changed: ${name}. Add a migration; do not rewrite history.`);
}
if (versions.length === complete.length) { console.log('All reviewed home-visit migrations are already applied; their source checksums match.'); process.exit(0); }
const pending = rollout.slice(versions.length - expected.length);
const literal = value => `'${String(value).replaceAll("'", "''")}'`;
const guards = rows.map(row => `IF NOT EXISTS(SELECT 1 FROM supabase_migrations.schema_migrations WHERE version=${literal(row.version)} AND md5(array_to_string(statements,E'\\n'))=${literal(row.checksum)}) THEN RAISE EXCEPTION 'Existing migration checksum changed'; END IF;`).join('\n');
let sql = `BEGIN;\nSET LOCAL lock_timeout='15s';\nSET LOCAL statement_timeout='120s';\nSELECT pg_advisory_xact_lock(hashtextextended('mydox-home-visit-rollout',0));\nDO $guard$ BEGIN\nIF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>${rows.length} THEN RAISE EXCEPTION 'Migration history changed'; END IF;\n${guards}\nEND $guard$;\n`;
const manifest = [];
for (const name of pending) {
  const source = readFileSync(new URL(`../staging/supabase/migrations/${name}`, import.meta.url), 'utf8');
  if (!source.trim()) throw new Error(`Empty migration: ${name}`);
  const [version, ...parts] = name.replace(/\.sql$/, '').split('_');
  sql += `\n-- ${name}\n${source}\nINSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES (${literal(version)},${literal(parts.join('_'))},ARRAY[${literal(source)}]);\n`;
  manifest.push({ name, sha256: createHash('sha256').update(source).digest('hex') });
}
sql += "NOTIFY pgrst, 'reload schema';\nCOMMIT;\n";
const path = resolve('/tmp/mydox-home-visits-deployment.sql');
writeFileSync(path, sql, { mode: 0o600 });
writeFileSync(`${path}.manifest.json`, JSON.stringify({ project, baseline: rows, migrations: manifest }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ project, artifact: path, migrations: manifest, note: 'PREPARED ONLY. Back up and pass local checks before applying this single transaction.' }));
