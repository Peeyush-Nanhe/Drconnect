import React from "react";
import { createCareProgramBooking } from "@/features/mydox/backend";

const PROGRAMS = {
  dialysis: {
    title: "Dialysis Centre",
    subtitle: "Plan recurring or one-time dialysis near you",
    emoji: "💧",
    accent: "#0369A1",
    soft: "#E0F2FE",
    frequencies: [
      { id: "three_weekly", label: "3× per week", sessions: 13 },
      { id: "two_weekly", label: "2× per week", sessions: 9 },
      { id: "single", label: "Single session", sessions: 1 },
    ],
    shifts: ["Morning", "Afternoon", "Evening"],
    tiers: [
      { id: "Standard", label: "Standard", fee: 1800, note: "Dialysis session · routine monitoring" },
      { id: "Premium", label: "Premium", fee: 2800, note: "Nephrologist-supervised · priority chair" },
    ],
  },
  medical_tourism: {
    title: "Medical Tourism",
    subtitle: "Treatment planning, travel and hospital coordination",
    emoji: "✈️",
    accent: "#7C3AED",
    soft: "#EDE9FE",
    origins: ["Within India", "International"],
    specialties: ["Cardiac care", "Neurology", "Orthopaedics", "General surgery", "Other treatment"],
    tiers: [
      { id: "Standard", label: "Standard", fee: 0, note: "Hospital matching and treatment estimate" },
      { id: "Premium Concierge", label: "Premium Concierge", fee: 15000, note: "Dedicated coordinator and travel planning" },
      { id: "VIP Concierge", label: "VIP Concierge", fee: 35000, note: "Priority coordination, stay and airport support" },
    ],
  },
};

