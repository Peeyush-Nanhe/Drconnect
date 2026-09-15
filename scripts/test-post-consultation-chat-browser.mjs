import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Actual local TanStack development build + the approved hosted staging backend.
// Uses an isolated Chrome context. Never prints credentials, cookies or tokens.
const project = 'pyrlvjeectjikvfksukb';
const delay = milliseconds => new Promise(done => setTimeout(done, milliseconds));

export class Chrome {
  constructor(socket) {
    this.socket = socket;
    this.next = 0;
    this.pending = new Map();
    socket.addEventListener('message', ({ data }) => {
      const result = JSON.parse(String(data));
      const pending = this.pending.get(result.id);
      if (!pending) return;
      this.pending.delete(result.id);
      clearTimeout(pending.timer);
      if (result.error) pending.reject(new Error('Chrome command failed; sensitive details withheld.'));
      else pending.resolve(result.result);
    });
  }
  static async connect(endpoint) {
    const response = await fetch(`${endpoint}/json/version`);
    if (!response.ok) throw new Error('Isolated Chrome debugging endpoint unavailable.');
    const { webSocketDebuggerUrl } = await response.json();
    const socket = new WebSocket(webSocketDebuggerUrl);
    await new Promise((done, fail) => {
      socket.addEventListener('open', done, { once: true });
      socket.addEventListener('error', () => fail(new Error('Chrome connection failed.')), { once: true });
    });
    return new Chrome(socket);
  }
  command(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((done, fail) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        fail(new Error(`Chrome timed out: ${method}`));
      }, 20000);
      this.pending.set(id, { resolve: done, reject: fail, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async page(url) {
    const { browserContextId } = await this.command('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await this.command('Target.createTarget', { url, browserContextId });
    const { sessionId } = await this.command('Target.attachToTarget', { targetId, flatten: true });
    await this.command('Page.enable', {}, sessionId);
    await this.command('Runtime.enable', {}, sessionId);
    await this.command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    return {
      evaluate: async expression => {
        const response = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (response.exceptionDetails) throw new Error('Browser evaluation failed; sensitive details withheld.');
        return response.result?.value;
      },
      screenshot: async (path, clip) => {
        const { data } = await this.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, ...(clip ? { clip } : {}) }, sessionId);
        await writeFile(path, Buffer.from(data, 'base64'));
      },
      close: () => this.command('Target.disposeBrowserContext', { browserContextId }),
    };
  }
  close() { this.socket.close(); }
}

export async function until(page, expression, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await page.evaluate(expression)) return; } catch { /* Navigation replaces the runtime. */ }
    await delay(200);
  }
  console.log(`Browser diagnostic: ${await page.evaluate(`JSON.stringify({path:location.pathname,headings:Array.from(document.querySelectorAll('h1,h2')).map(element=>element.textContent.slice(0,70)),buttons:Array.from(document.querySelectorAll('button')).filter(element=>element.getClientRects().length).map(element=>element.textContent.trim().slice(0,45)).slice(0,25)})`).catch(() => 'unavailable')}`);
  throw new Error(`Browser check timed out: ${label}`);
}

