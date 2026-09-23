import { supabase } from "@/integrations/supabase/client";
import type { AmbulancePing, EmergencyCase, EmergencyCategory, EmergencyStatus, ResponderRole, TransportMode, TriageAnswer } from "./types";

/**
 * The generated Database type is regenerated from the cloud project and does not
 * yet contain the emergency tables. Until `supabase gen types` is re-run, talk to
 * them through a loosely typed handle rather than weakening the typed client that
 * the rest of the app relies on.
 */
type LooseClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => any;
  from: (table: string) => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => any;
  auth: { getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
};
const db = supabase as unknown as LooseClient;

const TIMEOUT_MS = 15_000;

// Supabase's builders are only typed once the Database type knows the table, so
// the result is intentionally loose here and narrowed at each call site.
async function withDeadline(build: (signal: AbortSignal) => PromiseLike<any>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await build(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Turns Postgres plumbing into something a person in a crisis can act on. */
export function emergencyError(error: { code?: string; message?: string } | null, fallback: string): Error {
  const message = error?.message ?? "";
  if (message.includes("EMERGENCY_ALREADY_TAKEN")) {
    return new Error("Someone else accepted this case first. Refresh the queue.");
  }
  if (message.includes("EMERGENCY_CREW_BUSY")) {
    return new Error("This crew is already on an active case. Finish or hand it over first.");
  }
  if (message.includes("EMERGENCY_FORBIDDEN")) {
    return new Error("This account is not authorised for that action on this case.");
  }
  if (message.includes("EMERGENCY_DISABLED")) {
    return new Error("Coordinated dispatch is switched off on this environment. Call 108.");
  }
  if (message.includes("EMERGENCY_LEGACY_ACTIVE")) {
    return new Error(message.replace(/^.*EMERGENCY_LEGACY_ACTIVE[: ]*/, ""));
  }
  if (message.includes("EMERGENCY_NO_RECEIVER")) {
    return new Error("No hospital has accepted yet. Do not start transport without a receiving hospital.");
  }
  if (message.includes("EMERGENCY_NO_AMBULANCE")) {
    return new Error("This patient is travelling by their own vehicle. No crew is being sent.");
  }
  if (message.includes("EMERGENCY_NO_LOCATION")) {
    return new Error("Share your location or type a pickup address before sending.");
  }
  if (message.includes("EMERGENCY_AUTH_REQUIRED")) {
    return new Error("Sign in to raise an emergency. Call 108 now if this cannot wait.");
  }
  if (message.includes("EMERGENCY_CLOSED")) {
    return new Error("This case has already ended.");
  }
  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202") {
    return new Error(
      "Emergency dispatch is not set up on this database. Apply the emergency dispatch migration. Use the 108 button for urgent help.",
    );
  }
  if (error?.code === "42501") {
    return new Error("Access denied for this emergency case.");
  }
  // A lost response is not proof the write failed. Never invent a local success.
  return new Error(message || fallback);
}

/**
 * The whole input to an emergency: what is wrong, the triage answers, and the
 * live GPS fix. No phone, no address — those come from the profile server-side.
 */
export interface CreateCaseInput {
  category: EmergencyCategory;
  triage: TriageAnswer[];
  /** Whether a crew is dispatched, or the family drives and only a bed is held. */
  transport: TransportMode;
  /** Omit when GPS failed: the case is still saved and flagged for a callback. */
  location?: { lat: number; lng: number; accuracy: number; capturedAt: string } | null;
  /** Stable across retries of the same attempt. */
  requestKey: string;
}

export async function createEmergencyCase(input: CreateCaseInput): Promise<EmergencyCase> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("create_emergency_case", {
        p_category: input.category,
        p_triage: input.triage,
        p_lat: input.location?.lat ?? null,
        p_lng: input.location?.lng ?? null,
        p_accuracy_m: input.location?.accuracy ?? null,
        p_captured_at: input.location?.capturedAt ?? null,
        p_transport: input.transport,
        p_request_key: input.requestKey,
      })
      .abortSignal(signal)
      .single(),
  );
  if (error || !data) {
    throw emergencyError(error, "The emergency could not be confirmed. Call 108 and retry.");
  }
  return data as EmergencyCase;
}

/** First tap to land in the database wins; everyone else gets ALREADY_TAKEN. */
export async function acceptEmergencyCase(
  caseId: string,
  role: ResponderRole,
  options: { hospitalId?: string | null; bedLabel?: string | null } = {},
): Promise<EmergencyCase> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("accept_emergency_case", {
        p_case_id: caseId,
        p_role: role,
        p_hospital_id: options.hospitalId ?? null,
        p_bed_label: options.bedLabel ?? null,
      })
      .abortSignal(signal)
      .single(),
  );
  if (error || !data) {
    throw emergencyError(error, "Acceptance could not be confirmed. Refresh the queue.");
  }
  return data as EmergencyCase;
}

