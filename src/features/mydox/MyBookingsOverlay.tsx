import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, cancelDoctorAppointment, rescheduleDoctorAppointment } from "@/features/mydox/backend";
import { SlotPickerCalendarStandalone } from "./SlotPickerCalendar";
type Module =
  | "Doctor / Nurse"
  | "Lab / Scan"
  | "Home Care"
  | "Medicines"
  | "Care Program"
  | "Dialysis"
  | "Medical Tourism"
  | "Prosthetics"
  | "Special Needs"
  | "Blood Bank"
  | "Surgery";

type Item = {
  id: string;
  module: Module;
  title: string;
  subtitle?: string;
  status: string;
  createdAt: string;
  raw?: any;
};

const TEAL = "#0D9488";
const INK = "#0F172A";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#DBEAFE", fg: "#1E40AF" },
  pending: { bg: "#FEF3C7", fg: "#92400E" },
  broadcasting: { bg: "#EDE9FE", fg: "#5B21B6" },
  accepted: { bg: "#D1FAE5", fg: "#065F46" },
  confirmed: { bg: "#D1FAE5", fg: "#065F46" },
  in_progress: { bg: "#DBEAFE", fg: "#1E3A8A" },
  booked: { bg: "#CCFBF1", fg: "#134E4A" },
  completed: { bg: "#E5E7EB", fg: "#374151" },
  cancelled: { bg: "#FEE2E2", fg: "#991B1B" },
  declined: { bg: "#FEE2E2", fg: "#991B1B" },
  placed: { bg: "#D1FAE5", fg: "#065F46" },
  out_for_delivery: { bg: "#DBEAFE", fg: "#1E3A8A" },
  delivered: { bg: "#E5E7EB", fg: "#374151" },

};

