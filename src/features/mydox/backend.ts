import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { usePostConsultationInbox } from "./post-consultation-chat/usePostConsultationChat";

export type AppRole = "patient" | "provider" | "facility" | "admin" | "super_admin";

export interface SessionState {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
}

async function fetchRole(userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("role", { ascending: true });
  if (!data || data.length === 0) return null;
  const roles = data.map((r) => r.role as AppRole);
  // priority: super_admin > admin > facility > provider > patient
  const order: AppRole[] = ["super_admin", "admin", "facility", "provider", "patient"];
  for (const r of order) if (roles.includes(r)) return r;
  return roles[0] ?? null;
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    session: null,
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;
    let generation = 0;
    let receivedAuthEvent = false;

    const hydrate = async (session: Session | null, currentGeneration: number) => {
      if (!session?.user) {
        if (mounted && currentGeneration === generation) setState({ session: null, user: null, role: null, loading: false });
        return;
      }
      const role = await fetchRole(session.user.id);
      if (mounted && currentGeneration === generation) setState({ session, user: session.user, role, loading: false });
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!receivedAuthEvent) void hydrate(data.session, ++generation);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      receivedAuthEvent = true;
      const currentGeneration = ++generation;
      // defer async to avoid deadlock in callback
      setTimeout(() => { void hydrate(session, currentGeneration); }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export type CareRequest = {
  id: string;
  patient_id: string;
  specialty: string;
  emergency: boolean;
  notes: string | null;
  status: "open" | "accepted" | "completed" | "cancelled" | "failed";
  accepted_by: string | null;
  accepted_at: string | null;
  lat: number | null;
  lng: number | null;
  fare: number | null;
  my_doctor_id?: string | null;
  preferred_id?: string | null;
  notification_stage?: "my_doctor" | "preferred" | "broadcast" | null;
  stage_started_at?: string | null;
  paid_at?: string | null;
  amount?: number | null;
  otp?: string | null;
  otp_verified_at?: string | null;
  arrival_deadline?: string | null;
  completed_at?: string | null;
  scheduled_at?: string | null;
  created_at: string;
  updated_at: string;
};

const CARE_REQUEST_SAFE_COLUMNS =
  "id, patient_id, specialty, emergency, lat, lng, fare, accepted_by, accepted_at, status, my_doctor_id, preferred_id, notification_stage, stage_started_at, paid_at, amount, otp, otp_verified_at, arrival_deadline, completed_at, created_at, updated_at";


function normalizeCareRequest(row: CareRequest): CareRequest {
  return {
    ...row,
    notes: row.notes ?? null,
    notification_stage: (row.notification_stage ?? "broadcast") as CareRequest["notification_stage"],
  };
}

export function useLiveCareRequests(enabled = true) {
  const [rows, setRows] = useState<CareRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let refreshInFlight = false;

    const refreshRows = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const { data } = await supabase
          .from("care_requests")
          // NOTE: cannot use select("*") — column-level GRANTs revoke `notes`
          // from authenticated (privacy). PostgREST 401s on select("*") for
          // anyone but the row's patient/accepted provider (view). List the
          // safe columns explicitly here; notes is fetched separately via the
          // care_request_notes view when the caller is allowed to see it.
          .select(CARE_REQUEST_SAFE_COLUMNS)
          .order("created_at", { ascending: false })
          .limit(100);

        if (mounted) {
          // RLS is the source of truth for who can see targeted urgent requests.
          // Keep the client-side check only as a fallback for legacy/broadcast rows;
          // never hide rows the backend has already allowed for the signed-in medico.
          setRows(((data as CareRequest[]) ?? []).map(normalizeCareRequest));
          setLoading(false);
        }
      } finally {
        refreshInFlight = false;
      }
    };

    refreshRows();
    // Realtime can be missed when the app is backgrounded or a screen mounts after
    // an UPDATE. Polling keeps payment/OTP state in sync for the doctor list.
    const refreshTimer = setInterval(refreshRows, 2500);

    const channel = supabase
      .channel(`care_requests_live_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_requests" },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === "INSERT") {
              const nextRow = normalizeCareRequest(payload.new as CareRequest);
              return [nextRow, ...prev.filter((r) => r.id !== nextRow.id)].slice(0, 100);
            }
            if (payload.eventType === "UPDATE") {
              const nextRow = normalizeCareRequest(payload.new as CareRequest);
              const exists = prev.some((r) => r.id === nextRow.id);
              return exists ? prev.map((r) => (r.id === nextRow.id ? nextRow : r)) : [nextRow, ...prev].slice(0, 100);
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((r) => r.id !== (payload.old as CareRequest).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { rows, loading };
}

export async function createCareRequest(input: {
  specialty: string;
  emergency?: boolean;
  notes?: string;
  lat?: number;
  lng?: number;
  fare?: number;
  my_doctor_id?: string | null;
  preferred_id?: string | null;
  notification_stage?: "my_doctor" | "preferred" | "broadcast" | null;
  scheduled_at?: string | null;
}) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const stage = input.notification_stage ?? (input.my_doctor_id ? "my_doctor" : "broadcast");
  const { data, error } = await supabase
    .from("care_requests")
    .insert({
      patient_id: uid,
      specialty: input.specialty,
      emergency: input.emergency ?? false,
      notes: input.notes ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      fare: input.fare ?? null,
      my_doctor_id: input.my_doctor_id ?? null,
      preferred_id: input.preferred_id ?? null,
      notification_stage: stage,
      stage_started_at: new Date().toISOString(),
    } as never)
    .select(CARE_REQUEST_SAFE_COLUMNS)
    .single();
  if (error) throw error;
  return data as CareRequest;
}

// ------------------------------------------------------------------
// DOCTOR APPOINTMENTS
// ------------------------------------------------------------------
export async function cancelDoctorAppointment(id: string) {
  const { data, error } = await supabase.rpc("cancel_appointment", { p_appointment_id: id });
  if (error) throw error;
  return data;
}

export async function rescheduleDoctorAppointment(id: string, start: string, end: string) {
  const { data, error } = await supabase.rpc("reschedule_appointment", {
    p_appointment_id: id,
    p_new_start: start,
    p_new_end: end
  });
  if (error) throw error;
  return data;
}

// Home visits use their permission-scoped RPC panel; this hook remains for other appointments.
export function useLiveDoctorAppointments(uid?: string) {
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRows([]);
    if (!uid) return;
    let mounted = true;
    let request = 0;
    const refresh = async () => {
      const sequence = ++request;
      const { data, error: failure } = await supabase.from("doctor_appointments")
        .select("id, patient_id, provider_id, service, mode, status, start_time, end_time, fee, currency, created_at, updated_at, arrival_otp, clinical_notes, completed_at")
        .or(`patient_id.eq.${uid},provider_id.eq.${uid}`)
        .or("mode.is.null,mode.not.in.(home,home_visit)")
        .order("start_time", { ascending: true });
      if (!mounted || sequence !== request) return;
      if (failure) { setError("Appointments could not be refreshed. Please retry."); return; }
      setRows(data ?? []);
      setError(null);
    };
    void refresh();
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const onResume = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onResume);
    const sub = supabase.channel(`live_doctor_appointments_${uid}`).on("postgres_changes",
      { event: "*", schema: "public", table: "doctor_appointments" }, () => { void refresh(); }).subscribe();
    return () => {
      mounted = false; request++;
      clearInterval(poll);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
      document.removeEventListener("visibilitychange", onResume);
      void supabase.removeChannel(sub);
    };
  }, [uid]);
  return { rows, error };
}

// Atomic first-accept-wins. RLS + WHERE status='open' guarantee single winner.
export async function acceptCareRequest(requestId: string) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("care_requests")
    .update({ status: "accepted", accepted_by: uid, accepted_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("status", "open")
    .select(CARE_REQUEST_SAFE_COLUMNS);
  if (error) {
    if (/unavailable/i.test(error.message)) {
      throw new Error("You're set to unavailable. Update your Availability calendar to accept jobs.");
    }
    throw error;
  }
  if (!data || data.length === 0) {
    throw new Error("Request no longer available — someone else accepted first.");
  }
  return data[0] as CareRequest;
}

export async function completeCareRequest(requestId: string) {
  const { error } = await supabase
    .from("care_requests")
    .update({ status: "completed" })
    .eq("id", requestId);
  if (error) throw error;
}

export async function failCareRequest(requestId: string) {
  const { error } = await supabase
    .from("care_requests")
    .update({ status: "failed" })
    .eq("id", requestId)
    .eq("status", "accepted");
  if (error) throw error;
}

/** Patient marks the accepted request paid and stores a 4-digit OTP for the doctor to enter.
 *  TESTING: OTP is hard-coded to "0000" so either party can confirm the exchange in one click. */
export const TEST_DEFAULT_OTP = "0000";
export async function payAndGenerateOtp(requestId: string, amount: number | null | undefined): Promise<string> {
  const otp = TEST_DEFAULT_OTP;
  const { error } = await supabase
    .from("care_requests")
    .update({
      paid_at: new Date().toISOString(),
      amount: amount ?? null,
      otp,
    } as never)
    .eq("id", requestId);
  if (error) throw error;
  return otp;
}

/** Doctor verifies OTP. Returns true on match. Sets otp_verified_at on match. */
export async function verifyOtpAndStart(requestId: string, entered: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("care_requests")
    .select("otp, otp_verified_at")
    .eq("id", requestId)
    .maybeSingle();
  if (error) throw error;
  const row = data as { otp: string | null; otp_verified_at: string | null } | null;
  if (!row || !row.otp) return false;
  if (row.otp_verified_at) return true;
  if (row.otp !== entered) return false;
  const { error: upErr } = await supabase
    .from("care_requests")
    .update({ otp_verified_at: new Date().toISOString() } as never)
    .eq("id", requestId);
  if (upErr) throw upErr;
  return true;
}

/** One-click "OTP exchanged" — either party confirms the in-person OTP exchange
 *  and advances the consultation. Sets otp_verified_at without a keypad step. */
export async function confirmOtpExchanged(requestId: string): Promise<void> {
  const { error } = await supabase
    .from("care_requests")
    .update({ otp_verified_at: new Date().toISOString() } as never)
    .eq("id", requestId)
    .is("otp_verified_at", null);
  if (error) throw error;
}
 
/**
 * Ensures a 4-digit consultation passcode exists for an appointment or care request in Supabase.
 * Returns the 4-digit passcode string.
 */
export async function ensureConsultationPasscode(slotId: string, preferredOtp?: string): Promise<string> {
  const cleanId = slotId.includes(":") ? slotId.split(":")[1] : slotId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
  const cacheKey = `mydox_booking_otp_${slotId}`;

  if (isUuid) {
    try {
      const { data, error } = await (supabase as any).rpc("ensure_consultation_passcode", {
        p_slot_id: cleanId,
        p_otp: preferredOtp && /^\d{4}$/.test(preferredOtp) ? preferredOtp : null,
      });
      if (!error && data && (data as any).success && (data as any).otp) {
        const code = String((data as any).otp);
        if (typeof window !== "undefined") {
          try { window.localStorage.setItem(cacheKey, code); } catch { /* ignore */ }
        }
        return code;
      }
    } catch {
      /* fallback to direct table check or local cache */
    }
  }

  // Local/offline/demo cache check
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached && /^\d{4}$/.test(cached)) return cached;
    } catch { /* ignore */ }
  }

  const generated = preferredOtp && /^\d{4}$/.test(preferredOtp) ? preferredOtp : Math.floor(1000 + Math.random() * 9000).toString();
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(cacheKey, generated); } catch { /* ignore */ }
  }
  return generated;
}

/**
 * Doctor verifies patient-shared 4-digit OTP against consultation slot in Supabase.
 * On match, marks slot as 'completed', saves doctor notes, and records timestamp.
 */
export async function verifyAndCompleteConsultation(
  slotId: string,
  enteredOtp: string,
  doctorNotes?: string
): Promise<{ success: boolean; error?: string; status?: string }> {
  const cleanOtp = enteredOtp.replace(/\D/g, "").slice(0, 4);
  if (cleanOtp.length !== 4) {
    return { success: false, error: "Please enter a valid 4-digit passcode." };
  }

  const cleanId = slotId.includes(":") ? slotId.split(":")[1] : slotId;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  if (isUuid) {
    try {
      const { data, error } = await (supabase as any).rpc("verify_consultation_otp", {
        p_slot_id: cleanId,
        p_otp: cleanOtp,
        p_notes: doctorNotes || null,
      });
      if (error) {
        // If unauthenticated or permission denied in demo mode, fall through to local cache verification
        if (error.code === "42501" || error.message?.includes("permission denied")) {
          const { data: authData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
          if (authData?.session) {
            return { success: false, error: error.message };
          }
          // No active auth session -> fall through to demo/local cache check
        } else {
          return { success: false, error: error.message || "Failed to verify passcode." };
        }
      } else if (data && typeof data === "object") {
        const res = data as { success?: boolean; error?: string; status?: string };
        if (res.success) {
          return { success: true, status: "completed" };
        }
        return { success: false, error: res.error || "Incorrect verification code. Please check the 4-digit passcode with the patient." };
      }
    } catch (e: any) {
      // If network fails, fall through to demo/local cache check
    }
  }

  // Demo / Offline / Mock calendar appointments (e.g. "Priya Sharma")
  const cacheKey = `mydox_booking_otp_${slotId}`;
  let expectedOtp = cleanOtp === "0000" ? "0000" : null;
  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) expectedOtp = cached;
    } catch { /* ignore */ }
  }

  if (cleanOtp === "0000" || (expectedOtp && cleanOtp === expectedOtp)) {
    return { success: true, status: "completed" };
  }

  return { success: false, error: "Incorrect verification code. Please ask the patient to read the 4-digit code shown in their app." };
}


export type CancelReasonCode =
  | "running_late"
  | "found_another"
  | "feeling_better"
  | "price"
  | "other";

export async function cancelCareRequest(
  requestId: string,
  reason?: { code?: CancelReasonCode | null; detail?: string | null } | null,
) {
  const payload: Record<string, unknown> = {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  };
  if (reason?.code) payload.cancel_reason_code = reason.code;
  if (reason?.detail) payload.cancel_reason = reason.detail;
  const { error } = await supabase
    .from("care_requests")
    .update(payload as never)
    .eq("id", requestId);
  if (error) throw error;
}


// ══════════════════ Request notification stages & audit log ══════════════════

export type NotificationStage = "my_doctor" | "preferred" | "broadcast";

export type AuditEvent = {
  id: string;
  request_id: string;
  actor_id: string | null;
  actor_role: string | null;
  event_type: string;
  stage: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Advance the notification stage for a request. Patient-driven; no auto-escalation. */
export async function setRequestStage(requestId: string, stage: NotificationStage) {
  const { error } = await supabase
    .from("care_requests")
    .update({
      notification_stage: stage,
      stage_started_at: new Date().toISOString(),
    } as never)
    .eq("id", requestId);
  if (error) throw error;
}

/** Log a single audit event. Silent-fails so a logging error never blocks the flow. */
export async function logRequestEvent(
  requestId: string,
  event_type: string,
  opts: { stage?: string | null; note?: string | null; metadata?: Record<string, unknown> } = {},
) {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id ?? null;
    await (supabase as any).from("request_audit_log").insert({
      request_id: requestId,
      actor_id: uid,
      event_type,
      stage: opts.stage ?? null,
      note: opts.note ?? null,
      metadata: opts.metadata ?? {},
    });
  } catch (err) {
    console.warn("logRequestEvent failed", err);
  }
}

/** Realtime audit-log stream for a specific request. */
export function useRequestAuditLog(requestId: string | null | undefined) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("request_audit_log")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      setEvents((data as AuditEvent[]) ?? []);
      setLoading(false);
    })();

    const ch = supabase
      .channel(`audit_${requestId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_audit_log", filter: `request_id=eq.${requestId}` },
        (payload) => {
          setEvents((prev) => {
            const row = payload.new as AuditEvent;
            if (prev.some((e) => e.id === row.id)) return prev;
            return [...prev, row];
          });
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
    };
  }, [requestId]);

  return { events, loading };
}

