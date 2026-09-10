import React from "react";
import { supabase } from "@/integrations/supabase/client";

/* ── Drug / medicine delivery ────────────────────────────────────────
   Home Care → "Medicine Delivery". Patient uploads a prescription or
   types the medicines, picks a partner pharmacy and a delivery speed,
   confirms the address and places the order (persisted to
   public.medicine_orders).
─────────────────────────────────────────────────────────────────── */

const inr = (n) => "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");

export const DD_PHARMACIES = [
  { id: "medplus", name: "MedPlus Pharmacy", area: "Kothrud", eta: "45–60 min", rating: 4.6, off: 12 },
  { id: "apollo", name: "Apollo Pharmacy", area: "Baner", eta: "60–90 min", rating: 4.7, off: 15 },
  { id: "wellness", name: "Wellness Forever", area: "Aundh", eta: "40–55 min", rating: 4.5, off: 10 },
  { id: "hublocal", name: "MyDox Hub Pharmacy", area: "In-network", eta: "30–45 min", rating: 4.8, off: 18 },
];

export const DD_SPEEDS = [
  { id: "express", label: "Express", sub: "Within 90 minutes", fee: 79, emoji: "⚡" },
  { id: "sameday", label: "Same day", sub: "Delivered by tonight", fee: 39, emoji: "🛵" },
  { id: "scheduled", label: "Scheduled", sub: "Pick a date & time", fee: 0, emoji: "🗓" },
];

const C = {
  ink: "#0F172A", sub: "#64748B", faint: "#94A3B8", line: "#E2E8F0",
  canvas: "#F8FAFC", accent: "#059669", accentSoft: "#D1FAE5",
};

function Section({ title, hint, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: C.ink }}>
        {title}
        {hint && <span style={{ color: C.faint, fontWeight: 600, fontSize: 11 }}> · {hint}</span>}
      </p>
      {children}
    </div>
  );
}

