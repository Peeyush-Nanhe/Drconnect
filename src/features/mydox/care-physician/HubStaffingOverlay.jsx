import React from "react";
import { listFacilityCandidates, listMyFacilityJobs, postStaffingJob } from "./api";
import { AREAS, DEFAULT_FEES, DUTY_TYPES, PROCEDURES, QUALIFICATIONS, SHIFT_PRESETS, SPECIALTIES, dutyMeta, fitScore, toggleArray } from "./data";

const C = { ink: "#0F172A", sub: "#64748B", line: "#E2E8F0", purple: "#6D28D9", soft: "#F5F3FF", red: "#B91C1C", green: "#047857" };
const input = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 10, padding: 9, fontFamily: "inherit", background: "#fff" };
const action = { border: 0, borderRadius: 10, padding: "10px 12px", background: C.purple, color: "#fff", fontWeight: 900, cursor: "pointer", fontFamily: "inherit" };

function pad(n) { return String(n).padStart(2, "0"); }
function dateOnly(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function buildTimes(date, presetId) {
  const p = SHIFT_PRESETS.find((x) => x.id === presetId);
  if (!p || !date) return { starts_at: null, ends_at: null };
  const [y,m,d] = date.split("-").map(Number);
  const start = new Date(y,m-1,d,p.start,0,0);
  const end = new Date(y,m-1,d,p.end >= 24 ? p.end-24 : p.end,0,0);
  if (p.end >= 24) end.setDate(end.getDate()+1);
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}
function choice(active, danger=false) { return { border: `2px solid ${active ? (danger ? C.red : C.purple) : C.line}`, background: active ? (danger ? "#FEF2F2" : C.soft) : "#fff", color: C.ink, borderRadius: 10, padding: 8, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }; }

function Candidate({ row }) {
  return <div style={{ border: `1px solid ${row.match.blocked ? "#FCA5A5" : C.line}`, borderRadius: 12, padding: 10, background: "#fff" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><div><strong style={{ fontSize: 12 }}>{row.full_name}</strong><div style={{ color: C.sub, fontSize: 10 }}>{row.qualification?.toUpperCase()} · {row.experience_years || 0} yrs</div></div><strong style={{ color: row.match.blocked ? C.red : C.green, fontSize: 12 }}>{row.match.score}% fit</strong></div>
    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>{row.match.reasons.slice(0,4).map((r) => <span key={r} style={{ background: row.match.blocked ? "#FEF2F2" : "#ECFDF5", color: row.match.blocked ? C.red : C.green, borderRadius: 99, padding: "3px 7px", fontSize: 9, fontWeight: 800 }}>{r}</span>)}</div>
  </div>;
}

export default function HubStaffingOverlay({ onClose }) {
  const tomorrow = React.useMemo(() => dateOnly(new Date(Date.now()+86400_000)), []);
  const [form, setForm] = React.useState({ job_type: "locum", duty_type: "ward", date: tomorrow, shift: "night", title: "Ward RMO duty", specialty: "general", qualification: "mbbs", experience_years: 1, area: "wakad", compensation: DEFAULT_FEES.ward, compensation_unit: "shift", capacity: 1, urgency: "planned", required_procedures: ["iv"], description: "" });
  const [jobs, setJobs] = React.useState([]);
  const [candidates, setCandidates] = React.useState([]);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const previewJob = React.useMemo(() => ({ ...form, facility_name: "Your hospital" }), [form]);
  React.useEffect(() => { listMyFacilityJobs().then(setJobs).catch(() => {}); }, []);
  React.useEffect(() => {
    const timer = setTimeout(() => { listFacilityCandidates(previewJob).then((rows) => setCandidates(rows.slice(0,6))).catch(() => setCandidates([])); }, 180);
    return () => clearTimeout(timer);
  }, [previewJob]);

  function pickDuty(id) {
    const meta = dutyMeta(id);
    const defaultRequired = id === "icu" || id === "cardiac_icu" ? ["intubation","ventilator","acls"] : id === "nicu" ? ["intubation","ventilator"] : id === "emergency" ? ["suturing","acls","iv"] : ["iv"];
    setForm((f) => ({ ...f, duty_type: id, title: `${meta.label} — Care Physician / RMO`, compensation: DEFAULT_FEES[id] || 5000, required_procedures: defaultRequired }));
  }

  async function post() {
    setBusy(true); setMessage("");
    try {
      const shift = SHIFT_PRESETS.find((p) => p.id === form.shift);
      const times = form.job_type === "full_time" ? { starts_at: null, ends_at: null } : buildTimes(form.date, form.shift);
      const saved = await postStaffingJob({ ...form, ...times, shift_label: form.job_type === "full_time" ? "Full-time" : `${shift?.label || "Shift"} (${shift?.sub || ""})` });
      setMessage(`Posted successfully. ${candidates.filter((c) => !c.match.blocked).length} currently available physicians match this requirement.`);
      setJobs((rows) => [saved, ...rows]);
    } catch (e) { setMessage(e?.message || "Could not post staffing requirement."); }
    finally { setBusy(false); }
  }

  return <div role="dialog" aria-modal="true" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.55)", display: "flex", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" }}>
    <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, height: "100dvh", overflowY: "auto", background: "#F8FAFC" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 2, padding: "14px 15px", background: "#fff", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 10, alignItems: "center" }}><span style={{ fontSize: 24 }}>🏥</span><div style={{ flex: 1 }}><strong>Book a Care Physician</strong><div style={{ fontSize: 10.5, color: C.sub }}>Post a shift and see the transparent ranked shortlist</div></div><button onClick={onClose} style={{ border: 0, background: "transparent", fontSize: 23, cursor: "pointer" }}>×</button></header>
      <main style={{ padding: 14 }}>
        <section style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: 12, display: "grid", gap: 12 }}>
          <div><div style={{ fontSize: 10, fontWeight: 900, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>Engagement</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[["locum","Locum"],["shift","Shift"],["full_time","Full-time"]].map(([id,label]) => <button key={id} onClick={() => setForm((f) => ({ ...f, job_type:id, compensation_unit:id==="full_time"?"month":"shift", compensation:id==="full_time"?60000:(DEFAULT_FEES[f.duty_type]||5000) }))} style={choice(form.job_type===id)}>{label}</button>)}</div></div>
          <div><div style={{ fontSize: 10, fontWeight: 900, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>Duty type</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6 }}>{DUTY_TYPES.map((d) => <button key={d.id} onClick={() => pickDuty(d.id)} style={choice(form.duty_type===d.id, d.requiresGated)}>{d.emoji} {d.label}{d.requiresGated ? " 🔒" : ""}</button>)}</div></div>
          {form.job_type !== "full_time" ? <div><div style={{ fontSize: 10, fontWeight: 900, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>Shift</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{SHIFT_PRESETS.map((s) => <button key={s.id} onClick={() => setForm((f) => ({ ...f, shift:s.id }))} style={choice(form.shift===s.id)}>{s.label}<span style={{ display: "block", color: C.sub, fontSize: 9 }}>{s.sub}</span></button>)}</div><label style={{ display: "grid", gap: 3, fontSize: 10, fontWeight: 800, marginTop: 7 }}>Date<input style={input} type="date" min={dateOnly(new Date())} value={form.date} onChange={(e) => setForm((f) => ({ ...f, date:e.target.value }))} /></label></div> : null}
          <div><div style={{ fontSize: 10, fontWeight: 900, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>Qualification</div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5 }}>{QUALIFICATIONS.map((q) => <button key={q.id} onClick={() => setForm((f) => ({ ...f, qualification:q.id }))} style={choice(form.qualification===q.id)}>{q.label}</button>)}</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 7 }}><label style={{ fontSize: 10, fontWeight: 800 }}>Specialty<select style={input} value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty:e.target.value }))}>{SPECIALTIES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label style={{ fontSize: 10, fontWeight: 800 }}>Min. experience<input style={input} type="number" min="0" max="60" value={form.experience_years} onChange={(e) => setForm((f) => ({ ...f, experience_years:Number(e.target.value) }))} /></label></div>
          <div><div style={{ fontSize: 10, fontWeight: 900, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>Required procedures</div><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 5 }}>{PROCEDURES.map((p) => <button key={p.id} onClick={() => setForm((f) => ({ ...f, required_procedures:toggleArray(f.required_procedures,p.id) }))} style={choice(form.required_procedures.includes(p.id), p.gated)}>{p.emoji} {p.label}{p.gated ? " 🔒" : ""}</button>)}</div></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 7 }}><label style={{ fontSize: 10, fontWeight: 800 }}>Area<select style={input} value={form.area} onChange={(e) => setForm((f) => ({ ...f, area:e.target.value }))}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label><label style={{ fontSize: 10, fontWeight: 800 }}>Slots<input style={input} type="number" min="1" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity:Number(e.target.value) }))} /></label></div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 7 }}><input style={input} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title:e.target.value }))} placeholder="Role title" /><label style={{ fontSize: 10, fontWeight: 800 }}>₹/{form.compensation_unit}<input style={input} type="number" min="0" value={form.compensation} onChange={(e) => setForm((f) => ({ ...f, compensation:Number(e.target.value) }))} /></label></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>{[["planned","Planned"],["urgent","Urgent"],["emergency","Emergency"]].map(([id,label]) => <button key={id} onClick={() => setForm((f) => ({ ...f, urgency:id }))} style={choice(form.urgency===id, id==="emergency")}>{label}</button>)}</div>
          <textarea style={{ ...input, resize:"vertical" }} rows="2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description:e.target.value }))} placeholder="Notes for the doctor (optional)" />
          <button disabled={busy || !form.title.trim()} onClick={post} style={{ ...action, opacity:busy?.65:1 }}>{busy ? "Posting…" : "Post staffing requirement"}</button>
          {message ? <div style={{ color:C.purple, fontSize:11, fontWeight:800 }}>{message}</div> : null}
        </section>

        <h3 style={{ fontSize: 13, marginBottom: 7 }}>Live ranked shortlist</h3><p style={{ color:C.sub, fontSize:10.5, marginTop:0 }}>Fit score uses procedure coverage, specialty, area, preferred hospital/duty and verification. Blocked clinicians cannot claim gated duties.</p>
        <div style={{ display:"grid", gap:7 }}>{candidates.length ? candidates.map((row) => <Candidate key={row.user_id} row={row} />) : <div style={{ padding:20, border:`1px dashed ${C.line}`, borderRadius:12, textAlign:"center", color:C.sub, fontSize:11 }}>No available Care Physician profiles yet.</div>}</div>

        <h3 style={{ fontSize: 13, marginBottom: 7 }}>Your recent staffing posts</h3><div style={{ display:"grid", gap:7 }}>{jobs.slice(0,6).map((j) => { const d=dutyMeta(j.duty_type); return <div key={j.id} style={{ background:"#fff", border:`1px solid ${C.line}`, borderRadius:12, padding:10, display:"flex", gap:9 }}><span>{d.emoji}</span><div style={{ flex:1 }}><strong style={{ fontSize:11.5 }}>{j.title}</strong><div style={{ color:C.sub, fontSize:9.5, marginTop:2 }}>{j.shift_label || "Full-time"} · {j.area || "Area not set"}</div></div><span style={{ color:j.status==="open"?C.green:C.sub, fontSize:9.5, fontWeight:900, textTransform:"uppercase" }}>{j.status}</span></div>; })}</div>
      </main>
    </div>
  </div>;
}
