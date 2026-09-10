import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Real Chrome + hosted Supabase, with separate browser contexts for the synthetic actors.
// Credentials and one-time codes stay in memory. This script never prints them.
class Chrome {
  constructor(socket) {
    this.socket = socket; this.next = 0; this.pending = new Map();
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(String(data));
      if (!message.id) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id); clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(`Chrome command failed: ${message.error.message}`));
      else pending.resolve(message.result);
    });
  }
  static async connect(endpoint) {
    const version = await fetch(`${endpoint}/json/version`).then(r => r.json());
    const socket = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', () => reject(new Error('Chrome connection failed')), { once: true }); });
    return new Chrome(socket);
  }
  command(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`Chrome timeout: ${method}`)); }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async page(url, timezone) {
    const { browserContextId } = await this.command('Target.createBrowserContext', { disposeOnDetach: true });
    const { targetId } = await this.command('Target.createTarget', { url, browserContextId });
    const { sessionId } = await this.command('Target.attachToTarget', { targetId, flatten: true });
    await this.command('Page.enable', {}, sessionId);
    await this.command('Runtime.enable', {}, sessionId);
    if (timezone) await this.command('Emulation.setTimezoneOverride', { timezoneId: timezone }, sessionId);
    const chrome = this;
    return {
      context: browserContextId,
      async evaluate(expression) {
        const response = await chrome.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
        if (response.exceptionDetails) throw new Error('Browser evaluation failed (details withheld to protect fixture credentials)');
        return response.result?.value;
      },
      navigate: url => chrome.command('Page.navigate', { url }, sessionId),
      reload: () => chrome.command('Page.reload', { ignoreCache: true }, sessionId),
      close: () => chrome.command('Target.disposeBrowserContext', { browserContextId }),
    };
  }
  close() { this.socket.close(); }
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(page, expression, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { if (await page.evaluate(expression)) return; } catch { /* Navigation can replace the JS context. */ }
    await pause(150);
  }
  const diagnostics = await page.evaluate(`JSON.stringify({path:location.pathname,ready:document.readyState,headings:Array.from(document.querySelectorAll('h1,h2')).map(el=>el.textContent.slice(0,80)),checkingAccount:document.body.textContent.includes('Checking your account'),errorPage:document.body.textContent.includes("This page didn't load"),actionErrors:Array.from(document.querySelectorAll('.hv-error')).map(el=>el.textContent.slice(0,180)),buttons:Array.from(document.querySelectorAll('button')).map(el=>el.textContent.trim().slice(0,60)).slice(0,12)})`).catch(() => 'unavailable');
  console.log(`Browser diagnostic: ${diagnostics}`);
  throw new Error(`Browser acceptance timed out: ${label}`);
}
const scope = id => id ? `Array.from(document.querySelectorAll('article')).find(el => el.textContent.includes(${JSON.stringify(`Booking ID: ${id}`)}))` : 'document';
async function click(page, label, id) {
  const expression = `(() => { const root=${scope(id)}; const button=Array.from(root?.querySelectorAll('button') || []).find(el=>el.textContent.trim()===${JSON.stringify(label)} && el.getClientRects().length && !el.disabled); if(!button) return false; button.click(); return true; })()`;
  await until(page, expression, `button ${label}`);
  await pause(100);
}
async function field(page, label, value, id) {
  const result = await page.evaluate(`(() => {
    const root=${scope(id)};
    const label=Array.from(root?.querySelectorAll('label') || []).find(el=>el.textContent.trim().startsWith(${JSON.stringify(label)}));
    const input=label?.querySelector('input,textarea,select'); if(!input) return false;
    const prototype=input.tagName==='SELECT'?HTMLSelectElement.prototype:input.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(input,${JSON.stringify(value)});
    input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); return true;
  })()`);
  assert.equal(result, true, `Field is visible: ${label}`);
  await pause(80);
}
async function checkbox(page, label, id) {
  await until(page, `(() => { const root=${scope(id)}; const input=Array.from(root?.querySelectorAll('label')||[]).find(el=>el.textContent.includes(${JSON.stringify(label)}))?.querySelector('input[type=checkbox]'); if(!input)return false; if(!input.checked) input.click(); return true; })()`, 'consent/collection acknowledgement');
}
async function signedInPage(chrome, url, credentials, timezone) {
  const page = await chrome.page(`${url}/auth`, timezone);
  await until(page, 'document.readyState === "complete"', 'auth page loaded');
  const ok = await page.evaluate(`(async()=>{const {supabase}=await import('/src/integrations/supabase/client.ts'); const {error}=await supabase.auth.signInWithPassword(${JSON.stringify(credentials)}); return !error;})()`);
  assert.equal(ok, true, 'Synthetic account signs in');
  await page.navigate(`${url}/home-visits`);
  await until(page, 'document.body.textContent.includes("Doctor home visits") && !!document.querySelector("button")', 'home visits page loaded');
  return page;
}
async function state(page, id, expected) {
  await until(page, `(() => { const buttons=Array.from(document.querySelectorAll('button')).filter(el=>el.textContent.trim()==='Refresh' && !el.disabled); if(!buttons.length)return false; buttons.forEach(el=>el.click()); return true; })()`, 'dashboard refresh');
  await until(page, `(() => { const card=${scope(id)}; return card?.querySelector('.hv-status')?.textContent.trim()===${JSON.stringify(expected)}; })()`, `saved status ${expected}`);
}
async function closeBooking(page) {
  await page.evaluate(`document.querySelector('[aria-label="Close home visit"]')?.click()`);
  await pause(100);
}
async function requestVisit(page, { doctorId, pincode, date, now, rejectFirst = false }) {
  await click(page, now ? 'Visit Now' : 'Book for Later');
  await until(page, '!!Array.from(document.querySelectorAll("label")).find(el=>el.textContent.startsWith("Full home address"))', 'booking form enabled');
  await field(page, 'Full home address', '100 Synthetic Home Visit Test Street');
  await field(page, 'Locality', 'Synthetic Test Locality');
  await field(page, 'Pincode', pincode);
  await field(page, 'Contact phone', '9000000000');
  await field(page, 'Landmark', 'Synthetic test fixture; do not dispatch');
  await field(page, 'Reason for visit', rejectFirst ? 'xx' : 'Synthetic browser acceptance test — no real care requested');
  if (!now) await field(page, 'Appointment date', date);
  await click(page, 'Check actual availability');
  await until(page, `!!document.querySelector('select option[value="${doctorId}"]')`, 'eligible real provider discovery');
  await field(page, 'Doctor', doctorId);
  if (!now) {
    const value = await page.evaluate(`Array.from(document.querySelectorAll('label')).find(el=>el.textContent.startsWith('Published slot'))?.querySelector('select option:nth-child(3)')?.value`);
    assert.ok(value, 'At least two actual future slots are published');
    await field(page, 'Published slot', value);
  }
  await click(page, 'Review server quote');
  await until(page, 'document.body.textContent.includes("Review your request")', 'server quote displayed');
  await checkbox(page, 'I have read and agree');
  await click(page, 'Save pending home-visit request');
  if (rejectFirst) {
    await until(page, `!!document.querySelector('.hv-error') && !Array.from(document.querySelectorAll('label')).find(el=>el.textContent.startsWith('Reason for visit'))?.querySelector('textarea')?.closest('fieldset')?.disabled`, 'rejected transaction keeps form editable');
    await field(page, 'Reason for visit', 'Synthetic browser acceptance test — corrected form');
    await click(page, 'Review server quote');
    await until(page, 'document.body.textContent.includes("Review your request")', 'corrected server quote displayed');
    await checkbox(page, 'I have read and agree');
    await click(page, 'Save pending home-visit request');
  }
  await until(page, '!!document.querySelector(".hv-success")', 'one real pending booking saved');
  const id = await page.evaluate(`document.querySelector('.hv-success').textContent.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/)?.[0]`);
  assert.ok(id, 'UI returns canonical Supabase booking UUID');
  await closeBooking(page);
  await state(page, id, 'pending');
  return id;
}

