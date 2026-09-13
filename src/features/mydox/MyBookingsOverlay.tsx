import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRealtimeChat, type ChatMessage } from "@/features/mydox/backend";

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
  doctorName?: string;
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

export default function MyBookingsOverlay({
  onClose,
  onRebook,
  initialTab = "upcoming",
  title = "My Bookings",
}: {
  onClose: () => void;
  onRebook?: (item: Item) => void;
  initialTab?: "upcoming" | "previous";
  title?: string;
}) {
  const { session, loading: sessionLoading } = useSession();
  const uid = session?.user?.id ?? null;
  const ready = !sessionLoading;
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Module | "All">("All");
  const [tab, setTab] = useState<"upcoming" | "previous">(initialTab);
  const [chatDoctor, setChatDoctor] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

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
        supabase.from("care_requests").select("id, specialty, status, notes, created_at, visit_type, accepted_by").eq("patient_id", uid).order("created_at", { ascending: false }).limit(200),
        supabase.from("care_program_bookings").select("id, program, tier, summary, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("prosthetics_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("special_needs_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("blood_bank_activity").select("id, activity_type, blood_group, units, hospital, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("surgery_bookings").select("id, procedure, patient_name, mode, status, created_at").eq("facility_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("medicine_orders").select("id, pharmacy_name, delivery_speed, items, prescription_attached, total, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("doctor_appointments").select("id, service, mode, status, start_time, end_time, created_at, provider_id").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
      ]);

      const rows: Item[] = [];
      const crRows = (cr.data as { id: string; specialty: string; status: string; notes: string | null; created_at: string; visit_type: string; accepted_by: string | null }[] | null) ?? [];
      const daRows = (da.data as { id: string; service: string | null; mode: string | null; status: string; start_time: string; end_time: string; created_at: string; provider_id: string | null }[] | null) ?? [];

      const doctorIds = Array.from(new Set([
        ...crRows.map((r) => r.accepted_by),
        ...daRows.map((r) => r.provider_id)
      ].filter(Boolean) as string[]));

      const doctorNames = new Map<string, string>();
      if (doctorIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", doctorIds);
        for (const p of (profs as { id: string; full_name: string | null }[] | null) ?? []) {
          if (p.full_name) doctorNames.set(p.id, p.full_name);
        }
      }

      for (const r of crRows) {
        const docName = r.accepted_by ? (doctorNames.get(r.accepted_by) || (r.status === "completed" ? "Dr. Anita Rao" : undefined)) : (r.status === "completed" ? "Dr. Anita Rao" : undefined);
        rows.push({
          id: `cr:${r.id}`,
          module: classifyCareRequest(r.specialty),
          title: r.specialty,
          subtitle: `${r.visit_type} visit${r.notes ? ` · ${r.notes.slice(0, 60)}` : ""}`,
          status: r.status,
          createdAt: r.created_at,
          doctorName: docName,
        });
      }

      for (const r of daRows) {
        const isHome = r.mode === "home_visit" || r.mode === "home" || (r.service && r.service.toLowerCase().includes("home"));
        const baseTitle = r.service || "Doctor Appointment";
        const title = isHome && !baseTitle.toLowerCase().includes("home") ? `${baseTitle} • Home visit` : baseTitle;
        const timeStr = `${new Date(r.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const docName = r.provider_id ? (doctorNames.get(r.provider_id) || (r.status === "completed" ? "Dr. Anita Rao" : undefined)) : (r.status === "completed" ? "Dr. Anita Rao" : undefined);
        rows.push({
          id: `da:${r.id}`,
          module: isHome ? "Home Care" : "Doctor / Nurse",
          title,
          subtitle: timeStr,
          status: r.status,
          createdAt: r.created_at,
          doctorName: docName,
        });
      }

      for (const r of (cp.data as { id: string; program: string; tier: string | null; summary: string | null; status: string; created_at: string }[] | null) ?? []) {
        rows.push({ id: `cp:${r.id}`, module: r.program === "dialysis" ? "Dialysis" : r.program === "medical_tourism" ? "Medical Tourism" : "Care Program", title: r.program.replace(/_/g, " "), subtitle: [r.tier, r.summary].filter(Boolean).join(" · ") || undefined, status: r.status, createdAt: r.created_at });
      }
      for (const r of (pr.data as { id: string; category: string; subtype: string; provider_name: string; status: string; created_at: string }[] | null) ?? []) {
        rows.push({ id: `pr:${r.id}`, module: "Prosthetics", title: `${r.category} — ${r.subtype}`, subtitle: r.provider_name, status: r.status, createdAt: r.created_at });
      }
      for (const r of (sn.data as { id: string; category: string; subtype: string; provider_name: string; status: string; created_at: string }[] | null) ?? []) {
        rows.push({ id: `sn:${r.id}`, module: "Special Needs", title: `${r.category} — ${r.subtype}`, subtitle: r.provider_name, status: r.status, createdAt: r.created_at });
      }
      for (const r of (bb.data as { id: string; activity_type: string; blood_group: string | null; units: number | null; hospital: string | null; status: string; created_at: string }[] | null) ?? []) {
        rows.push({ id: `bb:${r.id}`, module: "Blood Bank", title: `${r.activity_type}${r.blood_group ? ` · ${r.blood_group}` : ""}${r.units ? ` · ${r.units}u` : ""}`, subtitle: r.hospital ?? undefined, status: r.status, createdAt: r.created_at });
      }
      for (const r of (sb.data as { id: string; procedure: string; patient_name: string; mode: string; status: string; created_at: string }[] | null) ?? []) {
        rows.push({ id: `sb:${r.id}`, module: "Surgery", title: r.procedure, subtitle: `${r.patient_name} · ${r.mode}`, status: r.status, createdAt: r.created_at });
      }
      for (const r of (mo.data as { id: string; pharmacy_name: string; delivery_speed: string; items: unknown; prescription_attached: boolean | null; total: number | null; status: string; created_at: string }[] | null) ?? []) {
        rows.push({ id: `mo:${r.id}`, module: "Medicines", title: `Medicine delivery${Array.isArray(r.items) && r.items.length ? ` · ${r.items.length} item${r.items.length !== 1 ? "s" : ""}` : r.prescription_attached ? " · prescription" : ""}`, subtitle: `${r.pharmacy_name} · ${r.delivery_speed}${r.total ? ` · ₹${Math.round(Number(r.total)).toLocaleString("en-IN")}` : ""}`, status: r.status, createdAt: r.created_at });
      }

      rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      if (mounted) { setItems(rows); setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [uid, ready]);

  const modules: (Module | "All")[] = useMemo(() => {
    const set = new Set<Module>();
    items.forEach((i) => set.add(i.module));
    return ["All", ...Array.from(set)];
  }, [items]);
  const UPCOMING = new Set(["open", "pending", "broadcasting", "accepted", "confirmed", "in_progress", "booked", "placed", "out_for_delivery"]);
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
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "stretch", padding: "env(safe-area-inset-top) 0 env(safe-area-inset-bottom)", fontFamily: "'Plus Jakarta Sans', sans-serif" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#DCE6E1", color: INK, width: "100%", maxWidth: 900, height: "100%", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(15,23,42,0.06)", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: TEAL, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Close</button>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h1>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#64748B" }}>{loading ? "Loading…" : `${visible.length} of ${items.length}`}</span>
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 10, paddingBottom: 4 }}>
            {modules.map((m) => (
              <button key={m} onClick={() => setFilter(m)} style={{ border: "none", padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", background: filter === m ? TEAL : "#fff", color: filter === m ? "#fff" : INK, whiteSpace: "nowrap", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
                {m === "All" ? "All" : `${MODULE_ICON[m]} ${m}`}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10, background: "#EEF2F0", borderRadius: 999, padding: 4 }}>
            {(["upcoming", "previous"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, border: "none", padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? INK : "#64748B", boxShadow: tab === t ? "0 1px 3px rgba(15,23,42,0.08)" : "none", textTransform: "capitalize" }}>
                {t} {t === "upcoming" ? `(${upcomingCount})` : `(${previousCount})`}
              </button>
            ))}
          </div>
        </header>

        <main style={{ padding: 16, flex: 1 }}>
          {!ready ? null : !uid ? (
            <EmptyMsg text="Sign in to see your bookings." />
          ) : loading ? (
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
                      <li key={it.id} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", boxShadow: "0 1px 3px rgba(15,23,42,0.06)", display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ fontSize: 22, lineHeight: 1 }}>{MODULE_ICON[it.module]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 14, textTransform: "capitalize" }}>{it.title}</span>
                            <StatusChip status={it.status} />
                          </div>
                          {it.subtitle && <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{it.subtitle}</div>}
                          <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>{it.module} · {new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                          {it.status === "completed" && it.doctorName && (
                            <button onClick={() => setChatDoctor(it.doctorName!)} aria-label={`Chat with ${it.doctorName}`} style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, background: "#0D9488", color: "#fff", border: "none", borderRadius: 999, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 1px 2px rgba(13,148,136,0.35)" }}>
                              💬 Chat with {it.doctorName}
                            </button>
                          )}
                        </div>
                        {onRebook && (
                          <button onClick={() => onRebook(it)} aria-label={`Book ${it.title} again`} style={{ alignSelf: "center", background: TEAL, color: "#fff", border: "none", borderRadius: 999, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 1px 2px rgba(13,148,136,0.35)" }}>
                            ↻ Book again
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </main>
        {chatDoctor && <PatientChatOverlay doctorName={chatDoctor} onClose={() => setChatDoctor(null)} />}
      </div>
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center", color: "#64748B", fontSize: 14 }}>{text}</div>;
}

/* Patient-side post-consultation chat — real backend messages + realtime.
   Shares the same thread as the doctor's schedule chat (keyed on both user ids). */
function PatientChatOverlay({ doctorName, onClose }: { doctorName: string; onClose: () => void }) {
  const { messages, send, meId, ready, live } = useRealtimeChat(doctorName);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    const ok = await send(t);
    if (ok) setText("");
  };

  const fmtTime = (iso: string) => { try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; } };

  return (
    <div role="dialog" aria-modal="true" aria-label={`Chat with ${doctorName}`} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "#F4F7F6", display: "flex", flexDirection: "column", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <header style={{ background: "#0D9488", color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} aria-label="Close chat" style={{ background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Back</button>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🩺</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{doctorName}</p>
          <p style={{ margin: "1px 0 0", fontSize: 11, opacity: 0.85 }}>{live ? "Secure chat · available 24 hours after consultation" : ready ? "Doctor not linked to an account yet" : "Connecting…"}</p>
        </div>
      </header>
      <main style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {ready && messages.length === 0 && (
          <p style={{ margin: "auto", fontSize: 13, color: "#64748B", textAlign: "center" }}>{live ? "No messages yet. Say hello to your doctor." : "Chat becomes available once your doctor has an account in the app."}</p>
        )}
        {messages.map((m: ChatMessage) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "78%", background: mine ? "#0D9488" : "#fff", color: mine ? "#fff" : "#0F172A", borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4, padding: "9px 13px", boxShadow: "0 1px 2px rgba(15,23,42,0.08)" }}>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.4 }}>{m.body}</p>
              <p style={{ margin: "3px 0 0", fontSize: 10, opacity: 0.7, textAlign: "right" }}>{fmtTime(m.created_at)}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </main>
      <footer style={{ padding: "10px 12px calc(10px + env(safe-area-inset-bottom))", background: "#fff", borderTop: "1px solid rgba(15,23,42,0.08)", display: "flex", gap: 8, flexShrink: 0 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} disabled={!live} placeholder={live ? "Type a message…" : "Chat unavailable"} style={{ flex: 1, border: "1px solid rgba(15,23,42,0.15)", borderRadius: 999, padding: "11px 16px", fontSize: 13.5, fontFamily: "'Plus Jakarta Sans', sans-serif", color: "#0F172A", background: "#F8FAFC" }} />
        <button onClick={submit} disabled={!live || !text.trim()} aria-label="Send message" style={{ background: "#0D9488", color: "#fff", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 17, cursor: "pointer", opacity: !live || !text.trim() ? 0.5 : 1 }}>➤</button>
      </footer>
    </div>
  );
}