export async function advanceEmergencyCase(
  caseId: string,
  status: EmergencyStatus,
  reason?: string,
): Promise<EmergencyCase> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("advance_emergency_case", { p_case_id: caseId, p_status: status, p_reason: reason ?? null })
      .abortSignal(signal)
      .single(),
  );
  if (error || !data) {
    throw emergencyError(error, "The status change could not be confirmed. Refresh before continuing.");
  }
  return data as EmergencyCase;
}

/**
 * Advances the specialist page one wave: in-house first choice, then the rest
 * of that hospital's in-house doctors, then every matching specialist in the
 * area. The server decides whether enough time has passed.
 */
export async function escalateSpecialists(caseId: string, afterSeconds?: number): Promise<number> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("escalate_emergency_specialists", { p_case_id: caseId, p_after_seconds: afterSeconds ?? null })
      .abortSignal(signal),
  );
  if (error) throw emergencyError(error, "Could not widen the specialist search.");
  return typeof data === "number" ? data : 0;
}

/**
 * Pushes the search radius out one step when nobody has accepted. Starts at
 * 4 km and grows a step roughly every 22 seconds, up to the case ceiling. Pass
 * nothing and the server uses its own emergency_settings row. Safe to call on a
 * timer: calls that arrive early are ignored.
 */
export async function expandSearch(
  caseId: string,
  afterSeconds?: number,
  stepKm?: number,
): Promise<number | null> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("expand_emergency_search", {
        p_case_id: caseId,
        p_after_seconds: afterSeconds ?? null,
        p_step_km: stepKm ?? null,
      })
      .abortSignal(signal),
  );
  if (error) throw emergencyError(error, "Could not widen the search area.");
  return typeof data === "number" ? data : null;
}

/** Passes on a case without affecting anyone else's copy of it. */
export async function declineEmergencyCase(caseId: string, role: ResponderRole): Promise<void> {
  const { error } = await db.rpc("decline_emergency_case", { p_case_id: caseId, p_role: role });
  if (error) throw emergencyError(error, "Could not pass on this case.");
}

export async function postAmbulancePing(
  caseId: string,
  location: { lat: number; lng: number; accuracy?: number | null; heading?: number | null; speed?: number | null; capturedAt?: string },
): Promise<AmbulancePing> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("post_emergency_ambulance_ping", {
        p_case_id: caseId,
        p_lat: location.lat,
        p_lng: location.lng,
        p_accuracy_m: location.accuracy ?? null,
        p_heading_deg: location.heading ?? null,
        p_speed_kph: location.speed ?? null,
        p_captured_at: location.capturedAt ?? new Date().toISOString(),
      })
      .abortSignal(signal)
      .single(),
  );
  if (error || !data) throw emergencyError(error, "Crew location could not be sent.");
  return data as AmbulancePing;
}

export async function fetchLatestPing(caseId: string): Promise<AmbulancePing | null> {
  const { data, error } = await withDeadline((signal) =>
    db
      .from("emergency_ambulance_pings")
      .select("*")
      .eq("case_id", caseId)
      .order("captured_at", { ascending: false })
      .limit(1)
      .abortSignal(signal)
      .maybeSingle(),
  );
  if (error) throw emergencyError(error, "Ambulance location could not be read.");
  return (data as AmbulancePing) ?? null;
}

/** Recent breadcrumbs so the map can draw the route actually driven. */
export async function fetchPingTrail(caseId: string, limit = 60): Promise<AmbulancePing[]> {
  const { data, error } = await withDeadline((signal) =>
    db
      .from("emergency_ambulance_pings")
      .select("*")
      .eq("case_id", caseId)
      .order("captured_at", { ascending: false })
      .limit(limit)
      .abortSignal(signal),
  );
  if (error) throw emergencyError(error, "Ambulance route could not be read.");
  return ((data as AmbulancePing[]) ?? []).slice().reverse();
}

export async function fetchMyActiveCase(userId: string): Promise<EmergencyCase | null> {
  const { data, error } = await withDeadline((signal) =>
    db
      .from("emergency_cases")
      .select("*")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .abortSignal(signal),
  );
  if (error) throw emergencyError(error, "Your emergency status could not be refreshed.");
  const row = ((data as EmergencyCase[]) ?? [])[0];
  return row ?? null;
}

export async function fetchDispatchQueue(role: ResponderRole): Promise<EmergencyCase[]> {
  const { data, error } = await withDeadline((signal) =>
    db.rpc("list_emergency_dispatch_queue", { p_role: role }).abortSignal(signal),
  );
  if (error) throw emergencyError(error, "The emergency queue could not be refreshed.");
  return (data as EmergencyCase[]) ?? [];
}

