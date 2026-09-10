import { execFileSync, spawnSync } from 'node:child_process';

// Optional local operator runner when the preserved .env has no server key.
// Credentials are captured in process memory and passed only to the test child.
// They are never logged, written to disk, or exposed to the browser bundle.
const project = 'pyrlvjeectjikvfksukb';
if (process.env.SUPABASE_URL !== `https://${project}.supabase.co`) throw new Error('Load the approved staging .env before using this runner.');
const suite = process.argv[2];
if (!['existing', 'home'].includes(suite)) throw new Error('Choose existing or home synthetic tests.');
const cli = process.env.SUPABASE_CLI_BIN || 'supabase';
let secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!secret) {
  let raw;
  try {
    raw = execFileSync(cli, ['projects', 'api-keys', '--project-ref', project, '--reveal', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error('Unable to obtain the approved staging test credential through the authenticated CLI. No credential values were logged.');
  }
  let parsed;
  try { parsed = JSON.parse(raw.slice(Math.min(...['[', '{'].map(character => raw.indexOf(character)).filter(index => index >= 0)))); }
  catch { throw new Error('Staging credential response was not recognized. No values were logged.'); }
  const keys = Array.isArray(parsed) ? parsed : parsed.api_keys || parsed.keys || parsed.data || [];
  const candidate = keys.find(item => item.name === 'service_role' || item.role === 'service_role') || keys.find(item => item.type === 'secret');
  secret = candidate?.api_key || candidate?.key;
  if (!secret || secret.includes('...') || secret.includes('***')) throw new Error('An unmasked server credential is unavailable. No values were logged.');
  raw = undefined;
  parsed = undefined;
}
const args = suite === 'home'
  ? ['--env-file=.env', 'scripts/test-home-visits-staging.mjs', '--run', ...process.argv.slice(3).filter(arg => ['--browser', '--browser-only'].includes(arg))]
  : ['--env-file=.env', 'scripts/test-staging.mjs', '--run'];
const result = spawnSync(process.execPath, args, { env: { ...process.env, SUPABASE_SERVICE_ROLE_KEY: secret }, stdio: 'inherit' });
secret = undefined;
if (result.error) throw new Error('Unable to launch the synthetic staging test process.');
process.exitCode = result.status ?? 1;
