import { useCallback, useEffect, useState } from "react";
import {
  listMyNursingShifts, getNursingDirections, startNursingTravel,
  verifyNursingArrival, completeNursingVisit, releaseNursingVisit,
  reportPatientNoShow, nursingErrorText, isNursingError,
  type NursingVisit, type NursingDirections,
} from "./nursing-client";
import "../emergency/emergency.css";

/**
 * The nurse's own days, once she has them. Separate from her offer queue: this
 * is work already hers, so the actions here are travel, arrival and closing.
 *
 * Arrival is not self-declared. She enters the six digits the family reads out,
 * and only then can the day be closed and paid.
 */

function dayText(d: string) {
  return new Date(d + "T00:00:00")
    .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}
function clock(ts: string | null) {
  return ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}

export function NurseShiftsPanel({ userId }: { userId: string | null }) {
  const [shifts, setShifts] = useState<NursingVisit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [directions, setDirections] = useState<Record<string, NursingDirections>>({});

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setShifts(await listMyNursingShifts(userId));
      setError(null);
    } catch (e) {
      setError(nursingErrorText(e));
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    try {
      await fn();
      setError(null);
      await refresh();
    } catch (e) {
      setError(nursingErrorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function onDirections(v: NursingVisit) {
    setBusy(v.id);
    try {
      setDirections(d => ({ ...d, [v.id]: null as never }));
      const dir = await getNursingDirections(v.id);
      setDirections(d => ({ ...d, [v.id]: dir }));
      setError(null);
    } catch (e) {
      // Too early is a rule, not a fault. Say so plainly.
      setError(isNursingError(e, "NURSING_TOO_EARLY")
        ? "The address opens two hours before the shift starts."
        : nursingErrorText(e));
    } finally {
      setBusy(null);
    }
  }

  async function onVerify(v: NursingVisit) {
    if (!/^[0-9]{6}$/.test(code)) { setError("Enter the six digits from the family."); return; }
    await run(v.id, () => verifyNursingArrival(v.id, code));
    setCode("");
    setCodeFor(null);
  }

  if (!userId || (!shifts.length && !error)) return null;

  return (
    <div className="emg-stack">
      <h2 className="emg-section-title">Your nursing shifts</h2>
      {error && <p className="emg-note" role="alert">{error}</p>}

      {shifts.map(v => {
        const dir = directions[v.id];
        return (
          <section className="emg-card" key={v.id}>
            <div className="emg-case-head">
              <span aria-hidden="true">🗓️</span>
              <div>
                <b>{dayText(v.visit_date)}</b>
                <p>
                  {clock(v.shift_start)}–{clock(v.shift_end)}
                  {v.status === "en_route" ? " · on the way" : ""}
                  {v.status === "arrived" ? " · with the patient" : ""}
                </p>
              </div>
            </div>

            {dir && (
              <div className="emg-note">
                <p><b>{dir.patient_name ?? "Patient"}</b></p>
                {dir.address && <p>{dir.address}</p>}
                {dir.maps_url && (
                  <a href={dir.maps_url} target="_blank" rel="noopener noreferrer">
                    Open directions
                  </a>
                )}
              </div>
            )}

            <div className="emg-actions">
              {!dir && (
                <button type="button" className="emg-ghost" disabled={busy === v.id}
                  onClick={() => onDirections(v)}>
                  Address &amp; directions
                </button>
              )}

              {v.status === "scheduled" && (
                <button type="button" className="emg-primary" disabled={busy === v.id}
                  onClick={() => run(v.id, () => startNursingTravel(v.id))}>
                  {busy === v.id ? "…" : "I'm on my way"}
                </button>
              )}

              {(v.status === "scheduled" || v.status === "en_route") && (
                codeFor === v.id ? (
                  <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input inputMode="numeric" maxLength={6} value={code}
                      aria-label="Arrival code from the family"
                      onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                      style={{ width: 96, padding: "6px 8px", borderRadius: 8,
                               border: "1px solid #CBD5E1", letterSpacing: 3,
                               fontWeight: 700, textAlign: "center" }} />
                    <button type="button" className="emg-primary" disabled={busy === v.id}
                      onClick={() => void onVerify(v)}>
                      Confirm arrival
                    </button>
                  </span>
                ) : (
                  <button type="button" className="emg-primary" disabled={busy === v.id}
                    onClick={() => { setCodeFor(v.id); setCode(""); }}>
                    Enter arrival code
                  </button>
                )
              )}

              {v.status === "arrived" && (
                <button type="button" className="emg-primary" disabled={busy === v.id}
                  onClick={() => run(v.id, () => completeNursingVisit(v.id))}>
                  {busy === v.id ? "…" : "Finish the day"}
                </button>
              )}

              {v.status === "scheduled" && (
                <button type="button" className="emg-ghost" disabled={busy === v.id}
                  onClick={() => {
                    const why = window.prompt(
                      "Why can you not attend? Twelve hours' notice or more costs you nothing if cover is found.");
                    if (why === null) return;
                    void run(v.id, () => releaseNursingVisit(v.id, why || "No reason given"));
                  }}>
                  Cannot attend
                </button>
              )}

              {v.status === "en_route" && (
                <button type="button" className="emg-ghost" disabled={busy === v.id}
                  onClick={() => {
                    if (!window.confirm("Report that nobody was home?")) return;
                    void run(v.id, () => reportPatientNoShow(v.id));
                  }}>
                  Nobody home
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default NurseShiftsPanel;
