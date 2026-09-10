import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SurgeryRoleKey =
  | "surgeon"
  | "anaesthetist"
  | "obstetrician"
  | "paediatrician"
  | "ot_technician"
  | "scrub_nurse"
  | "other";

export const SURGERY_ROLE_LABELS: Record<SurgeryRoleKey, string> = {
  surgeon: "Surgeon",
  anaesthetist: "Anaesthetist",
  obstetrician: "Obstetrician",
  paediatrician: "Paediatrician",
  ot_technician: "OT Technician",
  scrub_nurse: "Scrub Nurse",
  other: "Other",
};

export const PROCEDURE_PRESETS: { name: string; roles: SurgeryRoleKey[] }[] = [
  { name: "C-section", roles: ["obstetrician", "anaesthetist", "paediatrician", "ot_technician", "scrub_nurse"] },
  { name: "Normal Delivery", roles: ["obstetrician", "paediatrician", "scrub_nurse"] },
  { name: "Appendectomy", roles: ["surgeon", "anaesthetist", "ot_technician"] },
  { name: "Fracture / Ortho", roles: ["surgeon", "anaesthetist", "ot_technician"] },
  { name: "Cataract", roles: ["surgeon", "anaesthetist", "scrub_nurse"] },
  { name: "Emergency Trauma", roles: ["surgeon", "anaesthetist", "ot_technician", "scrub_nurse"] },
];

export type SurgeryBooking = {
  id: string;
  facility_id: string;
  patient_name: string;
  patient_phone: string | null;
  procedure: string;
  mode: "planned" | "emergency";
  scheduled_at: string | null;
  notes: string | null;
  status: "draft" | "broadcasting" | "confirmed" | "in_progress" | "completed" | "cancelled";
  ot_room: string | null;
  blood_units: number | null;
  blood_group: string | null;
  created_at: string;
  updated_at: string;
};

export type SurgeryRole = {
  id: string;
  booking_id: string;
  role: SurgeryRoleKey;
  specialty: string | null;
  assigned_to: string | null;
  status: "pending" | "accepted" | "declined";
  accepted_at: string | null;
  arrival_deadline: string | null;
  paid_at: string | null;
  otp: string | null;
  otp_verified_at: string | null;
  completed_at: string | null;
  chat_expires_at: string | null;
  rating_hub: number | null;
  rating_hub_at: string | null;
  rating_provider: number | null;
  rating_provider_at: string | null;
  fee: number | null;
  created_at: string;
  updated_at: string;
};

export const BLOOD_GROUPS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const SURGERY_TEST_OTP = "0000";

export function surgeryChatThreadKey(roleId: string) {
  return `surgery:${roleId}`;
}

/** Hub confirms the accepted role → generates OTP + stamps paid_at. */
export async function hubConfirmSurgeryRole(roleId: string) {
  const otp = SURGERY_TEST_OTP;
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({ paid_at: new Date().toISOString(), otp } as never)
    .eq("id", roleId)
    .is("paid_at", null);
  if (error) throw error;
  return otp;
}

/** Provider verifies the hub-supplied OTP. Returns true on match. */
export async function providerVerifySurgeryOtp(roleId: string, entered: string) {
  const { data } = await supabase
    .from("surgery_booking_roles")
    .select("otp, otp_verified_at")
    .eq("id", roleId)
    .maybeSingle();
  const row = data as { otp: string | null; otp_verified_at: string | null } | null;
  if (!row || !row.otp) return false;
  if (row.otp_verified_at) return true;
  if (row.otp !== entered) return false;
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({ otp_verified_at: new Date().toISOString() } as never)
    .eq("id", roleId)
    .is("otp_verified_at", null);
  return !error;
}

/** One-tap "OTP exchanged" — either party confirms in person. */
export async function confirmSurgeryOtpExchanged(roleId: string) {
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({ otp_verified_at: new Date().toISOString() } as never)
    .eq("id", roleId)
    .is("otp_verified_at", null);
  if (error) throw error;
}

export async function completeSurgeryRole(roleId: string) {
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({ status: "accepted", completed_at: new Date().toISOString() } as never)
    .eq("id", roleId);
  if (error) throw error;
}

export async function rateSurgeryRole(
  roleId: string,
  side: "hub" | "provider",
  stars: number,
) {
  const patch =
    side === "hub"
      ? { rating_hub: Math.max(1, Math.min(5, Math.round(stars))) }
      : { rating_provider: Math.max(1, Math.min(5, Math.round(stars))) };
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update(patch as never)
    .eq("id", roleId);
  if (error) throw error;
}

/** Mark an accepted role as failed (no-show / arrival deadline missed). */
export async function failSurgeryRole(roleId: string) {
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({ status: "declined", completed_at: new Date().toISOString() } as never)
    .eq("id", roleId)
    .eq("status", "accepted");
  if (error) throw error;
}

