import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../backend";
import { clearRecoveryReference, homeVisitError, homeVisits, HomeVisitRpcError, readRecoveryReference, recoveryReference } from "./api";
import type { HomeAddress, HomeProvider, HomeQuote, HomeVisit, HomeVisitContext } from "./api";
import { HomeVisitPanel } from "./HomeVisitPanel";
import { homeTime, money } from "./format";
import "./home-visits.css";

const EMPTY_ADDRESS: HomeAddress = { full_address: "", locality: "", pincode: "", phone: "", landmark: "", reason: "" };
type BookingProps = { onClose: () => void; initialProviderId?: string; initialMode?: "now" | "later" };
export function HomeVisitBooking(props: BookingProps) {
  const { session } = useSession();
  // Remount all in-memory clinical fields if the signed-in account changes.
  return <BookingForm key={session?.user.id || "signed-out"} {...props} actorId={session?.user.id} />;
}
function BookingForm({ onClose, initialProviderId, initialMode = "now", actorId }: BookingProps & { actorId?: string }) {
  const [context, setContext] = useState<HomeVisitContext | null>(null);
  const [address, setAddress] = useState<HomeAddress>(EMPTY_ADDRESS);
  const [mode, setMode] = useState(initialMode);
  const [date, setDate] = useState("");
  const [providers, setProviders] = useState<HomeProvider[]>([]);
  const [providerId, setProviderId] = useState(initialProviderId || "");
  const [slot, setSlot] = useState("");
  const [searched, setSearched] = useState(false);
  const [quote, setQuote] = useState<HomeQuote | null>(null);
  const [consent, setConsent] = useState(false);
  const [visit, setVisit] = useState<HomeVisit | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryPending, setRecoveryPending] = useState(false);
  const discoverySequence = useRef(0);
  const sentInput = useRef<Parameters<typeof homeVisits.create>[0] | null>(null);
  const mounted = useRef(true);

  const reconcile = useCallback(async () => {
    if (!actorId) return;
    const key = readRecoveryReference(actorId);
    if (!key) return;
    const saved = await homeVisits.recover(key);
    if (saved) {
      clearRecoveryReference(actorId);
      setVisit(saved);
      setError("");
    }
    setRecoveryPending(false);
    return saved;
  }, [actorId]);

  useEffect(() => {
    mounted.current = true;
    if (!actorId) return;
    setBusy(true);
    Promise.all([homeVisits.context(), reconcile()]).then(([config]) => { if (mounted.current) setContext(config); })
      .catch(e => { if (mounted.current) setError(homeVisitError(e)); })
      .finally(() => { if (mounted.current) setBusy(false); });
    return () => { mounted.current = false; };
  }, [actorId, reconcile]);

  function invalidate() {
    discoverySequence.current++;
    setQuote(null); setConsent(false); setProviders([]); setSlot(""); setSearched(false);
  }
  function updateAddress(field: keyof HomeAddress, value: string) {
    if (field === "pincode") invalidate();
    else { setQuote(null); setConsent(false); }
    setAddress(current => ({ ...current, [field]: value }));
  }
  async function discover() {
    const sequence = ++discoverySequence.current;
    setBusy(true); setError(""); setQuote(null); setConsent(false);
    try {
      const result = await homeVisits.discover({ pincode: address.pincode, is_now: mode === "now", ...(mode === "later" ? { date } : {}) });
      if (sequence !== discoverySequence.current) return;
      const eligible = initialProviderId ? result.filter(p => p.provider_id === initialProviderId) : result;
      setProviders(eligible); setSlot(""); setSearched(true);
      if (initialProviderId) setProviderId(initialProviderId);
    } catch (e) { setError(homeVisitError(e)); }
    finally { setBusy(false); }
  }
  async function review() {
    const sequence = ++discoverySequence.current;
    setBusy(true); setError("");
    try {
      const result = await homeVisits.quote({ provider_id: providerId || null, routing: providerId ? "named" : "pool", is_now: mode === "now", pincode: address.pincode, ...(slot ? { start_time: slot } : {}) });
      if (mounted.current && sequence === discoverySequence.current) { setQuote(result); setConsent(false); }
    } catch (e) { setError(homeVisitError(e)); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!actorId || !quote || !context || !consent) return;
    setBusy(true); setError("");
    try {
      const key = recoveryReference(actorId);
      // Reconcile first after a prior response loss. Never replace the key to force a second booking.
      const recovered = await homeVisits.recover(key);
      if (recovered) { setVisit(recovered); clearRecoveryReference(actorId); return; }
      const input = sentInput.current || { quote_id: quote.quote_id, idempotency_key: key, address: { ...address }, consent_version: context.consent_version, consent: true, dependent_id: null };
      sentInput.current = input;
      const saved = await homeVisits.create(input);
      clearRecoveryReference(actorId); setVisit(saved); sentInput.current = null; setRecoveryPending(false);
    } catch (e) {
      setError(homeVisitError(e));
      setRecoveryPending(!!sentInput.current);
      // The form remains in memory. Only the opaque key survives restart.
      try {
        const recovered = await reconcile();
        if (!recovered && e instanceof HomeVisitRpcError && e.transactionRejected) {
          // A returned database rejection confirms rollback. Corrections may use a fresh quote.
          sentInput.current = null; clearRecoveryReference(actorId); setRecoveryPending(false); setQuote(null); setConsent(false);
        }
      } catch { /* Ambiguous response loss retains the original key and payload. */ }
    } finally { setBusy(false); }
  }
  const selectedProvider = providers.find(p => p.provider_id === providerId);
  const validAddress = address.full_address.trim().length >= 10 && address.locality.trim().length > 0 && /^\d{6}$/.test(address.pincode) && address.phone.trim().length >= 10 && address.reason.trim().length > 0;

  return <div className="hv-overlay" role="dialog" aria-modal="true" aria-labelledby="hv-book-title">
    <section className="hv hv-dialog">
      <header className="hv-header"><div><h2 id="hv-book-title">Doctor home visit</h2><p>Visit Now or Book for Later</p></div><button type="button" onClick={onClose} aria-label="Close home visit">Close</button></header>
      <div className="hv-body">
        {!actorId && <p role="alert">Please sign in before booking.</p>}
        {error && <p className="hv-error" role="alert">{error}</p>}
        {recoveryPending && <div className="hv-note"><p>A previous submission needs checking. No booking is confirmed until the server returns its saved status.</p><button disabled={busy} onClick={() => { setBusy(true); reconcile().catch(e => setError(homeVisitError(e))).finally(() => setBusy(false)); }}>Check saved request</button></div>}
        {visit ? <><p className="hv-success">Request saved · {visit.id || visit.booking_id}. Status: {(visit.home_visit_status || visit.status).replaceAll("_", " ")}.{(visit.home_visit_status || visit.status) === "pending" ? " The doctor must explicitly accept before confirmation." : ""}</p><HomeVisitPanel audience="patient" /></> : <>
          {busy && !context && <p role="status">Checking home-visit service…</p>}
          {context && (!context.enabled || !context.participant) && <p className="hv-note">{context.reason || "Home visits are not open for this account. The pilot is awaiting approval."}</p>}
          {context?.enabled && context.participant && <form onSubmit={e => { e.preventDefault(); void discover(); }}>
            <fieldset disabled={busy || recoveryPending || !!sentInput.current}>
              <legend>Patient and home address</legend>
              <label>Patient<input value="Myself — signed-in account" readOnly /></label>
              <p className="hv-help">Family booking is unavailable until an authorised relationship and record access are enabled. This visit does not share your other records.</p>
              <label>Full home address<textarea required value={address.full_address} onChange={e => updateAddress("full_address", e.target.value)} autoComplete="street-address" /></label>
              <div className="hv-grid"><label>Locality<input required value={address.locality} onChange={e => updateAddress("locality", e.target.value)} /></label><label>Pincode<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={address.pincode} onChange={e => updateAddress("pincode", e.target.value)} autoComplete="postal-code" /></label></div>
              <label>Contact phone<input type="tel" required value={address.phone} onChange={e => updateAddress("phone", e.target.value)} autoComplete="tel" /></label>
              <label>Landmark or access instructions (optional)<input value={address.landmark} onChange={e => updateAddress("landmark", e.target.value)} /></label>
              <label>Reason for visit<textarea required value={address.reason} onChange={e => updateAddress("reason", e.target.value)} /></label>
              <p className="hv-help">Enter your address manually. Coverage is checked against published service pincodes. Visit Now is a home-care request; emergency/SOS remains separate.</p>
              <label>When<select value={mode} onChange={e => { invalidate(); setMode(e.target.value as "now" | "later"); }}><option value="now">Visit Now</option><option value="later">Book for Later</option></select></label>
              {mode === "later" && <label>Appointment date<input type="date" required value={date} onChange={e => { invalidate(); setDate(e.target.value); }} /><span className="hv-help">Times below use each doctor's published timezone.</span></label>}
              <button type="submit" disabled={!validAddress || (mode === "later" && !date)}>Check actual availability</button>
              {searched && providers.length === 0 && <p className="hv-note">No eligible doctor is available for this pincode and time. Try another date or Book for Later.</p>}
              {providers.length > 0 && <>
                <label>Doctor<select value={providerId} onChange={e => { setProviderId(e.target.value); setSlot(""); setQuote(null); setConsent(false); }}>
                  {!initialProviderId && <option value="">{mode === "now" ? "Eligible doctor pool — first explicit acceptance" : "Select a doctor"}</option>}
                  {providers.map(p => <option key={p.provider_id} value={p.provider_id}>{p.name} · {money(p.fee, p.currency)}</option>)}
                </select></label>
                {selectedProvider && <p className="hv-help">{selectedProvider.duration_minutes} minute consultation · {selectedProvider.buffer_before_minutes} minutes before and {selectedProvider.buffer_after_minutes} minutes after reserved for travel · {selectedProvider.timezone}</p>}
                {mode === "later" && selectedProvider && <label>Published slot<select value={slot} onChange={e => { setSlot(e.target.value); setQuote(null); setConsent(false); }}><option value="">Select a time</option>{selectedProvider.slots.map(s => <option key={s.start_time} value={s.start_time}>{homeTime(s.start_time, selectedProvider.timezone)}</option>)}</select></label>}
                <button type="button" onClick={() => void review()} disabled={mode === "later" && (!providerId || !slot)}>Review server quote</button>
              </>}
            </fieldset>
            {quote && <section className="hv-card">
              <h3>Review your request</h3>
              <p>{quote.routing === "named" ? selectedProvider?.name || "Selected doctor" : `Eligible provider pool · ${quote.candidate_count} candidates`}</p>
              <p>{homeTime(quote.start_time, selectedProvider?.timezone)} · {money(quote.total, quote.currency)}</p>
              <QuoteBreakdown quote={quote} />
              <p>Payment method: {quote.payment_method?.replaceAll("_", " ") || "Not configured"}. Payment is separate from visit completion.</p>
              <p>{address.full_address}, {address.locality}, {address.pincode} · {address.phone}</p>
              <p className="hv-help">Quote expires {new Date(quote.expires_at).toLocaleString()}. Confirmation and arrival time depend on doctor acceptance.</p>
              <p className="hv-policy">{context.terms || "Terms must be approved before real-patient use."}</p>
              <details><summary>Home-visit consent · {context.consent_version}</summary><p className="hv-policy">{context.consent_text || "Consent wording is not available. Booking cannot continue."}</p></details>
              <label className="hv-check"><input type="checkbox" checked={consent} disabled={busy} onChange={e => setConsent(e.target.checked)} />I have read and agree to this visit's consent and terms.</label>
              <button type="button" disabled={busy || !consent || !context.consent_text || recoveryPending} onClick={() => void submit()}>{busy ? "Saving…" : sentInput.current ? "Retry the same request" : "Save pending home-visit request"}</button>
            </section>}
          </form>}
        </>}
      </div>
    </section>
  </div>;
}

export function HomeVisitEntry({ onOpen }: { onOpen: (options: { initialMode: "now" | "later" }) => void }) {
  return <section className="hv hv-card"><h3>Doctor home visit</h3><p>Enter your address to see eligible doctors, published times and the actual fee.</p><p className="hv-help">Visit Now needs doctor acceptance. No arrival time is promised before acceptance.</p><div className="hv-actions"><button onClick={() => onOpen({ initialMode: "now" })}>Visit Now</button><button onClick={() => onOpen({ initialMode: "later" })}>Book for Later</button></div><a href="/home-visits">View saved doctor home visits</a></section>;
}

function QuoteBreakdown({ quote }: { quote: HomeQuote }) {
  if (Array.isArray(quote.breakdown)) return <ul>{quote.breakdown.map((line, index) => <li key={index}>{line.label || "Consultation"}: {money(line.amount, quote.currency)}</li>)}</ul>;
  return <ul>{Object.entries(quote.breakdown || {}).map(([label, amount]) => <li key={label}>{label.replaceAll("_", " ")}: {typeof amount === "number" ? money(amount, quote.currency) : String(amount)}</li>)}</ul>;
}
