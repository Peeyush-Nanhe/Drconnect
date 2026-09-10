import React from "react";
import { claimStaffingJob, getCarePhysicianProfile, listMyStaffingAssignments, listOpenStaffingJobs, setCarePhysicianAvailability } from "./api";
import { dutyMeta, fitScore, procedureMeta } from "./data";
import ProfileBuilder from "./ProfileBuilder";

const C = { ink: "#0F172A", sub: "#64748B", line: "#E2E8F0", purple: "#6D28D9", soft: "#F5F3FF", green: "#047857", red: "#B91C1C" };
const button = { border: 0, borderRadius: 10, padding: "9px 11px", background: C.purple, color: "#fff", fontWeight: 800, cursor: "pointer", fontFamily: "inherit", fontSize: 11 };

function money(value) { return value == null ? "Pay on discussion" : `₹${Number(value).toLocaleString("en-IN")}`; }
function when(value) { if (!value) return "Date to be confirmed"; return new Date(value).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); }

function JobCard({ job, profile, assignment, onClaim }) {
  const duty = dutyMeta(job.duty_type);
  const match = fitScore(profile, job);
  return <article style={{ background: "#fff", border: `1.5px solid ${match.blocked ? "#FCA5A5" : C.line}`, borderRadius: 15, padding: 13, marginBottom: 10 }}>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: `${duty.color}15`, display: "grid", placeItems: "center", fontSize: 20 }}>{duty.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13 }}>{job.title}</strong><div style={{ color: C.purple, fontSize: 11, fontWeight: 800, marginTop: 2 }}>{job.facility_name}</div><div style={{ color: C.sub, fontSize: 10.5, marginTop: 2 }}>📍 {job.area || "Area not set"} · {job.shift_label || "Flexible"}</div></div>
      <div style={{ textAlign: "right" }}><strong style={{ color: duty.color, fontSize: 13 }}>{money(job.compensation)}</strong><div style={{ color: C.sub, fontSize: 9 }}>/ {job.compensation_unit || "shift"}</div></div>
    </div>
    <div style={{ marginTop: 9, fontSize: 11, color: C.sub }}>{when(job.starts_at)}</div>
    {(job.required_procedures || []).length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>{job.required_procedures.map((id) => { const p = procedureMeta(id); return <span key={id} style={{ background: p.gated ? "#FFF7ED" : "#EFF6FF", color: p.gated ? "#9A3412" : "#1D4ED8", borderRadius: 99, padding: "3px 7px", fontSize: 9.5, fontWeight: 800 }}>{p.emoji} {p.label}{p.gated ? " 🔒" : ""}</span>; })}</div> : null}
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>{match.reasons.slice(0, 4).map((reason) => <span key={reason} style={{ background: match.blocked ? "#FEF2F2" : "#ECFDF5", color: match.blocked ? C.red : C.green, borderRadius: 99, padding: "3px 7px", fontSize: 9.5, fontWeight: 800 }}>{reason}</span>)}</div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10 }}>
      <div><strong style={{ fontSize: 12 }}>Fit {match.score}%</strong><div style={{ height: 4, width: 90, borderRadius: 99, background: "#E2E8F0", marginTop: 4 }}><div style={{ height: "100%", width: `${match.score}%`, borderRadius: 99, background: match.blocked ? "#EF4444" : "#10B981" }} /></div></div>
      {assignment ? <span style={{ color: C.purple, fontSize: 11, fontWeight: 900, textTransform: "capitalize" }}>{assignment.status}</span> : <button disabled={match.blocked} onClick={() => onClaim(job)} style={{ ...button, opacity: match.blocked ? .45 : 1, cursor: match.blocked ? "not-allowed" : "pointer" }}>{job.capacity === 1 ? "Accept shift" : "Claim slot"}</button>}
    </div>
  </article>;
}

function Roster({ assignments }) {
  const accepted = assignments.filter((a) => ["accepted", "completed"].includes(a.status));
  const earned = accepted.filter((a) => a.status === "completed").reduce((sum, a) => sum + Number(a.job?.compensation || 0), 0);
  return <div>
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}><div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: 12 }}><div style={{ color: C.sub, fontSize: 10 }}>Confirmed duties</div><strong style={{ fontSize: 21 }}>{accepted.length}</strong></div><div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: 12 }}><div style={{ color: C.sub, fontSize: 10 }}>Completed earnings</div><strong style={{ fontSize: 19 }}>₹{earned.toLocaleString("en-IN")}</strong></div></section>
    {assignments.length === 0 ? <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 13, padding: 28, textAlign: "center", color: C.sub, fontSize: 12 }}>No duty applications yet.</div> : assignments.map((a) => <article key={a.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 13, padding: 12, marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ fontSize: 12.5 }}>{a.job?.title || "Staffing duty"}</strong><span style={{ color: a.status === "completed" ? C.green : C.purple, fontWeight: 900, fontSize: 10, textTransform: "capitalize" }}>{a.status}</span></div><div style={{ color: C.sub, fontSize: 10.5, marginTop: 4 }}>{a.job?.facility_name} · {a.job?.shift_label || "Flexible"}</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 10.5 }}><span>{when(a.job?.starts_at)}</span><strong>{money(a.job?.compensation)}</strong></div></article>)}
  </div>;
}