export type SurgeryAuditEvent = {
  id: string;
  booking_id: string | null;
  booking_role_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  event_type: string;
  stage: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Realtime audit log for a single surgery booking. */
export function useSurgeryBookingAuditLog(bookingId: string | null | undefined) {
  const [events, setEvents] = useState<SurgeryAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) { setEvents([]); setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("request_audit_log")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (!mounted) return;
      setEvents((data as SurgeryAuditEvent[]) ?? []);
      setLoading(false);
    })();
    const ch = supabase
      .channel(`s_audit_${bookingId}_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "request_audit_log", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const row = payload.new as SurgeryAuditEvent;
          setEvents((prev) => (prev.some((e) => e.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [bookingId]);

  return { events, loading };
}

export type SurgeryChatMessage = {
  id: string;
  thread_key: string;
  sender_id: string;
  recipient_id: string | null;
  body: string;
  created_at: string;
};

/** Hub↔provider chat for one accepted role. Auto-closes after chat_expires_at. */
export function useSurgeryRoleChat(
  roleId: string | null,
  counterpartId: string | null,
  chatExpiresAt: string | null,
) {
  const [messages, setMessages] = useState<SurgeryChatMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!roleId) { setMessages([]); setReady(true); return; }
    const tk = surgeryChatThreadKey(roleId);
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id ?? null;
      if (!mounted) return;
      setMeId(uid);
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("thread_key", tk)
        .order("created_at", { ascending: true })
        .limit(500);
      if (!mounted) return;
      setMessages((data as SurgeryChatMessage[]) ?? []);
      setReady(true);
      const ch = supabase
        .channel(`surgery_chat_${tk}_${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_key=eq.${tk}` },
          (payload) => {
            const m = payload.new as SurgeryChatMessage;
            setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          },
        )
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
    return () => { mounted = false; };
  }, [roleId]);

  const expired =
    !!chatExpiresAt && new Date(chatExpiresAt).getTime() < Date.now();

  const send = useCallback(
    async (body: string) => {
      const text = body.trim();
      if (!text || !meId || !roleId || !counterpartId || expired) return false;
      const { error } = await supabase.from("chat_messages").insert({
        thread_key: surgeryChatThreadKey(roleId),
        sender_id: meId,
        recipient_id: counterpartId,
        body: text,
      } as never);
      return !error;
    },
    [meId, roleId, counterpartId, expired],
  );

  return { messages, send, meId, ready, expired };
}

export async function createSurgeryBooking(input: {
  patient_name: string;
  patient_phone?: string | null;
  procedure: string;
  mode: "planned" | "emergency";
  scheduled_at?: string | null;
  notes?: string | null;
  roles: SurgeryRoleKey[];
  ot_room?: string | null;
  blood_units?: number | null;
  blood_group?: string | null;
  role_fees?: Partial<Record<SurgeryRoleKey, number | null>>;
}) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");

  const { data: booking, error } = await supabase
    .from("surgery_bookings")
    .insert({
      facility_id: uid,
      patient_name: input.patient_name,
      patient_phone: input.patient_phone ?? null,
      procedure: input.procedure,
      mode: input.mode,
      scheduled_at: input.mode === "emergency" ? null : input.scheduled_at ?? null,
      notes: input.notes ?? null,
      status: "broadcasting",
      ot_room: input.ot_room ?? null,
      blood_units: input.blood_units ?? null,
      blood_group: input.blood_group ?? null,
    } as never)
    .select("*")
    .single();
  if (error) throw error;

  const rolesToInsert = input.roles.map((r) => ({
    booking_id: (booking as SurgeryBooking).id,
    role: r,
    fee: input.role_fees?.[r] ?? null,
  }));
  if (rolesToInsert.length > 0) {
    const { error: rErr } = await supabase.from("surgery_booking_roles").insert(rolesToInsert as never);
    if (rErr) throw rErr;
  }
  return booking as SurgeryBooking;
}

export async function cancelSurgeryBooking(id: string) {
  const { error } = await supabase
    .from("surgery_bookings")
    .update({ status: "cancelled" } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function acceptSurgeryRole(roleId: string) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({
      assigned_to: uid,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    } as never)
    .eq("id", roleId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function declineSurgeryRole(roleId: string) {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) throw new Error("Not signed in");
  const { error } = await supabase
    .from("surgery_booking_roles")
    .update({ status: "declined", assigned_to: uid } as never)
    .eq("id", roleId);
  if (error) throw error;
}

export function useMyFacilitySurgeries() {
  const [bookings, setBookings] = useState<SurgeryBooking[]>([]);
  const [roles, setRoles] = useState<SurgeryRole[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) {
      setBookings([]); setRoles([]); setLoading(false); return;
    }
    const { data: bs } = await supabase
      .from("surgery_bookings")
      .select("*")
      .eq("facility_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (bs as SurgeryBooking[]) ?? [];
    setBookings(list);
    if (list.length) {
      const ids = list.map((b) => b.id);
      const { data: rs } = await supabase
        .from("surgery_booking_roles")
        .select("*")
        .in("booking_id", ids);
      setRoles((rs as SurgeryRole[]) ?? []);
    } else {
      setRoles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`surgery_facility_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "surgery_bookings" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "surgery_booking_roles" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { bookings, roles, loading, refresh };
}

export function useProviderSurgeryInvites() {
  const [roles, setRoles] = useState<SurgeryRole[]>([]);
  const [bookings, setBookings] = useState<SurgeryBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) { setRoles([]); setBookings([]); setLoading(false); return; }

    // Pending (open to anyone) + roles already assigned to me
    const { data: rs } = await supabase
      .from("surgery_booking_roles")
      .select("*")
      .or(`status.eq.pending,assigned_to.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(200);
    const list = (rs as SurgeryRole[]) ?? [];
    setRoles(list);
    if (list.length) {
      const ids = Array.from(new Set(list.map((r) => r.booking_id)));
      const { data: bs } = await supabase.from("surgery_bookings").select("*").in("id", ids);
      setBookings((bs as SurgeryBooking[]) ?? []);
    } else {
      setBookings([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`surgery_provider_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "surgery_booking_roles" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "surgery_bookings" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { roles, bookings, loading, refresh };
}
