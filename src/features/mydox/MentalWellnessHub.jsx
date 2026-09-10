import React from "react";
import { MW_TRACKS, RESPONSES, PHQ9_SAFETY_ITEM, scoreBand, modalityFor, SLA, URGENT_CONTACTS, inr } from "@/features/mydox/mw-tracks";
import { createMentalWellnessTeam, listMyMwTeams, listMwMeasurements, addMwMeasurement } from "@/features/mydox/backend";

const INK = "#0F172A";
const SUB = "#64748B";
const LINE = "#E2E8F0";
const COORD_FEE = 1500;

export default function MentalWellnessHub({ onClose, onBooked }) {
  const [track, setTrack] = React.useState(null);
  const [step, setStep] = React.useState("tracks"); // tracks | screener | safety | team | done | progress
  const [answers, setAnswers] = React.useState([]);
  const [optIn, setOptIn] = React.useState({});
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [teams, setTeams] = React.useState([]);
  const [trend, setTrend] = React.useState(null);

  React.useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const score = answers.reduce((sum, v) => sum + (v || 0), 0);
  const band = track?.instrument ? scoreBand(track.instrument, score) : null;
  const redFlag = Boolean(track?.instrument === "PHQ-9" && (answers[PHQ9_SAFETY_ITEM] || 0) > 0);
  const modality = track ? modalityFor(track, score) : null;
  const accent = track?.accent || "#4F46E5";

  function openTrack(t) {
    setTrack(t);
    setAnswers(new Array(t.items.length).fill(null));
    setOptIn(Object.fromEntries(t.team.filter((r) => !r.required).map((r) => [r.role, false])));
    setNotes("");
    setError("");
    setStep(t.instrument ? "screener" : "team");
  }

  function answer(index, value) {
    const next = [...answers];
    next[index] = value;
    setAnswers(next);
    if (track.instrument === "PHQ-9" && index === PHQ9_SAFETY_ITEM && value > 0) setStep("safety");
  }

  const complete = !track?.instrument || answers.every((v) => v !== null);

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const roles = track.team
        .filter((r) => r.required || optIn[r.role])
        .map((r) => ({ role: r.role, role_label: r.label, required: r.required }));
      const row = await createMentalWellnessTeam({
        track: track.id,
        trackLabel: track.label,
        anchorRole: track.anchorRole,
        anchorModality: modality.mode,
        modalityReason: modality.reason,
        urgent: redFlag || band?.band === "Severe",
        instrument: track.instrument,
        score: track.instrument ? score : null,
        band: band?.band || null,
        redFlag,
        roles,
        notes,
        coordinationFee: COORD_FEE,
      });
      setStep("done");
      onBooked?.(row);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this request.");
    } finally {
      setSaving(false);
    }
  }

  async function openProgress() {
    setStep("progress");
    setError("");
    try {
      const rows = await listMyMwTeams();
      setTeams(rows);
      const depression = rows.find((r) => r.track === "depression");
      if (depression) setTrend({ team: depression, points: await listMwMeasurements(depression.id) });
      else setTrend(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your programme.");
    }
  }

  async function retakePhq9(team) {
    const t = MW_TRACKS.find((x) => x.id === team.track);
    if (!t?.instrument) return;
    setTrack(t);
    setAnswers(new Array(t.items.length).fill(null));
    setStep("screener");
    setTrend((current) => (current ? { ...current, retakeFor: team.id } : current));
  }

  async function saveRetake(teamId) {
    setSaving(true);
    try {
      await addMwMeasurement({ teamId, instrument: track.instrument, score, band: band.band, redFlag });
      await openProgress();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this score.");
    } finally {
      setSaving(false);
    }
  }

  const retakeTeamId = trend?.retakeFor;

  return (
    <div role="dialog" aria-modal="true" aria-label="Mental Wellness" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.55)", display: "flex", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, height: "100dvh", background: "#fff", display: "flex", flexDirection: "column" }}>
        <header style={{ padding: "14px 16px", background: track?.bg || "#EEF2FF", borderBottom: `1px solid ${LINE}`, display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "#fff", display: "grid", placeItems: "center", fontSize: 24 }}>{track?.emoji || "🧠"}</span>
          <div style={{ flex: 1 }}>
            <strong style={{ fontSize: 16, color: INK }}>{track ? track.label : "Mental Wellness"}</strong>
            <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{track ? track.blurb : "A named coordinator and a full care team, not a single appointment"}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: "transparent", fontSize: 24, cursor: "pointer", color: SUB }}>×</button>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {step === "tracks" && (
            <>
              <div style={{ display: "grid", gap: 10 }}>
                {MW_TRACKS.map((t) => (
                  <button key={t.id} onClick={() => openTrack(t)} style={{ textAlign: "left", border: `1.5px solid ${LINE}`, borderRadius: 14, padding: 13, background: t.bg, cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 24 }}>{t.emoji}</span>
                      <div>
                        <strong style={{ color: t.accentDeep }}>{t.label}</strong>
                        <div style={{ fontSize: 11, color: SUB, marginTop: 2, lineHeight: 1.4 }}>{t.blurb}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p style={{ marginTop: 14, background: "#F1F5F9", borderRadius: 12, padding: 12, fontSize: 11.5, color: SUB, lineHeight: 1.5 }}>{SLA.text}</p>
              <button onClick={openProgress} style={{ marginTop: 10, width: "100%", border: `1.5px solid ${LINE}`, borderRadius: 12, padding: 12, background: "#fff", fontWeight: 800, color: INK, cursor: "pointer", fontFamily: "inherit" }}>My wellness programme</button>
              <Helplines />
            </>
          )}

          {step === "screener" && track && (
            <>
              <p style={{ fontSize: 12, color: SUB, lineHeight: 1.5, marginTop: 0 }}>Over the last two weeks, how often have you been bothered by the following?</p>
              {track.items.map((item, index) => (
                <section key={index} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12.5, color: INK, fontWeight: 700, lineHeight: 1.4, marginBottom: 7 }}>{index + 1}. {item}</div>
                  <div style={{ display: "grid", gap: 6 }}>
                    {RESPONSES.map((r) => (
                      <button key={r.v} onClick={() => answer(index, r.v)} style={{ textAlign: "left", padding: "9px 11px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 12, color: INK, border: `2px solid ${answers[index] === r.v ? accent : LINE}`, background: answers[index] === r.v ? track.bg : "#fff" }}>{r.label}</button>
                    ))}
                  </div>
                </section>
              ))}
              {complete && band && (
                <div style={{ background: "#F8FAFC", borderRadius: 12, padding: 13, marginBottom: 10 }}>
                  <strong style={{ color: band.tone }}>{track.instrument} score {score} · {band.band}</strong>
                  <div style={{ fontSize: 11, color: SUB, marginTop: 4, lineHeight: 1.45 }}>This is a screening result, not a diagnosis. Your psychiatrist confirms it at the first appointment.</div>
                </div>
              )}
              {error && <p role="alert" style={{ color: "#B91C1C", fontSize: 12 }}>{error}</p>}
            </>
          )}

          {step === "safety" && (
            <div>
              <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", borderRadius: 14, padding: 14 }}>
                <strong style={{ color: "#B91C1C" }}>Please talk to someone now</strong>
                <p style={{ fontSize: 12, color: "#7F1D1D", lineHeight: 1.5 }}>You told us you have had thoughts of being better off dead or of hurting yourself. We are not continuing with an online booking. Please call one of these numbers — they are staffed right now.</p>
              </div>
              <Helplines emphasis />
              <button onClick={() => setStep("team")} style={{ marginTop: 14, width: "100%", border: `1.5px solid ${LINE}`, borderRadius: 12, padding: 12, background: "#fff", fontWeight: 700, color: SUB, cursor: "pointer", fontFamily: "inherit" }}>I am safe right now — continue to arrange care</button>
            </div>
          )}

          {step === "team" && track && (
            <>
              {modality?.mode === "in_person" && (
                <p style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: 12, fontSize: 11.5, color: "#92400E", lineHeight: 1.5 }}>{modality.reason}</p>
              )}
              <h3 style={{ fontSize: 13, margin: "14px 0 8px", color: INK }}>Your recommended team</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {track.team.map((r) => {
                  const on = r.required || optIn[r.role];
                  return (
                    <button key={r.role} disabled={r.required} onClick={() => setOptIn((c) => ({ ...c, [r.role]: !c[r.role] }))} style={{ textAlign: "left", padding: "11px 12px", borderRadius: 12, cursor: r.required ? "default" : "pointer", fontFamily: "inherit", border: `2px solid ${on ? accent : LINE}`, background: on ? track.bg : "#fff" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ color: INK, fontSize: 13 }}>{r.label}</strong>
                        <span style={{ fontSize: 10, fontWeight: 800, color: r.required ? accent : SUB, textTransform: "uppercase" }}>{r.required ? "Required" : on ? "Added" : "Add"}</span>
                      </div>
                      <div style={{ fontSize: 11, color: SUB, marginTop: 3, lineHeight: 1.4 }}>{r.desc}</div>
                    </button>
                  );
                })}
              </div>
              <p style={{ background: "#F1F5F9", borderRadius: 12, padding: 12, fontSize: 11.5, color: SUB, lineHeight: 1.5, marginTop: 12 }}>{track.note}</p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: INK, margin: "12px 0 6px" }}>Anything your coordinator should know · optional</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={track.discreet ? "Shared only with your clinical team" : "Current medication, previous treatment, preferred language"} style={{ width: "100%", boxSizing: "border-box", border: `1.5px solid ${LINE}`, borderRadius: 12, padding: 11, resize: "none", fontFamily: "inherit" }} />
              <div style={{ background: "#F8FAFC", borderRadius: 13, padding: 13, display: "flex", justifyContent: "space-between", gap: 12, marginTop: 12 }}>
                <span style={{ color: SUB, fontSize: 12 }}>Coordination fee (billed later)</span>
                <strong style={{ color: INK }}>{inr(COORD_FEE)}</strong>
              </div>
              <p style={{ fontSize: 10.5, color: SUB, marginTop: 6, lineHeight: 1.45 }}>Nothing is charged in the app today. Clinician fees are billed by the hospital at each appointment.</p>
              {error && <p role="alert" style={{ color: "#B91C1C", fontSize: 12 }}>{error}</p>}
            </>
          )}

          {step === "done" && (
            <div style={{ textAlign: "center", paddingTop: 30 }}>
              <div style={{ fontSize: 56 }}>✅</div>
              <h2 style={{ color: INK, marginBottom: 8 }}>Your team is being assembled</h2>
              <p style={{ color: SUB, lineHeight: 1.5, fontSize: 13 }}>{SLA.text}</p>
              <button onClick={openProgress} style={{ marginTop: 18, width: "100%", border: 0, borderRadius: 12, padding: 13, background: accent, color: "#fff", fontWeight: 800, cursor: "pointer" }}>See my programme</button>
            </div>
          )}

          {step === "progress" && (
            <>
              {teams.length === 0 ? (
                <p style={{ color: SUB, fontSize: 12.5, textAlign: "center", padding: 30 }}>You have no wellness programme yet.</p>
              ) : teams.map((team) => {
                const t = MW_TRACKS.find((x) => x.id === team.track);
                return (
                  <article key={team.id} style={{ border: `1px solid ${LINE}`, borderRadius: 13, padding: 13, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <strong style={{ color: INK }}>{t?.label || team.track}</strong>
                      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: team.status === "active" ? "#16A34A" : SUB }}>{String(team.status).replace(/_/g, " ")}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: SUB, marginTop: 5, lineHeight: 1.45 }}>
                      {team.screening_instrument ? `${team.screening_instrument} ${team.screening_score} · ${team.screening_band}` : "Enquiry with the psychiatric team"}
                      {team.assigned_coordinator_id ? " · coordinator assigned" : " · awaiting coordinator"}
                    </div>
                    {team.review_flag && <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: "#B91C1C" }}>Flagged for clinical review</div>}
                    {t?.instrument && (
                      <button onClick={() => retakePhq9(team)} style={{ marginTop: 9, border: `1.5px solid ${LINE}`, borderRadius: 10, padding: "7px 11px", background: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: INK }}>Re-take {t.instrument}</button>
                    )}
                    {trend?.team?.id === team.id && trend.points?.length > 0 && (
                      <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "flex-end", height: 54 }}>
                        {trend.points.map((p) => (
                          <div key={p.id} title={`${p.instrument} ${p.score} · ${p.band}`} style={{ flex: 1, background: scoreBand(p.instrument, p.score).tone, height: `${Math.max(8, (p.score / 27) * 54)}px`, borderRadius: 4 }} />
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
              {error && <p role="alert" style={{ color: "#B91C1C", fontSize: 12 }}>{error}</p>}
              <Helplines />
            </>
          )}
        </main>

        <footer style={{ padding: 16, borderTop: `1px solid ${LINE}`, display: "flex", gap: 8 }}>
          {step !== "tracks" && (
            <button onClick={() => { setStep("tracks"); setTrack(null); setTrend(null); }} style={{ border: `1.5px solid ${LINE}`, borderRadius: 13, padding: "13px 15px", background: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", color: INK }}>Back</button>
          )}
          {step === "screener" && (
            retakeTeamId
              ? <button disabled={!complete || saving} onClick={() => saveRetake(retakeTeamId)} style={cta(accent, !complete || saving)}>{saving ? "Saving…" : "Save score"}</button>
              : <button disabled={!complete} onClick={() => setStep(redFlag ? "safety" : "team")} style={cta(accent, !complete)}>Continue</button>
          )}
          {step === "team" && <button disabled={saving} onClick={confirm} style={cta(accent, saving)}>{saving ? "Saving…" : "Confirm care team"}</button>}
        </footer>
      </div>
    </div>
  );
}

const cta = (accent, disabled) => ({ flex: 1, border: 0, borderRadius: 13, padding: 14, background: accent, color: "#fff", fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, fontFamily: "inherit" });

function Helplines({ emphasis }) {
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
      {URGENT_CONTACTS.map((c) => (
        <a key={c.value} href={`tel:${c.value.replace(/[^0-9+]/g, "")}`} style={{ textDecoration: "none", border: `1.5px solid ${emphasis ? "#FECACA" : LINE}`, borderRadius: 12, padding: 12, display: "block", background: emphasis ? "#FEF2F2" : "#fff" }}>
          <strong style={{ color: emphasis ? "#B91C1C" : INK, fontSize: 13 }}>{c.value}</strong>
          <div style={{ fontSize: 11, color: SUB, marginTop: 2 }}>{c.label} · {c.note}</div>
        </a>
      ))}
    </div>
  );
}