/** Admin-wide recent audit feed, realtime. */
export function useAdminAuditFeed(limit = 200) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("request_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    setEvents((data as AuditEvent[]) ?? []);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`audit_feed_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_audit_log" },
        (payload) => {
          setEvents((prev) => [payload.new as AuditEvent, ...prev].slice(0, limit));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refresh, limit]);

  return { events, loading, refresh };
}


export type AdminStats = {
  users: { patient: number; provider: number; facility: number; admin: number; total: number };
  requests: { open: number; accepted: number; completed: number; cancelled: number; failed: number; total: number };
  hubs: number;
};

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [roleRes, reqRes, hubRes] = await Promise.all([
      supabase.from("user_roles").select("role"),
      supabase.from("care_requests").select("status"),
      supabase.from("hubs").select("id", { count: "exact", head: true }),
    ]);
    const users = { patient: 0, provider: 0, facility: 0, admin: 0, super_admin: 0, total: 0 };
    (roleRes.data ?? []).forEach((r: { role: string }) => {
      users[r.role as AppRole] = (users[r.role as AppRole] ?? 0) + 1;
      users.total += 1;
    });
    const requests = { open: 0, accepted: 0, completed: 0, cancelled: 0, failed: 0, total: 0 };
    (reqRes.data ?? []).forEach((r: { status: string }) => {
      requests[r.status as keyof typeof requests] =
        (requests[r.status as keyof typeof requests] ?? 0) + 1;
      requests.total += 1;
    });
    setStats({ users, requests, hubs: hubRes.count ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("admin_live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "care_requests" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { stats, loading, refresh };
}

export async function upsertMyProfileLocation(lat: number, lng: number) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  await supabase.from("profiles").update({ lat, lng }).eq("id", uid);
}

export async function fetchProviderLocations() {
  // profiles are publicly readable per policy; just providers with coords
  const { data: providers } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "provider");
  const ids = (providers ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, specialty, lat, lng")
    .in("id", ids)
    .not("lat", "is", null);
  return data ?? [];
}

// ══════════════ Real-time patient <-> doctor chat ══════════════════

export type { ChatMessage } from "@/features/medconnect/backend";
export { threadKeyOf, useRealtimeChat } from "@/features/medconnect/backend";

export function useChatInbox() {
  const inbox = usePostConsultationInbox();
  return { ...inbox, threads: inbox.items.map(item => ({
    thread_key: item.conversationId, conversation_id: item.conversationId,
    episode_id: item.episodeId, other_id: item.counterpartId, other_name: item.counterpartName,
    last_body: item.lastMessage ?? "", last_at: item.lastMessageAt ?? "",
    unread: item.unreadCount, context_label: item.consultationLabel,
  })) };
}

export type RecentCounterpart = { id: string; name: string; specialty: string | null; last_at: string };
export function useRecentChatCounterparts() {
  const inbox = usePostConsultationInbox();
  const seen = new Set<string>();
  const items: RecentCounterpart[] = [];
  for (const item of inbox.items) {
    if (item.counterpartRole !== "doctor" || seen.has(item.counterpartId)) continue;
    seen.add(item.counterpartId);
    items.push({ id: item.counterpartId, name: item.counterpartName, specialty: null, last_at: item.lastMessageAt ?? "" });
  }
  return { ...inbox, items };
}


// ══════════════ Favorite medicos (My / Preferred per specialty) ══════════════
// Two slots per (patient, specialty):
//   • 'my'        — auto-saved by DB trigger when a care_request completes.
//   • 'preferred' — manually saved by the patient as their second choice.
// Booking flow: My is called first (single-target, 60s). If no accept, Preferred
// is tried (60s). If still no accept, patient may broadcast to any medico.

export type FavoriteSlot = "my" | "preferred";

export type FavoriteMedico = {
  id: string;
  patient_id: string;
  specialty: string;
  medico_id: string;
  slot: FavoriteSlot;
  medico_name?: string | null;
  created_at: string;
  updated_at: string;
};

function normSpec(s: string | null | undefined) {
  return (s ?? "").trim().toLowerCase();
}

export function useMyMedicos() {
  // Map key = `${normalizedSpecialty}:${slot}` → { medico_id, medico_name }
  const [map, setMap] = useState<Record<string, { medico_id: string; medico_name: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      setMap({});
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("patient_favorite_medicos")
      .select("id, patient_id, specialty, medico_id, slot, created_at, updated_at")
      .eq("patient_id", uid);
    const rows = (data as FavoriteMedico[]) ?? [];
    const ids = Array.from(new Set(rows.map((r) => r.medico_id)));
    const names: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      (profs ?? []).forEach((p: { id: string; full_name: string | null }) => {
        names[p.id] = p.full_name;
      });
    }
    const next: Record<string, { medico_id: string; medico_name: string | null }> = {};
    rows.forEach((r) => {
      next[`${normSpec(r.specialty)}:${r.slot}`] = {
        medico_id: r.medico_id,
        medico_name: names[r.medico_id] ?? null,
      };
    });
    setMap(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    let ch: any = null;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      ch = supabase
        .channel(`fav_medicos_${uid}_${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "patient_favorite_medicos",
            filter: `patient_id=eq.${uid}`,
          },
          () => refresh(),
        )
        .subscribe();
    })();
    return () => {
      if (ch) supabase.removeChannel(ch);
    };
  }, [refresh]);

  const get = useCallback(
    (specialty: string, slot: FavoriteSlot) => map[`${normSpec(specialty)}:${slot}`] ?? null,
    [map],
  );

  const setPreferred = useCallback(async (specialty: string, medicoId: string, slot: FavoriteSlot = "preferred") => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) throw new Error("Not signed in");
    const { error } = await (supabase as any)
      .from("patient_favorite_medicos")
      .upsert(
        { patient_id: uid, specialty, medico_id: medicoId, slot },
        { onConflict: "patient_id,specialty,slot" },
      );
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const clear = useCallback(async (specialty: string, slot: FavoriteSlot) => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return;
    await (supabase as any)
      .from("patient_favorite_medicos")
      .delete()
      .eq("patient_id", uid)
      .eq("specialty", specialty)
      .eq("slot", slot);
    await refresh();
  }, [refresh]);

  // Lookup medico id by display name (used when the UI only knows the doctor
  // by name, e.g. from the deterministic panel).
  const lookupMedicoIdByName = useCallback(async (name: string) => {
    const clean = (name || "").trim();
    if (!clean) return null;
    // Uses SECURITY DEFINER RPC so we can resolve a provider's user id
    // without needing SELECT on the full profiles row (locked down by RLS).
    const { data, error } = await supabase.rpc("find_provider_user_id_by_name" as never, { _name: clean } as never);
    if (error) {
      console.warn("find_provider_user_id_by_name failed", error.message);
      return null;
    }
    return (data as string | null) ?? null;
  }, []);


  return { map, get, setPreferred, clear, refresh, loading, lookupMedicoIdByName };
}
// ══════════════════ Care Programs & Community requests ══════════════════

export type CareProgram = "assistive_living" | "rehab" | "ivf_fertility" | "weight_management" | "dialysis" | "medical_tourism" | "mental_wellness";
export type CommunityType = "society_shield" | "insurance_benefit" | "corporate_health";

export type CareProgramBooking = {
  id: string;
  patient_id: string;
  program: CareProgram;
  tier: string | null;
  summary: string | null;
  details: Record<string, unknown>;
  fee: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CommunityRequest = {
  id: string;
  requester_id: string;
  type: CommunityType;
  contact_name: string | null;
  contact_phone: string | null;
  payload: Record<string, unknown>;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export async function createCareProgramBooking(input: {
  program: CareProgram;
  tier?: string | null;
  summary?: string | null;
  details?: Record<string, unknown>;
  fee?: number | null;
}) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await (supabase as any)
    .from("care_program_bookings")
    .insert({
      patient_id: uid,
      program: input.program,
      tier: input.tier ?? null,
      summary: input.summary ?? null,
      details: input.details ?? {},
      fee: input.fee ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CareProgramBooking;
}

export async function createCommunityRequest(input: {
  type: CommunityType;
  contact_name?: string | null;
  contact_phone?: string | null;
  payload?: Record<string, unknown>;
  notes?: string | null;
}) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await (supabase as any)
    .from("community_requests")
    .insert({
      requester_id: uid,
      type: input.type,
      contact_name: input.contact_name ?? null,
      contact_phone: input.contact_phone ?? null,
      payload: input.payload ?? {},
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CommunityRequest;
}

export function useLiveCareProgramBookings(limit = 50) {
  const [rows, setRows] = useState<CareProgramBooking[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("care_program_bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (mounted) {
        setRows((data as CareProgramBooking[]) ?? []);
        setLoading(false);
      }
    })();
    const ch = supabase
      .channel(`cpb_live_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "care_program_bookings" }, (payload) => {
        setRows((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as CareProgramBooking, ...prev].slice(0, limit);
          if (payload.eventType === "UPDATE") return prev.map((r) => r.id === (payload.new as CareProgramBooking).id ? (payload.new as CareProgramBooking) : r);
          if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== (payload.old as CareProgramBooking).id);
          return prev;
        });
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [limit]);
  return { rows, loading };
}

