import React from "react";
import { AREAS, AGE_GROUPS, DUTY_TYPES, PROCEDURES, QUALIFICATIONS, SPECIALTIES, toggleArray } from "./data";
import { saveCarePhysicianProfile } from "./api";

const C = { ink: "#0F172A", sub: "#64748B", line: "#E2E8F0", purple: "#6D28D9", soft: "#F5F3FF", danger: "#B91C1C" };
const input = { width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, fontFamily: "inherit", background: "#fff" };
const empty = {
  qualification: "mbbs",
  council_name: "Maharashtra Medical Council",
  council_registration_number: "",
  experience_years: 1,
  procedures: ["iv"],
  age_groups: ["adult"],
  specialty_interests: ["general"],
  duty_types: ["ward", "homecare"],
  preferred_areas: ["wakad"],
  preferred_hospitals: [],
  is_available: true,
};

const DUTY_PREF_OPTIONS = [
  { id: "all", label: "All" },
  { id: "ward", label: "Ward" },
  { id: "icu", label: "ICU" },
  { id: "emergency", label: "Emergency" },
  { id: "night", label: "Night shift" },
];

function Option({ active, disabled, children, onClick }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ border: `2px solid ${active ? C.purple : C.line}`, background: active ? C.soft : "#fff", color: disabled ? "#94A3B8" : C.ink, borderRadius: 11, padding: 9, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", textAlign: "left", opacity: disabled ? .6 : 1 }}>{children}</button>;
}

