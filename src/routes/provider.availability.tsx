import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProviderHomeSettings } from "@/features/mydox/home-visits/HomeVisitPanel";

export const Route = createFileRoute("/provider/availability")({
  head: () => ({
    meta: [
      { title: "Availability — MyDox Provider" },
      { name: "description", content: "Set your working hours, block dates and toggle services on/off. Dispatch respects your settings in real time." },
    ],
  }),
  component: ProviderAvailability,
});

type Interval = { start: string; end: string };
type WeekHours = Record<string, Interval[]>;
type DndWindow = { start: string; end: string; days: string[]; label?: string };

const DAYS: [string, string][] = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"],
  ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const DEFAULT_SERVICES = [
  "General Physician", "Pediatrician", "Cardiologist", "Dermatologist",
  "Home Nurse", "Physiotherapist", "Lab Technician", "Scan Technician",
  "OT Technician", "Home Care",
];

const DUTY_PREF_OPTIONS = [
  { id: "all", label: "All" },
  { id: "ward", label: "Ward" },
  { id: "icu", label: "ICU" },
  { id: "emergency", label: "Emergency" },
  { id: "night", label: "Night shift" },
];

const DEFAULT_HOURS: WeekHours = {
  mon: [{ start: "09:00", end: "17:00" }],
  tue: [{ start: "09:00", end: "17:00" }],
  wed: [{ start: "09:00", end: "17:00" }],
  thu: [{ start: "09:00", end: "17:00" }],
  fri: [{ start: "09:00", end: "17:00" }],
  sat: [{ start: "10:00", end: "14:00" }],
  sun: [],
};

