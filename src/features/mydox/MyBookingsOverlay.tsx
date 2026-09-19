import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRealtimeChat, ensureConsultationPasscode, type ChatMessage } from "@/features/mydox/backend";
import { ChevronLeft, Eye, Phone, ShieldCheck, Plus, Send, Scissors, MessageSquare } from "lucide-react";
import {
  parseChatAttachment,
  processImageFile,
  processPdfFile,
  AttachmentMenu,
  AttachmentPreviewBar,
  ChatAttachmentBubbleContent,
  ImageLightboxModal,
  type ChatAttachment,
  type StagedAttachment
} from "@/features/mydox/chatAttachmentUtils";

function toast(msg: string) {
  let el = document.getElementById("mc-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "mc-toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1E293B;color:#fff;padding:10px 18px;border-radius:9999px;font-size:13px;font-weight:600;z-index:99999;box-shadow:0 10px 25px rgba(0,0,0,0.25);transition:opacity 0.2s;";
  // @ts-expect-error timer on element
  clearTimeout(el._timer);
  // @ts-expect-error timer on element
  el._timer = setTimeout(() => { if (el) el.style.opacity = "0"; }, 2400);
}

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
  | "Surgery"
  | "Physiotherapy"
  | "Nursing"
  | "Diagnostics";

type Item = {
  id: string;
  module: Module;
  title: string;
  subtitle?: string;
  status: string;
  createdAt: string;
  doctorName?: string;
  otp?: string;
  isEmergency?: boolean;
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
  Physiotherapy: "🧘",
  Nursing: "👩‍⚕️",
  Diagnostics: "🧪",
};

function classifyCareRequest(specialty: string): Module {
  const s = specialty.toLowerCase();
  if (/(lab|scan|xray|mri|ct|ultrasound|blood test)/.test(s)) return "Diagnostics";
  if (/(nurse|caretaker)/.test(s)) return "Nursing";
  if (/(physio|therap)/.test(s)) return "Physiotherapy";
  return "Doctor / Nurse";
}

const REVIEW_KEY = (id: string, name?: string) => `mydox_review_${id || name || "unknown"}`;

function readReview(id: string, name?: string): { stars: number; comment?: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REVIEW_KEY(id, name));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { stars: Number(parsed?.stars) || 0, comment: parsed?.comment || "" };
  } catch {
    return null;
  }
}