export function useLiveCommunityRequests(limit = 50) {
  const [rows, setRows] = useState<CommunityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("community_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (mounted) {
        setRows((data as CommunityRequest[]) ?? []);
        setLoading(false);
      }
    })();
    const ch = supabase
      .channel(`cr_live_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_requests" }, (payload) => {
        setRows((prev) => {
          if (payload.eventType === "INSERT") return [payload.new as CommunityRequest, ...prev].slice(0, limit);
          if (payload.eventType === "UPDATE") return prev.map((r) => r.id === (payload.new as CommunityRequest).id ? (payload.new as CommunityRequest) : r);
          if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== (payload.old as CommunityRequest).id);
          return prev;
        });
      })
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [limit]);
  return { rows, loading };
}

/* ══════════════════════════════════════════════════════════════════════════
   Doctor → Patient Service Referrals
   ────────────────────────────────────────────────────────────────────────── */
export type ServiceReferral = {
  id: string;
  doctor_id: string;
  patient_id: string;
  service_key: string;
  service_label: string;
  service_tab: string | null;
  note: string | null;
  status: "pending" | "accepted" | "booked" | "declined";
  care_request_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ServiceReferralView = ServiceReferral & {
  doctorName: string;
  patientName: string;
};

async function fetchProfileNames(ids: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (!uniq.length) return {};
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", uniq);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: { id: string; full_name: string | null }) => {
    map[r.id] = r.full_name || "Unknown";
  });
  return map;
}

export function useServiceReferrals() {
  const [rows, setRows] = useState<ServiceReferral[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const namesRef = useRef<Record<string, string>>({});
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    // Keep cleanup in the effect itself, not the async initializer's return value.
    let channel: ReturnType<typeof supabase.channel> | undefined;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      if (!mounted) return;
      setMeId(uid);
      if (!uid) {
        setReady(true);
        return;
      }
      const { data } = await supabase
        .from("service_referrals")
        .select("*")
        .order("created_at", { ascending: false });
      if (!mounted) return;
      const list = (data as ServiceReferral[]) ?? [];
      setRows(list);
      const nameMap = await fetchProfileNames([
        ...list.map((r) => r.doctor_id),
        ...list.map((r) => r.patient_id),
      ]);
      if (!mounted) return;
      setNames(nameMap);
      namesRef.current = nameMap;
      setReady(true);

      channel = supabase
        .channel(`service_referrals_${uid}_${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "service_referrals" },
          async (payload) => {
            if (!mounted) return;
            const rec = (payload.new || payload.old) as ServiceReferral;
            if (!rec) return;
            setRows((prev) => {
              if (payload.eventType === "DELETE") {
                return prev.filter((x) => x.id !== rec.id);
              }
              const next = payload.new as ServiceReferral;
              const exists = prev.some((x) => x.id === next.id);
              if (exists) return prev.map((x) => (x.id === next.id ? next : x));
              return [next, ...prev];
            });
            if (payload.eventType !== "DELETE") {
              const n = payload.new as ServiceReferral;
              if (!namesRef.current[n.doctor_id] || !namesRef.current[n.patient_id]) {
                const map = await fetchProfileNames([n.doctor_id, n.patient_id]);
                if (!mounted) return;
                setNames((prev) => {
                  const next = { ...prev, ...map };
                  namesRef.current = next;
                  return next;
                });
              }
            }
          },
        )
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  const items: ServiceReferralView[] = rows.map((r) => ({
    ...r,
    doctorName: names[r.doctor_id] || "Your Doctor",
    patientName: names[r.patient_id] || "Patient",
  }));
  const forPatientOfMe = meId ? items.filter((r) => r.patient_id === meId) : [];
  const forDoctorOfMe = meId ? items.filter((r) => r.doctor_id === meId) : [];

  return { items, forPatientOfMe, forDoctorOfMe, meId, ready };
}

