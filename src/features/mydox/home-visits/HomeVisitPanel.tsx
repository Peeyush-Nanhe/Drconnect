import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../backend";
import { TwoWayChatModal } from "../TwoWayChatModal";
import { homeVisitError, homeVisits } from "./api";
import type { HomeAction, HomeProviderSettings, HomeQuote, HomeVisit } from "./api";
import { homeTime, money } from "./format";
import "./home-visits.css";

export function HomeVisitPanel({ audience, completedOnly = false }: { audience: "patient" | "doctor" | "operations"; completedOnly?: boolean }) {
  const { session } = useSession();
  const actorId = session?.user.id;
  return <VisitPanel key={actorId || "signed-out"} audience={audience} actorId={actorId} completedOnly={completedOnly} />;
}
function VisitPanel({ audience, actorId, completedOnly }: { audience: "patient" | "doctor" | "operations"; actorId?: string; completedOnly: boolean }) {
  const [rows, setRows] = useState<HomeVisit[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState<string | null>(null);
  const sequence = useRef(0);
  const active = useRef(true);
  const refresh = useCallback(async () => {
    if (!actorId) return;
    const current = ++sequence.current;
    try {
      const result = await homeVisits.list();
      if (!active.current || current !== sequence.current) return;
      setRows(result || []); setError(""); setUpdated(new Date().toLocaleTimeString());
    } catch (e) { if (active.current && current === sequence.current) setError(homeVisitError(e)); }
  }, [actorId]);
  useEffect(() => {
    active.current = true; setRows([]); setUpdated(null); setLoading(true);
    void refresh().finally(() => setLoading(false));
    const onResume = () => { if (!document.hidden) void refresh(); };
    // Polling is an open-app refresh, never advertised as background notification delivery.
    const poll = window.setInterval(onResume, 12000);
    window.addEventListener("focus", onResume); window.addEventListener("online", onResume); document.addEventListener("visibilitychange", onResume);
    return () => { active.current = false; clearInterval(poll); window.removeEventListener("focus", onResume); window.removeEventListener("online", onResume); document.removeEventListener("visibilitychange", onResume); };
  }, [refresh]);
  const visible = rows.filter(row => !completedOnly || (row.home_visit_status || row.status) === "completed").filter(row => audience === "doctor" ? row.patient_id !== actorId : row.patient_id === actorId || row.booker_id === actorId || row.actor_id === actorId);
  return <section className="hv hv-card" aria-label="Saved doctor home visits">
    <div className="hv-header"><div><h2>{completedOnly ? "Completed home consultations" : "Doctor home visits"}</h2><small>{updated ? `Last refreshed ${updated}` : "Saved requests and visits"}</small></div><button type="button" onClick={() => void refresh()}>Refresh</button></div>
    {error && <p className="hv-error" role="alert">{error}</p>}
    {loading && <p role="status">Loading saved home visits…</p>}
    {!loading && !error && visible.length === 0 && <p>{completedOnly ? "No completed home consultations available." : "No saved home visits available."}</p>}
    {visible.map(row => <VisitCard key={row.id || row.booking_id} visit={row} actorId={actorId || ""} refresh={refresh} />)}
    {!completedOnly && audience === "doctor" && <ProviderHomeSettings />}
    {!completedOnly && audience === "operations" && <HomeVisitOperations />}
    <p className="hv-help">This view refreshes while the app is open. Notification delivery depends on the approved pilot channels.</p>
  </section>;
}

function VisitCard({ visit, actorId, refresh }: { visit: HomeVisit; actorId: string; refresh: () => Promise<void> }) {
  const id = visit.id || visit.booking_id || "";
  const status = visit.home_visit_status || visit.status;
  const isPatient = visit.patient_id === actorId || visit.booker_id === actorId || visit.actor_id === actorId;
  const actions = visit.allowed_actions || [];
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState("");
  const [reason, setReason] = useState("");
  const [summary, setSummary] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [eta, setEta] = useState("");
  const [code, setCode] = useState("");
  const [patientCode, setPatientCode] = useState<{ code: string; expires_at: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  useEffect(() => {
    if (!["en_route", "arrived"].includes(status) || visit.arrived_at) { setPatientCode(null); setCode(""); }
  }, [status, actorId, visit.arrived_at]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true); setError("");
    try {
      const input: HomeAction = { booking_id: id, action, expected_version: visit.version, ...extra };
      if (action === "verify_arrival") await homeVisits.verifyArrival({ booking_id: id, code, expected_version: visit.version });
      else await homeVisits.action(input);
      setForm(""); setCode(""); setPatientCode(null); setAcknowledge(false);
      await refresh();
    } catch (e) { setError(homeVisitError(e)); await refresh(); }
    finally { setBusy(false); }
  }
  const button = (action: string, label: string, needsForm = false) => actions.includes(action) && <button key={action} disabled={busy} type="button" onClick={() => needsForm ? (setForm(action), setError("")) : void act(action)}>{label}</button>;
  const receipt = visit.payment_settlement;
  return <article className="hv-card">
    <h3>{visit.provider_name || (visit.provider_id ? "Selected doctor" : "Eligible doctor pool")} <span className="hv-status">{status.replaceAll("_", " ")}</span></h3>
    <small>Booking ID: {id}</small>
    <p>{homeTime(visit.start_time, visit.provider_timezone)} · <data value={String(visit.fee)} data-currency={visit.currency}>{money(visit.fee, visit.currency)}</data></p>
    {status === "pending" && <p className="hv-help">Waiting for explicit doctor acceptance.{visit.pending_deadline ? ` Acceptance deadline: ${homeTime(visit.pending_deadline)}.` : ""}</p>}
    {visit.address_snapshot?.full_address && <><p>{visit.address_snapshot.full_address}, {visit.address_snapshot.locality}, {visit.address_snapshot.pincode}</p><p>Contact: {visit.address_snapshot.phone}{visit.address_snapshot.landmark ? ` · Access: ${visit.address_snapshot.landmark}` : ""}</p><p>Reason: {visit.address_snapshot.reason}</p></>}
    {visit.address_snapshot && !visit.address_snapshot.full_address && <p>Offer area: {visit.address_snapshot.locality} · {visit.address_snapshot.pincode}. Full address is available only after acceptance.</p>}
    {["en_route", "arrived"].includes(status) && <p>{visit.eta_minutes != null ? `Doctor-reported ETA: ${visit.eta_minutes} minutes · updated ${homeTime(visit.en_route_at || visit.start_time)}` : "ETA unavailable"}. Arrival is acknowledged separately by the patient code.</p>}
    {visit.doctor_arrived_at && !visit.arrived_at && <p>Doctor reported arrival. Patient acknowledgement is still required.</p>}
    {error && <p className="hv-error" role="alert">{error}</p>}
    <div className="hv-actions">
      {status === "completed" && (isPatient || visit.provider_id === actorId) && <button type="button" onClick={() => setChatOpen(true)}>Chat about this consultation</button>}
      {button("accept", "Accept visit")}{button("decline", "Decline", true)}{button("cancel", "Cancel visit", true)}
      {button("start_travel", "Start travel", true)}{button("report_arrival", "Report my arrival")}{button("start_consultation", "Start consultation")}
      {button("save_encounter", "Save encounter", true)}{button("amend_encounter", "Amend signed encounter", true)}{button("complete", "Complete visit")}
      {button("record_settlement", "Record collected payment", true)}{button("request_reschedule", "Request reschedule", true)}
      {button("dispute", "Raise a dispute", true)}
      {button("accept_reschedule", "Accept replacement slot")}{button("decline_reschedule", "Decline replacement slot", true)}
      {isPatient && !visit.arrived_at && ["en_route", "arrived"].includes(status) && <button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { setPatientCode(await homeVisits.arrivalCode(id)); } catch (e) { setError(homeVisitError(e)); } finally { setBusy(false); } }}>Get arrival code</button>}
      {!isPatient && (actions.includes("verify_arrival") || (visit.provider_id === actorId && ["en_route", "arrived"].includes(status))) && <button disabled={busy} onClick={() => setForm("verify_arrival")}>Verify patient arrival code</button>}
    </div>
    {patientCode && !visit.arrived_at && <div className="hv-note"><p>Share this code only when the doctor is with you. A code acknowledges the visit; it does not independently prove physical attendance.</p><p className="hv-code">{patientCode.code}</p><p>Expires {homeTime(patientCode.expires_at)}. One use only.</p></div>}
    {form && form !== "request_reschedule" && <form onSubmit={e => {
      e.preventDefault();
      const extra: Record<string, unknown> = {};
      if (["cancel", "decline", "decline_reschedule", "amend_encounter", "dispute"].includes(form)) extra.reason = reason;
      if (form === "start_travel") extra.eta_minutes = eta ? Number(eta) : null;
      if (["save_encounter", "amend_encounter"].includes(form)) { extra.summary = summary; extra.follow_up = followUp; }
      if (form === "record_settlement") Object.assign(extra, { amount: Number(amount), currency: visit.currency, method: "cash", reference });
      void act(form, extra);
    }}>
      <fieldset disabled={busy}>
        {["cancel", "decline", "decline_reschedule", "amend_encounter", "dispute"].includes(form) && <label>Reason (saved in the audit history)<textarea required value={reason} onChange={e => setReason(e.target.value)} /></label>}
        {form === "start_travel" && <label>Doctor-reported ETA in minutes (optional)<input type="number" min="1" max="600" value={eta} onChange={e => setEta(e.target.value)} /><span className="hv-help">Leave blank when unknown. The patient sees that this is your estimate.</span></label>}
        {form === "verify_arrival" && <label>Patient's one-time arrival code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="off" value={code} onChange={e => setCode(e.target.value)} /></label>}
        {["save_encounter", "amend_encounter"].includes(form) && <><label>Clinician-authored encounter summary<textarea required value={summary} onChange={e => setSummary(e.target.value)} /></label><label>Follow-up instructions (optional)<textarea value={followUp} onChange={e => setFollowUp(e.target.value)} /></label><p className="hv-help">Saving signs this encounter. Further corrections require an audited amendment. A prescription is optional; this form does not generate one.</p></>}
        {form === "record_settlement" && <><p>Record cash actually collected at this visit. Online payment is unavailable.</p><label>Amount collected ({visit.currency})<input required type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Collection reference (optional)<input value={reference} onChange={e => setReference(e.target.value)} /></label><label className="hv-check"><input required type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />I acknowledge receiving this amount. This is a recorded pay-at-visit settlement.</label></>}
        <div className="hv-actions"><button type="submit">Save {form.replaceAll("_", " ")}</button><button type="button" onClick={() => setForm("")}>Close</button></div>
      </fieldset>
    </form>}
    {form === "request_reschedule" && <RescheduleForm visit={visit} busy={busy} onSubmit={(replacement, rescheduleReason) => act("request_reschedule", { quote_id: replacement.quote_id, reason: rescheduleReason })} onClose={() => setForm("")} />}
    {visit.reschedule && <div className="hv-note"><p>Reschedule: {visit.reschedule.status || "Awaiting doctor decision"}</p>{(visit.reschedule.start_time || visit.reschedule.new_start_time) && <p>Replacement: {homeTime(visit.reschedule.start_time || visit.reschedule.new_start_time || "", visit.provider_timezone)}</p>}<p>The original appointment remains reserved until the replacement is accepted.</p></div>}
    {visit.clinical_notes?.summary && <details><summary>Saved clinical encounter</summary><p className="hv-policy">{visit.clinical_notes.summary}</p>{visit.clinical_notes.follow_up && <p className="hv-policy">Follow-up: {visit.clinical_notes.follow_up}</p>}{visit.clinical_notes.amendments?.map((amendment, index) => <div key={index} className="hv-note"><strong>Amendment {index + 1}</strong><p>{amendment.summary}</p><p>{amendment.follow_up}</p><small>Reason: {amendment.reason}</small></div>)}<p className="hv-help">Follow-up instructions do not create a new appointment.</p></details>}
    {receipt?.status === "recorded_pay_at_visit" ? <details open><summary>Recorded pay-at-visit receipt</summary><p>{money(receipt.amount, receipt.currency || visit.currency)} · {receipt.method}</p>{receipt.recorded_at && <p>Recorded {homeTime(receipt.recorded_at)}</p>}{receipt.reference && <p>Reference: {receipt.reference}</p>}<small>Booking {id}. This is an authorised collection record, not gateway-verified payment.</small></details> : <p>Payment: {receipt?.status || "Unpaid / no collection recorded"}. Online payment is unavailable.</p>}
    {!!visit.disputes?.length && <details open><summary>Disputes</summary>{visit.disputes.map(dispute => <p key={dispute.id}>{dispute.status} · {homeTime(dispute.opened_at)} · {dispute.reason}</p>)}<p className="hv-help">Opening a dispute does not erase the encounter or verify a refund.</p></details>}
    {!!visit.events?.length && <details><summary>Visit history</summary><ul>{visit.events.map((event, index) => <li key={`${event.version}-${index}`}>{homeTime(event.created_at)} · {event.kind.replaceAll("_", " ")}{event.reason ? ` · ${event.reason}` : ""}</li>)}</ul></details>}
    {chatOpen && <TwoWayChatModal reference={{ source: "doctor_appointment", sourceId: id }} onClose={() => setChatOpen(false)} />}
  </article>;
}