export default function CarePhysicianApp({ profilePill }) {
  const [profile, setProfile] = React.useState(undefined);
  const [jobs, setJobs] = React.useState([]);
  const [assignments, setAssignments] = React.useState([]);
  const [tab, setTab] = React.useState("opportunities");
  const [filter, setFilter] = React.useState("all");
  const [editing, setEditing] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [p, open, mine] = await Promise.all([getCarePhysicianProfile(), listOpenStaffingJobs(), listMyStaffingAssignments()]);
      setProfile(p || null); setJobs(open); setAssignments(mine);
    } catch (e) { setMessage(e?.message || "Could not load staffing marketplace."); setProfile((p) => p === undefined ? null : p); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function claim(job) {
    setBusy(true); setMessage("");
    try { await claimStaffingJob(job.id); setMessage("Shift accepted. It is now in your duty roster."); await load(); }
    catch (e) { setMessage(e?.message || "This shift could not be accepted."); }
    finally { setBusy(false); }
  }

  async function toggleAvailable() {
    if (!profile) return;
    const next = !profile.is_available;
    setProfile({ ...profile, is_available: next });
    try { await setCarePhysicianAvailability(next); } catch (e) { setProfile({ ...profile, is_available: !next }); setMessage(e?.message || "Could not update availability."); }
  }

  if (profile === undefined) return <div style={{ minHeight: 720, display: "grid", placeItems: "center", fontFamily: "system-ui", color: C.sub }}>Loading Care Physician portal…</div>;
  if (!profile || editing) return <ProfileBuilder initial={profile || undefined} onCancel={profile ? () => setEditing(false) : undefined} onDone={(saved) => { setProfile(saved); setEditing(false); setMessage(saved.registration_verified ? "Profile saved." : "Profile saved — verification pending for gated duties."); void load(); }} />;

  const applied = new Map(assignments.map((a) => [a.job_id, a]));
  const shown = jobs.filter((job) => filter === "all" || job.job_type === filter || job.duty_type === filter || (filter === "night" && /night/i.test(job.shift_label || ""))).map((job) => ({ job, match: fitScore(profile, job) })).sort((a, b) => Number(a.match.blocked) - Number(b.match.blocked) || b.match.score - a.match.score);

  return <div style={{ minHeight: 720, background: "#F8FAFC", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: C.ink }}>
    <header style={{ padding: "17px 15px", background: "linear-gradient(135deg,#4C1D95,#7C3AED)", color: "#fff", display: "flex", alignItems: "center", gap: 10 }}><div style={{ fontSize: 25 }}>🩺</div><div style={{ flex: 1 }}><strong>Care Physician / RMO</strong><div style={{ fontSize: 10.5, opacity: .85 }}>Verified staffing, hospital shifts and career roles</div></div>{profilePill}</header>
    <main style={{ padding: 14, maxWidth: 620, margin: "0 auto" }}>
      {!profile.registration_verified ? <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 12, padding: 10, fontSize: 11, fontWeight: 800, marginBottom: 10 }}>🟠 Verification pending. Ward/home-care work remains visible, but ICU and gated-procedure duties stay blocked until registration is verified.</div> : <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", color: C.green, borderRadius: 12, padding: 10, fontSize: 11, fontWeight: 800, marginBottom: 10 }}>✅ Registration verified · critical-care matching enabled</div>}
      {message ? <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 11, padding: 9, fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 10 }}>{message}</div> : null}
      <section style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><div style={{ flex: 1 }}><strong style={{ fontSize: 12 }}>Available for duties</strong><div style={{ color: C.sub, fontSize: 10 }}>Turn off when you do not want new staffing alerts.</div></div><button onClick={toggleAvailable} style={{ border: 0, borderRadius: 99, padding: "7px 12px", background: profile.is_available ? "#D1FAE5" : "#E2E8F0", color: profile.is_available ? C.green : C.sub, fontWeight: 900, cursor: "pointer" }}>{profile.is_available ? "Online" : "Offline"}</button><button onClick={() => setEditing(true)} style={{ border: `1px solid ${C.line}`, borderRadius: 9, background: "#fff", padding: "7px 9px", cursor: "pointer", fontWeight: 800 }}>Edit</button></section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>{[["opportunities","Opportunities"],["roster","My roster & earnings"]].map(([id,label]) => <button key={id} onClick={() => setTab(id)} style={{ border: `1.5px solid ${tab===id?C.purple:C.line}`, background: tab===id?C.soft:"#fff", color: tab===id?C.purple:C.ink, borderRadius: 10, padding: 9, fontWeight: 900, cursor: "pointer" }}>{label}</button>)}</div>
      {tab === "roster" ? <Roster assignments={assignments} /> : <>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 9 }}>{[["all","All"],["ward","Ward"],["icu","ICU"],["emergency","ER"],["night","Night"],["full_time","Full-time"]].map(([id,label]) => <button key={id} onClick={() => setFilter(id)} style={{ flexShrink: 0, border: `1px solid ${filter===id?C.purple:C.line}`, background: filter===id?C.purple:"#fff", color: filter===id?"#fff":C.sub, borderRadius: 99, padding: "6px 11px", fontWeight: 800, cursor: "pointer" }}>{label}</button>)}</div>
        <div style={{ color: C.sub, fontSize: 10.5, marginBottom: 8 }}>{shown.length} open opportunities · ranked by transparent fit score</div>
        {shown.length ? shown.map(({ job }) => <JobCard key={job.id} job={job} profile={profile} assignment={applied.get(job.id)} onClaim={busy ? () => {} : claim} />) : <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 13, padding: 28, textAlign: "center", color: C.sub, fontSize: 12 }}>No matching opportunities are open right now.</div>}
      </>}
    </main>
  </div>;
}
