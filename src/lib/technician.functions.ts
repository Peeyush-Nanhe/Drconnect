import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MACHINE_TESTS, TECHNICIAN_TEST_LABEL } from "@/lib/care-staff-catalog";

export type TechnicianProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  testTypes: string[];
  org: string | null;
  qualification: string | null;
  yearsExperience: number | null;
  areas: string[];
  city: string;
  homeVisits: boolean;
  clinicVisits: boolean;
  carriesMachine: boolean;
  preferredHubs: string[];
  preferredFacilities: string[];
  bio: string | null;
  isOnline: boolean;
  active: boolean;
  travelRadiusKm: number;
  preferredDutyHours: number;
  maxHoursPerDay: number;
  minimumPay: number;
  availableToday: boolean;
  locumAvailable: boolean;
  fullTimeInterest: boolean;
  workingDays: string[];
  dndEnabled: boolean;
  dndStart: string;
  dndEnd: string;
  dndAllowEmergency: boolean;
  notificationPreferences: Record<string, boolean>;
  recentCourses: string | null;
  specialInterests: string | null;
  certifications: string[];
  languages: string[];
};

export type TechnicianJob = {
  id: string;
  patientName: string;
  patientPhone: string | null;
  testType: string;
  testLabel: string;
  area: string;
  city: string;
  homeVisit: boolean;
  scheduledAt: string | null;
  urgency: string;
  status: string;
  fee: number | null;
  paymentStatus: string;
  referringDoctor: string | null;
  notes: string | null;
  findings: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  /** true when the machine must be collected from a tie-up hub first */
  machinePickupNeeded: boolean;
  pickupHub: string | null;
  venueKind: "home" | "hub" | "clinic";
};

export type TechnicianBoard = {
  profile: TechnicianProfile | null;
  hubs: { id: string; name: string; area: string | null }[];
  totals: { today: number; upcoming: number; completed30d: number; earnings30d: number; openMatches: number; toConfirm: number };
  today: TechnicianJob[];
  upcoming: TechnicianJob[];
  history: TechnicianJob[];
  openTests: TechnicianJob[];
};

const TEST_COLUMNS =
  "id, patient_name, patient_phone, test_type, test_label, technician_id, area, city, home_visit, scheduled_at, urgency, status, checked_in_at, completed_at, findings, fee, payment_status, referring_doctor_name, notes, created_at";

function mapProfile(r: any): TechnicianProfile {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone ?? null,
    testTypes: r.test_types ?? [],
    org: r.org ?? null,
    qualification: r.qualification ?? null,
    yearsExperience: r.years_experience ?? null,
    areas: r.areas ?? [],
    city: r.city ?? "Pune",
    homeVisits: !!r.home_visits,
    clinicVisits: !!r.clinic_visits,
    carriesMachine: !!r.carries_machine,
    preferredHubs: r.preferred_hubs ?? [],
    preferredFacilities: r.preferred_facilities ?? [],
    bio: r.bio ?? null,
    isOnline: !!r.is_online,
    active: !!r.active,
    travelRadiusKm: r.travel_radius_km ?? 10,
    preferredDutyHours: r.preferred_duty_hours ?? 8,
    maxHoursPerDay: r.max_hours_per_day ?? 12,
    minimumPay: r.minimum_pay ?? 0,
    availableToday: !!r.available_today,
    locumAvailable: !!r.locum_available,
    fullTimeInterest: !!r.full_time_interest,
    workingDays: r.working_days ?? [],
    dndEnabled: !!r.dnd_enabled,
    dndStart: r.dnd_start ?? '22:00',
    dndEnd: r.dnd_end ?? '07:00',
    dndAllowEmergency: !!r.dnd_allow_emergency,
    notificationPreferences: r.notification_preferences ?? {},
    recentCourses: r.recent_courses ?? null,
    specialInterests: r.special_interests ?? null,
    certifications: r.certifications ?? [],
    languages: r.languages ?? [],
  };
}