/** Keeps this responder in the "online nearby" pool that new cases page. */
export async function heartbeatResponder(lat: number | null, lng: number | null): Promise<void> {
  const { error } = await db.rpc("heartbeat_responder", { p_lat: lat, p_lng: lng });
  if (error) throw emergencyError(error, "Could not report this crew as online.");
}

export async function fetchHospitalNames(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const { data, error } = await db.from("hospitals").select("id,name,area,phone").in("id", unique);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of (data as { id: string; name: string; area: string | null }[]) ?? []) {
    map[row.id] = row.area ? `${row.name} · ${row.area}` : row.name;
  }
  return map;
}

export { db as emergencyDb };

/** The hospital this account manages, if any. Drives the hospital console. */
export async function fetchMyHospital(userId: string): Promise<{
  id: string; name: string; area: string | null; emergency_mode: boolean;
  er_beds_available: number; has_icu: boolean; has_ot: boolean;
  has_cath_lab: boolean; has_nicu: boolean; has_blood_bank: boolean;
  lat: number | null; lng: number | null;
} | null> {
  const { data, error } = await db
    .from("hospitals")
    .select("id,name,area,emergency_mode,er_beds_available,has_icu,has_ot,has_cath_lab,has_nicu,has_blood_bank,lat,lng")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw emergencyError(error, "Could not load this hospital.");
  return data ?? null;
}

/**
 * Real numbers for the hospital dashboard header. There is no fee/revenue
 * concept on emergency_cases, so this reports what the table actually has:
 * cases this hospital took today, how many are still open, and how fast a
 * doctor accepted once the case reached this hospital today.
 */
export async function fetchHospitalDashboardStats(hospitalId: string): Promise<{
  visitsToday: number;
  openNow: number;
  avgDoctorResponseMin: number | null;
}> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sinceIso = startOfDay.toISOString();

  const [{ data: acceptedToday, error: e1 }, { count: openCount, error: e2 }] = await Promise.all([
    db
      .from("emergency_cases")
      .select("id, created_at, doctor_accepted_at")
      .eq("hospital_id", hospitalId)
      .gte("hospital_accepted_at", sinceIso),
    db
      .from("emergency_cases")
      .select("id", { count: "exact", head: true })
      .eq("hospital_id", hospitalId)
      .not("status", "in", "(cancelled,closed)"),
  ]);
  if (e1) throw emergencyError(e1, "Could not load hospital stats.");
  if (e2) throw emergencyError(e2, "Could not load hospital stats.");

  const rows = (acceptedToday ?? []) as { created_at: string; doctor_accepted_at: string | null }[];
  const withDoctor = rows.filter((r) => r.doctor_accepted_at);
  const avgMs = withDoctor.length
    ? withDoctor.reduce(
        (sum, r) => sum + (new Date(r.doctor_accepted_at as string).getTime() - new Date(r.created_at).getTime()),
        0,
      ) / withDoctor.length
    : null;

  return {
    visitsToday: rows.length,
    openNow: openCount ?? 0,
    avgDoctorResponseMin: avgMs != null ? Math.round(avgMs / 60000) : null,
  };
}

/** Flips this hospital in or out of emergency mode. Off means it is not paged. */
export async function setHospitalEmergencyMode(hospitalId: string, on: boolean): Promise<void> {
  const { error } = await db
    .from("hospitals")
    .update({ emergency_mode: on, emergency_mode_at: new Date().toISOString() })
    .eq("id", hospitalId);
  if (error) throw emergencyError(error, "Could not change emergency mode.");
}

/** Admin operations view. RLS lets only the admin role read across all cases. */
export async function fetchAllOpenCases(): Promise<EmergencyCase[]> {
  const { data, error } = await withDeadline((signal) =>
    db
      .from("emergency_cases")
      .select("*")
      .not("status", "in", "(cancelled,closed,admitted)")
      .order("created_at", { ascending: false })
      .limit(100)
      .abortSignal(signal),
  );
  if (error) throw emergencyError(error, "The emergency board could not be loaded.");
  return (data as EmergencyCase[]) ?? [];
}

/** Supplies a pickup for a case saved without one, and restarts matching. */
export async function setEmergencyPickup(
  caseId: string,
  location: { lat: number; lng: number; accuracy?: number | null; capturedAt?: string },
  verified = false,
): Promise<EmergencyCase> {
  const { data, error } = await withDeadline((signal) =>
    db
      .rpc("set_emergency_pickup", {
        p_case_id: caseId,
        p_lat: location.lat,
        p_lng: location.lng,
        p_accuracy_m: location.accuracy ?? null,
        p_captured_at: location.capturedAt ?? new Date().toISOString(),
        p_verified: verified,
      })
      .abortSignal(signal)
      .single(),
  );
  if (error || !data) throw emergencyError(error, "The pickup could not be saved.");
  return data as EmergencyCase;
}