function RescheduleForm({ visit, busy, onSubmit, onClose }: { visit: HomeVisit; busy: boolean; onSubmit: (quote: HomeQuote, reason: string) => Promise<void>; onClose: () => void }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [start, setStart] = useState("");
  const [quote, setQuote] = useState<HomeQuote | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function discover() {
    setLoading(true); setError(""); setQuote(null);
    try { const rows = await homeVisits.discover({ pincode: visit.address_snapshot?.pincode || "", is_now: false, date }); setSlots(rows.find(p => p.provider_id === visit.provider_id)?.slots || []); }
    catch (e) { setError(homeVisitError(e)); } finally { setLoading(false); }
  }
  return <div className="hv-note">
    <p>The original visit stays booked while a replacement is reviewed. Changing the address requires a separate coverage and quote review; this reschedule keeps the saved address.</p>
    {error && <p className="hv-error" role="alert">{error}</p>}
    <fieldset disabled={busy || loading}>
      <label>New date<input type="date" value={date} onChange={e => { setDate(e.target.value); setSlots([]); setStart(""); setQuote(null); }} /></label><button disabled={!date} onClick={() => void discover()}>Find replacement slots</button>
      {slots.length > 0 && <><label>Replacement time<select value={start} onChange={e => { setStart(e.target.value); setQuote(null); }}><option value="">Select a slot</option>{slots.map(s => <option key={s.start_time} value={s.start_time}>{homeTime(s.start_time, visit.provider_timezone)}</option>)}</select></label><button disabled={!start} onClick={async () => { setLoading(true); setError(""); try { setQuote(await homeVisits.quote({ booking_id: visit.id || visit.booking_id, provider_id: visit.provider_id, routing: "named", is_now: false, pincode: visit.address_snapshot?.pincode || "", start_time: start })); } catch (e) { setError(homeVisitError(e)); } finally { setLoading(false); } }}>Review replacement quote</button></>}
      {quote && <><p>{homeTime(quote.start_time, visit.provider_timezone)} · {money(quote.total, quote.currency)} · {quote.payment_method}</p><label>Reason<input required value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={!reason.trim()} onClick={() => void onSubmit(quote, reason)}>Agree to quote and request replacement</button></>}
      <button onClick={onClose}>Close reschedule</button>
    </fieldset>
  </div>;
}

