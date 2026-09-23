import { supabase } from "@/integrations/supabase/client";

/**
 * Nurse and technician booking, built the same way as home physiotherapy:
 *
 *   * "Any available"  — an open request at a chosen date/time. Nurses receive
 *                         it as an offer; technicians see it among open tests.
 *   * a named provider — the patient picks from verified providers and, for
 *                         technicians, a real free slot from their published
 *                         hours. Booking is atomic on the server, so two
 *                         patients can never take the same slot.
 *
 * Every price comes from the database (nursing_settings.day_rate,
 * technician_test_catalog.fee). Nothing here is hardcoded.
 */

// The generated Database type predates these tables and RPCs.
const db = supabase as unknown as {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  from: (table: string) => any;
  auth: typeof supabase.auth;
};

/** Server errors arrive as "CODE: sentence" — show the sentence. */
function readable(error: unknown, fallback: string): string {
  const e = error as { message?: string; code?: string } | null;
  const raw = e?.message ?? "";
  const m = raw.match(/^[A-Z_]+:\s*(.+)$/s);
  if (m) return m[1];
  if (e?.code === "PGRST202" || e?.code === "42883") return "This booking isn't set up on the server yet.";
  return raw || fallback;
}

function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hhmm(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Best-effort device position for the booking address. Resolves null rather
 * than blocking the booking if permission is denied or the fix is slow.
 */
export function currentPosition(timeoutMs = 4000): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { clearTimeout(timer); resolve(null); },
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: timeoutMs },
    );
  });
}

/* ═══════════════════════════════════ nurses ═══════════════════════════════ */

export interface NurseRosterEntry {
  userId: string;
  name: string;
  specialty: string | null;
  qualification: string | null;
  yearsExperience: number | null;
  areas: string[];
  /** True when the nurse lists the patient's area. Listed first. */
  coversArea: boolean;
}

/** Verified nurses who take home-care work; those covering `area` first. */
export async function fetchNurseRoster(area?: string | null): Promise<NurseRosterEntry[]> {
  const { data, error } = await db
    .from("nurses")
    .select("user_id, full_name, specialty, qualification, years_experience, areas")
    .eq("active", true)
    .eq("verified", true)
    .eq("home_care", true)
    .order("full_name");
  if (error) throw new Error(readable(error, "Could not load nurses."));
  const want = (area ?? "").trim().toLowerCase();
  return ((data ?? []) as any[])
    .map((n) => {
      const areas: string[] = n.areas ?? [];
      return {
        userId: n.user_id,
        name: n.full_name,
        specialty: n.specialty ?? null,
        qualification: n.qualification ?? null,
        yearsExperience: n.years_experience ?? null,
        areas,
        coversArea: !!want && areas.some((a) => a.toLowerCase() === want),
      };
    })
    .sort((a, b) => (a.coversArea === b.coversArea ? a.name.localeCompare(b.name) : a.coversArea ? -1 : 1));
}

/** Per-day rate from nursing_settings. */
export async function fetchNursingDayRate(): Promise<number | null> {
  const { data, error } = await db.from("nursing_settings").select("day_rate").eq("id", 1).maybeSingle();
  if (error) return null;
  return typeof data?.day_rate === "number" ? data.day_rate : null;
}

/** Days (YYYY-MM-DD) on which this nurse already holds a shift. */
export async function fetchNurseBookedDates(nurseUserId: string, from: Date, days: number): Promise<string[]> {
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  const { data, error } = await db.rpc("nurse_booked_dates", {
    p_nurse_id: nurseUserId,
    p_from: isoDate(from),
    p_to: isoDate(to),
  });
  if (error) throw new Error(readable(error, "Could not load this nurse's calendar."));
  return ((data ?? []) as any[]).map((d) => (typeof d === "string" ? d : d?.nurse_booked_dates)).filter(Boolean);
}

/**
 * Shift start options for a package of `packageDays`, as ISO strings, for the
 * slot calendar. For a named nurse, a start day is only offered if she is free
 * on every day of the package.
 */