function StatusChip({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#E5E7EB", fg: "#374151" };
  return (
    <span style={{ background: s.bg, color: s.fg, padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600, textTransform: "capitalize", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const MODULE_ICON: Record<Module, string> = {
  "Doctor / Nurse": "🩺",
  "Lab / Scan": "🧪",
  "Home Care": "🏠",
  Medicines: "💊",
  "Care Program": "💚",
  Dialysis: "💧",
  "Medical Tourism": "✈️",
  Prosthetics: "🦿",
  "Special Needs": "🤝",
  "Blood Bank": "🩸",
  Surgery: "🏥",
};

function classifyCareRequest(specialty: string): Module {
  const s = specialty.toLowerCase();
  if (/(lab|scan|xray|mri|ct|ultrasound|blood test)/.test(s)) return "Lab / Scan";
  if (/(home|nurse|physio|caretaker)/.test(s)) return "Home Care";
  return "Doctor / Nurse";
}

export default function MyBookingsOverlay({ onClose, onRebook }: { onClose: () => void; onRebook?: (item: Item) => void }) {
  const { session, loading: sessionLoading } = useSession();
  const uid = session?.user?.id ?? null;
  const ready = !sessionLoading;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Module | "All">("All");
  const [tab, setTab] = useState<"upcoming" | "previous">("upcoming");
  const [trigger, setTrigger] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<Item | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!ready) return;
    if (!uid) { setLoading(false); return; }
    let mounted = true;
    (async () => {
      setLoading(true);
      const [cr, cp, pr, sn, bb, sb, mo, da] = await Promise.all([
        supabase.from("care_requests").select("id, specialty, status, notes, created_at, visit_type").eq("patient_id", uid).order("created_at", { ascending: false }).limit(200),
        supabase.from("care_program_bookings").select("id, program, tier, summary, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("prosthetics_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("special_needs_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("blood_bank_activity").select("id, activity_type, blood_group, units, hospital, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("surgery_bookings").select("id, procedure, patient_name, mode, status, created_at").eq("facility_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("medicine_orders").select("id, pharmacy_name, delivery_speed, items, prescription_attached, total, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("doctor_appointments").select("id, service, status, home_visit_status, address_snapshot, arrival_otp, eta_minutes, start_time, end_time, created_at, provider_id").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
      ]);

      const rows: Item[] = [];
      for (const r of (cr.data as any[] | null) ?? []) rows.push({ id: `cr:${r.id}`, module: classifyCareRequest(r.specialty), title: r.specialty, subtitle: `${r.visit_type} visit${r.notes ? ` · ${r.notes.slice(0, 60)}` : ""}`, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (cp.data as any[] | null) ?? []) rows.push({ id: `cp:${r.id}`, module: r.program === "dialysis" ? "Dialysis" : r.program === "medical_tourism" ? "Medical Tourism" : "Care Program", title: r.program.replace(/_/g, " "), subtitle: [r.tier, r.summary].filter(Boolean).join(" · ") || undefined, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (pr.data as any[] | null) ?? []) rows.push({ id: `pr:${r.id}`, module: "Prosthetics", title: `${r.category} — ${r.subtype}`, subtitle: r.provider_name, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (sn.data as any[] | null) ?? []) rows.push({ id: `sn:${r.id}`, module: "Special Needs", title: `${r.category} — ${r.subtype}`, subtitle: r.provider_name, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (bb.data as any[] | null) ?? []) rows.push({ id: `bb:${r.id}`, module: "Blood Bank", title: `${r.activity_type}${r.blood_group ? ` · ${r.blood_group}` : ""}${r.units ? ` · ${r.units}u` : ""}`, subtitle: r.hospital ?? undefined, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (sb.data as any[] | null) ?? []) rows.push({ id: `sb:${r.id}`, module: "Surgery", title: r.procedure, subtitle: `${r.patient_name} · ${r.mode}`, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (mo.data as any[] | null) ?? []) rows.push({ id: `mo:${r.id}`, module: "Medicines", title: `Medicine delivery${Array.isArray(r.items) && r.items.length ? ` · ${r.items.length} item${r.items.length !== 1 ? "s" : ""}` : r.prescription_attached ? " · prescription" : ""}`, subtitle: `${r.pharmacy_name} · ${r.delivery_speed}${r.total ? ` · ₹${Math.round(Number(r.total)).toLocaleString("en-IN")}` : ""}`, status: r.status, createdAt: r.created_at, raw: r });
      for (const r of (da.data as any[] | null) ?? []) rows.push({ id: `da:${r.id}`, module: "Doctor / Nurse", title: r.service || "Doctor Appointment", subtitle: `${r.service} · ${new Date(r.start_time).toLocaleDateString()} ${new Date(r.start_time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`, status: r.home_visit_status || r.status, createdAt: r.created_at, raw: r });

      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (mounted) { setItems(rows); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [uid, ready, trigger]);

  const modules: (Module | "All")[] = useMemo(() => {
    const set = new Set<Module>();
    items.forEach((i) => set.add(i.module));
    return ["All", ...Array.from(set)];
  }, [items]);
  const UPCOMING = new Set(["open", "pending", "broadcasting", "accepted", "confirmed", "en_route", "arrived", "in_consultation", "in_progress", "booked", "placed", "out_for_delivery"]);
  const byTab = items.filter((i) => (tab === "upcoming" ? UPCOMING.has(i.status) : !UPCOMING.has(i.status)));
  const visible = filter === "All" ? byTab : byTab.filter((i) => i.module === filter);
  const upcomingCount = items.filter((i) => UPCOMING.has(i.status)).length;
  const previousCount = items.length - upcomingCount;

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    const sorted = [...visible].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const it of sorted) {
      const key = new Date(it.createdAt).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries());
  }, [visible]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
      <div style={{ background: "#F8FAFC", borderRadius: 20, width: "100%", maxWidth: 640, height: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
        <header style={{ padding: "16px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: INK }}>My Bookings</h1>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>Track appointments, Home Visits, lab orders & care requests</p>
          </div>
          <button onClick={onClose} aria-label="Close my bookings" style={{ background: "#F1F5F9", border: "none", borderRadius: 999, width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#475569" }}>✕</button>
        </header>

        <div style={{ padding: "12px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={() => setTab("upcoming")} style={{ flex: 1, padding: "8px 12px", borderRadius: 999, border: "none", background: tab === "upcoming" ? TEAL : "#F1F5F9", color: tab === "upcoming" ? "#fff" : "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Upcoming ({upcomingCount})
          </button>
          <button onClick={() => setTab("previous")} style={{ flex: 1, padding: "8px 12px", borderRadius: 999, border: "none", background: tab === "previous" ? TEAL : "#F1F5F9", color: tab === "previous" ? "#fff" : "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Past / Completed ({previousCount})
          </button>
        </div>

        {modules.length > 2 && (
          <div style={{ padding: "10px 20px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", gap: 6, overflowX: "auto" }}>
            {modules.map((m) => (
              <button key={m} onClick={() => setFilter(m)} style={{ padding: "4px 12px", borderRadius: 999, border: filter === m ? `1px solid ${TEAL}` : "1px solid #E2E8F0", background: filter === m ? "#F0FDFA" : "#fff", color: filter === m ? TEAL : "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                {m}
              </button>
            ))}
          </div>
        )}

        <main style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {loading ? (
            <EmptyMsg text="Loading your bookings…" />
          ) : visible.length === 0 ? (
            <EmptyMsg text={tab === "upcoming" ? "No upcoming bookings. New bookings appear here until they're completed or cancelled." : "No previous bookings yet."} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {grouped.map(([date, rows]) => (
                <section key={date}>
                  <h2 style={{ margin: "0 0 8px 4px", fontSize: 12, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>{date}</h2>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                    {rows.map((it) => (
                      <li key={it.id} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                          <div style={{ fontSize: 22, lineHeight: 1 }}>{MODULE_ICON[it.module]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, fontSize: 14, textTransform: "capitalize" }}>{it.title}</span>
                              <StatusChip status={it.status} />
                            </div>
                            {it.subtitle && <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{it.subtitle}</div>}
                            {it.raw?.address_snapshot?.full_address && (
                              <div style={{ color: "#64748B", fontSize: 11.5, marginTop: 3 }}>📍 {it.raw.address_snapshot.full_address}</div>
                            )}
                            <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>{it.module} · {new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                          {it.id.startsWith("da:") && ["confirmed", "rescheduled", "pending"].includes(it.status) ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, alignSelf: "center" }}>
                              <button onClick={() => setRescheduling(it)} disabled={busyId === it.id} style={{ background: "#F1F5F9", color: INK, border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: busyId === it.id ? "wait" : "pointer" }}>
                                Reschedule
                              </button>
                              <button onClick={async () => {
                                if (!confirm("Are you sure you want to cancel this appointment?")) return;
                                setBusyId(it.id);
                                try { await cancelDoctorAppointment(it.raw.id); setTrigger(t => t + 1); } 
                                catch (e: any) { alert(e.message); }
                                setBusyId(null);
                              }} disabled={busyId === it.id} style={{ background: "#FEE2E2", color: "#991B1B", border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: busyId === it.id ? "wait" : "pointer" }}>
                                Cancel
                              </button>
                            </div>
                          ) : onRebook && (
                            <button onClick={() => onRebook(it)} aria-label={`Book ${it.title} again`} style={{ alignSelf: "center", background: TEAL, color: "#fff", border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 1px 2px rgba(13,148,136,0.35)" }}>
                              ↻ Book again
                            </button>
                          )}
                        </div>
                        {it.raw?.arrival_otp && ["en_route", "arrived"].includes(it.raw.home_visit_status || it.status) && (
                          <div style={{ background: "#F0FDF4", border: "1.5px dashed #16A34A", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 12, color: "#15803D", fontWeight: 700 }}>
                              🔑 Doctor Arrival Code: <strong style={{ fontSize: 15, color: "#166534", letterSpacing: 1 }}>{it.raw.arrival_otp}</strong>
                            </span>
                            {it.raw?.eta_minutes && <span style={{ fontSize: 11, color: "#15803D", fontWeight: 800 }}>ETA ~{it.raw.eta_minutes}m</span>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>

      {rescheduling && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Select New Time</h3>
              <button onClick={() => setRescheduling(null)} style={{ background: "transparent", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>
            <div style={{ padding: 16, overflowY: "auto" }}>
              <SlotPickerCalendarStandalone 
                days={7}
                seed={rescheduling.raw.provider_id}
                value={undefined}
                onChange={async (iso: string) => {
                  if (!iso) return;
                  try {
                    setBusyId(rescheduling.id);
                    const start = new Date(iso);
                    const end = new Date(start.getTime() + 30 * 60000);
                    await rescheduleDoctorAppointment(rescheduling.raw.id, start.toISOString(), end.toISOString());
                    setRescheduling(null);
                    setTrigger(t => t + 1);
                  } catch (e: any) {
                    alert(e.message);
                  } finally {
                    setBusyId(null);
                  }
                }} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center", color: "#64748B", fontSize: 14 }}>{text}</div>;
}
