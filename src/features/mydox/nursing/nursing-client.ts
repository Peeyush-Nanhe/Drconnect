import { supabase } from "@/integrations/supabase/client";

/**
 * One place for the nursing RPCs. The generated Supabase types do not yet know
 * about these functions, so the client is widened here rather than sprinkling
 * `as never` through every call site.
 */
type LooseClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  from: (table: string) => any;
};
const db = supabase as unknown as LooseClient;

export type NursingAssignmentState = "seeking_nurse" | "assigned" | "unfilled";

export type NursingVisitStatus =
  | "scheduled" | "seeking_cover" | "en_route" | "arrived"
  | "completed" | "cancelled_by_family" | "no_show_patient" | "missed";

export interface NursingEngagement {
  id: string;
  patient_id: string;
  kind: string;
  days_booked: number;
  days_scheduled: number;
  day_rate: number;
  total_amount: number;
  start_date: string;
  slot_time: string | null;
  shift_hours: number;
  address_snapshot: string | null;
  lat: number | null;
  lng: number | null;
  primary_nurse_id: string | null;
  preferred_nurse_id: string | null;
  assignment_state: NursingAssignmentState;
  status: "active" | "completed" | "cancelled";
  paid_at: string | null;
  created_at: string;
}

export interface NursingVisit {
  id: string;
  engagement_id: string;
  seq: number;
  visit_date: string;
  status: NursingVisitStatus;
  assigned_nurse_id: string | null;
  shift_start: string | null;
  shift_end: string | null;
  en_route_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  payout_amount: number | null;
}

export interface NursingDirections {
  visit_id: string;
  visit_date: string;
  shift_start: string;
  shift_end: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  patient_name: string | null;
  maps_url: string | null;
}

/** The server prefixes its errors with a stable code; show the sentence after it. */
export function nursingErrorText(error: unknown): string {
  const raw = (error as { message?: string })?.message ?? String(error ?? "");
  const m = raw.match(/NURSING_[A-Z_]+:\s*(.+)$/);
  return m ? m[1] : raw || "Something went wrong.";
}