export function nurseStartSlots(opts: {
  horizonDays: number;
  packageDays: number;
  bookedDates?: string[];
  firstHour?: number;
  lastHour?: number;
}): string[] {
  const { horizonDays, packageDays, bookedDates = [], firstHour = 6, lastHour = 21 } = opts;
  const busy = new Set(bookedDates);
  const out: string[] = [];
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    const start = new Date(today);
    start.setDate(today.getDate() + i);
    let free = true;
    for (let k = 0; k < packageDays && free; k++) {
      const d = new Date(start);
      d.setDate(start.getDate() + k);
      if (busy.has(isoDate(d))) free = false;
    }
    if (!free) continue;
    for (let h = firstHour; h <= lastHour; h++) {
      const t = new Date(start);
      t.setHours(h, 0, 0, 0);
      if (t.getTime() > now + 30 * 60_000) out.push(t.toISOString());
    }
  }
  return out;
}

export interface NursingBookingInput {
  days: number;
  kind: string;
  /** The chosen shift start (ISO). */
  startIso: string;
  area: string;
  city?: string;
  address?: string | null;
  /** A named nurse gets the package alone for the grace period, then it opens. */
  nurseUserId?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** +20% on the day rate, same surcharge doctor/physio urgent bookings apply. */
  urgent?: boolean;
}

export interface NursingBooking {
  id: string;
  kind: string;
  days_scheduled: number;
  total_amount: number;
  assignment_state: string;
}

export async function bookHomeNursing(input: NursingBookingInput): Promise<NursingBooking> {
  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) throw new Error("Pick a start date and time.");
  const address = [input.address?.trim(), input.area?.trim(), input.city ?? "Pune"].filter(Boolean).join(", ");
  const { data, error } = await db.rpc("create_nursing_engagement", {
    p_days: input.days,
    p_start_date: isoDate(start),
    p_slot_time: hhmm(start),
    p_kind: input.kind,
    p_address: address,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_nurse_id: input.nurseUserId ?? null,
    p_urgent: !!input.urgent,
  });
  if (error) throw new Error(readable(error, "Could not book home nursing."));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) throw new Error("Could not book home nursing.");
  return row as NursingBooking;
}

/** The nurse from the patient's most recent engagement, if any — used to
 *  suggest "book them again" instead of starting from a blank roster. */
export async function fetchLastBookedNurseId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("nursing_engagements")
    .select("primary_nurse_id, preferred_nurse_id, created_at")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error || !data) return null;
  for (const row of data as any[]) {
    const id = row.primary_nurse_id || row.preferred_nurse_id;
    if (id) return id;
  }
  return null;
}

/* ═════════════════════════════════ technicians ════════════════════════════ */

export interface TechnicianTest {
  testType: string;
  label: string;
  description: string | null;
  fee: number;
  durationMin: number;
}

export async function fetchTechnicianCatalog(): Promise<TechnicianTest[]> {
  const { data, error } = await db
    .from("technician_test_catalog")
    .select("test_type, label, description, fee, duration_min, sort_order")
    .eq("active", true)
    .order("sort_order");
  if (error) throw new Error(readable(error, "Could not load tests."));
  return ((data ?? []) as any[]).map((t) => ({
    testType: t.test_type,
    label: t.label,
    description: t.description ?? null,
    fee: t.fee,
    durationMin: t.duration_min,
  }));
}

/**
 * The patient picker's older ids (lab, ncs, audio…) mapped onto the catalog.
 * Used when a booking starts from a search result or a doctor's referral.
 */
