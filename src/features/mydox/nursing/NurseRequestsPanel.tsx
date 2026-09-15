import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NurseShiftsPanel } from "./NurseShiftsPanel";
import "../emergency/emergency.css";

/**
 * Nursing work lives in its own tables, so it never appears in the doctor
 * home-visit feed a provider sees by default. This is the nurse's queue:
 * packages offered to her, and single days released by another nurse.
 */
type LooseClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  channel: (name: string) => any;
  removeChannel: (c: any) => any;
};
const db = supabase as unknown as LooseClient;

interface Engagement {
  id: string;
  kind: string;
  days_scheduled: number;
  day_rate: number;
  total_amount: number;
  start_date: string;
  slot_time: string | null;
  address_snapshot: string | null;
  primary_nurse_id: string | null;
  preferred_nurse_id: string | null;
  assignment_state: string;
  broadcast_after: string | null;
}

interface VisitOffer {
  id: string;
  visit_date: string;
  payout_amount: number | null;
  status: string;
  assigned_nurse_id: string | null;
}

const POLL_MS = 5_000;

function money(n: number | null | undefined) {
  return "₹" + Number(n ?? 0).toLocaleString("en-IN");
}
function dayText(d: string) {
  return new Date(d + "T00:00:00").toDateString();
}

export function NurseRequestsPanel({ userId }: { userId: string | null }) {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [visits, setVisits] = useState<VisitOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const lock = useRef(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [e, v] = await Promise.all([
        db.rpc("list_nursing_engagement_offers"),
        db.rpc("list_nursing_offers"),
      ]);
      if (e.error) throw e.error;
      setEngagements((e.data as Engagement[]) ?? []);
      setVisits(((v.data as VisitOffer[]) ?? []).filter(x => x.status === "seeking_cover"));
      setError(null);
    } catch (err: any) {
      // A missing function means the nursing migrations have not been applied.
      if (["PGRST202", "42883"].includes(err?.code || "")) {
        setError("Home nursing is not set up on this server yet.");
      } else {
        setError(err?.message || "Could not load nursing requests.");
      }
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refresh();
    const t = setInterval(() => { if (!document.hidden) void refresh(); }, POLL_MS);
    const ch = supabase
      .channel(`nursing_offers_${userId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "nursing_engagement_offers" },
        () => void refresh())
      .subscribe();
    return () => { clearInterval(t); void supabase.removeChannel(ch); };
  }, [userId, refresh]);

  async function act(id: string, fn: string, arg: Record<string, unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusyId(id);
    setError(null);
    try {
      const { error: e } = await db.rpc(fn, arg);
      if (e) throw e;
    } catch (err: any) {
      const m = String(err?.message || "");
      // Losing a race is normal, not a failure. Say so plainly.
      setError(m.includes("ALREADY_TAKEN")
        ? "Another nurse accepted that first."
        : m.replace(/^NURSING_[A-Z_]+:\s*/, "") || "Could not confirm. Try again.");
    } finally {
      lock.current = false;
      setBusyId(null);
      void refresh();
    }
  }

  if (!userId) return null;

  const mine = engagements.filter(e => e.primary_nurse_id === userId);
  const offered = engagements.filter(e => !e.primary_nurse_id);
  const nothing = loaded && !mine.length && !offered.length && !visits.length;

  return (
    <div className="emg-portal" style={{ marginTop: 12 }}>
      {error && (
        <div className="emg-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      {nothing && !error && (
        <p className="emg-note">No home nursing requests right now.</p>
      )}

      {/* Days already hers: travel, arrival code, closing the day. */}
      <NurseShiftsPanel userId={userId} />

      {mine.map(e => (
        <section className="emg-card emg-card-active" key={e.id}>
          <div className="emg-badge">YOUR NURSING BOOKING</div>
          <div className="emg-case-head">
            <span aria-hidden="true">🏠</span>
            <div>
              <b>{e.kind}</b>
              <p>{e.days_scheduled} day{e.days_scheduled > 1 ? "s" : ""} from {dayText(e.start_date)}
                {e.slot_time ? " · " + e.slot_time.slice(0, 5) : ""}</p>
            </div>
          </div>
          <div className="emg-chips">
            <span>{money(e.total_amount)} total</span>
            <span>{money(e.day_rate)}/day</span>
          </div>
          {e.address_snapshot && <p className="emg-note">{e.address_snapshot}</p>}
        </section>
      ))}

      {offered.map(e => (
        <section className="emg-card emg-card-incoming" key={e.id}>
          <div className="emg-badge emg-badge-alert">
            {e.preferred_nurse_id === userId ? "ASKED FOR YOU BY NAME" : "NURSING REQUEST NEARBY"}
          </div>
          <div className="emg-case-head">
            <span aria-hidden="true">🏠</span>
            <div>
              <b>{e.kind}</b>
              <p>{e.days_scheduled} day{e.days_scheduled > 1 ? "s" : ""} from {dayText(e.start_date)}
                {e.slot_time ? " · " + e.slot_time.slice(0, 5) : ""}</p>
            </div>
          </div>
          <div className="emg-chips">
            <span>{money(e.total_amount)} total</span>
            <span>{money(e.day_rate)}/day</span>
          </div>
          {e.address_snapshot && <p className="emg-note">{e.address_snapshot}</p>}
          {e.preferred_nurse_id === userId && (
            <p className="emg-note">
              The patient asked for you. If you do not respond it goes to every nurse nearby.
            </p>
          )}
          <button type="button" className="emg-primary" disabled={!!busyId}
            onClick={() => act(e.id, "accept_nursing_engagement", { p_engagement_id: e.id })}>
            {busyId === e.id ? "Confirming…" : "Accept all " + e.days_scheduled + " day" + (e.days_scheduled > 1 ? "s" : "")}
          </button>
          <button type="button" className="emg-ghost" disabled={!!busyId}
            onClick={() => act(e.id, "decline_nursing_engagement", { p_engagement_id: e.id })}>
            Cannot take this
          </button>
        </section>
      ))}

      {visits.map(v => (
        <section className="emg-card emg-card-incoming" key={v.id}>
          <div className="emg-badge emg-badge-alert">COVER FOR ONE DAY</div>
          <div className="emg-case-head">
            <span aria-hidden="true">📅</span>
            <div>
              <b>Single visit</b>
              <p>{dayText(v.visit_date)}</p>
            </div>
          </div>
          <div className="emg-chips"><span>{money(v.payout_amount)} for the day</span></div>
          <button type="button" className="emg-primary" disabled={!!busyId}
            onClick={() => act(v.id, "accept_nursing_visit", { p_visit_id: v.id })}>
            {busyId === v.id ? "Confirming…" : "Accept this day"}
          </button>
        </section>
      ))}
    </div>
  );
}

export default NurseRequestsPanel;