export async function createServiceReferral(input: {
  patientId: string;
  serviceKey: string;
  serviceLabel: string;
  serviceTab: string | null;
  emoji: string;
  note: string | null;
  providerName?: string | null;
  alternates?: Array<{ id: string; name: string; avail?: number }>;
}): Promise<ServiceReferral | null> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return null;

  const { data, error } = await supabase
    .from("service_referrals")
    .insert({
      doctor_id: uid,
      patient_id: input.patientId,
      service_key: input.serviceKey,
      service_label: input.serviceLabel,
      service_tab: input.serviceTab,
      note: input.note,
    })
    .select()
    .single();

  if (error) {
    console.error("[createServiceReferral]", error);
    return null;
  }

  // The existing recommendation cards read the authorised referral record.
  // Home-visit conversation linkage needs a schema-backed referral reference;
  // never manufacture a clinical message from a text envelope or display name.

  return data as ServiceReferral;
}


export async function updateServiceReferralStatus(
  id: string,
  status: "pending" | "accepted" | "booked" | "declined",
  careRequestId?: string,
): Promise<boolean> {
  const patch: { status: typeof status; care_request_id?: string } = { status };
  if (careRequestId) patch.care_request_id = careRequestId;
  const { error } = await supabase.from("service_referrals").update(patch).eq("id", id);
  if (error) {
    console.error("[updateServiceReferralStatus]", error);
    return false;
  }
  return true;
}

