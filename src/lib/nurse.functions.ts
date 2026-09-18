import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NurseProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  qualification: string | null;
  registrationNumber: string | null;
  yearsExperience: number;
  skills: string[];
  specialty: string | null;
  shiftPrefs: string[];
  homeCare: boolean;
  hospitalDuty: boolean;
  areas: string[];
  city: string;
  preferredFacilities: string[];
  languages: string[];
  bio: string | null;
  isOnline: boolean;
  verified: boolean;
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
};

export type NurseJob = {
  id: string;
  assignmentId: string | null;
  title: string;
  jobType: string;
  dutyType: string | null;
  specialty: string | null;
  facilityName: string | null;
  area: string | null;
  shiftLabel: string | null;
  startsAt: string | null;
  endsAt: string | null;
  compensation: number | null;
  compensationUnit: string | null;
  urgency: string;
  description: string | null;
  status: string; // assignment status when assigned, else job status
  jobStatus: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export type NurseBoard = {
  profile: NurseProfile | null;
  totals: { today: number; upcoming: number; completed: number; earnings30d: number; openMatches: number };
  today: NurseJob[];
  upcoming: NurseJob[];
  history: NurseJob[];
  openJobs: NurseJob[];
};

const NURSE_HINTS = ["nurse", "nursing", "icu", "ward", "ot", "scrub", "maternity", "neonatal", "attendant"];

function looksLikeNurseJob(job: any): boolean {
  const hay = `${job.job_type ?? ""} ${job.duty_type ?? ""} ${job.title ?? ""} ${job.specialty ?? ""} ${job.qualification ?? ""}`.toLowerCase();
  return NURSE_HINTS.some((h) => hay.includes(h));
}

const JOB_COLUMNS =
  "id, facility_id, job_type, duty_type, title, specialty, qualification, experience_years, area, shift_label, starts_at, ends_at, compensation, compensation_unit, capacity, urgency, description, status, created_at";

function mapProfile(r: any): NurseProfile {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone ?? null,
    qualification: r.qualification ?? null,
    registrationNumber: r.registration_number ?? null,
    yearsExperience: r.years_experience ?? 0,
    skills: r.skills ?? [],
    specialty: r.specialty ?? null,
    shiftPrefs: r.shift_prefs ?? [],
    homeCare: !!r.home_care,
    hospitalDuty: !!r.hospital_duty,
    areas: r.areas ?? [],
    city: r.city ?? "Pune",
    preferredFacilities: r.preferred_facilities ?? [],
    languages: r.languages ?? [],
    bio: r.bio ?? null,
    isOnline: !!r.is_online,
    verified: !!r.verified,
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
  };
}

function mapJob(job: any, assignment: any | null, facilityName: string | null): NurseJob {
  return {
    id: job.id,
    assignmentId: assignment?.id ?? null,
    title: job.title ?? "Nursing duty",
    jobType: job.job_type ?? "locum",
    dutyType: job.duty_type ?? null,
    specialty: job.specialty ?? null,
    facilityName,
    area: job.area ?? null,
    shiftLabel: job.shift_label ?? null,
    startsAt: job.starts_at ?? null,
    endsAt: job.ends_at ?? null,
    compensation: job.compensation === null || job.compensation === undefined ? null : Number(job.compensation),
    compensationUnit: job.compensation_unit ?? null,
    urgency: job.urgency ?? "normal",
    description: job.description ?? null,
    status: assignment?.status ?? job.status ?? "open",
    jobStatus: job.status ?? "open",
    checkedInAt: assignment?.checked_in_at ?? null,
    checkedOutAt: assignment?.checked_out_at ?? null,
  };
}