function mapTest(r: any, profile: TechnicianProfile | null, hubAreas: Set<string>): TechnicianJob {
  const atHub = !r.home_visit && hubAreas.has((r.area ?? "").toLowerCase());
  const venueKind: TechnicianJob["venueKind"] = r.home_visit ? "home" : atHub ? "hub" : "clinic";
  const needsMachine = MACHINE_TESTS.has(r.test_type) && venueKind !== "hub";
  return {
    id: r.id,
    patientName: r.patient_name ?? "Patient",
    patientPhone: r.patient_phone ?? null,
    testType: r.test_type,
    testLabel: r.test_label ?? TECHNICIAN_TEST_LABEL[r.test_type] ?? r.test_type,
    area: r.area ?? "",
    city: r.city ?? "Pune",
    homeVisit: !!r.home_visit,
    scheduledAt: r.scheduled_at ?? null,
    urgency: r.urgency ?? "normal",
    status: r.status,
    fee: r.fee === null || r.fee === undefined ? null : Number(r.fee),
    paymentStatus: r.payment_status ?? "unpaid",
    referringDoctor: r.referring_doctor_name ?? null,
    notes: r.notes ?? null,
    findings: r.findings ?? null,
    checkedInAt: r.checked_in_at ?? null,
    completedAt: r.completed_at ?? null,
    machinePickupNeeded: needsMachine,
    pickupHub: needsMachine ? (profile?.preferredHubs?.[0] ?? null) : null,
    venueKind,
  };
}

/** Everything the technician home screen needs. */
export const getTechnicianBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TechnicianBoard> => {
    const sb = context.supabase as any;

    const [{ data: tech, error }, { data: hubRows }] = await Promise.all([
      sb.from("technicians").select("*").eq("user_id", context.userId).maybeSingle(),
      sb.from("hubs").select("id, name, area").limit(200),
    ]);
    if (error) throw new Error(error.message);

    const profile = tech ? mapProfile(tech) : null;
    const hubs = (hubRows ?? []).map((h: any) => ({ id: h.id, name: h.name, area: h.area ?? null }));
    const hubAreas = new Set<string>(
      hubs.map((h: { area: string | null }) => (h.area ?? "").toLowerCase()).filter(Boolean),
    );

    if (!profile) {
      return {
        profile: null,
        hubs,
        totals: { today: 0, upcoming: 0, completed30d: 0, earnings30d: 0, openMatches: 0, toConfirm: 0 },
        today: [],
        upcoming: [],
        history: [],
        openTests: [],
      };
    }

    const since = new Date(Date.now() - 60 * 24 * 3600_000).toISOString();
    const [mine, open] = await Promise.all([
      sb
        .from("technician_tests")
        .select(TEST_COLUMNS)
        .eq("technician_id", profile.id)
        .gte("created_at", since)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(300),
      sb
        .from("technician_tests")
        .select(TEST_COLUMNS)
        .is("technician_id", null)
        .in("status", ["requested", "pending"])
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(100),
    ]);
    if (mine.error) throw new Error(mine.error.message);
    if (open.error) throw new Error(open.error.message);

    const jobs: TechnicianJob[] = (mine.data ?? []).map((r: any) => mapTest(r, profile, hubAreas));

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startOfDay.getTime() + 24 * 3600_000;
    const closed = new Set(["completed", "cancelled", "no_show"]);

    const today = jobs.filter((j) => {
      const t = j.scheduledAt ? new Date(j.scheduledAt).getTime() : null;
      return !closed.has(j.status) && t != null && t >= startOfDay.getTime() && t < endOfDay;
    });
    const upcoming = jobs.filter((j) => {
      const t = j.scheduledAt ? new Date(j.scheduledAt).getTime() : null;
      return !closed.has(j.status) && (t == null || t >= endOfDay);
    });
    const history = jobs.filter((j) => {
      const t = j.scheduledAt ? new Date(j.scheduledAt).getTime() : null;
      return closed.has(j.status) || (t != null && t < startOfDay.getTime());
    });

    const since30 = Date.now() - 30 * 24 * 3600_000;
    const completed30 = jobs.filter(
      (j) => j.status === "completed" && (!j.completedAt || new Date(j.completedAt).getTime() >= since30),
    );

    const openTests: TechnicianJob[] = ((open.data ?? []) as any[])
      .map((r: any): TechnicianJob => mapTest(r, profile, hubAreas))
      .filter((j) => profile.testTypes.length === 0 || profile.testTypes.includes(j.testType))
      .filter((j) => (j.homeVisit ? profile.homeVisits : profile.clinicVisits))
      .filter((j) => !profile.areas.length || !j.area || profile.areas.includes(j.area));

    const toConfirm = jobs.filter(j => j.status === 'assigned').length;

    return {
      profile,
      hubs,
      totals: {
        today: today.length,
        upcoming: upcoming.length,
        completed30d: completed30.length,
        earnings30d: Math.round(completed30.reduce((s, j) => s + (j.fee ?? 0), 0)),
        openMatches: openTests.length,
        toConfirm,
      },
      today,
      upcoming,
      history,
      openTests,
    };
  });