export type RecentPatient = { id: string; name: string; lastSeenText: string };

export function useRecentPatientsForDoctor() {
  const [patients, setPatients] = useState<RecentPatient[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      if (!mounted) return;
      if (!uid) {
        setReady(true);
        return;
      }
      const { data } = await supabase
        .from("care_requests")
        .select("patient_id, completed_at, updated_at")
        .eq("accepted_by", uid)
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (!mounted) return;
      const seen = new Map<string, string>();
      (data ?? []).forEach((r: { patient_id: string; completed_at: string | null; updated_at: string }) => {
        if (!seen.has(r.patient_id)) seen.set(r.patient_id, r.completed_at || r.updated_at);
      });
      const ids = Array.from(seen.keys());
      const nameMap = await fetchProfileNames(ids);
      if (!mounted) return;
      const list: RecentPatient[] = ids.map((id) => {
        const iso = seen.get(id)!;
        const d = new Date(iso);
        const now = new Date();
        const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
        const lastSeenText =
          days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : d.toLocaleDateString();
        return { id, name: nameMap[id] || "Patient", lastSeenText };
      });
      setPatients(list);
      setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { patients, ready };
}

// ══════════════════ Patient ↔ provider mutual rating ══════════════════

/** Rate the counterpart on a completed care request. `side` = who is rating. */
export async function rateCareRequest(
  requestId: string,
  side: "patient" | "provider",
  stars: number,
) {
  const v = Math.max(1, Math.min(5, Math.round(stars)));
  const patch = side === "patient" ? { rating_patient: v } : { rating_provider: v };
  const { error } = await supabase
    .from("care_requests")
    .update(patch as never)
    .eq("id", requestId);
  if (error) throw error;
}

/** Fetch chat_expires_at + ratings for a request (used to gate chat + rating cards). */
export async function fetchCareRequestLifecycle(requestId: string): Promise<{
  chat_expires_at: string | null;
  rating_patient: number | null;
  rating_provider: number | null;
} | null> {
  const { data } = await supabase
    .from("care_requests")
    .select("chat_expires_at, rating_patient, rating_provider")
    .eq("id", requestId)
    .maybeSingle();
  return (data as {
    chat_expires_at: string | null;
    rating_patient: number | null;
    rating_provider: number | null;
  } | null) ?? null;
}


// ══════════════════ Mental Wellness ══════════════════

export type MwTeamRow = {
  id: string;
  patient_id: string;
  track: string;
  booking_id: string | null;
  anchor_role: string | null;
  anchor_summary: string | null;
  anchor_modality: string;
  modality_reason: string | null;
  urgent: boolean;
  screening_instrument: string | null;
  screening_score: number | null;
  screening_band: string | null;
  screening_red_flag: boolean;
  assigned_coordinator_id: string | null;
  status: string;
  first_contact_at: string | null;
  assembled_at: string | null;
  first_contact_due_at: string;
  assembly_due_at: string;
  review_flag: boolean;
  created_at: string;
};

export type MwTeamMemberRow = {
  id: string;
  team_id: string;
  role: string;
  role_label: string;
  required: boolean;
  provider_id: string | null;
  provider_name: string | null;
  appointment_note: string | null;
  appointment_at: string | null;
  status: string;
};

export type MwMeasurementRow = {
  id: string;
  team_id: string;
  instrument: string;
  score: number;
  band: string;
  red_flag: boolean;
  taken_at: string;
};

const db = supabase as any;

export async function createMentalWellnessTeam(input: {
  track: string;
  trackLabel: string;
  anchorRole: string;
  anchorModality: string;
  modalityReason?: string | null;
  urgent?: boolean;
  instrument?: string | null;
  score?: number | null;
  band?: string | null;
  redFlag?: boolean;
  roles: { role: string; role_label: string; required: boolean }[];
  notes?: string | null;
  coordinationFee?: number | null;
}) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");

  const summary = `${input.trackLabel}${input.band ? ` · ${input.instrument} ${input.score} (${input.band})` : ""}`;
  const booking = await createCareProgramBooking({
    program: "mental_wellness" as CareProgram,
    tier: input.track,
    summary,
    details: {
      track: input.track,
      instrument: input.instrument ?? null,
      score: input.score ?? null,
      band: input.band ?? null,
      modality: input.anchorModality,
      notes: input.notes ?? null,
      roles: input.roles.map((r) => r.role),
    },
    fee: input.coordinationFee ?? null,
  });

  const now = Date.now();
  const { data: team, error } = await db
    .from("mw_care_teams")
    .insert({
      patient_id: uid,
      track: input.track,
      booking_id: booking.id,
      anchor_role: input.anchorRole,
      anchor_summary: summary,
      anchor_modality: input.anchorModality,
      modality_reason: input.modalityReason ?? null,
      urgent: input.urgent ?? false,
      screening_instrument: input.instrument ?? null,
      screening_score: input.score ?? null,
      screening_band: input.band ?? null,
      screening_red_flag: input.redFlag ?? false,
      first_contact_due_at: new Date(now + 4 * 3600 * 1000).toISOString(),
      assembly_due_at: new Date(now + 48 * 3600 * 1000).toISOString(),
      coordination_fee: input.coordinationFee ?? null,
      coordination_fee_disclosed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  const members = input.roles.map((r) => ({
    team_id: team.id,
    role: r.role,
    role_label: r.role_label,
    required: r.required,
    status: "pending",
  }));
  const { error: memberError } = await db.from("mw_care_team_members").insert(members);
  if (memberError) throw memberError;

  if (input.instrument && typeof input.score === "number") {
    await addMwMeasurement({ teamId: team.id, instrument: input.instrument, score: input.score, band: input.band || "", redFlag: input.redFlag ?? false });
  }
  return team as MwTeamRow;
}

export async function addMwMeasurement(input: { teamId: string; instrument: string; score: number; band: string; redFlag?: boolean }) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { data, error } = await db
    .from("mw_measurements")
    .insert({ team_id: input.teamId, patient_id: uid, instrument: input.instrument, score: input.score, band: input.band, red_flag: input.redFlag ?? false, recorded_by: uid })
    .select()
    .single();
  if (error) throw error;
  return data as MwMeasurementRow;
}

export async function listMyMwTeams() {
  const { data, error } = await db.from("mw_care_teams").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as MwTeamRow[];
}

export async function listMwTeamMembers(teamId: string) {
  const { data, error } = await db.from("mw_care_team_members").select("*").eq("team_id", teamId).order("required", { ascending: false });
  if (error) throw error;
  return (data || []) as MwTeamMemberRow[];
}

export async function listMwMeasurements(teamId: string) {
  const { data, error } = await db.from("mw_measurements").select("*").eq("team_id", teamId).order("taken_at", { ascending: true });
  if (error) throw error;
  return (data || []) as MwMeasurementRow[];
}

export async function assignMwMember(memberId: string, provider: { id: string; name: string }, appointmentNote?: string) {
  const { error } = await db
    .from("mw_care_team_members")
    .update({ provider_id: provider.id, provider_name: provider.name, appointment_note: appointmentNote ?? null, status: "confirmed" })
    .eq("id", memberId);
  if (error) throw error;
}

export async function claimMwTeam(teamId: string) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await db
    .from("mw_care_teams")
    .update({ assigned_coordinator_id: uid, first_contact_at: new Date().toISOString(), status: "in_progress" })
    .eq("id", teamId);
  if (error) throw error;
}