export async function runHomeVisitBrowser({ url = 'http://127.0.0.1:8081', cdp = 'http://127.0.0.1:9333', patient, doctor, doctorId, pincode, date }) {
  const chrome = await Chrome.connect(cdp);
  const pages = [];
  const evidence = [];
  const pass = label => { evidence.push({ status: 'PASS', label }); console.log(`PASS browser: ${label}`); };
  try {
    const p = await signedInPage(chrome, url, patient, 'America/New_York'); pages.push(p);
    const d = await signedInPage(chrome, url, doctor, 'Asia/Kolkata'); pages.push(d);
    const id = await requestVisit(p, { doctorId, pincode, date, now: true, rejectFirst: true });
    pass('Definitive booking rejection preserves an editable form and permits corrected submission');
    await pause(1200); await state(p, id, 'pending');
    pass('Immediate request saves once and waiting does not accept it');
    await d.reload(); await state(d, id, 'pending');
    const minimal = await d.evaluate(`!(${scope(id)}?.textContent.includes('100 Synthetic Home Visit Test Street'))`);
    assert.equal(minimal, true, 'Unaccepted offer does not contain full address');
    await click(d, 'Accept visit', id);
    await state(d, id, 'confirmed'); await state(p, id, 'confirmed');
    await p.reload(); await state(p, id, 'confirmed'); await d.reload(); await state(d, id, 'confirmed');
    const patientTime = await p.evaluate(`${scope(id)}.querySelector('p').textContent`);
    const doctorTime = await d.evaluate(`${scope(id)}.querySelector('p').textContent`);
    assert.equal(patientTime, doctorTime, 'Different device timezones display the same saved provider appointment instant');
    assert.ok(patientTime.includes('Asia/Kolkata'), 'Provider timezone is stated explicitly');
    pass('Explicit doctor acceptance and both dashboards survive reload with the same ID');
    pass('New York patient and Kolkata doctor retain the same appointment instant and provider timezone');
    await click(d, 'Start travel', id); await click(d, 'Save start travel', id);
    await state(p, id, 'en route'); await state(d, id, 'en route');
    const truthfulEta = await p.evaluate(`${scope(id)}.textContent.includes('ETA unavailable')`);
    assert.equal(truthfulEta, true, 'No invented ETA');
    await click(p, 'Get arrival code', id);
    await until(p, `!!${scope(id)}?.querySelector('.hv-code')`, 'patient-only code issued');
    const code = await p.evaluate(`${scope(id)}.querySelector('.hv-code').textContent`);
    await click(d, 'Report my arrival', id); await state(d, id, 'arrived'); await state(p, id, 'arrived');
    assert.ok(await p.evaluate(`${scope(id)}.querySelector('.hv-code')?.textContent`) === code, 'Doctor-reported arrival preserves the unconsumed patient code');
    await click(d, 'Verify patient arrival code', id); await field(d, "Patient's one-time arrival code", code, id); await click(d, 'Save verify arrival', id);
    await until(d, `!!Array.from(${scope(id)}?.querySelectorAll('button')||[]).find(el=>el.textContent==='Start consultation')`, 'verified arrival allows consultation');
    await click(d, 'Start consultation', id); await state(d, id, 'in consultation');
    await click(d, 'Save encounter', id);
    await field(d, 'Clinician-authored encounter summary', 'Synthetic signed encounter summary — no diagnosis or treatment.', id);
    await field(d, 'Follow-up instructions', 'Synthetic follow-up instruction only; no new booking.', id);
    await click(d, 'Save save encounter', id);
    await until(d, `!Array.from(${scope(id)}?.querySelectorAll('textarea')||[]).length`, 'encounter saved');
    await click(d, 'Complete visit', id); await state(d, id, 'completed'); await state(p, id, 'completed');
    pass('Explicit travel, patient code, consultation, saved encounter and completion');
    await click(d, 'Record collected payment', id);
    const fee = await d.evaluate(`${scope(id)}.querySelector('data[data-currency]')?.value`);
    assert.ok(fee, 'Agreed fee is visible');
    await field(d, 'Amount collected', fee, id); await checkbox(d, 'I acknowledge receiving', id); await click(d, 'Save record settlement', id);
    await p.reload(); await state(p, id, 'completed');
    await until(p, `${scope(id)}.textContent.includes('Recorded pay-at-visit receipt')`, 'accurate persisted settlement receipt');
    pass('Recorded cash receipt and clinical record persist after reload');

    const laterId = await requestVisit(p, { doctorId, pincode, date, now: false });
    await d.reload(); await state(d, laterId, 'pending'); await click(d, 'Accept visit', laterId); await state(p, laterId, 'confirmed');
    await click(p, 'Request reschedule', laterId);
    await field(p, 'New date', date, laterId); await click(p, 'Find replacement slots', laterId);
    await until(p, `!!Array.from(${scope(laterId)}.querySelectorAll('label')).find(el=>el.textContent.startsWith('Replacement time'))`, 'replacement capacity discovery');
    const replacement = await p.evaluate(`Array.from(${scope(laterId)}.querySelectorAll('label')).find(el=>el.textContent.startsWith('Replacement time')).querySelector('option:last-child').value`);
    await field(p, 'Replacement time', replacement, laterId); await click(p, 'Review replacement quote', laterId);
    await until(p, `!!Array.from(${scope(laterId)}.querySelectorAll('button')).find(el=>el.textContent==='Agree to quote and request replacement')`, 'reschedule quote reviewed');
    await field(p, 'Reason', 'Synthetic true reschedule verification', laterId); await click(p, 'Agree to quote and request replacement', laterId);
    await until(p, `!!${scope(laterId)}?.textContent.includes('Reschedule:')`, 'patient sees persisted replacement proposal');
    await d.reload(); await state(d, laterId, 'confirmed'); await click(d, 'Accept replacement slot', laterId);
    await until(d, `(() => { const card=${scope(laterId)}; return !!card && !Array.from(card.querySelectorAll('button')).some(el=>el.textContent==='Accept replacement slot'); })()`, 'doctor accepted replacement and received committed state');
    await state(p, laterId, 'confirmed');
    await until(p, `(() => { const card=${scope(laterId)}; return !!card && !card.textContent.includes('Reschedule:'); })()`, 'patient sees accepted replacement before next action');
    await click(p, 'Cancel visit', laterId); await field(p, 'Reason', 'Synthetic cancellation verification', laterId); await click(p, 'Save cancel', laterId); await state(p, laterId, 'cancelled'); await state(d, laterId, 'cancelled');
    pass('Later booking, accepted reschedule and cancellation agree across both dashboards');
    return evidence;
  } finally {
    for (const page of pages) await page.close().catch(() => {});
    chrome.close();
  }
}

export async function runHomeVisitBrowserSmoke({ url = 'http://127.0.0.1:8081', cdp = 'http://127.0.0.1:9333' } = {}) {
  const chrome = await Chrome.connect(cdp);
  let page;
  try {
    page = await chrome.page(`${url}/home-visits`);
    await until(page, 'location.pathname === "/auth"', 'unauthenticated home visit redirects to auth');
    console.log('PASS browser: unauthenticated home visits redirect to sign-in');
  } finally { if (page) await page.close(); chrome.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes('--smoke')) {
  await runHomeVisitBrowserSmoke();
}