/** Everything the nurse home screen needs: profile, duty lists and open jobs. */
export const getNurseBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NurseBoard> => {
    const sb = context.supabase as any;

    const { data: nurse, error } = await sb.from("nurses").select("*").eq("user_id", context.userId).maybeSingle();
    if (error) throw new Error(error.message);

    const profile = nurse ? mapProfile(nurse) : null;

    const [assignments, openRows] = await Promise.all([
      sb
        .from("staffing_assignments")
        .select("id, job_id, status, duty_type, applied_at, accepted_at, completed_at, checked_in_at, checked_out_at, no_show")
        .eq("provider_id", context.userId)
        .order("applied_at", { ascending: false })
        .limit(300),
      sb.from("staffing_jobs").select(JOB_COLUMNS).eq("status", "open").order("starts_at", { ascending: true }).limit(200),
    ]);
    if (assignments.error) throw new Error(assignments.error.message);
    if (openRows.error) throw new Error(openRows.error.message);

    const myAssignments = assignments.data ?? [];
    const jobIds = myAssignments.map((a: any) => a.job_id);
    let myJobRows: any[] = [];
    if (jobIds.length) {
      const { data, error: jErr } = await sb.from("staffing_jobs").select(JOB_COLUMNS).in("id", jobIds);
      if (jErr) throw new Error(jErr.message);
      myJobRows = data ?? [];
    }
    const jobById = new Map(myJobRows.map((j) => [j.id, j]));

    // facility names for display
    const facilityIds = Array.from(
      new Set([...(openRows.data ?? []), ...myJobRows].map((j: any) => j.facility_id).filter(Boolean)),
    );
    const nameById = new Map<string, string>();
    if (facilityIds.length) {
      const [{ data: facs }, { data: profs }] = await Promise.all([
        sb.from("facilities").select("owner_id, name").in("owner_id", facilityIds),
        sb.from("profiles").select("id, full_name").in("id", facilityIds),
      ]);
      (facs ?? []).forEach((f: any) => nameById.set(f.owner_id, f.name));
      (profs ?? []).forEach((p: any) => {
        if (!nameById.has(p.id) && p.full_name) nameById.set(p.id, p.full_name);
      });
    }

    const mine: NurseJob[] = myAssignments
      .filter((a: any) => jobById.has(a.job_id))
      .map((a: any) => {
        const job = jobById.get(a.job_id);
        return mapJob(job, a, nameById.get(job.facility_id) ?? null);
      });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startOfDay.getTime() + 24 * 3600_000;
    const closed = new Set(["completed", "cancelled", "rejected", "withdrawn"]);

    const today = mine.filter((j) => {
      const t = j.startsAt ? new Date(j.startsAt).getTime() : null;
      return !closed.has(j.status) && t != null && t >= startOfDay.getTime() && t < endOfDay;
    });
    const upcoming = mine.filter((j) => {
      const t = j.startsAt ? new Date(j.startsAt).getTime() : null;
      return !closed.has(j.status) && (t == null || t >= endOfDay);
    });
    const history = mine.filter((j) => {
      const t = j.startsAt ? new Date(j.startsAt).getTime() : null;
      return closed.has(j.status) || (t != null && t < startOfDay.getTime());
    });

    const since = Date.now() - 30 * 24 * 3600_000;
    const earnings30d = Math.round(
      mine
        .filter((j) => j.status === "completed" && j.startsAt && new Date(j.startsAt).getTime() >= since)
        .reduce((sum, j) => sum + (j.compensation ?? 0), 0),
    );

    const appliedJobIds = new Set(myAssignments.map((a: any) => a.job_id));
    const openJobs = (openRows.data ?? [])
      .filter((j: any) => looksLikeNurseJob(j) && !appliedJobIds.has(j.id))
      .filter((j: any) => {
        if (!profile) return true;
        if (profile.areas.length && j.area && !profile.areas.includes(j.area)) return false;
        return true;
      })
      .map((j: any) => mapJob(j, null, nameById.get(j.facility_id) ?? null));

    return {
      profile,
      totals: {
        today: today.length,
        upcoming: upcoming.length,
        completed: mine.filter((j) => j.status === "completed").length,
        earnings30d,
        openMatches: openJobs.length,
      },
      today,
      upcoming,
      history,
      openJobs,
    };
  });

export type NurseProfileInput = {
  fullName: string;
  phone?: string | null;
  qualification?: string | null;
  registrationNumber?: string | null;
  yearsExperience?: number | null;
  skills: string[];
  specialty?: string | null;
  shiftPrefs: string[];
  homeCare: boolean;
  hospitalDuty: boolean;
  areas: string[];
  city: string;
  preferredFacilities: string[];
  languages: string[];
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
};

/** Nurse builds or updates their own profile (skills, wards, areas, venues). */
export const saveNurseProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: NurseProfileInput) => {
    if (!d?.fullName?.trim()) throw new Error("Your name is required");
    if (!Array.isArray(d.skills) || d.skills.length === 0) throw new Error("Pick at least one skill or ward");
    if (d.bio && d.bio.length > 1000) throw new Error("Keep the summary under 1000 characters");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      user_id: context.userId,
      full_name: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      qualification: data.qualification || null,
      registration_number: data.registrationNumber?.trim() || null,
      years_experience: Math.max(0, Math.min(60, Number(data.yearsExperience ?? 0) || 0)),
      skills: data.skills,
      specialty: data.specialty?.trim() || null,
      shift_prefs: data.shiftPrefs ?? [],
      home_care: !!data.homeCare,
      hospital_duty: !!data.hospitalDuty,
      areas: data.areas ?? [],
      city: data.city?.trim() || "Pune",
      preferred_facilities: data.preferredFacilities ?? [],
      languages: data.languages ?? [],
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
    };

    const { data: existing } = await sb.from("nurses").select("id").eq("user_id", context.userId).maybeSingle();
    if (existing) {
      const { error } = await sb.from("nurses").update(row).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("nurses").insert(row);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Nurse goes online (open for jobs) or offline. */
export const setNurseOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { online: boolean }) => ({ online: !!d?.online }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("nurses").update({ is_online: data.online }).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await sb
      .from("provider_availability")
      .upsert({ user_id: context.userId, is_online: data.online }, { onConflict: "user_id" });
    return { ok: true, online: data.online };
  });