export function ProviderHomeSettings() {
  const { session } = useSession();
  return <ProviderSettingsForm key={session?.user.id || "signed-out"} />;
}
function ProviderSettingsForm() {
  const [settings, setSettings] = useState<HomeProviderSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    if (loaded) return;
    setBusy(true);
    try { setSettings(await homeVisits.settings()); setLoaded(true); } catch (e) { setMessage(homeVisitError(e)); } finally { setBusy(false); }
  }
  function initialise() {
    // No availability, fee or travel default is silently published.
    setSettings({ enabled: false, coverage_pincodes: [], fee: 0, currency: "INR", duration_minutes: 0, buffer_before_minutes: 0, buffer_after_minutes: 0, lead_minutes: 0, horizon_days: 0, acceptance_minutes: 0, timezone: "" });
  }
  return <details className="hv-card" onToggle={e => { if (e.currentTarget.open) void load(); }}><summary>Publish home-service settings</summary>
    <p>Only authorised, registration-verified doctors may publish. Immediate Online/Offline is separate from future home appointments.</p><p><a href="/provider/availability">Set working hours, leave and DND</a></p>
    {message && <p role="status">{message}</p>}
    {loaded && !settings && <button onClick={initialise}>Configure home visits</button>}
    {settings && <form onSubmit={async e => { e.preventDefault(); setBusy(true); setMessage(""); try { setSettings(await homeVisits.saveSettings(settings)); setMessage("Home-service settings saved. Pilot access remains controlled by the approved policy."); } catch (err) { setMessage(homeVisitError(err)); } finally { setBusy(false); } }}><fieldset disabled={busy}>
      <label className="hv-check"><input type="checkbox" checked={settings.enabled} onChange={e => setSettings({ ...settings, enabled: e.target.checked })} />Offer home visits during my published hours</label>
      <label>Coverage pincodes (comma separated)<input required value={settings.coverage_pincodes.join(",")} onChange={e => setSettings({ ...settings, coverage_pincodes: e.target.value.split(",").map(x => x.trim()) })} /></label>
      <label>Provider IANA timezone<input required placeholder="e.g. Asia/Kolkata" value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })} /></label>
      <div className="hv-grid">{([
        ["fee", "Consultation fee (INR)"], ["duration_minutes", "Consultation duration (minutes)"], ["buffer_before_minutes", "Travel before (minutes)"], ["buffer_after_minutes", "Travel after (minutes)"], ["lead_minutes", "Advance lead time (minutes)"], ["horizon_days", "Booking horizon (days)"], ["acceptance_minutes", "Pending acceptance deadline (minutes)"],
      ] as const).map(([key, label]) => <label key={key}>{label}<input required type="number" min="0" step={key === "fee" ? "0.01" : "1"} value={settings[key]} onChange={e => setSettings({ ...settings, [key]: Number(e.target.value) })} /></label>)}</div>
      <p className="hv-help">Use approved fees and explicit conservative travel buffers. These are reserved capacity, not route estimates. Real-patient activation requires the owner-approved service policy.</p>
      <button type="submit">Save home-service settings</button>
    </fieldset></form>}
  </details>;
}

export function HomeVisitOperations() {
  const { session } = useSession();
  return <OperationsView key={session?.user.id || "signed-out"} />;
}
function OperationsView() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <section className="hv hv-card"><h3>Home-visit operations</h3><p>Permission-scoped unaccepted requests, delays and notification failures.</p><button disabled={busy} onClick={async () => { setBusy(true); setError(""); try { setRows(await homeVisits.operations()); } catch (e) { setError(homeVisitError(e)); } finally { setBusy(false); } }}>Refresh operations</button>{error && <p className="hv-error" role="alert">{error}</p>}{rows.map((row, i) => <article className="hv-card" key={String(row.id || i)}>{Object.entries(row).map(([key, value]) => <p key={key}><strong>{key.replaceAll("_", " ")}:</strong> {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}</p>)}</article>)}</section>;
}