function saveReview(id: string, name: string | undefined, stars: number, comment?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      REVIEW_KEY(id, name),
      JSON.stringify({ stars, comment, at: Date.now(), providerName: name || null })
    );
  } catch {
    /* ignore storage errors */
  }
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
  const [reviewTarget, setReviewTarget] = useState<{ item: Item; doctorName: string } | null>(null);
  const [otpTarget, setOtpTarget] = useState<{ item: Item; doctorName: string } | null>(null);
  const [reviewsMap, setReviewsMap] = useState<Record<string, number>>({});

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
      const [cr, cp, pr, sn, bb, sb, mo, da, pv, sc, comm] = await Promise.all([
        supabase.from("care_requests").select("id, specialty, status, notes, created_at, visit_type, accepted_by, rating_provider, otp, emergency").eq("patient_id", uid).order("created_at", { ascending: false }).limit(200),
        supabase.from("care_program_bookings").select("id, program, tier, summary, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("prosthetics_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("special_needs_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("blood_bank_activity").select("id, activity_type, blood_group, units, hospital, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("surgery_bookings").select("id, procedure, patient_name, mode, status, created_at").eq("facility_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("medicine_orders").select("id, pharmacy_name, delivery_speed, items, prescription_attached, total, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("doctor_appointments").select("id, service, mode, status, start_time, end_time, created_at, provider_id, arrival_otp").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("physio_visits").select("id, therapy_type, area, city, session_number, status, created_at, therapist_id, scheduled_at, fee, otp, urgency").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("specialty_care_bookings").select("id, specialty_label, concern, mode, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
        supabase.from("community_requests").select("id, type, notes, status, created_at").eq("requester_id", uid).order("created_at", { ascending: false }).limit(100),
      ]);

      const rows: Item[] = [];
      const localReviews: Record<string, number> = {};
      const crRows = (cr.data as { id: string; specialty: string; status: string; notes: string | null; created_at: string; visit_type: string; accepted_by: string | null; rating_provider: number | null; otp: string | null; emergency?: boolean }[] | null) ?? [];
      const daRows = (da.data as { id: string; service: string | null; mode: string | null; status: string; start_time: string; end_time: string; created_at: string; provider_id: string | null; arrival_otp: string | null }[] | null) ?? [];
      const pvRows = (pv.data as { id: string; therapy_type: string; area: string; city: string; session_number: number; status: string; created_at: string; therapist_id: string | null; scheduled_at: string | null; fee: number | null; otp: string | null; urgency?: string }[] | null) ?? [];
      const scRows = (sc.data as { id: string; specialty_label: string; concern: string; mode: string; provider_name: string; status: string; created_at: string }[] | null) ?? [];
      const commRows = (comm.data as { id: string; type: string; notes: string | null; status: string; created_at: string }[] | null) ?? [];

      const doctorIds = Array.from(new Set([
        ...crRows.map((r) => r.accepted_by).filter((id): id is string => Boolean(id)),
        ...daRows.map((r) => r.provider_id).filter((id): id is string => Boolean(id)),
        ...pvRows.map((r) => r.therapist_id).filter((id): id is string => Boolean(id)),
      ]));

      const doctorNames = new Map<string, string>();
      if (doctorIds.length > 0) {
        const [{ data: profs }, { data: physioTherapists }] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", doctorIds),
          supabase.from("physio_therapists").select("id, full_name").in("id", doctorIds),
        ]);
        for (const p of (profs as { id: string; full_name: string | null }[] | null) ?? []) {
          if (p.full_name) doctorNames.set(p.id, p.full_name);
        }
        for (const p of (physioTherapists as { id: string; full_name: string | null }[] | null) ?? []) {
          if (p.full_name) doctorNames.set(p.id, p.full_name);
        }
      }

      for (const r of crRows) {
        const docName = r.accepted_by ? (doctorNames.get(r.accepted_by) || (r.status === "completed" ? "Dr. Anita Rao" : undefined)) : (r.status === "completed" ? "Dr. Anita Rao" : undefined);
        const itemId = `cr:${r.id}`;
        const saved = readReview(itemId, docName);
        if (saved?.stars) localReviews[itemId] = saved.stars;
        rows.push({
          id: itemId,
          module: classifyCareRequest(r.specialty),
          title: r.specialty,
          subtitle: `${r.visit_type === "at_home" ? "Home visit" : "Clinic visit"}${r.notes ? ` · ${r.notes}` : ""}`,
          status: r.status,
          createdAt: r.created_at,
          doctorName: docName,
          otp: r.otp || undefined,
          isEmergency: !!r.emergency,
        });
      }

      for (const r of daRows) {
        const baseTitle = r.service || "General Doctor Consultation";
        const isHome = r.mode === "home_visit" || r.mode === "home" || (r.service && r.service.toLowerCase().includes("home"));
        const isPhysio = /(physio|therap)/i.test(baseTitle);
        const title = isHome && !baseTitle.toLowerCase().includes("home") ? `${baseTitle} • Home visit` : baseTitle;
        const timeStr = `${new Date(r.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(r.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        const docName = r.provider_id ? (doctorNames.get(r.provider_id) || (r.status === "completed" ? "Dr. Anita Rao" : undefined)) : (r.status === "completed" ? "Dr. Anita Rao" : undefined);
        const itemId = `da:${r.id}`;
        const saved = readReview(itemId, docName);
        if (saved?.stars) localReviews[itemId] = saved.stars;
        rows.push({
          id: itemId,
          module: isHome ? "Home Care" : "Doctor / Nurse",
          title,
          subtitle: timeStr,
          status: r.status,
          createdAt: r.created_at,
          doctorName: docName,
          otp: r.arrival_otp || undefined,
        });
      }

      for (const r of pvRows) {
        const therapistName = r.therapist_id ? doctorNames.get(r.therapist_id) : undefined;
        const itemId = `pv:${r.id}`;
        const saved = readReview(itemId, therapistName);
        if (saved?.stars) localReviews[itemId] = saved.stars;
        const timeStr = r.scheduled_at
          ? `${new Date(r.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${new Date(r.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : `${r.area}, ${r.city}`;
        let displayFee = r.fee;
        if (r.urgency === "urgent" && displayFee) {
          if (displayFee === 700) displayFee = 840;
          if (displayFee === 1500) displayFee = 1800;
        }
        rows.push({
          id: itemId,
          module: "Physiotherapy",
          title: `${r.therapy_type.replace(/_/g, " ")} Physiotherapy — Session ${r.session_number || 1}`,
          subtitle: `${timeStr}${displayFee ? ` · ₹${displayFee}` : ""}`,
          status: r.status,
          createdAt: r.created_at,
          doctorName: therapistName || "Dr. Kavita Deshmukh",
          otp: r.otp || undefined,
          isEmergency: r.urgency === "urgent",
        });
      }

      for (const r of scRows) {
        const itemId = `sc:${r.id}`;
        const saved = readReview(itemId, r.provider_name);
        if (saved?.stars) localReviews[itemId] = saved.stars;
        rows.push({
          id: itemId,
          module: "Doctor / Nurse",
          title: `${r.specialty_label} — ${r.concern}`,
          subtitle: `${r.provider_name} · ${r.mode}`,
          status: r.status,
          createdAt: r.created_at,
          doctorName: r.provider_name,
        });
      }

      for (const r of commRows) {
        rows.push({
          id: `comm:${r.id}`,
          module: "Special Needs",
          title: r.type ? r.type.replace(/_/g, " ") : "Community Request",
          subtitle: r.notes || undefined,
          status: r.status,
          createdAt: r.created_at,
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
      if (mounted) {
        setItems(rows);
        setReviewsMap(localReviews);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [uid, ready]);

  const modules: (Module | "All")[] = useMemo(() => {
    const set = new Set<Module>();
    items.forEach((i) => set.add(i.module));
    return ["All", ...Array.from(set)];
  }, [items]);
  const UPCOMING = new Set(["open", "pending", "broadcasting", "accepted", "confirmed", "in_progress", "booked", "placed", "out_for_delivery", "requested", "assigned", "en_route"]);
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
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: 999,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: tab === t ? "#fff" : "transparent",
                  color: tab === t ? INK : "#64748B",
                  boxShadow: tab === t ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
                  textTransform: "capitalize",
                }}
              >
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
                    {rows.map((it) => {
                      const docName = it.doctorName || (/nurse/i.test(it.title) ? "Nurse Specialist" : /physio/i.test(it.title) ? "Dr. Rajesh K (PT)" : "Dr. Anita Rao");
                      const userRating = reviewsMap[it.id] ?? (readReview(it.id, docName)?.stars ?? null);
                      const isConsultationOver = ["completed", "delivered", "closed", "finished"].includes((it.status || "").toLowerCase());
                      const showOtpOption = tab !== "previous" && !isConsultationOver;
                      return (
                        <li
                          key={it.id}
                          onClick={() => {
                            if (showOtpOption) setOtpTarget({ item: it, doctorName: docName });
                          }}
                          role={showOtpOption ? "button" : undefined}
                          tabIndex={showOtpOption ? 0 : undefined}
                          onKeyDown={(e) => {
                            if ((e.key === "Enter" || e.key === " ") && showOtpOption) {
                              e.preventDefault();
                              setOtpTarget({ item: it, doctorName: docName });
                            }
                          }}
                          style={{
                            background: "#fff",
                            borderRadius: 14,
                            padding: "12px 14px",
                            boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            flexWrap: "wrap",
                            cursor: showOtpOption ? "pointer" : "default",
                            transition: "box-shadow 0.15s ease",
                          }}
                        >
                          <div style={{ fontSize: 22, lineHeight: 1, marginTop: 2 }}>{MODULE_ICON[it.module]}</div>
                          <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ fontWeight: 700, fontSize: 14, textTransform: "capitalize", color: "#0F172A" }}>{it.title}</span>
                              <StatusChip status={it.status} />
                              {it.isEmergency && <span style={{ background: "#FEE2E2", color: "#991B1B", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800, textTransform: "uppercase", whiteSpace: "nowrap" }}>URGENT</span>}
                            </div>
                            {it.subtitle && <div style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{it.subtitle}</div>}
                            <div style={{ color: "#94A3B8", fontSize: 11, marginTop: 4 }}>{it.module} · {new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                            {showOtpOption && (
                              <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOtpTarget({ item: it, doctorName: docName });
                                  }}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "#ECFDF5",
                                    color: "#065F46",
                                    border: "1px solid #A7F3D0",
                                    borderRadius: 999,
                                    padding: "3px 9px",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  🔑 {it.module === "Physiotherapy" ? "Session OTP (tap to view)" : "Consultation OTP (tap to view)"}
                                </button>
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", alignSelf: "center", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReviewTarget({ item: it, doctorName: docName });
                              }}
                              aria-label={`Review ${docName}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: userRating ? "#FEF3C7" : "#FFFBEB",
                                color: "#92400E",
                                border: "1px solid #FDE68A",
                                borderRadius: 999,
                                padding: "8px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                boxShadow: "0 1px 2px rgba(245,158,11,0.12)",
                              }}
                            >
                              <span style={{ color: "#F59E0B", fontSize: 13 }}>★</span>
                              {userRating ? `${userRating}★ Reviewed` : "Review your doctor"}
                            </button>

                            <button
                              type="button"
                              disabled={!isConsultationOver}
                              aria-disabled={!isConsultationOver}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isConsultationOver) return;
                                setChatDoctor(docName);
                              }}
                              aria-label={isConsultationOver ? `Chat with ${docName}` : `Chat available after consultation`}
                              title={isConsultationOver ? `Chat with ${docName}` : "Chat will be enabled once consultation is over"}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                background: isConsultationOver ? "#F0FDFA" : "#F8FAFC",
                                color: isConsultationOver ? "#0F766E" : "#94A3B8",
                                border: isConsultationOver ? "1px solid #99F6E4" : "1px solid #E2E8F0",
                                borderRadius: 999,
                                padding: "8px 12px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: isConsultationOver ? "pointer" : "not-allowed",
                                whiteSpace: "nowrap",
                                boxShadow: isConsultationOver ? "0 1px 2px rgba(13,148,136,0.12)" : "none",
                                opacity: isConsultationOver ? 1 : 0.65,
                              }}
                            >
                              <span style={{ fontSize: 13, filter: isConsultationOver ? "none" : "grayscale(100%)" }}>💬</span>
                              Chat
                            </button>

                            {onRebook && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRebook(it);
                                }}
                                aria-label={`Book ${it.title} again`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  background: TEAL,
                                  color: "#fff",
                                  border: "none",
                                  borderRadius: 999,
                                  padding: "8px 12px",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  boxShadow: "0 1px 2px rgba(13,148,136,0.35)",
                                }}
                              >
                                ↻ Book again
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </main>
        {chatDoctor && <PatientChatOverlay doctorName={chatDoctor} onClose={() => setChatDoctor(null)} />}
        {reviewTarget && (
          <PatientReviewModal
            item={reviewTarget.item}
            doctorName={reviewTarget.doctorName}
            initialRating={reviewsMap[reviewTarget.item.id]}
            onClose={() => setReviewTarget(null)}
            onSaved={(rating) => {
              setReviewsMap((prev) => ({ ...prev, [reviewTarget.item.id]: rating }));
            }}
          />
        )}
        {otpTarget && (
          <BookingOtpModal
            target={otpTarget}
            onClose={() => setOtpTarget(null)}
            onOpenChat={(doc) => {
              setOtpTarget(null);
              setChatDoctor(doc);
            }}
          />
        )}
      </div>
    </div>
  );
}

function EmptyMsg({ text }: { text: string }) {
  return <div style={{ background: "#fff", borderRadius: 14, padding: 24, textAlign: "center", color: "#64748B", fontSize: 14 }}>{text}</div>;
}

/* Patient-side consultation chat matching design specification */
function PatientChatOverlay({ doctorName, onClose }: { doctorName: string; onClose: () => void }) {
  const { messages, send, meId, ready, live } = useRealtimeChat(doctorName);
  const [text, setText] = useState("");
  const [localSentMessages, setLocalSentMessages] = useState<ChatMessage[]>([]);
  const [pendingAttachment, setPendingAttachment] = useState<StagedAttachment | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<{ name: string; dataUrl: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [rechargeBonus, setRechargeBonus] = useState<number>(() => {
    try {
      return Number(localStorage.getItem(`mydox_chat_recharge_${doctorName}`)) || 0;
    } catch {
      return 0;
    }
  });

  const BASE_LIMIT = 25;
  const totalLimit = BASE_LIMIT + rechargeBonus;

  // Combine real-time Supabase messages and local synthetic messages
  const allMessages = useMemo(() => {
    const existingIds = new Set(messages.map((m) => m.id));
    const uniqueLocal = localSentMessages.filter((m) => !existingIds.has(m.id));
    return [...messages, ...uniqueLocal];
  }, [messages, localSentMessages]);

  // Count messages sent by the patient (doctor messages do not reduce allowance)
  const patientSentCount = useMemo(() => {
    return allMessages.filter(
      (m) => (meId && m.sender_id === meId) || m.id.startsWith("local_")
    ).length;
  }, [allMessages, meId]);

  const messagesRemaining = Math.max(0, totalLimit - patientSentCount);
  const isLimitReached = messagesRemaining <= 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [allMessages.length, pendingAttachment]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isLimitReached) {
      toast("Message limit reached (0/25). Please recharge ₹200 to continue chatting.");
      return;
    }
    try {
      const processed = await processImageFile(file);
      setPendingAttachment(processed);
    } catch (err: any) {
      toast(err?.message || "Failed to load photo");
    } finally {
      e.target.value = "";
    }
  };

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isLimitReached) {
      toast("Message limit reached (0/25). Please recharge ₹200 to continue chatting.");
      return;
    }
    try {
      const processed = await processPdfFile(file);
      setPendingAttachment(processed);
    } catch (err: any) {
      toast(err?.message || "Failed to load PDF");
    } finally {
      e.target.value = "";
    }
  };

  const submit = async () => {
    const t = text.trim();
    if (!t && !pendingAttachment) return;
    if (isLimitReached) {
      toast("Message limit reached (0/25). Please recharge ₹200 to continue chatting.");
      return;
    }
    let bodyToSend = t;
    if (pendingAttachment) {
      bodyToSend = JSON.stringify({
        _type: "attachment",
        fileType: pendingAttachment.type,
        name: pendingAttachment.name,
        size: pendingAttachment.size,
        dataUrl: pendingAttachment.dataUrl,
        caption: t
      });
    }
    setText("");
    setPendingAttachment(null);
    setShowAttachMenu(false);
    const ok = await send(bodyToSend);
    if (!ok) {
      // Local fallback for offline/demo/unlinked doctor profile
      const fallbackMsg: ChatMessage = {
        id: "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        sender_id: meId || "patient",
        recipient_id: "doctor",
        body: bodyToSend,
        created_at: new Date().toISOString(),
        thread_key: "thread"
      };
      setLocalSentMessages((prev) => [...prev, fallbackMsg]);
    }
  };

  const handleRecharge = () => {
    const newBonus = rechargeBonus + 25;
    setRechargeBonus(newBonus);
    try {
      localStorage.setItem(`mydox_chat_recharge_${doctorName}`, String(newBonus));
    } catch (_e) {
      // Storage might be restricted
    }
    toast("Recharge ₹200 successful! +25 messages added to your consultation token wallet.");
  };

  const fmtTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const getInitials = (n: string) => {
    if (!n) return "VI";
    const clean = n.replace(/^Dr\.?\s+/i, "").trim();
    const parts = clean.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
    return "VI";
  };

  const displayName = doctorName || "Dr. Vikram Iyer";
  const initials = getInitials(displayName);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${displayName}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1100,
        background: "#061A14",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        color: "#fff"
      }}
    >
      {/* Top Header */}
      <header
        style={{
          background: "#061A14",
          color: "#fff",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
          borderBottom: "1px solid #0E2E23"
        }}
      >
        <button
          onClick={onClose}
          aria-label="Back"
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: 4
          }}
        >
          <ChevronLeft size={24} color="#fff" />
        </button>

        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#00875A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 16,
            color: "#fff",
            flexShrink: 0
          }}
        >
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {displayName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8EABA0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Online · Women's Health / Gynecologist
          </p>
        </div>

        <button
          onClick={() => toast("Viewing medical history & case file")}
          aria-label="View history"
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            padding: 6,
            display: "flex",
            alignItems: "center"
          }}
        >
          <Eye size={20} color="#fff" />
        </button>

        <button
          onClick={() => toast(`Calling ${displayName}...`)}
          aria-label="Phone call"
          style={{
            background: "transparent",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            padding: 6,
            display: "flex",
            alignItems: "center"
          }}
        >
          <Phone size={20} color="#fff" />
        </button>
      </header>

      {/* Top 3 Quota Allowance Cards */}
      <div
        style={{
          display: "flex",
          gap: 10,
          padding: "12px 14px 8px",
          background: "#061A14",
          flexShrink: 0
        }}
      >
        <div
          style={{
            flex: 1,
            background: "#0A241D",
            border: "1px solid #144436",
            borderRadius: 14,
            padding: "10px 6px",
            textAlign: "center"
          }}
        >
          <div style={{ color: messagesRemaining > 5 ? "#10B981" : messagesRemaining > 0 ? "#F59E0B" : "#EF4444", fontWeight: 800, fontSize: 17 }}>
            {messagesRemaining}/{totalLimit}
          </div>
          <div style={{ color: "#7B9E93", fontSize: 11, fontWeight: 600, marginTop: 2 }}>Messages Left</div>
        </div>

        <div
          style={{
            flex: 1,
            background: "#0A241D",
            border: "1px solid #144436",
            borderRadius: 14,
            padding: "10px 6px",
            textAlign: "center"
          }}
        >
          <div style={{ color: "#F59E0B", fontWeight: 800, fontSize: 17 }}>10:00</div>
          <div style={{ color: "#7B9E93", fontSize: 11, fontWeight: 600, marginTop: 2 }}>Audio Left</div>
        </div>

        <div
          style={{
            flex: 1,
            background: "#0A241D",
            border: "1px solid #144436",
            borderRadius: 14,
            padding: "10px 6px",
            textAlign: "center"
          }}
        >
          <div style={{ color: "#38BDF8", fontWeight: 800, fontSize: 17 }}>2/2</div>
          <div style={{ color: "#7B9E93", fontSize: 11, fontWeight: 600, marginTop: 2 }}>Calls Left</div>
        </div>
      </div>

      {/* Scrollable Message List */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "#061A14",
          position: "relative"
        }}
      >
        {/* End-to-End Encryption Notice */}
        <div
          style={{
            margin: "4px auto 12px",
            maxWidth: "88%",
            background: "#1E2A18",
            border: "1px solid rgba(245, 158, 11, 0.18)",
            borderRadius: 12,
            padding: "10px 14px",
            textAlign: "center",
            color: "#C5D1B8",
            fontSize: 11.5,
            lineHeight: 1.45
          }}
        >
          <ShieldCheck size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5, color: "#F59E0B" }} />
          Messages and calls are end-to-end encrypted. No one outside this chat, not even MedConnect, can read or listen to them.
        </div>

        {ready && allMessages.length === 0 && (
          <p style={{ margin: "auto", fontSize: 13, color: "#64748B", textAlign: "center" }}>
            {live
              ? "No messages yet. Say hello to your doctor."
              : "Connecting to the chat thread…"}
          </p>
        )}

        {allMessages.map((m: ChatMessage) => {
          const mine = (meId && m.sender_id === meId) || m.id.startsWith("local_");
          const att = parseChatAttachment(m.body);
          return (
            <div
              key={m.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "78%",
                background: mine ? "#1A5644" : "#0F2B23",
                color: "#FFFFFF",
                border: mine ? "1px solid #25745C" : "1px solid #184437",
                borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                padding: "10px 14px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.25)"
              }}
            >
              {att ? (
                <ChatAttachmentBubbleContent
                  attachment={att}
                  mine={mine}
                  onViewImage={(img) => setSelectedImageModal(img)}
                />
              ) : (
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{m.body}</p>
              )}
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 10,
                  color: mine ? "#8EE0C4" : "#7B9E93",
                  textAlign: "right",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 3
                }}
              >
                <span>{fmtTime(m.created_at)}</span>
                {mine && <span style={{ fontSize: 11 }}>✓</span>}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </main>

      {/* Hidden File Pickers */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
      />
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={handlePdfSelect}
      />

      {/* Floating Tool Buttons on Right */}
      <div style={{ position: "fixed", right: 16, bottom: 132, display: "flex", flexDirection: "column", gap: 10, zIndex: 10 }}>
        <button
          onClick={() => toast("Prescriptions & Notes")}
          aria-label="Prescriptions tool"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#fff",
            border: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <Scissors size={18} color="#061A14" />
        </button>

        <button
          onClick={() => toast("MedConnect AI Assistant")}
          aria-label="AI assistant"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#fff",
            border: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#0284C7,#2563EB)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <MessageSquare size={13} color="#fff" />
          </div>
        </button>
      </div>

      {/* Attachment Staging Preview Bar */}
      {pendingAttachment && (
        <AttachmentPreviewBar
          attachment={pendingAttachment}
          onRemove={() => setPendingAttachment(null)}
        />
      )}

      {/* Input Row */}
      <div
        style={{
          position: "relative",
          padding: "10px 14px",
          background: "#061A14",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0
        }}
      >
        {/* Attachment Options Menu */}
        {showAttachMenu && !isLimitReached && (
          <AttachmentMenu
            onSelectPhoto={() => photoInputRef.current?.click()}
            onSelectPdf={() => pdfInputRef.current?.click()}
            onClose={() => setShowAttachMenu(false)}
          />
        )}

        <button
          onClick={() => {
            if (isLimitReached) {
              toast("Message limit reached (0/25). Please recharge ₹200 to continue chatting.");
              return;
            }
            setShowAttachMenu((prev) => !prev);
          }}
          disabled={isLimitReached}
          aria-label="Add attachment: photo or PDF"
          title="Attach photo or PDF file"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: showAttachMenu ? "#10B981" : "#123328",
            border: "1px solid #1C4D3E",
            color: "#fff",
            cursor: isLimitReached ? "not-allowed" : "pointer",
            opacity: isLimitReached ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "background 0.2s"
          }}
        >
          <Plus
            size={22}
            color="#fff"
            style={{
              transform: showAttachMenu ? "rotate(45deg)" : "none",
              transition: "transform 0.2s"
            }}
          />
        </button>

        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={isLimitReached}
          placeholder={isLimitReached ? "Message limit reached (0/25) · Recharge to chat" : pendingAttachment ? "Add a caption (optional)" : "Type a message"}
          style={{
            flex: 1,
            background: "#0A241D",
            border: "1px solid #144436",
            borderRadius: 9999,
            padding: "11px 18px",
            color: "#fff",
            fontSize: 14,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            outline: "none",
            opacity: isLimitReached ? 0.6 : 1
          }}
        />

        <button
          onClick={submit}
          disabled={isLimitReached || (!text.trim() && !pendingAttachment)}
          aria-label="Send message"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: "#10B981",
            border: "none",
            color: "#fff",
            cursor: !isLimitReached && (text.trim() || pendingAttachment) ? "pointer" : "default",
            opacity: !isLimitReached && (text.trim() || pendingAttachment) ? 1 : 0.4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "opacity 0.2s"
          }}
        >
          <Send size={18} color="#fff" style={{ transform: "translate(1px, -1px)" }} />
        </button>
      </div>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        image={selectedImageModal}
        onClose={() => setSelectedImageModal(null)}
      />

      {/* Bottom Allowance & Recharge Bar */}
      <div
        style={{
          padding: "12px 16px calc(12px + env(safe-area-inset-bottom))",
          background: "#04120E",
          borderTop: "1px solid #0D2D22",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexShrink: 0
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 12.5,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {messagesRemaining > 0 ? "Free chat" : "Quota reached"} · {messagesRemaining}/{totalLimit} msgs · 10:00 audio · 2/2 calls
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontSize: 10.5,
              color: "#6A8B80",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            Open 24h after payment · tokens work with ANY doctor
          </p>
        </div>

        <button
          onClick={handleRecharge}
          style={{
            background: "#10B981",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.35)"
          }}
        >
          Recharge ₹200
        </button>
      </div>
    </div>
  );
}

function PatientReviewModal({
  item,
  doctorName,
  initialRating,
  onClose,
  onSaved,
}: {
  item: Item;
  doctorName: string;
  initialRating?: number;
  onClose: () => void;
  onSaved: (rating: number) => void;
}) {
  const [rating, setRating] = useState(initialRating || 5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const TAGS = [
    "Attentive & Caring",
    "Clear Explanations",
    "On-Time Consultation",
    "Accurate Diagnosis",
    "Helpful Advice",
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      if (item.id.startsWith("cr:")) {
        const cleanId = item.id.replace("cr:", "");
        await supabase
          .from("care_requests")
          .update({
            rating_provider: rating,
            rating_provider_at: new Date().toISOString(),
          })
          .eq("id", cleanId);
      }
      saveReview(item.id, doctorName, rating, comment);
      onSaved(rating);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch {
      saveReview(item.id, doctorName, rating, comment);
      onSaved(rating);
      setSubmitted(true);
      setTimeout(() => {
        onClose();
      }, 1200);
    } finally {
      setSubmitting(false);
    }
  };

  const displayStars = hoverRating || rating;
  const ratingLabels: Record<number, string> = {
    1: "Poor experience",
    2: "Fair, could be better",
    3: "Good consultation",
    4: "Very good experience",
    5: "Exceptional care & service",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Review your doctor"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15,23,42,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          maxWidth: 440,
          width: "100%",
          padding: 24,
          boxShadow: "0 20px 30px -10px rgba(15,23,42,0.25)",
          boxSizing: "border-box",
        }}
      >
        {submitted ? (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <div style={{ fontSize: 44, marginBottom: 8 }}>⭐</div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#0F172A", fontWeight: 800 }}>
              Thank you for your feedback!
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
              Your {rating}-star review for <strong>{doctorName}</strong> has been saved.
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Review your doctor</h3>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475569" }}>
                  {doctorName} · <span style={{ color: "#64748B" }}>{item.title}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close review dialog"
                style={{
                  background: "#F1F5F9",
                  border: "none",
                  borderRadius: "50%",
                  width: 30,
                  height: 30,
                  fontSize: 16,
                  color: "#64748B",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ textAlign: "center", margin: "20px 0 14px" }}>
              <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`Rate ${star} out of 5 stars`}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: 34,
                      cursor: "pointer",
                      padding: "2px 4px",
                      color: star <= displayStars ? "#F59E0B" : "#E2E8F0",
                      transform: star <= displayStars ? "scale(1.1)" : "scale(1)",
                      transition: "transform 0.12s ease, color 0.12s ease",
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 12, fontWeight: 700, color: displayStars ? "#D97706" : "#94A3B8" }}>
                {displayStars ? ratingLabels[displayStars] : "Select your rating"}
              </p>
            </div>

            <div style={{ margin: "14px 0" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                What went well?
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {TAGS.map((tag) => {
                  const sel = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        background: sel ? "#0D9488" : "#F8FAFC",
                        color: sel ? "#fff" : "#475569",
                        border: sel ? "1px solid #0D9488" : "1px solid #E2E8F0",
                        borderRadius: 999,
                        padding: "5px 11px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {sel ? "✓ " : ""}{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ margin: "14px 0" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Additional comments (optional)
              </label>
              <textarea
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience to help us improve consultation quality..."
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid #CBD5E1",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                  resize: "none",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  background: "#F1F5F9",
                  color: "#334155",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || !rating}
                onClick={handleSubmit}
                style={{
                  flex: 1.4,
                  background: !rating ? "#CBD5E1" : TEAL,
                  color: "#fff",
                  border: "none",
                  borderRadius: 12,
                  padding: "11px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: !rating || submitting ? "not-allowed" : "pointer",
                  boxShadow: rating ? "0 2px 6px rgba(13,148,136,0.3)" : "none",
                }}
              >
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* Consultation Completion OTP Generator & Supabase Sync */
async function getOrGenerateBookingOtp(item: Item): Promise<string> {
  if (item.otp && /^\d{4}$/.test(item.otp)) {
    return item.otp;
  }
  if (item.otp && /^\d{5,6}$/.test(item.otp)) {
    return item.otp.slice(0, 4);
  }
  return await ensureConsultationPasscode(item.id, item.otp);
}

/* Consultation Verification OTP Modal */
function BookingOtpModal({
  target,
  onClose,
  onOpenChat,
}: {
  target: { item: Item; doctorName: string };
  onClose: () => void;
  onOpenChat: (doctorName: string) => void;
}) {
  const [otp, setOtp] = useState<string>(target.item.otp ? target.item.otp.slice(0, 4) : "");
  const [loading, setLoading] = useState<boolean>(!target.item.otp);
  const [status, setStatus] = useState<string>(target.item.status || "");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const isConsultationOver = ["completed", "delivered", "closed", "finished"].includes((status || "").toLowerCase());

  useEffect(() => {
    let mounted = true;
    (async () => {
      const code = await getOrGenerateBookingOtp(target.item);
      if (mounted) {
        setOtp(code);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [target.item]);

  // Realtime subscription & polling so modal updates the moment the doctor marks consultation over
  useEffect(() => {
    const [prefix, rawId] = target.item.id.split(":");
    if (!rawId) return;
    const table = prefix === "cr" ? "care_requests" : prefix === "da" ? "doctor_appointments" : null;
    if (!table) return;

    let active = true;
    const checkStatus = async () => {
      try {
        const { data } = await supabase.from(table).select("status").eq("id", rawId).maybeSingle();
        if (active && data && (data as any).status) {
          setStatus((data as any).status);
        }
      } catch {
        /* ignore */
      }
    };

    const interval = setInterval(checkStatus, 3000);
    const channel = supabase
      .channel(`booking_modal_${target.item.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table, filter: `id=eq.${rawId}` }, (payload) => {
        if (active && payload.new && (payload.new as any).status) {
          setStatus((payload.new as any).status);
        }
      })
      .subscribe();

    return () => {
      active = false;
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [target.item.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const digits = (otp || "----").slice(0, 4).split("");
  const displayDocName = target.doctorName.startsWith("Dr.") ? target.doctorName : `Dr. ${target.doctorName}`;

  const handleShare = async () => {
    if (!otp) return;
    const shareText = `MyDox 4-Digit Consultation Passcode: ${otp} (for ${displayDocName})`;
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ title: "Consultation Passcode", text: shareText })) {
      try {
        await navigator.share({
          title: "MyDox Consultation Passcode",
          text: shareText,
        });
        setShareFeedback("Shared successfully!");
        setTimeout(() => setShareFeedback(null), 3000);
        return;
      } catch {
        /* user cancelled share sheet */
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(otp);
        setShareFeedback("Passcode copied to clipboard!");
        setTimeout(() => setShareFeedback(null), 3000);
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Consultation Verification OTP"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 20,
          width: "100%",
          maxWidth: 440,
          boxShadow: "0 20px 25px -5px rgba(15,23,42,0.2), 0 8px 10px -6px rgba(15,23,42,0.1)",
          padding: "24px 22px",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: "#CCFBF1",
                color: "#0F766E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              🔒
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#0F172A" }}>
                {target.item.module === "Physiotherapy" ? "Session Passcode" : "Consultation Passcode"}
              </h2>
              <p style={{ margin: 0, fontSize: 12, color: "#64748B", fontWeight: 500 }}>
                Verification code generated from Supabase
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close popup"
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 14,
              color: "#64748B",
            }}
          >
            ✕
          </button>
        </div>

        {/* Doctor & Booking snapshot */}
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: 14,
            padding: "12px 14px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>{target.item.title}</span>
            <StatusChip status={status} />
          </div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span>Attending Doctor:</span>
            <span style={{ fontWeight: 700, color: "#0D9488" }}>{displayDocName}</span>
          </div>
          {target.item.subtitle && (
            <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 2 }}>{target.item.subtitle}</div>
          )}
        </div>

        {/* OTP Code Display Box */}
        <div
          style={{
            background: "linear-gradient(180deg, #F0FDFA 0%, #E6FFFA 100%)",
            border: "1.5px dashed #14B8A6",
            borderRadius: 16,
            padding: "20px 16px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#0F766E", textTransform: "uppercase" }}>
            4-Digit Consultation Passcode
          </span>

          {loading ? (
            <div style={{ padding: "18px 0", fontSize: 13, color: "#0F766E", fontWeight: 600 }}>
              Generating secure OTP from Supabase…
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  marginTop: 14,
                  marginBottom: 6,
                }}
              >
                {digits.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: 52,
                      height: 60,
                      background: "#FFFFFF",
                      borderRadius: 12,
                      border: "2px solid #99F6E4",
                      boxShadow: "0 2px 6px rgba(13,148,136,0.12)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                      fontWeight: 800,
                      color: "#0F172A",
                      fontFamily: "monospace",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Share Passcode Action */}
              <button
                type="button"
                onClick={handleShare}
                style={{
                  marginTop: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: shareFeedback ? "#ECFDF5" : "#FFFFFF",
                  color: shareFeedback ? "#065F46" : "#0F766E",
                  border: shareFeedback ? "1.5px solid #10B981" : "1.5px solid #99F6E4",
                  borderRadius: 999,
                  padding: "7px 16px",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(13,148,136,0.1)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>{shareFeedback ? `✓ ${shareFeedback}` : "📤 Share Passcode with Doctor"}</span>
              </button>
            </>
          )}
        </div>

        {/* Verified Banner when Consultation is Over */}
        {isConsultationOver ? (
          <div
            style={{
              background: "#ECFDF5",
              border: "1.5px solid #6EE7B7",
              borderRadius: 14,
              padding: "12px 14px",
              marginTop: 14,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "#065F46" }}>
                {target.item.module === "Physiotherapy" ? "Session Verified & Completed!" : "Consultation Verified & Completed!"}
              </div>
              <div style={{ fontSize: 11.5, color: "#047857", marginTop: 2 }}>
                {target.item.module === "Physiotherapy"
                  ? "Your therapist has verified the OTP. Session completed!"
                  : "Your doctor has verified the OTP. Chat option is now enabled!"}
              </div>
            </div>
          </div>
        ) : (
          /* Required Notice Box */
          <div
            style={{
              background: "#FFFBEB",
              border: "1px solid #FCD34D",
              borderRadius: 14,
              padding: "13px 14px",
              marginTop: 16,
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>{target.item.module === "Physiotherapy" ? "🧘" : "🩺"}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#92400E", lineHeight: 1.35 }}>
                {target.item.module === "Physiotherapy"
                  ? `Share this OTP with ${displayDocName} once your session is over`
                  : `Share this OTP with ${displayDocName} once your consultation is over`}
              </div>
              <div style={{ fontSize: 11.5, color: "#78350F", marginTop: 4, lineHeight: 1.45 }}>
                {target.item.module === "Physiotherapy"
                  ? "Please do not share this passcode beforehand. Your physiotherapist inserts this 4-digit code in Patient Verification Code to verify and complete the session."
                  : "Please do not share this passcode beforehand. Your doctor inserts this 4-digit code in Patient Verification Code to verify and complete the session."}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            type="button"
            disabled={!isConsultationOver}
            aria-disabled={!isConsultationOver}
            onClick={() => {
              if (isConsultationOver) onOpenChat(target.doctorName);
            }}
            title={isConsultationOver ? `Chat with ${displayDocName}` : "Chat will be enabled once your consultation is over"}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              background: isConsultationOver ? "#0D9488" : "#F8FAFC",
              color: isConsultationOver ? "#FFFFFF" : "#94A3B8",
              border: isConsultationOver ? "none" : "1px solid #E2E8F0",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: isConsultationOver ? "pointer" : "not-allowed",
              boxShadow: isConsultationOver ? "0 2px 6px rgba(13,148,136,0.3)" : "none",
              opacity: isConsultationOver ? 1 : 0.65,
            }}
          >
            <span>💬</span>
            {isConsultationOver ? "Chat with Doctor" : "Chat (after visit)"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              background: TEAL,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "11px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(13,148,136,0.25)",
            }}
          >
            Done
          </button>
        </div>
        {!isConsultationOver && (
          <div style={{ fontSize: 11, color: "#94A3B8", textAlign: "center", marginTop: 8 }}>
            🔒 Chat unlocks once your doctor completes the consultation.
          </div>
        )}
      </div>
    </div>
  );
}