function ProviderAvailability() {
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [isOnline, setIsOnline] = useState(true);
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [hours, setHours] = useState<WeekHours>(DEFAULT_HOURS);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [newBlock, setNewBlock] = useState("");
  const [serviceOnline, setServiceOnline] = useState<Record<string, boolean>>({});
  const [customService, setCustomService] = useState("");
  const [dndWindows, setDndWindows] = useState<DndWindow[]>([]);
  const [dndAllowEmergency, setDndAllowEmergency] = useState(true);
  const [isCarePhysician, setIsCarePhysician] = useState(false);
  const [cpDutyTypes, setCpDutyTypes] = useState<string[]>(["all"]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const u = sess.session?.user?.id;
      if (!u) { window.location.href = "/auth"; return; }
      setUid(u);
      const { data } = await supabase.from("provider_availability").select("*").eq("user_id", u).maybeSingle();
      if (data) {
        setIsOnline(!!data.is_online);
        setTimezone(data.timezone || "Asia/Kolkata");
        const wh = (data.working_hours as WeekHours) || {};
        setHours(Object.keys(wh).length ? { ...DEFAULT_HOURS, ...wh } : DEFAULT_HOURS);
        setBlocked((data.blocked_dates as string[]) || []);
        setServiceOnline((data.service_online as Record<string, boolean>) || {});
        setDndWindows(((data as unknown as { dnd_windows?: DndWindow[] }).dnd_windows) || []);
        setDndAllowEmergency((data as unknown as { dnd_allow_emergency?: boolean }).dnd_allow_emergency !== false);
      }
      const { data: cpData } = await supabase.from("care_physician_profiles").select("duty_types").eq("user_id", u).maybeSingle();
      if (cpData) {
        setIsCarePhysician(true);
        if (cpData.duty_types && cpData.duty_types.length) {
          setCpDutyTypes(cpData.duty_types);
        }
      } else {
        const { data: prof } = await supabase.from("profiles").select("view").eq("id", u).maybeSingle();
        if (prof?.view === "care_physician") {
          setIsCarePhysician(true);
        }
      }
      setLoading(false);
    })();
  }, []);

  function handleCpDutyToggle(id: string) {
    setCpDutyTypes((current) => {
      const active = current || ["all"];
      if (id === "all") {
        return ["all"];
      }
      const withoutAll = active.filter((x) => x !== "all");
      const next = withoutAll.includes(id)
        ? withoutAll.filter((x) => x !== id)
        : [...withoutAll, id];
      return next.length === 0 ? ["all"] : next;
    });
  }

  const allServices = useMemo(() => {
    const set = new Set(DEFAULT_SERVICES);
    Object.keys(serviceOnline).forEach(k => set.add(k));
    return Array.from(set);
  }, [serviceOnline]);

  async function save() {
    if (!uid) return;
    setSaving(true); setMsg(null);
    const { error } = await supabase.from("provider_availability").upsert({
      user_id: uid,
      is_online: isOnline,
      timezone,
      working_hours: hours,
      blocked_dates: blocked,
      service_online: serviceOnline,
      dnd_windows: dndWindows,
      dnd_allow_emergency: dndAllowEmergency,
    } as never, { onConflict: "user_id" });

    if (isCarePhysician) {
      await supabase.from("care_physician_profiles").upsert({
        user_id: uid,
        duty_types: cpDutyTypes,
        qualification: "mbbs",
      } as never, { onConflict: "user_id" });
    }

    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : "Saved. Dispatch will respect these settings.");
    if (!error) setTimeout(() => setMsg(null), 3000);
  }

  function addInterval(day: string) {
    setHours(h => ({ ...h, [day]: [...(h[day] || []), { start: "09:00", end: "17:00" }] }));
  }
  function updateInterval(day: string, i: number, patch: Partial<Interval>) {
    setHours(h => ({ ...h, [day]: h[day].map((iv, idx) => idx === i ? { ...iv, ...patch } : iv) }));
  }
  function removeInterval(day: string, i: number) {
    setHours(h => ({ ...h, [day]: h[day].filter((_, idx) => idx !== i) }));
  }
  function closeDay(day: string) {
    setHours(h => ({ ...h, [day]: [] }));
  }

  if (loading) return <div style={S.page}><div style={S.card}>Loading…</div></div>;

  return (
    <div style={S.page}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0" }}>
          <div>
            <Link to="/" style={{ color: "#0D9488", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>← Back</Link>
            <h1 style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 800, color: "#0F172A" }}>Availability</h1>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>Dispatch respects everything you set here.</p>
          </div>
          <button onClick={save} disabled={saving} style={S.saveBtn}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>

        {msg && <div style={{ ...S.card, background: msg.startsWith("Error") ? "#FEE2E2" : "#D1FAE5", color: msg.startsWith("Error") ? "#991B1B" : "#065F46", fontWeight: 700 }}>{msg}</div>}

        <div className="hv"><ProviderHomeSettings /></div>

        {/* Care Physician Duty Preferences */}
        {isCarePhysician && (
          <div style={S.card}>
            <div style={S.h2}>Hospital Duty Preferences</div>
            <div style={S.hint}>Choose which types of hospital duties you want to receive. Multiple choice except All.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {DUTY_PREF_OPTIONS.map((opt) => {
                const isAll = opt.id === "all";
                const isAllActive = !cpDutyTypes || cpDutyTypes.length === 0 || cpDutyTypes.includes("all");
                const active = isAll ? isAllActive : (!isAllActive && cpDutyTypes.includes(opt.id));
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCpDutyToggle(opt.id)}
                    style={{
                      border: `2px solid ${active ? "#6D28D9" : "#E2E8F0"}`,
                      background: active ? "#F5F3FF" : "#FFFFFF",
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
          </div>
        )}

        {/* Master toggle */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={S.h2}>{isOnline ? "🟢 Online" : "🔴 Offline"}</div>
              <div style={S.hint}>Master switch. Off = no new dispatches at all.</div>
            </div>
            <Toggle on={isOnline} onChange={setIsOnline} />
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
            <label style={S.label}>Timezone</label>
            <input value={timezone} onChange={e => setTimezone(e.target.value)} style={S.input} placeholder="Asia/Kolkata" />
          </div>
        </div>

        {/* Working hours */}
        <div style={S.card}>
          <div style={S.h2}>Working hours</div>
          <div style={S.hint}>Add time windows per day. Empty = closed. Any windows = only accept during those windows.</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {DAYS.map(([key, label]) => {
              const ivs = hours[key] || [];
              return (
                <div key={key} style={S.dayRow}>
                  <div style={{ width: 90, fontWeight: 700, color: "#0F172A" }}>{label}</div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {ivs.length === 0 && <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>Closed</div>}
                    {ivs.map((iv, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="time" value={iv.start} onChange={e => updateInterval(key, i, { start: e.target.value })} style={S.time} />
                        <span style={{ color: "#94A3B8" }}>–</span>
                        <input type="time" value={iv.end} onChange={e => updateInterval(key, i, { end: e.target.value })} style={S.time} />
                        <button onClick={() => removeInterval(key, i)} style={S.iconBtn} aria-label="Remove">✕</button>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => addInterval(key)} style={S.smBtn}>+ Add window</button>
                      {ivs.length > 0 && <button onClick={() => closeDay(key)} style={{ ...S.smBtn, color: "#DC2626" }}>Close day</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blocked dates */}
        <div style={S.card}>
          <div style={S.h2}>Blocked dates</div>
          <div style={S.hint}>Holidays, leave, personal days. You won't receive any dispatch these days.</div>
          <div style={{ marginTop: 10, display: "flex", gap: 6, alignItems: "center" }}>
            <input type="date" value={newBlock} onChange={e => setNewBlock(e.target.value)} style={S.input} />
            <button onClick={() => { if (newBlock && !blocked.includes(newBlock)) { setBlocked([...blocked, newBlock].sort()); setNewBlock(""); } }} style={S.smBtn}>Add</button>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
            {blocked.length === 0 && <div style={{ fontSize: 12, color: "#94A3B8" }}>None</div>}
            {blocked.map(d => (
              <span key={d} style={S.chip}>
                {d}
                <button onClick={() => setBlocked(blocked.filter(x => x !== d))} style={{ marginLeft: 6, background: "transparent", border: "none", cursor: "pointer", color: "#64748B" }}>✕</button>
              </span>
            ))}
          </div>
        </div>

        {/* Per-service toggles */}
        <div style={S.card}>
          <div style={S.h2}>Services</div>
          <div style={S.hint}>Turn specific service types on or off. Anything left "On" (default) receives dispatch.</div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {allServices.map(svc => {
              const on = serviceOnline[svc] !== false;
              return (
                <div key={svc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 14, color: "#0F172A" }}>{svc}</div>
                  <Toggle on={on} onChange={v => setServiceOnline({ ...serviceOnline, [svc]: v })} />
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <input value={customService} onChange={e => setCustomService(e.target.value)} placeholder="Add custom service" style={S.input} />
            <button onClick={() => { const s = customService.trim(); if (s) { setServiceOnline({ ...serviceOnline, [s]: true }); setCustomService(""); } }} style={S.smBtn}>Add</button>
          </div>
        </div>

        {/* Do-Not-Disturb windows */}
        <div style={S.card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={S.h2}>🌙 Do-Not-Disturb windows</div>
              <div style={S.hint}>Separate from working hours. Non-emergency requests are auto-declined during these windows.</div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#FEF3C7", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>Let emergencies ring through</div>
            <Toggle on={dndAllowEmergency} onChange={setDndAllowEmergency} />
          </div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {dndWindows.length === 0 && (
              <div style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>No DND windows. Add one below (e.g. sleep 22:00 – 07:00).</div>
            )}
            {dndWindows.map((w, i) => (
              <div key={i} style={{ border: "1px solid #E2E8F0", borderRadius: 10, padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <input
                    placeholder="Label (e.g. Sleep)"
                    value={w.label || ""}
                    onChange={e => setDndWindows(ws => ws.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    style={{ ...S.input, flex: 1 }}
                  />
                  <input type="time" value={w.start} onChange={e => setDndWindows(ws => ws.map((x, idx) => idx === i ? { ...x, start: e.target.value } : x))} style={S.time} />
                  <span style={{ color: "#94A3B8" }}>–</span>
                  <input type="time" value={w.end} onChange={e => setDndWindows(ws => ws.map((x, idx) => idx === i ? { ...x, end: e.target.value } : x))} style={S.time} />
                  <button onClick={() => setDndWindows(ws => ws.filter((_, idx) => idx !== i))} style={S.iconBtn} aria-label="Remove">✕</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {DAYS.map(([key, label]) => {
                    const active = (w.days || []).includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => setDndWindows(ws => ws.map((x, idx) => {
                          if (idx !== i) return x;
                          const days = x.days || [];
                          return { ...x, days: active ? days.filter(d => d !== key) : [...days, key] };
                        }))}
                        style={{
                          padding: "4px 10px", fontSize: 11, fontWeight: 700, borderRadius: 99,
                          border: active ? "1px solid #6366F1" : "1px solid #E2E8F0",
                          background: active ? "#EEF2FF" : "#fff",
                          color: active ? "#4338CA" : "#64748B", cursor: "pointer",
                        }}
                      >{label.slice(0, 3)}</button>
                    );
                  })}
                  {(w.days || []).length === 0 && (
                    <span style={{ fontSize: 10, color: "#94A3B8", alignSelf: "center", marginLeft: 4 }}>every day</span>
                  )}
                </div>
                {w.start && w.end && w.start > w.end && (
                  <div style={{ marginTop: 6, fontSize: 10, color: "#6366F1" }}>Overnight window (crosses midnight)</div>
                )}
              </div>
            ))}
            <button
              onClick={() => setDndWindows(ws => [...ws, { start: "22:00", end: "07:00", days: [], label: "Sleep" }])}
              style={S.smBtn}
            >+ Add DND window</button>
          </div>
        </div>


        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} aria-pressed={on} style={{
      width: 46, height: 26, borderRadius: 99, border: "none", cursor: "pointer",
      background: on ? "#10B981" : "#CBD5E1", position: "relative", transition: "background .15s",
    }}>
      <span style={{
        position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
        background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .15s",
      }} />
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", paddingBottom: 40 },
  card: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: 14, marginBottom: 12, boxShadow: "0 1px 3px rgba(15,23,42,.04)" },
  h2: { fontSize: 15, fontWeight: 800, color: "#0F172A", marginBottom: 2 },
  hint: { fontSize: 12, color: "#64748B" },
  label: { fontSize: 12, fontWeight: 700, color: "#475569" },
  input: { flex: 1, padding: "8px 10px", fontSize: 13, border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#0F172A" },
  time: { padding: "6px 8px", fontSize: 13, border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", color: "#0F172A" },
  smBtn: { padding: "6px 10px", fontSize: 12, fontWeight: 700, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", color: "#0F172A" },
  iconBtn: { padding: "4px 8px", fontSize: 12, background: "transparent", border: "1px solid #E2E8F0", borderRadius: 6, cursor: "pointer", color: "#64748B" },
  saveBtn: { padding: "9px 18px", fontSize: 14, fontWeight: 800, background: "linear-gradient(135deg,#0D9488,#14B8A6)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer", boxShadow: "0 2px 6px -2px rgba(13,148,136,.5)" },
  dayRow: { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid #F1F5F9" },
  chip: { display: "inline-flex", alignItems: "center", padding: "4px 8px", fontSize: 12, fontWeight: 700, background: "#FEF3C7", color: "#92400E", borderRadius: 99 },
};
