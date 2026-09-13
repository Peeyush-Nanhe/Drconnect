import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Chrome, until } from './test-post-consultation-chat-browser.mjs';

// Read-only HTTP/browser regression against the existing marked demo patient.
// No tokens/passwords, patient rows, or headers are written to evidence.
const project = 'pyrlvjeectjikvfksukb';
const url = process.argv.find(arg => arg.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:8081';
const expected = process.argv.includes('--expect-before') ? 400 : 200;
assert.ok(['localhost', '127.0.0.1'].includes(new URL(url).hostname));
assert.equal(process.env.VITE_SUPABASE_URL, `https://${project}.supabase.co`);
const output = 'docs/home-visits/evidence/hv-list';
await mkdir(output, { recursive: true });
const chrome = await Chrome.connect('http://127.0.0.1:9334');
let page;
const report = { checkedAt: new Date().toISOString(), project, application: url,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: 'Existing nonpilot account; read-only list and policy UI. Enabled home-visit lifecycles covered by local SQL regressions.',
  expectedHttpStatus: expected, checks: [], sourceHashes: [] };
const files = ['src/features/mydox/home-visits/HomeVisitPanel.tsx', 'src/features/mydox/home-visits/api.ts'];
for (const path of files) report.sourceHashes.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
const check = (name, assertion) => { assert.ok(assertion, name); report.checks.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); };
try {
  page = await chrome.page(url);
  await until(page, 'location.pathname === "/auth"', 'authentication redirects');
  await until(page, `(() => { const button = Array.from(document.querySelectorAll('button')).find(element => element.textContent.includes('One-Click Demo Patient Access')); if (!button || button.disabled) return false; button.click(); return true; })()`, 'existing demo patient login');
  await until(page, 'location.pathname === "/"', 'signed in');
  const result = await page.evaluate(`(async () => {
    const { supabase } = await import('/src/integrations/supabase/client.ts');
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.app_metadata?.careconnect_demo !== true || data.user?.app_metadata?.staging_project !== '${project}') throw new Error('Expected staging fixture only');
    const context = await supabase.rpc('hv_context');
    const list = await supabase.rpc('hv_list');
    return { contextEnabled: context.data?.enabled, status: list.status, code: list.error?.code ?? null,
      message: list.error?.message ?? null, isEmptyArray: Array.isArray(list.data) && list.data.length === 0 };
  })()`);
  report.response = result;
  check('Existing authenticated fixture remains outside the home-visit rollout', result.contextEnabled === false);
  check(`Actual POST hv_list returns HTTP ${expected}`, result.status === expected);
  if (expected === 400) {
    check('Original error is the policy exception, not malformed parameters', result.code === 'P0001' && result.message === 'Home visits are disabled pending approved pilot policies');
  } else {
    check('Disabled account receives an empty authorized list without an RPC error', result.isEmptyArray && result.code === null);
    // Count actual frontend RPCs after the direct endpoint probe. A disabled
    // panel must consult context, not repeatedly call restricted list/settings.
    await page.evaluate(`(() => {
      const original = window.fetch.bind(window);
      window.__hvListChecks = { list: 0, settings: 0, context: 0 };
      window.fetch = (input, init) => {
        const requestUrl = new URL(input instanceof Request ? input.url : String(input), location.href);
        const name = requestUrl.origin === 'https://${project}.supabase.co' && requestUrl.pathname.startsWith('/rest/v1/rpc/')
          ? requestUrl.pathname.split('/').at(-1) : null;
        if (name === 'hv_list') window.__hvListChecks.list += 1;
        if (name === 'hv_provider_settings') window.__hvListChecks.settings += 1;
        if (name === 'hv_context') window.__hvListChecks.context += 1;
        return original(input, init);
      };
    })()`);
    await until(page, `(() => { const button = Array.from(document.querySelectorAll('button')).find(element => element.textContent.trim() === 'Consult'); if (!button) return false; button.click(); return true; })()`, 'consult tab');
    await until(page, `(() => { const button = Array.from(document.querySelectorAll('button')).find(element => element.textContent.trim() === 'Consultation history'); if (!button) return false; button.click(); return true; })()`, 'consultation history');
    await until(page, `document.querySelector('[aria-label="Saved doctor home visits"]')?.textContent.includes('Real-patient use requires approved consent')`, 'normal unavailable policy state');
    await page.evaluate(`(() => { const panel = document.querySelector('[aria-label="Saved doctor home visits"]'); Array.from(panel.querySelectorAll('button')).find(button => button.textContent === 'Refresh')?.click(); window.dispatchEvent(new Event('focus')); })()`);
    await new Promise(done => setTimeout(done, 13000));
    const ui = await page.evaluate(`(() => { const panel = document.querySelector('[aria-label="Saved doctor home visits"]'); return { ...window.__hvListChecks, alerts: panel.querySelectorAll('[role="alert"]').length, loading: panel.textContent.includes('Loading saved home visits') }; })()`);
    report.ui = ui;
    check('History panel checks rollout context during load, refresh and polling', ui.context >= 2);
    check('Disabled panel does not request list or doctor settings', ui.list === 0 && ui.settings === 0);
    check('Unavailable history has no error alert or stuck loading indicator', ui.alerts === 0 && !ui.loading);
    const clip = await page.evaluate(`(() => { const panel = document.querySelector('[aria-label="Saved doctor home visits"]'); panel.scrollIntoView({block:'center'}); const rect = panel.getBoundingClientRect(); return {x: rect.x + window.scrollX, y: rect.y + window.scrollY, width: rect.width, height: rect.height, scale: 1}; })()`);
    await page.screenshot(`${output}/after.png`, clip);
  }
} catch (error) {
  report.checks.push({ name: error instanceof Error ? error.message : 'Verification failed', status: 'FAIL' });
  throw error;
} finally {
  report.sourceChangedDuringRun = (await Promise.all(report.sourceHashes.map(async file => createHash('sha256').update(await readFile(file.path)).digest('hex') !== file.sha256))).some(Boolean);
  await writeFile(`${output}/${expected === 400 ? 'before' : 'after'}.json`, `${JSON.stringify(report, null, 2)}\n`);
  if (page) {
    await page.evaluate(`(async () => { const { supabase } = await import('/src/integrations/supabase/client.ts'); await supabase.auth.signOut({scope:'local'}); })()`).catch(() => {});
    await page.close().catch(() => {});
  }
  chrome.close();
}