export type TechnicianProfileInput = {
  fullName: string;
  phone?: string | null;
  testTypes: string[];
  org?: string | null;
  qualification?: string | null;
  yearsExperience?: number | null;
  areas: string[];
  city: string;
  homeVisits: boolean;
  clinicVisits: boolean;
  carriesMachine: boolean;
  preferredHubs: string[];
  preferredFacilities: string[];
  bio?: string | null;
  travelRadiusKm?: number;
  preferredDutyHours?: number;
  maxHoursPerDay?: number;
  minimumPay?: number;
  availableToday?: boolean;
  locumAvailable?: boolean;
  fullTimeInterest?: boolean;
  workingDays?: string[];
  dndEnabled?: boolean;
  dndStart?: string;
  dndEnd?: string;
  dndAllowEmergency?: boolean;
  notificationPreferences?: Record<string, boolean>;
  recentCourses?: string | null;
  specialInterests?: string | null;
  certifications?: string[];
  languages?: string[];
};

/** Technician builds their live profile: which tests they can run and where. */
export const saveTechnicianProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: TechnicianProfileInput) => {
    if (!d?.fullName?.trim()) throw new Error("Your name is required");
    if (!Array.isArray(d.testTypes) || d.testTypes.length === 0) throw new Error("Pick at least one test you can run");
    if (d.bio && d.bio.length > 1000) throw new Error("Keep the summary under 1000 characters");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      user_id: context.userId,
      full_name: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      test_types: data.testTypes,
      org: data.org?.trim() || null,
      qualification: data.qualification || null,
      years_experience: data.yearsExperience ?? null,
      areas: data.areas ?? [],
      city: data.city?.trim() || "Pune",
      home_visits: !!data.homeVisits,
      clinic_visits: !!data.clinicVisits,
      carries_machine: !!data.carriesMachine,
      preferred_hubs: data.preferredHubs ?? [],
      preferred_facilities: data.preferredFacilities ?? [],
      bio: data.bio?.trim() || null,
      travel_radius_km: data.travelRadiusKm ?? 10,
      preferred_duty_hours: data.preferredDutyHours ?? 8,
      max_hours_per_day: data.maxHoursPerDay ?? 12,
      minimum_pay: data.minimumPay ?? 0,
      available_today: !!data.availableToday,
      locum_available: !!data.locumAvailable,
      full_time_interest: !!data.fullTimeInterest,
      working_days: data.workingDays ?? [],
      dnd_enabled: !!data.dndEnabled,
      dnd_start: data.dndStart ?? '22:00',
      dnd_end: data.dndEnd ?? '07:00',
      dnd_allow_emergency: !!data.dndAllowEmergency,
      notification_preferences: data.notificationPreferences ?? {},
      recent_courses: data.recentCourses?.trim() || null,
      special_interests: data.specialInterests?.trim() || null,
      certifications: data.certifications ?? [],
      languages: data.languages ?? [],
    };

    const { data: existing } = await sb.from("technicians").select("id").eq("user_id", context.userId).maybeSingle();
    if (existing) {
      const { error } = await sb.from("technicians").update(row).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("technicians").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Technician goes online or offline for new test requests. */
export const setTechnicianOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { online: boolean }) => ({ online: !!d?.online }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("technicians").update({ is_online: data.online }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await sb
      .from("provider_availability")
      .upsert({ user_id: context.userId, is_online: data.online }, { onConflict: "user_id" });
    return { ok: true, online: data.online };
  });

/** Technician takes an unassigned test request. */
export const claimTechnicianTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string }) => {
    if (!d?.testId) throw new Error("testId is required");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("claim_technician_test", { _test_id: data.testId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Technician moves a test through accepted → on the way → running → done. */
export const setTechnicianTestStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { testId: string; stage: string; note?: string | null }) => {
    if (!d?.testId) throw new Error("testId is required");
    if (!["accepted", "en_route", "in_progress", "completed", "cancelled", "no_show"].includes(d.stage))
      throw new Error("Unknown stage");
    if (d.note && d.note.length > 2000) throw new Error("Keep findings under 2000 characters");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("set_technician_test_stage", {
      _test_id: data.testId,
      _stage: data.stage,
      _note: data.note?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