const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function CareProgramExpansionOverlay({ program, onClose, onBooked }) {
  const config = PROGRAMS[program] || PROGRAMS.dialysis;
  const dialysis = program === "dialysis";
  const [frequency, setFrequency] = React.useState(dialysis ? config.frequencies[0].id : "");
  const [shift, setShift] = React.useState(dialysis ? config.shifts[0] : "");
  const [origin, setOrigin] = React.useState(dialysis ? "" : config.origins[0]);
  const [specialty, setSpecialty] = React.useState(dialysis ? "" : config.specialties[0]);
  const [tier, setTier] = React.useState(config.tiers[0].id);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);
  const selectedTier = config.tiers.find((item) => item.id === tier) || config.tiers[0];
  const selectedFrequency = dialysis ? config.frequencies.find((item) => item.id === frequency) || config.frequencies[0] : null;
  const estimate = dialysis ? selectedTier.fee * selectedFrequency.sessions : selectedTier.fee;

  React.useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const details = dialysis
        ? { frequency, frequency_label: selectedFrequency.label, preferred_shift: shift, sessions_estimate: selectedFrequency.sessions, notes }
        : { origin, specialty, international: origin === "International", notes };
      const summary = dialysis
        ? `${selectedFrequency.label} · ${shift} · ${money(selectedTier.fee)}/session`
        : `${origin} · ${specialty} · ${tier}`;
      const row = await createCareProgramBooking({ program, tier, summary, details, fee: selectedTier.fee });
      setDone(true);
      onBooked?.(row);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this request.");
    } finally {
      setSaving(false);
    }
  }

  const optionStyle = (active) => ({
    width: "100%", textAlign: "left", borderRadius: 12, padding: "11px 12px", cursor: "pointer",
    border: `2px solid ${active ? config.accent : "#E2E8F0"}`, background: active ? config.soft : "#fff",
    fontFamily: "inherit", color: "#0F172A",
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={config.title} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15,23,42,.55)", display: "flex", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
      <div onClick={(event) => event.stopPropagation()} style={{ width: "100%", maxWidth: 440, height: "100dvh", background: "#fff", display: "flex", flexDirection: "column" }}>
        <header style={{ padding: "14px 16px", background: config.soft, borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 44, height: 44, borderRadius: 13, background: "#fff", display: "grid", placeItems: "center", fontSize: 24 }}>{config.emoji}</span>
          <div style={{ flex: 1 }}><strong style={{ fontSize: 16, color: "#0F172A" }}>{config.title}</strong><div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{config.subtitle}</div></div>
          <button onClick={onClose} aria-label="Close" style={{ border: 0, background: "transparent", fontSize: 24, cursor: "pointer", color: "#64748B" }}>×</button>
        </header>

        {done ? (
          <main style={{ flex: 1, padding: 28, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div><div style={{ fontSize: 56 }}>✅</div><h2 style={{ color: "#0F172A", marginBottom: 8 }}>Request confirmed</h2><p style={{ color: "#64748B", lineHeight: 1.5 }}>{dialysis ? "Nearby dialysis centres will review your preferred schedule." : "A health coordinator will contact you to verify treatment and travel requirements."}</p><button onClick={onClose} style={{ marginTop: 18, width: "100%", border: 0, borderRadius: 12, padding: 13, background: config.accent, color: "#fff", fontWeight: 800, cursor: "pointer" }}>Done</button></div>
          </main>
        ) : (
          <>
            <main style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {dialysis ? <>
                <Field title="1 · Frequency"><div style={{ display: "grid", gap: 8 }}>{config.frequencies.map((item) => <button key={item.id} onClick={() => setFrequency(item.id)} style={optionStyle(frequency === item.id)}><strong>{item.label}</strong><div style={{ fontSize: 10.5, color: "#64748B", marginTop: 2 }}>{item.sessions} estimated session{item.sessions === 1 ? "" : "s"} in the first month</div></button>)}</div></Field>
                <Field title="2 · Preferred shift"><div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>{config.shifts.map((item) => <button key={item} onClick={() => setShift(item)} style={{ ...optionStyle(shift === item), textAlign: "center", padding: "12px 5px", fontSize: 12, fontWeight: 800 }}>{item}</button>)}</div></Field>
              </> : <>
                <Field title="1 · Travelling from"><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{config.origins.map((item) => <button key={item} onClick={() => setOrigin(item)} style={{ ...optionStyle(origin === item), textAlign: "center", fontWeight: 800 }}>{item}</button>)}</div></Field>
                <Field title="2 · Treatment"><select value={specialty} onChange={(event) => setSpecialty(event.target.value)} style={{ width: "100%", border: "1.5px solid #E2E8F0", borderRadius: 12, padding: 12, background: "#F8FAFC", fontWeight: 700 }}>{config.specialties.map((item) => <option key={item}>{item}</option>)}</select></Field>
              </>}
              <Field title={`${dialysis ? "3" : "3"} · Plan`}><div style={{ display: "grid", gap: 8 }}>{config.tiers.map((item) => <button key={item.id} onClick={() => setTier(item.id)} style={optionStyle(tier === item.id)}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>{item.label}</strong><strong style={{ color: config.accent }}>{item.fee ? money(item.fee) + (dialysis ? "/session" : "") : "Included"}</strong></div><div style={{ fontSize: 10.5, color: "#64748B", marginTop: 3 }}>{item.note}</div></button>)}</div></Field>
              <Field title="Notes · optional"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder={dialysis ? "Access needs, current centre or nephrologist instructions" : "Diagnosis, preferred city, travel dates or language"} style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #E2E8F0", borderRadius: 12, padding: 11, resize: "none", fontFamily: "inherit" }} /></Field>
              <div style={{ background: "#F8FAFC", borderRadius: 13, padding: 13, display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#64748B", fontSize: 12 }}>{dialysis ? "Estimated first month" : "Coordination fee"}</span><strong style={{ color: "#0F172A" }}>{estimate ? money(estimate) : "No upfront fee"}</strong></div>
              {!dialysis && origin === "International" && <p style={{ background: "#EFF6FF", color: "#1E40AF", borderRadius: 10, padding: 10, fontSize: 11, lineHeight: 1.45 }}>Your coordinator can guide visa and document preparation. Approval and issuance remain with the relevant authorities.</p>}
              {error && <p role="alert" style={{ color: "#B91C1C", fontSize: 12 }}>{error}</p>}
            </main>
            <footer style={{ padding: 16, borderTop: "1px solid #E2E8F0" }}><button disabled={saving} onClick={confirm} style={{ width: "100%", border: 0, borderRadius: 13, padding: 14, background: config.accent, color: "#fff", fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? .7 : 1 }}>{saving ? "Saving…" : "Review & confirm"}</button></footer>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ title, children }) {
  return <section style={{ marginBottom: 18 }}><h3 style={{ margin: "0 0 8px", fontSize: 13, color: "#0F172A" }}>{title}</h3>{children}</section>;
}