export default function ProfileBuilder({ initial, onDone, onCancel }) {
  const [step, setStep] = React.useState(1);
  const [form, setForm] = React.useState({ ...empty, ...(initial || {}) });
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const selectedAreas = AREAS.filter((area) => form.preferred_areas.includes(area.id));
  const hospitalOptions = [...new Set(selectedAreas.flatMap((area) => area.hospitals))];
  const hasGatedProcedure = form.procedures.some((id) => PROCEDURES.find((p) => p.id === id)?.gated);

  function toggle(key, value) {
    setForm((current) => ({ ...current, [key]: toggleArray(current[key] || [], value) }));
  }

  function handleDutyToggle(id) {
    setForm((current) => {
      const active = current.duty_types || ["all"];
      if (id === "all") {
        return { ...current, duty_types: ["all"] };
      }
      const withoutAll = active.filter((x) => x !== "all");
      const next = withoutAll.includes(id)
        ? withoutAll.filter((x) => x !== id)
        : [...withoutAll, id];
      return { ...current, duty_types: next.length === 0 ? ["all"] : next };
    });
  }

  function next() {
    setError("");
    if (step === 1 && (!form.qualification || !form.council_registration_number.trim())) {
      setError("Qualification and council registration number are required.");
      return;
    }
    if (step === 2 && !form.procedures.length) {
      setError("Select at least one procedure you are comfortable performing.");
      return;
    }
    if (step === 3 && (!form.duty_types.length || !form.preferred_areas.length)) {
      setError("Select at least one duty type and one preferred area.");
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const safeForm = hasGatedProcedure
        ? form
        : { ...form, duty_types: form.duty_types.filter((id) => !DUTY_TYPES.find((d) => d.id === id)?.requiresGated) };
      const saved = await saveCarePhysicianProfile(safeForm);
      onDone?.(saved);
    } catch (e) {
      setError(e?.message || "Could not save profile.");
    } finally { setSaving(false); }
  }

  return <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", color: C.ink }}>
    <header style={{ padding: "16px", background: "linear-gradient(135deg,#4C1D95,#7C3AED)", color: "#fff", position: "sticky", top: 0, zIndex: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {onCancel ? <button onClick={onCancel} style={{ border: 0, background: "rgba(255,255,255,.15)", color: "#fff", borderRadius: 10, width: 34, height: 34, cursor: "pointer" }}>←</button> : null}
        <div style={{ flex: 1 }}><strong>Care Physician profile</strong><div style={{ fontSize: 11, opacity: .85 }}>Step {step} of 4 · used for safe hospital matching</div></div>
        <span style={{ fontSize: 24 }}>🩺</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 5, marginTop: 11 }}>{[1,2,3,4].map((n) => <div key={n} style={{ height: 4, borderRadius: 99, background: n <= step ? "#fff" : "rgba(255,255,255,.28)" }} />)}</div>
    </header>

    <main style={{ padding: 15, maxWidth: 560, margin: "0 auto" }}>
      {step === 1 ? <section>
        <h2 style={{ fontSize: 18, margin: "4px 0" }}>Credentials</h2><p style={{ color: C.sub, fontSize: 12, marginTop: 0 }}>Registration verification controls access to critical-care duties.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>{QUALIFICATIONS.map((q) => <Option key={q.id} active={form.qualification === q.id} onClick={() => setForm((f) => ({ ...f, qualification: q.id }))}><b>{q.label}</b></Option>)}</div>
        <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Council / registration body<input style={input} value={form.council_name || ""} onChange={(e) => setForm((f) => ({ ...f, council_name: e.target.value }))} /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Registration number<input style={input} value={form.council_registration_number || ""} onChange={(e) => setForm((f) => ({ ...f, council_registration_number: e.target.value }))} placeholder="e.g. MMC-2019-08421" /></label>
          <label style={{ fontSize: 11, fontWeight: 800 }}>Experience (years)<input style={input} min="0" max="60" type="number" value={form.experience_years} onChange={(e) => setForm((f) => ({ ...f, experience_years: Number(e.target.value) }))} /></label>
        </div>
      </section> : null}

      {step === 2 ? <section>
        <h2 style={{ fontSize: 18, margin: "4px 0" }}>Clinical procedures</h2><p style={{ color: C.sub, fontSize: 12, marginTop: 0 }}>Critical-care procedures are marked 🔒. They remain gated until registration is verified.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>{PROCEDURES.map((p) => <Option key={p.id} active={form.procedures.includes(p.id)} onClick={() => toggle("procedures", p.id)}><span>{p.emoji} {p.label} {p.gated ? "🔒" : ""}</span></Option>)}</div>
        {hasGatedProcedure ? <div style={{ marginTop: 10, background: "#FFF7ED", border: "1px solid #FED7AA", color: "#9A3412", borderRadius: 11, padding: 10, fontSize: 11, fontWeight: 700 }}>Critical-care capability selected. ICU access activates only after credential verification.</div> : null}
      </section> : null}

      {step === 3 ? <section>
        <h2 style={{ fontSize: 18, margin: "4px 0" }}>Work preferences</h2><p style={{ color: C.sub, fontSize: 12, marginTop: 0 }}>Choose duties, age groups and specialties you want to receive.</p>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: C.sub, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 14, marginBottom: 8 }}>Duty types</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {DUTY_PREF_OPTIONS.map((opt) => {
            const isAll = opt.id === "all";
            const isAllActive = !form.duty_types || form.duty_types.length === 0 || form.duty_types.includes("all");
            const active = isAll ? isAllActive : (!isAllActive && form.duty_types.includes(opt.id));
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleDutyToggle(opt.id)}
                style={{
                  border: `2px solid ${active ? C.purple : C.line}`,
                  background: active ? C.soft : "#fff",
                  color: "#0F172A",
                  borderRadius: 14,
                  padding: "10px 20px",
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: active ? "0 2px 5px rgba(109,40,217,0.15)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <h3 style={{ fontSize: 12 }}>Age groups</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>{AGE_GROUPS.map((a) => <Option key={a.id} active={form.age_groups.includes(a.id)} onClick={() => toggle("age_groups", a.id)}>{a.emoji} {a.label}</Option>)}</div>
        <h3 style={{ fontSize: 12 }}>Specialty interests</h3><div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>{SPECIALTIES.map((s) => <Option key={s.id} active={form.specialty_interests.includes(s.id)} onClick={() => toggle("specialty_interests", s.id)}>{s.emoji} {s.label}</Option>)}</div>
      </section> : null}

      {step === 4 ? <section>
        <h2 style={{ fontSize: 18, margin: "4px 0" }}>Preferred locations</h2><p style={{ color: C.sub, fontSize: 12, marginTop: 0 }}>This improves match ranking; it does not block other suitable work.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 7 }}>{AREAS.map((a) => <Option key={a.id} active={form.preferred_areas.includes(a.id)} onClick={() => toggle("preferred_areas", a.id)}>📍 {a.label}</Option>)}</div>
        {hospitalOptions.length ? <><h3 style={{ fontSize: 12 }}>Preferred hospitals</h3><div style={{ display: "grid", gap: 6 }}>{hospitalOptions.map((h) => <Option key={h} active={form.preferred_hospitals.includes(h)} onClick={() => toggle("preferred_hospitals", h)}>🏥 {h}</Option>)}</div></> : null}
        <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 14, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, fontSize: 12, fontWeight: 800 }}><input type="checkbox" checked={form.is_available} onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))} /> Available to receive matching duties</label>
      </section> : null}

      {error ? <div style={{ color: C.danger, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 9, marginTop: 12, fontSize: 11, fontWeight: 700 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {step > 1 ? <button onClick={() => setStep((s) => s - 1)} style={{ flex: 1, padding: 12, borderRadius: 11, border: `1px solid ${C.line}`, background: "#fff", fontWeight: 800, cursor: "pointer" }}>Back</button> : null}
        {step < 4 ? <button onClick={next} style={{ flex: 2, padding: 12, borderRadius: 11, border: 0, background: C.purple, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Continue</button> : <button onClick={save} disabled={saving} style={{ flex: 2, padding: 12, borderRadius: 11, border: 0, background: C.purple, color: "#fff", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? .65 : 1 }}>{saving ? "Saving…" : "Save profile"}</button>}
      </div>
    </main>
  </div>;
}