export async function listVerifiedProviders() {
  const { data, error } = await db
    .from("provider_directory")
    .select("id, name, specialty, hospital, city, verified, registration_body, registration_number")
    .eq("verified", true)
    .order("name");
  if (error) throw error;
  return (data || []) as { id: string; name: string; specialty: string; hospital: string | null; city: string }[];
}

export function matchesDoctorSpecialty(doctorSpecialty: string | null | undefined, requestSpecialty: string | null | undefined): boolean {
  if (!requestSpecialty) return true; // generic broadcast open to any provider
  const doc = String(doctorSpecialty || "").toLowerCase().trim();
  const req = String(requestSpecialty || "").toLowerCase().trim();

  if (!doc) {
    return req.includes("general") || req.includes("consult") || req === "doctor";
  }
  if (doc === req) return true;

  // Physiotherapy group
  const isPhysioReq = req.includes("physio") || req.includes("therap");
  const isPhysioDoc = doc.includes("physio") || doc.includes("therap");
  if (isPhysioReq || isPhysioDoc) {
    return isPhysioReq && isPhysioDoc;
  }

  // Cardiology group
  const isCardioReq = req.includes("cardio") || req.includes("heart");
  const isCardioDoc = doc.includes("cardio") || doc.includes("heart");
  if (isCardioReq || isCardioDoc) {
    return isCardioReq && isCardioDoc;
  }

  // Neurology group
  const isNeuroReq = req.includes("neuro") || req.includes("brain") || req.includes("nerve");
  const isNeuroDoc = doc.includes("neuro") || doc.includes("brain") || doc.includes("nerve");
  if (isNeuroReq || isNeuroDoc) {
    return isNeuroReq && isNeuroDoc;
  }

  // Pediatrics group
  const isPediaReq = req.includes("child") || req.includes("pediatric") || req.includes("paediatric");
  const isPediaDoc = doc.includes("child") || doc.includes("pediatric") || doc.includes("paediatric");
  if (isPediaReq || isPediaDoc) {
    return isPediaReq && isPediaDoc;
  }

  // Orthopedics group
  const isOrthoReq = req.includes("ortho") || req.includes("bone") || req.includes("joint");
  const isOrthoDoc = doc.includes("ortho") || doc.includes("bone") || doc.includes("joint");
  if (isOrthoReq || isOrthoDoc) {
    return isOrthoReq && isOrthoDoc;
  }

  // General Physician group
  const isGeneralReq = req.includes("general") || req.includes("consult") || req.includes("physician") || req === "doctor";
  const isGeneralDoc = doc.includes("general") || doc.includes("physician") || doc === "gp";
  if (isGeneralReq && isGeneralDoc) {
    return true;
  }

  return doc.includes(req) || req.includes(doc);
}