export function technicianTestType(spec: { id?: string; name?: string } | null | undefined): string | null {
  const byId: Record<string, string> = {
    lab: "phlebotomy", ecg: "ecg", eeg: "eeg", xray: "xray",
    ncs: "nerve_conduction", audio: "audiometry", ot: "ot_assist",
  };
  const id = String(spec?.id ?? "").toLowerCase();
  if (byId[id]) return byId[id];
  const name = String(spec?.name ?? "").toLowerCase();
  if (/blood|lab|sample/.test(name)) return "phlebotomy";
  if (/ecg/.test(name)) return "ecg";
  if (/eeg/.test(name)) return "eeg";
  if (/x-?ray/.test(name)) return "xray";
  if (/ncs|emg|nerve/.test(name)) return "nerve_conduction";
  if (/audio|hearing/.test(name)) return "audiometry";
  if (/\bot\b|theatre/.test(name)) return "ot_assist";
  return null;
}

export interface TechnicianRosterEntry {
  technicianId: string;
  userId: string;
  name: string;
  org: string | null;
  qualification: string | null;
  areas: string[];
  coversArea: boolean;
}

/** Verified technicians who perform `testType`; those covering `area` first. */
export async function fetchTechnicianRoster(testType: string, area?: string | null): Promise<TechnicianRosterEntry[]> {
  const { data, error } = await db
    .from("technicians")
    .select("id, user_id, full_name, org, qualification, areas, test_types, home_visits")
    .eq("active", true)
    .eq("verified", true)
    .contains("test_types", [testType])
    .order("full_name");
  if (error) throw new Error(readable(error, "Could not load technicians."));
  const want = (area ?? "").trim().toLowerCase();
  return ((data ?? []) as any[])
    .filter((t) => t.home_visits !== false)
    .map((t) => {
      const areas: string[] = t.areas ?? [];
      return {
        technicianId: t.id,
        userId: t.user_id,
        name: t.full_name,
        org: t.org ?? null,
        qualification: t.qualification ?? null,
        areas,
        coversArea: !!want && areas.some((a) => a.toLowerCase() === want),
      };
    })
    .sort((a, b) => (a.coversArea === b.coversArea ? a.name.localeCompare(b.name) : a.coversArea ? -1 : 1));
}

/**
 * Real free start times for a provider from their published working hours,
 * minus anything they are already booked for (get_provider_slots).
 */
export async function fetchProviderSlots(providerUserId: string, durationMin: number, days = 14): Promise<string[]> {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + days - 1);
  const { data, error } = await db.rpc("get_provider_slots", {
    p_provider_id: providerUserId,
    p_start_date: isoDate(from),
    p_end_date: isoDate(to),
    p_duration_minutes: durationMin,
  });
  if (error) throw new Error(readable(error, "Could not load available slots."));
  return ((data ?? []) as any[]).filter((s) => s.is_available).map((s) => s.start_time as string);
}

export interface TechnicianBookingInput {
  testType: string;
  startIso: string;
  area: string;
  city?: string;
  address?: string | null;
  notes?: string | null;
  urgent?: boolean;
  /** Books this technician's slot directly; omit for "any available". */
  technicianId?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/** Returns the technician_tests id. */
export async function bookTechnicianTest(input: TechnicianBookingInput): Promise<string> {
  const common = {
    p_test_type: input.testType,
    p_area: input.area,
    p_city: input.city ?? "Pune",
    p_address: input.address?.trim() || null,
    p_notes: input.notes?.trim() || null,
    p_urgency: input.urgent ? "urgent" : "normal",
    p_home_visit: true,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  };
  if (input.technicianId) {
    const { data, error } = await db.rpc("atomic_book_technician_test", {
      ...common,
      p_technician_id: input.technicianId,
      p_start_time: input.startIso,
    });
    if (error) throw new Error(readable(error, "Could not book that slot."));
    return data as string;
  }
  const { data, error } = await db.rpc("create_technician_request", {
    ...common,
    p_scheduled_at: input.startIso,
  });
  if (error) throw new Error(readable(error, "Could not book a technician."));
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id as string;
}

/** The technician from the patient's most recent test, if any — used to
 *  suggest "book them again" instead of starting from a blank roster. */
export async function fetchLastBookedTechnicianId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("technician_tests")
    .select("technician_id, created_at")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error || !data) return null;
  for (const row of data as any[]) {
    if (row.technician_id) return row.technician_id as string;
  }
  return null;
}