export async function runPostConsultationChatBrowser({
  url = 'http://127.0.0.1:8081',
  cdp = 'http://127.0.0.1:9333',
  output = resolve('docs/post-consultation-chat/evidence'),
  existingDemo = false,
  demoButton = false,
} = {}) {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'Only a local tested build is supported by this harness.');
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(cdp).hostname), 'Use an isolated local Chrome instance.');
  if (existingDemo) {
    assert.equal(process.env.SUPABASE_URL, `https://${project}.supabase.co`, 'Server must use the approved staging project.');
    assert.equal(process.env.VITE_SUPABASE_URL, `https://${project}.supabase.co`, 'Browser must use the approved staging project.');
    if (!demoButton) assert.ok(process.env.MYDOX_DEMO_PASSWORD, 'Existing synthetic-login password is unavailable.');
  }
  await mkdir(output, { recursive: true });
  const chrome = await Chrome.connect(cdp);
  let page;
  const checks = [];
  const pass = name => { checks.push({ name, status: 'PASS' }); console.log(`PASS browser: ${name}`); };
  const report = {
    capturedAt: new Date().toISOString(),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingTree: 'Local working-tree build; commit alone does not identify uncommitted changes.',
    application: url,
    backendProject: existingDemo ? project : 'Not authenticated in this run',
    scope: 'Authentication and gated chat entry only; no completed-consultation, two-party, file, payment, call or background-delivery proof.',
    checks,
    sourceHashes: [],
  };
  try {
    const files = [
      'src/routes/auth.tsx', 'src/routes/index.tsx', 'src/routes/bookings.tsx',
      'src/features/mydox/MyDoxFull.jsx', 'src/features/mydox/PatientDashboard.tsx',
      'src/features/mydox/TwoWayChatModal.tsx',
      ...['types.ts', 'state.ts', 'api.ts', 'recovery.ts', 'usePostConsultationChat.ts'].map(name => `src/features/mydox/post-consultation-chat/${name}`),
      ...(await readdir('staging/supabase/migrations')).filter(name => name.includes('post_consultation_chat')).map(name => `staging/supabase/migrations/${name}`),
    ];
    report.sourceHashes = await Promise.all(files.map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })));
    page = await chrome.page(`${url}/`);
    await until(page, 'location.pathname === "/auth" && document.readyState === "complete"', 'signed-out account redirects to authentication');
    await until(page, '!!document.querySelector("input")', 'actual sign-in form visible');
    pass('Signed-out application redirects to sign-in');
    await page.screenshot(resolve(output, '01-signed-out-auth.png'));
    if (!existingDemo) return report;

    // Reuse only the owner-established patient fixture. Never provision/reset/upgrade an account.
    if (demoButton) {
      await until(page, `(() => { const button = Array.from(document.querySelectorAll('button')).find(element => element.textContent.includes('One-Click Demo Patient Access')); if (!button || button.disabled) return false; button.click(); return true; })()`, 'existing synthetic patient button available');
      await until(page, 'location.pathname === "/"', 'existing demo button signs in');
    }
    const authenticated = await page.evaluate(`(async () => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      const result = ${demoButton ? 'await supabase.auth.getUser()' : `await supabase.auth.signInWithPassword({ email: 'patient1@demo.med', password: ${JSON.stringify(process.env.MYDOX_DEMO_PASSWORD)} })`};
      const user = result.data?.user;
      const allowed = !result.error && user?.app_metadata?.careconnect_demo === true && user?.app_metadata?.staging_project === ${JSON.stringify(project)};
      if (!allowed) await supabase.auth.signOut({ scope: 'local' });
      return { signedIn: !result.error, fixtureMarked: user?.app_metadata?.careconnect_demo === true, projectMatches: user?.app_metadata?.staging_project === ${JSON.stringify(project)} };
    })()`);
    assert.equal(authenticated?.signedIn, true, 'Existing synthetic fixture login is unavailable with the preserved local configuration.');
    assert.equal(authenticated?.fixtureMarked, true, 'Existing account must be marked as a synthetic fixture.');
    assert.equal(authenticated?.projectMatches, true, 'Existing fixture must belong to the approved staging project.');
    pass('Existing marked staging patient authenticates without account changes');
    const gate = await page.evaluate(`(async () => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      const result = await supabase.rpc('pc_chat_context');
      return { backendHostname: new URL(supabase.supabaseUrl).hostname, error: !!result.error, enabled: result.data?.enabled, testOnly: result.data?.test_only,
        advancedDisabled: ['attachments_enabled', 'calls_enabled', 'payments_enabled', 'prescription_issuance_enabled', 'notifications_enabled'].every(key => result.data?.[key] === false) };
    })()`);
    assert.equal(gate.backendHostname, `${project}.supabase.co`, 'Actual browser client uses the approved staging backend.');
    assert.equal(gate.error, false, 'Deployed staging chat context responds.');
    assert.equal(gate.enabled, false, 'Existing demo patient is outside the explicit synthetic chat allowlist.');
    assert.equal(gate.testOnly, true, 'Server policy remains test-only.');
    assert.equal(gate.advancedDisabled, true, 'Unconfigured attachments, calls, payments, issuance and notifications remain disabled.');
    pass('Actual staging context confirms rollout and all unfinished integrations disabled');
    const denial = await page.evaluate(`(async () => {
      const { supabase } = await import('/src/integrations/supabase/client.ts');
      const { data: actor } = await supabase.auth.getUser();
      const conversation = crypto.randomUUID();
      const episode = crypto.randomUUID();
      const inbox = await supabase.rpc('pc_chat_inbox');
      const open = await supabase.rpc('pc_chat_open', { p_input: { source_kind: 'doctor_appointment', source_id: crypto.randomUUID() } });
      const send = await supabase.rpc('pc_chat_send', { p_input: { conversation_id: conversation, episode_id: episode, body: 'Synthetic denied permission check; no care requested.', idempotency_key: crypto.randomUUID() } });
      const insert = await supabase.from('chat_messages').insert({ id: crypto.randomUUID(), thread_key: 'consultation:' + conversation, conversation_id: conversation, episode_id: episode,
        sender_id: actor.user.id, recipient_id: crypto.randomUUID(), sender_role: 'patient', body: 'Synthetic denied permission check; no care requested.', idempotency_key: crypto.randomUUID() });
      const ledger = await supabase.from('chat_message_debits').select('message_id').limit(1);
      return { inboxEmpty: !inbox.error && Array.isArray(inbox.data) && inbox.data.length === 0, openCode: open.error?.code, sendCode: send.error?.code, insertCode: insert.error?.code, ledgerCode: ledger.error?.code };
    })()`);
    assert.equal(denial.inboxEmpty, true, 'The non-allowlisted synthetic account has no canonical inbox rows.');
    assert.equal(denial.openCode, '42501', 'Opening an arbitrary consultation is denied by the server.');
    assert.equal(denial.sendCode, '42501', 'Sending into an arbitrary conversation is denied by the server.');
    assert.ok(['42501', '23503'].includes(denial.insertCode), 'Direct canonical insert is denied by RLS or immutable foreign keys.');
    assert.equal(denial.ledgerCode, '42501', 'Privileged debit ledger cannot be read by the patient.');
    pass('Authenticated staging denies arbitrary open/send/direct insert and privileged ledger access');
    await page.navigate(`${url}/`);
    await until(page, 'location.pathname === "/" && !document.body.textContent.includes("Loading MyDox") && !!document.querySelector("button")', 'patient home loaded');
    await page.screenshot(resolve(output, '02-authenticated-patient-home.png'));
    await until(page, `(() => { const button = Array.from(document.querySelectorAll('nav[aria-label="Main navigation"] button')).find(element => element.textContent.trim() === 'Consult'); if (!button) return false; button.click(); return true; })()`, 'preserved Consult navigation opens conversations');
    await until(page, 'document.body.textContent.includes("Your Doctors")', 'actual consultation inbox mounted');
    await until(page, `(() => { const heading = Array.from(document.querySelectorAll('p,h2,h3')).find(element => /Chats.*Your Doctors/.test(element.textContent)); return heading && !heading.parentElement.parentElement.textContent.includes('Loading consultations'); })()`, 'consultation inbox completed its server query');
    await page.evaluate(`(() => { const label = Array.from(document.querySelectorAll('p,h2,h3')).find(element => /Chats.*Your Doctors/.test(element.textContent)); label?.scrollIntoView({ block: 'start' }); })()`);
    await delay(300);
    await page.screenshot(resolve(output, '02-authenticated-patient-inbox.png'));
    const inbox = await page.evaluate(`(() => {
      const heading = Array.from(document.querySelectorAll('p,h2,h3')).find(element => /Chats.*Your Doctors/.test(element.textContent));
      const root = heading?.parentElement?.parentElement;
      return { present: !!root, unavailable: /unavailable|not available|not enabled|not configured|could not|unable|retry|no conversations|no authorised consultation|no consultation|completed consultation/i.test(root?.textContent || ''), fakeTyping: /typing…|typing\.\.\./i.test(root?.textContent || '') };
    })()`);
    assert.equal(inbox.present, true, 'Patient has the preserved chat entry.');
    assert.equal(inbox.unavailable, true, 'Unapproved or unconfigured inbox explicitly shows unavailable/empty state.');
    assert.equal(inbox.fakeTyping, false, 'Gated inbox has no invented typing state.');
    pass('Patient consultation inbox exposes a truthful gated/empty state');
    await page.reload();
    await until(page, `(() => { const button = Array.from(document.querySelectorAll('nav[aria-label="Main navigation"] button')).find(element => element.textContent.trim() === 'Consult'); if (!button) return false; button.click(); return true; })()`, 'Consult navigation remains available after reload');
    await until(page, 'document.body.textContent.includes("Your Doctors")', 'authenticated patient home survives reload');
    pass('Existing authenticated patient can reload the actual application');

    await until(page, `(() => { const button = Array.from(document.querySelectorAll('button')).find(element => element.textContent.trim() === 'Consultation history'); if (!button) return false; button.click(); return true; })()`, 'preserved consultation-history entry opens');
    await until(page, 'document.body.textContent.includes("Completed home consultations") && Array.from(document.querySelectorAll("button")).some(element => element.textContent.includes("OTP pending"))', 'real previous-consultations panel visible');
    await delay(500);
    await page.screenshot(resolve(output, '03-previous-consultations-gated.png'));
    pass('Previous-consultations entry remains available to the authenticated patient');
    const legacyChatPresent = await page.evaluate(`!!document.querySelector('button[aria-label="Chat"]')`);
    if (legacyChatPresent) {
      await page.evaluate(`document.querySelector('button[aria-label="Chat"]').click()`);
      await until(page, `!!document.querySelector('[role="dialog"] [role="alert"]') && !document.querySelector('[role="dialog"] [aria-busy="true"]')`, 'legacy completed-item chat reports the server access gate');
      const gated = await page.evaluate(`(() => { const dialog = document.querySelector('[role="dialog"]'); return { noMessages: !dialog?.querySelector('[role="log"] [data-message-id]'), composerDisabled: dialog?.querySelector('textarea')?.disabled === true, gateVisible: /restricted|approval|not available|not integrated|authorised/i.test(dialog?.querySelector('[role="alert"]')?.textContent || '') }; })()`);
      assert.equal(gated.composerDisabled, true, 'Gated chat cannot compose a patient message.');
      assert.equal(gated.gateVisible, true, 'Opening legacy completion visibly explains the server gate.');
      await page.screenshot(resolve(output, '04-completed-item-chat-gated.png'));
      pass('Completed legacy item opens the real chat modal with server denial and disabled composer');
      await page.evaluate(`document.querySelector('button[aria-label="Close chat"]').click()`);
    }

    await page.evaluate(`(async () => { const { supabase } = await import('/src/integrations/supabase/client.ts'); await supabase.auth.signOut({ scope: 'local' }); })()`);
    await until(page, 'location.pathname === "/auth"', 'sign-out returns to authentication');
    pass('Sign-out removes authenticated patient navigation');
    return report;
  } catch (error) {
    checks.push({ name: error instanceof Error ? error.message : 'Browser check failed', status: 'FAIL' });
    throw error;
  } finally {
    report.sourceChangedDuringRun = (await Promise.all(report.sourceHashes.map(async file => createHash('sha256').update(await readFile(file.path)).digest('hex') !== file.sha256))).some(Boolean);
    await writeFile(resolve(output, 'browser-smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
    if (page) await page.close().catch(() => {});
    chrome.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runPostConsultationChatBrowser({ url: process.argv.find(argument => argument.startsWith('--url='))?.slice(6), existingDemo: process.argv.includes('--existing-demo'), demoButton: process.argv.includes('--demo-button') });
}