export default function DrugDeliveryOverlay({ area = "Pune", onClose, onOrdered }) {
  const [mode, setMode] = React.useState("prescription"); // prescription | manual
  const [photo, setPhoto] = React.useState(null);
  const [lines, setLines] = React.useState([{ name: "", qty: "1 strip" }]);
  const [pharmacy, setPharmacy] = React.useState(DD_PHARMACIES[0].id);
  const [speed, setSpeed] = React.useState("express");
  const [when, setWhen] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [cold, setCold] = React.useState(false);
  const [repeat, setRepeat] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [done, setDone] = React.useState(null);
  const fileRef = React.useRef(null);

  const ph = DD_PHARMACIES.find((p) => p.id === pharmacy) || DD_PHARMACIES[0];
  const sp = DD_SPEEDS.find((s) => s.id === speed) || DD_SPEEDS[0];
  const items = lines.filter((l) => l.name.trim());
  const estItems = mode === "manual" ? items.length * 240 : photo ? 480 : 0;
  const deliveryFee = sp.fee + (cold ? 60 : 0);
  const total = estItems + deliveryFee;

  const canPlace =
    (mode === "prescription" ? !!photo : items.length > 0) &&
    address.trim().length >= 6 &&
    (speed !== "scheduled" || !!when);

  const place = async () => {
    setErr(null);
    setSaving(true);
    try {
      const { data: userRes, error: uErr } = await supabase.auth.getUser();
      if (uErr || !userRes?.user) throw new Error("Please sign in to order medicines.");
      const payload = {
        patient_id: userRes.user.id,
        pharmacy_name: ph.name,
        delivery_speed: speed,
        scheduled_at: speed === "scheduled" && when ? new Date(when).toISOString() : null,
        address: address.trim(),
        items: mode === "manual" ? items.map((l) => ({ name: l.name.trim(), qty: l.qty })) : [],
        prescription_attached: mode === "prescription" && !!photo,
        cold_chain: cold,
        repeat_monthly: repeat,
        items_total: estItems || null,
        delivery_fee: deliveryFee,
        total,
        notes: notes.trim() || null,
        status: "placed",
      };
      const { data, error } = await supabase.from("medicine_orders").insert(payload).select().single();
      if (error) throw error;
      onOrdered && onOrdered(data || payload);
      setDone(data || payload);
    } catch (e) {
      setErr(e.message || "Could not place the order.");
    } finally {
      setSaving(false);
    }
  };

  const wrap = {
    position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 9999,
    display: "flex", justifyContent: "center", fontFamily: "'Plus Jakarta Sans',sans-serif",
  };
  const panel = {
    background: "#fff", width: "100%", maxWidth: 440, height: "100dvh",
    display: "flex", flexDirection: "column",
  };
  const inputS = {
    width: "100%", border: `1.5px solid ${C.line}`, borderRadius: 12, padding: "11px 12px",
    fontSize: 13.5, fontWeight: 600, color: C.ink, outline: "none", fontFamily: "inherit",
    background: C.canvas, boxSizing: "border-box",
  };

  if (done)
    return (
      <div style={wrap}>
        <div style={panel}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "30px 26px", textAlign: "center" }}>
            <div style={{ width: 78, height: 78, borderRadius: "50%", background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, marginBottom: 18 }}>💊</div>
            <p style={{ margin: 0, fontSize: 21, fontWeight: 800, color: C.ink }}>Order placed</p>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: C.sub, lineHeight: 1.5, maxWidth: 300 }}>
              {ph.name} is verifying your order. A pharmacist will call if a substitution is needed, then a rider is assigned — {sp.label.toLowerCase()} delivery{speed === "express" ? " within 90 minutes" : ""}.
            </p>
            <div style={{ marginTop: 20, width: "100%", maxWidth: 320, background: C.canvas, borderRadius: 16, padding: "12px 16px", textAlign: "left" }}>
              {[
                ["Pharmacy", ph.name],
                ["Delivery", `${sp.emoji} ${sp.label}`],
                [mode === "manual" ? "Medicines" : "Prescription", mode === "manual" ? `${items.length} item${items.length !== 1 ? "s" : ""}` : "Attached ✓"],
                ["Payable", inr(total)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                  <span style={{ fontSize: 12.5, color: C.sub, fontWeight: 600 }}>{k}</span>
                  <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 800 }}>{v}</span>
                </div>
              ))}
            </div>
            {repeat && (
              <p style={{ margin: "14px 0 0", fontSize: 11.5, color: C.accent, fontWeight: 700 }}>🔁 Repeat monthly enabled — we'll remind you 3 days before refill.</p>
            )}
            <button onClick={onClose} style={{ marginTop: 22, width: "100%", maxWidth: 320, padding: 14, borderRadius: 13, border: "none", background: C.accent, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Done</button>
          </div>
        </div>
      </div>
    );

  return (
    <div style={wrap}>
      <div style={panel}>
        <div style={{ padding: "14px 16px", background: "linear-gradient(135deg,#D1FAE5,#fff)", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, border: `1.5px solid ${C.accent}` }}>💊</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>Medicine Delivery</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 1 }}>Prescription drugs to your door · {area}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: C.sub, padding: "4px 8px" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", scrollbarWidth: "none" }}>
          <Section title="1 · How do we know what to send?">
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {[["prescription", "📄 Upload prescription"], ["manual", "✍️ Type medicines"]].map(([id, lbl]) => {
                const on = mode === id;
                return (
                  <button key={id} onClick={() => setMode(id)} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, border: `2px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff", color: C.ink, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>{lbl}</button>
                );
              })}
            </div>

            {mode === "prescription" ? (
              <div>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(e) => setPhoto(e.target.files?.[0]?.name || null)} />
                <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "18px 12px", borderRadius: 14, border: `2px dashed ${photo ? C.accent : C.line}`, background: photo ? C.accentSoft : C.canvas, cursor: "pointer", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 26 }}>{photo ? "✅" : "📄"}</div>
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 800, color: C.ink }}>{photo ? photo : "Tap to attach prescription"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 10.5, color: C.faint }}>Photo or PDF · a registered pharmacist verifies it before dispatch</p>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {lines.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 8 }}>
                    <input value={l.name} placeholder="Medicine name & strength" onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} style={{ ...inputS, flex: 2 }} />
                    <input value={l.qty} placeholder="Qty" onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} style={{ ...inputS, flex: 1 }} />
                    {lines.length > 1 && (
                      <button onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} style={{ border: "none", background: "transparent", color: C.faint, fontSize: 18, cursor: "pointer" }}>×</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setLines((ls) => [...ls, { name: "", qty: "1 strip" }])} style={{ alignSelf: "flex-start", border: "none", background: "transparent", color: C.accent, fontSize: 12.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>+ Add another medicine</button>
                <p style={{ margin: 0, fontSize: 10.5, color: C.faint, lineHeight: 1.4 }}>Schedule-H drugs still need a valid prescription — the pharmacist will ask for it before dispatch.</p>
              </div>
            )}
          </Section>

          <Section title="2 · Pharmacy" hint="nearest partners">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {DD_PHARMACIES.map((p) => {
                const on = pharmacy === p.id;
                return (
                  <button key={p.id} onClick={() => setPharmacy(p.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${on ? C.accent : C.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <span style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent }} />}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.ink }}>{p.name}</p>
                      <p style={{ margin: "1px 0 0", fontSize: 10.5, color: C.faint }}>{p.area} · ⭐ {p.rating} · {p.eta}</p>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 800, color: C.accent, background: "#ECFDF5", borderRadius: 99, padding: "3px 8px", flexShrink: 0 }}>{p.off}% OFF</span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="3 · Delivery speed">
            <div style={{ display: "flex", gap: 8 }}>
              {DD_SPEEDS.map((s) => {
                const on = speed === s.id;
                return (
                  <button key={s.id} onClick={() => setSpeed(s.id)} style={{ flex: 1, padding: "12px 6px", borderRadius: 14, border: `2px solid ${on ? C.accent : C.line}`, background: on ? C.accentSoft : "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ fontSize: 20 }}>{s.emoji}</div>
                    <p style={{ margin: "4px 0 0", fontSize: 12, fontWeight: 800, color: C.ink }}>{s.label}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 9.5, color: C.faint, lineHeight: 1.25 }}>{s.sub}</p>
                    <p style={{ margin: "4px 0 0", fontSize: 10.5, fontWeight: 800, color: C.accent }}>{s.fee ? inr(s.fee) : "Free"}</p>
                  </button>
                );
              })}
            </div>
            {speed === "scheduled" && (
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ ...inputS, marginTop: 10 }} />
            )}
          </Section>

          <Section title="4 · Delivery address">
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Flat / building, street, landmark, pincode" style={{ ...inputS, resize: "none" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {[
                ["cold", cold, setCold, "❄️ Cold-chain items", `Insulin, vaccines etc. · +${inr(60)}`],
                ["repeat", repeat, setRepeat, "🔁 Repeat every month", "Auto-reminder 3 days before refill"],
              ].map(([k, val, set, label, sub]) => (
                <button key={k} onClick={() => set((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 13, border: `2px solid ${val ? C.accent : C.line}`, background: val ? C.accentSoft : "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 800, color: C.ink }}>{label}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 10.5, color: C.faint }}>{sub}</p>
                  </div>
                  <span style={{ width: 42, height: 24, borderRadius: 99, background: val ? C.accent : C.line, position: "relative", flexShrink: 0, transition: "background .2s" }}>
                    <span style={{ position: "absolute", top: 2, left: val ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
                  </span>
                </button>
              ))}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Notes for the pharmacist (allergies, substitution preference…)" style={{ ...inputS, resize: "none", marginTop: 10 }} />
          </Section>

          {err && <p style={{ margin: "0 0 10px", fontSize: 12, color: "#B91C1C", fontWeight: 700 }}>{err}</p>}
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 16px 16px", background: "#fff" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: C.faint, fontWeight: 600 }}>Medicines (estimate)</span>
              <span style={{ fontSize: 11.5, color: C.sub, fontWeight: 800 }}>{estItems ? inr(estItems) : "On verification"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11.5, color: C.faint, fontWeight: 600 }}>Delivery{cold ? " + cold chain" : ""}</span>
              <span style={{ fontSize: 11.5, color: C.sub, fontWeight: 800 }}>{deliveryFee ? inr(deliveryFee) : "Free"}</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: C.faint, fontWeight: 700 }}>Payable now</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>{inr(total)}</span>
          </div>
          <button
            disabled={!canPlace || saving}
            onClick={place}
            style={{ width: "100%", padding: 14, borderRadius: 13, border: "none", background: canPlace && !saving ? C.accent : "#CBD5E1", color: "#fff", fontSize: 14.5, fontWeight: 800, cursor: canPlace && !saving ? "pointer" : "not-allowed", fontFamily: "inherit" }}
          >
            {saving ? "Placing order…" : "Place order"}
          </button>
          <p style={{ margin: "8px 0 0", fontSize: 10, color: C.faint, textAlign: "center", lineHeight: 1.4 }}>
            Final amount is confirmed by the pharmacist after prescription verification. Pay on delivery available.
          </p>
        </div>
      </div>
    </div>
  );
}