/** Nurse applies for an open shift / home-care duty. */
export const applyToNurseJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string; note?: string | null }) => {
    if (!d?.jobId) throw new Error("jobId is required");
    if (d.note && d.note.length > 500) throw new Error("Keep the note under 500 characters");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: job, error: jErr } = await sb
      .from("staffing_jobs")
      .select("id, duty_type, status")
      .eq("id", data.jobId)
      .maybeSingle();
    if (jErr) throw new Error(jErr.message);
    if (!job || job.status !== "open") throw new Error("This job is no longer open");

    const { error } = await sb.from("staffing_assignments").insert({
      job_id: data.jobId,
      provider_id: context.userId,
      status: "applied",
      duty_type: job.duty_type ?? null,
      application_note: data.note?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Nurse moves their own duty forward: check in, check out, withdraw. */
export const setNurseJobStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assignmentId: string; stage: "checked_in" | "completed" | "withdrawn" }) => {
    if (!d?.assignmentId) throw new Error("assignmentId is required");
    if (!["checked_in", "completed", "withdrawn"].includes(d.stage)) throw new Error("Unknown stage");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> =
      data.stage === "checked_in"
        ? { status: "in_progress", checked_in_at: now }
        : data.stage === "completed"
          ? { status: "completed", checked_out_at: now, completed_at: now }
          : { status: "withdrawn", cancelled_at: now };

    const { error } = await sb
      .from("staffing_assignments")
      .update(patch)
      .eq("id", data.assignmentId)
      .eq("provider_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type NurseSearchRow = {
  id: string;
  fullName: string;
  phone: string | null;
  qualification: string | null;
  yearsExperience: number;
  skills: string[];
  specialty: string | null;
  shiftPrefs: string[];
  areas: string[];
  city: string;
  homeCare: boolean;
  hospitalDuty: boolean;
  languages: string[];
  isOnline: boolean;
  verified: boolean;
  preferredFacilities: string[];
};

/** Hospitals, clinics and home-care requesters screen available nurses. */
export const searchNurses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      skills?: string[];
      city?: string | null;
      area?: string | null;
      shift?: string | null;
      onlineOnly?: boolean;
      homeCareOnly?: boolean;
      minExperience?: number | null;
    }) => d ?? {},
  )
  .handler(async ({ data, context }): Promise<{ nurses: NurseSearchRow[] }> => {
    const sb = context.supabase as any;
    let q = sb.from("nurses").select("*").eq("active", true).limit(200);
    if (data.city) q = q.eq("city", data.city);
    if (data.onlineOnly) q = q.eq("is_online", true);
    if (data.homeCareOnly) q = q.eq("home_care", true);
    if (data.skills?.length) q = q.overlaps("skills", data.skills);
    if (data.area) q = q.contains("areas", [data.area]);
    if (data.minExperience) q = q.gte("years_experience", data.minExperience);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const nurses = (rows ?? [])
      .filter((r: any) => !data.shift || (r.shift_prefs ?? []).includes(data.shift))
      .map((r: any) => {
        const p = mapProfile(r);
        return {
          id: p.id,
          fullName: p.fullName,
          phone: p.phone,
          qualification: p.qualification,
          yearsExperience: p.yearsExperience,
          skills: p.skills,
          specialty: p.specialty,
          shiftPrefs: p.shiftPrefs,
          areas: p.areas,
          city: p.city,
          homeCare: p.homeCare,
          hospitalDuty: p.hospitalDuty,
          languages: p.languages,
          isOnline: p.isOnline,
          verified: p.verified,
          preferredFacilities: p.preferredFacilities,
        };
      })
      .sort((a: NurseSearchRow, b: NurseSearchRow) =>
        a.isOnline === b.isOnline ? b.yearsExperience - a.yearsExperience : a.isOnline ? -1 : 1,
      );

    return { nurses };
  });