export function isNursingError(error: unknown, code: string): boolean {
  return ((error as { message?: string })?.message ?? "").includes(code);
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

// ------------------------------------------------------------------ patient --

export interface BookNursingInput {
  days: number;
  startDate: string;          // YYYY-MM-DD
  slotTime?: string | null;   // HH:MM, the nurse's arrival time
  kind?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  nurseId?: string | null;    // asks this nurse first; it does not assign her
  idempotencyKey?: string;
}

/**
 * The key matters: without it a double tap creates a second paid package. The
 * server also collapses an identical repeat inside two minutes, but a caller
 * that can generate a stable key should.
 */
export async function bookNursing(input: BookNursingInput): Promise<NursingEngagement> {
  const rows = await call<NursingEngagement[] | NursingEngagement>(
    "create_nursing_engagement", {
      p_days: input.days,
      p_start_date: input.startDate,
      p_slot_time: input.slotTime ?? null,
      p_kind: input.kind ?? "General Duty Nurse",
      p_address: input.address ?? "Koregaon Park, Pune",
      p_lat: input.lat ?? 18.5362,
      p_lng: input.lng ?? 73.8930,
      p_nurse_id: input.nurseId ?? null,
      p_idempotency_key: input.idempotencyKey ?? null,
    });
  return Array.isArray(rows) ? rows[0] : rows;
}

export function newBookingKey(): string {
  return (globalThis.crypto?.randomUUID?.() ??
    `nk-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

export async function listMyNursingEngagements(patientId: string) {
  const { data, error } = await db
    .from("nursing_engagements")
    .select("*")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as NursingEngagement[];
}

export async function listNursingVisits(engagementIds: string[]) {
  if (!engagementIds.length) return [] as NursingVisit[];
  const { data, error } = await db
    .from("nursing_visits")
    .select("*")
    .in("engagement_id", engagementIds)
    .order("seq", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NursingVisit[];
}

/** Cancels one day. The money stays and a replacement day is added at the end. */
export function cancelNursingDay(visitId: string, reason?: string) {
  return call<NursingVisit[]>("cancel_nursing_visit_by_family", {
    p_visit_id: visitId, p_reason: reason ?? null,
  });
}

/** Six digits for the family to read out. Re-issuable, capped at ten. */
export function issueArrivalCode(visitId: string) {
  return call<string>("issue_nursing_arrival_code", { p_visit_id: visitId });
}

/** Finds today's open visit for an engagement to show the OTP. */
export async function getTodayVisitForEngagement(engagementId: string): Promise<NursingVisit | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("nursing_visits")
    .select("*")
    .eq("engagement_id", engagementId)
    .eq("visit_date", today)
    .in("status", ["scheduled", "en_route"])
    .maybeSingle();
  if (error) throw error;
  return data as NursingVisit | null;
}

// -------------------------------------------------------------------- nurse --

export function acceptNursingEngagement(engagementId: string) {
  return call<NursingEngagement[]>("accept_nursing_engagement", {
    p_engagement_id: engagementId,
  });
}

export function declineNursingEngagement(engagementId: string) {
  return call<void>("decline_nursing_engagement", { p_engagement_id: engagementId });
}

export function acceptNursingVisit(visitId: string) {
  return call<NursingVisit[]>("accept_nursing_visit", { p_visit_id: visitId });
}

export function releaseNursingVisit(visitId: string, reason?: string) {
  return call<NursingVisit[]>("release_nursing_visit", {
    p_visit_id: visitId, p_reason: reason ?? null,
  });
}

export function startNursingTravel(visitId: string) {
  return call<NursingVisit[]>("advance_nursing_visit", {
    p_visit_id: visitId, p_status: "en_route",
  });
}

/** The only route to 'arrived'. A wrong code throws NURSING_CODE_WRONG. */
export function verifyNursingArrival(visitId: string, code: string) {
  return call<NursingVisit[]>("verify_nursing_arrival", {
    p_visit_id: visitId, p_code: code,
  });
}

export function completeNursingVisit(visitId: string) {
  return call<NursingVisit[]>("advance_nursing_visit", {
    p_visit_id: visitId, p_status: "completed",
  });
}

export function reportPatientNoShow(visitId: string) {
  return call<NursingVisit[]>("advance_nursing_visit", {
    p_visit_id: visitId, p_status: "no_show_patient",
  });
}

/** Address opens two hours before the shift; earlier throws NURSING_TOO_EARLY. */
export function getNursingDirections(visitId: string) {
  return call<NursingDirections>("nursing_visit_directions", { p_visit_id: visitId });
}

/** Days this nurse already has that would clash with a package she is offered. */
export async function nursingConflicts(nurseId: string, engagementId: string) {
  const { data, error } = await db.rpc("nursing_nurse_conflicts", {
    p_nurse: nurseId, p_engagement_id: engagementId,
  });
  if (error) throw error;
  return (data ?? []) as string[];
}

/** A nurse's own assigned days, for her shift list. */
export async function listMyNursingShifts(nurseId: string) {
  const { data, error } = await db
    .from("nursing_visits")
    .select("*")
    .eq("assigned_nurse_id", nurseId)
    .in("status", ["scheduled", "en_route", "arrived"])
    .order("visit_date", { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as NursingVisit[];
}

// ------------------------------------------------------------------ display --

export const NURSING_ENGAGEMENT_LABEL: Record<NursingAssignmentState, string> = {
  seeking_nurse: "Finding a nurse",
  assigned: "Confirmed",
  unfilled: "No nurse found",
};

export const NURSING_VISIT_LABEL: Record<NursingVisitStatus, string> = {
  scheduled: "Scheduled",
  seeking_cover: "Finding cover",
  en_route: "Nurse on the way",
  arrived: "Nurse with you",
  completed: "Completed",
  cancelled_by_family: "You cancelled",
  no_show_patient: "Nobody home",
  missed: "Missed",
};

/** Engagement states that belong in the Upcoming tab rather than Previous. */
export const NURSING_UPCOMING = new Set<string>([
  "seeking_nurse", "assigned", "unfilled",
]);

export function nursingSubtitle(e: NursingEngagement): string {
  const start = new Date(e.start_date + "T00:00:00")
    .toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = e.slot_time ? ` · arrives ${e.slot_time.slice(0, 5)}` : "";
  const days = `${e.days_scheduled} day${e.days_scheduled > 1 ? "s" : ""}`;
  return `${days} from ${start}${time} · ₹${Number(e.total_amount).toLocaleString("en-IN")}`;
}
