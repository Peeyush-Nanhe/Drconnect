import { useCallback, useEffect, useState } from "react";
import {
  listNursingVisits, cancelNursingDay, issueArrivalCode, nursingErrorText,
  NURSING_VISIT_LABEL, type NursingEngagement, type NursingVisit,
} from "./nursing-client";

/**
 * The family's view of a nursing package: one row per day, the arrival code for
 * today, and a way to cancel a single day without losing it.
 *
 * Cancelling does not refund. A replacement day is added at the end, so the
 * family still receives every day they paid for. That is said on the button
 * rather than left to be discovered.
 */

const INK = "#0F172A";
const TEAL = "#0D9488";

function dayLabel(d: string) {
  return new Date(d + "T00:00:00")
    .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

const DOT: Record<string, string> = {
  scheduled: "#94A3B8", seeking_cover: "#F59E0B", en_route: "#3B82F6",
  arrived: "#10B981", completed: "#CBD5E1", cancelled_by_family: "#CBD5E1",
  no_show_patient: "#EF4444", missed: "#EF4444",
};

import { supabase } from "@/integrations/supabase/client";

export function NursingEngagementPanel({ engagement }: { engagement: NursingEngagement }) {
  const [visits, setVisits] = useState<NursingVisit[]>([]);
  const [nurseName, setNurseName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVisits(await listNursingVisits([engagement.id]));
      setError(null);
    } catch (e) {
      setError(nursingErrorText(e));
    } finally {
      setLoading(false);
    }
  }, [engagement.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!engagement.primary_nurse_id) { setNurseName(null); return; }
    let alive = true;
    supabase.from("profiles").select("full_name").eq("id", engagement.primary_nurse_id).maybeSingle()
      .then(({ data }) => {
        if (alive && data?.full_name) setNurseName(data.full_name);
      });
    return () => { alive = false; };
  }, [engagement.primary_nurse_id]);

  const today = new Date().toISOString().slice(0, 10);

  async function onCancelDay(v: NursingVisit) {
    if (!window.confirm(
      `Cancel ${dayLabel(v.visit_date)}? You keep the day — it is added to the end instead.`
    )) return;
    setBusy(v.id);
    try {
      await cancelNursingDay(v.id, "Cancelled by family");
      await refresh();
    } catch (e) {
      setError(nursingErrorText(e));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p style={{ fontSize: 12, color: "#64748B" }}>Loading days…</p>;

  return (
    <div style={{ marginTop: 10 }}>
      {engagement.assignment_state === "assigned" && (
        <div style={{ fontSize: 12, color: "#065F46", background: "#D1FAE5",
                    padding: "8px 12px", borderRadius: 10, margin: "0 0 10px", fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 6 }}>
          <span>✓</span>
          <span>Accepted &amp; Confirmed · Nurse: {nurseName || "Pooja (Nurse)"}</span>
        </div>
      )}
      {engagement.assignment_state === "seeking_nurse" && (
        <p style={{ fontSize: 12, color: "#92400E", background: "#FEF3C7",
                    padding: "8px 10px", borderRadius: 10, margin: "0 0 10px" }}>
          {engagement.preferred_nurse_id
            ? "We have asked the nurse you chose. If she does not take it shortly, every nurse nearby is asked."
            : "Asking nurses near you. The first to accept takes the booking."}
        </p>
      )}
      {engagement.assignment_state === "unfilled" && (
        <p style={{ fontSize: 12, color: "#991B1B", background: "#FEE2E2",
                    padding: "8px 10px", borderRadius: 10, margin: "0 0 10px" }}>
          No nurse took this booking before it was due to start. Our team will contact
          you about a refund or a new date.
        </p>
      )}
      {error && (
        <p style={{ fontSize: 12, color: "#991B1B", margin: "0 0 8px" }}>{error}</p>
      )}

      <ul style={{ listStyle: "none", margin: 0, padding: 0,
                   display: "flex", flexDirection: "column", gap: 6 }}>
        {visits.map(v => {
          const isToday = v.visit_date === today;
          const open = v.status === "scheduled" || v.status === "en_route";
          return (
            <li key={v.id} style={{ display: "flex", alignItems: "center", gap: 10,
                                    background: "#fff", border: "1px solid #E2E8F0",
                                    borderRadius: 10, padding: "8px 10px" }}>
              <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999,
                                                background: DOT[v.status] ?? "#CBD5E1" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK }}>
                  Day {v.seq} · {dayLabel(v.visit_date)}
                </div>
                <div style={{ fontSize: 11, color: "#64748B" }}>
                  {NURSING_VISIT_LABEL[v.status]}
                  {v.shift_start && v.shift_end && (v.status === "scheduled" || v.status === "en_route")
                    ? ` · ${new Date(v.shift_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–${new Date(v.shift_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                    : ""}
                </div>
              </div>

              {/* Code removed here: arrival code handled by unified modal in MyBookingsOverlay */}
              {open && !isToday && (
                <button type="button" disabled={busy === v.id} onClick={() => onCancelDay(v)}
                  style={{ background: "#F1F5F9", color: "#475569", border: "none",
                           borderRadius: 999, padding: "5px 12px", fontSize: 12,
                           fontWeight: 700, cursor: "pointer" }}>
                  Cancel day
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default NursingEngagementPanel;
