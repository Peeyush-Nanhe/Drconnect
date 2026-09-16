import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { THERAPY_LABEL } from "@/lib/physio-patient.functions";

export type TherapistVisit = {
  id: string;
  patientName: string;
  therapyType: string;
  therapyLabel: string;
  area: string;
  city: string;
  address: string | null;
  scheduledAt: string | null;
  durationMin: number;
  sessionNumber: number;
  status: string;
  urgency: string;
  confirmedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  fee: number | null;
  paymentStatus: string;
  fromPack: boolean;
  notes: string | null;
  therapistNote: string | null;
};

export type TherapistBoard = {
  therapist: { id: string; name: string; area: string | null; city: string; verified: boolean } | null;
  totals: {
    toConfirm: number;
    today: number;
    upcoming: number;
    completed30d: number;
    earnings30d: number;
  };
  visits: TherapistVisit[];
  openRequests: TherapistVisit[];
};

const mapVisit = (r: any): TherapistVisit => ({
  id: r.id,
  patientName: r.patient_name ?? "Patient",
  therapyType: r.therapy_type,
  therapyLabel: THERAPY_LABEL[r.therapy_type] ?? r.therapy_type,
  area: r.area,
  city: r.city,
  address: r.address ?? null,
  scheduledAt: r.scheduled_at ?? null,
  durationMin: r.duration_min ?? 45,
  sessionNumber: r.session_number ?? 1,
  status: r.status,
  urgency: r.urgency,
  confirmedAt: r.confirmed_at ?? null,
  checkedInAt: r.checked_in_at ?? null,
  checkedOutAt: r.checked_out_at ?? null,
  fee: r.fee === null || r.fee === undefined ? null : Number(r.fee),
  paymentStatus: r.payment_status ?? "unpaid",
  fromPack: !!r.pack_id,
  notes: r.notes ?? null,
  therapistNote: r.therapist_note ?? null,
});

const VISIT_COLUMNS =
  "id, patient_name, therapy_type, area, city, address, scheduled_at, duration_min, session_number, status, urgency, confirmed_at, checked_in_at, checked_out_at, fee, payment_status, pack_id, notes, therapist_note, created_at";

const STAGES = ["confirmed", "en_route", "in_progress", "completed", "no_show", "cancelled"] as const;

/** The signed-in therapist's own queue of home sessions. */
export const getTherapistBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TherapistBoard> => {
    const sb = context.supabase as any;

    const { data: therapist, error: tErr } = await sb
      .from("physio_therapists")
      .select("id, full_name, area, city, verified")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!therapist) {
      return {
        therapist: null,
        totals: { toConfirm: 0, today: 0, upcoming: 0, completed30d: 0, earnings30d: 0 },
        visits: [],
        openRequests: [],
      };
    }

    const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    const [mine, openRows] = await Promise.all([
      sb
        .from("physio_visits")
        .select(VISIT_COLUMNS)
        .eq("therapist_id", therapist.id)
        .gte("created_at", since)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(300),
      sb
        .from("physio_visits")
        .select(VISIT_COLUMNS)
        .is("therapist_id", null)
        .eq("status", "requested")
        .eq("city", therapist.city)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .limit(50),
    ]);
    if (mine.error) throw new Error(mine.error.message);
    if (openRows.error) throw new Error(openRows.error.message);

    const visits: TherapistVisit[] = (mine.data ?? []).map(mapVisit);
    const openRequests: TherapistVisit[] = (openRows.data ?? []).map(mapVisit);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = startOfDay.getTime() + 24 * 3600_000;
    const open = new Set(["assigned", "confirmed", "en_route", "in_progress"]);

    const totals = {
      toConfirm: visits.filter((v) => v.status === "assigned").length,
      today: visits.filter((v) => {
        const t = v.scheduledAt ? new Date(v.scheduledAt).getTime() : null;
        return t != null && t >= startOfDay.getTime() && t < endOfDay;
      }).length,
      upcoming: visits.filter(
        (v) => open.has(v.status) && v.scheduledAt && new Date(v.scheduledAt).getTime() >= Date.now(),
      ).length,
      completed30d: visits.filter((v) => v.status === "completed").length,
      earnings30d: Math.round(
        visits.filter((v) => v.status === "completed").reduce((sum, v) => sum + (v.fee ?? 0), 0),
      ),
    };

    return {
      therapist: {
        id: therapist.id,
        name: therapist.full_name,
        area: therapist.area ?? null,
        city: therapist.city,
        verified: !!therapist.verified,
      },
      totals,
      visits,
      openRequests,
    };
  });

/** Therapist takes an unassigned home-session request in their city. */
export const claimPhysioVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string }) => {
    if (!input?.visitId) throw new Error("visitId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("claim_physio_visit", { _visit_id: data.visitId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Therapist confirms a session or moves it through the stages. */
export const setPhysioVisitStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string; stage: string; note?: string | null }) => {
    if (!input?.visitId) throw new Error("visitId is required");
    if (!STAGES.includes(input.stage as (typeof STAGES)[number])) throw new Error("Unknown stage");
    if (input.note && input.note.length > 1000) throw new Error("Note must be under 1000 characters");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("set_physio_visit_stage", {
      _visit_id: data.visitId,
      _stage: data.stage,
      _note: data.note?.trim() || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------- therapist profile & presence ---------------------- */

export type TherapistProfile = {
  id: string;
  fullName: string;
  phone: string | null;
  specializations: string[];
  qualification: string | null;
  registrationNumber: string | null;
  yearsExperience: number | null;
  areas: string[];
  city: string;
  homeVisits: boolean;
  clinicVisits: boolean;
  preferredFacilities: string[];
  languages: string[];
  bio: string | null;
  recentCourses: string | null;
  specialInterests: string | null;
  isOnline: boolean;
  verified: boolean;
  active: boolean;
};

/** The signed-in physiotherapist's own profile row (null when not registered). */
export const getTherapistProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ profile: TherapistProfile | null }> => {
    const sb = context.supabase as any;
    const { data: r, error } = await sb
      .from("physio_therapists")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return { profile: null };
    return {
      profile: {
        id: r.id,
        fullName: r.full_name,
        phone: r.phone ?? null,
        specializations: r.specializations ?? [],
        qualification: r.qualification ?? null,
        registrationNumber: r.registration_number ?? null,
        yearsExperience: r.years_experience ?? null,
        areas: r.areas ?? [],
        city: r.city ?? "Pune",
        homeVisits: !!r.home_visits,
        clinicVisits: !!r.clinic_visits,
        preferredFacilities: r.preferred_facilities ?? [],
        languages: r.languages ?? [],
        bio: r.bio ?? null,
        recentCourses: r.recent_courses ?? null,
        specialInterests: r.special_interests ?? null,
        isOnline: !!r.is_online,
        verified: !!r.verified,
        active: !!r.active,
      },
    };
  });

export type TherapistProfileInput = {
  fullName: string;
  phone?: string | null;
  specializations: string[];
  qualification?: string | null;
  registrationNumber?: string | null;
  yearsExperience?: number | null;
  areas: string[];
  city: string;
  homeVisits: boolean;
  clinicVisits: boolean;
  preferredFacilities: string[];
  languages: string[];
  bio?: string | null;
  recentCourses?: string | null;
  specialInterests?: string | null;
};

/** Physiotherapist updates their own profile and preferred centres. */
export const saveTherapistProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: TherapistProfileInput) => {
    if (!d?.fullName?.trim()) throw new Error("Your name is required");
    if (!Array.isArray(d.specializations) || d.specializations.length === 0)
      throw new Error("Pick at least one therapy you offer");
    if (d.bio && d.bio.length > 1000) throw new Error("Keep the summary under 1000 characters");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const row = {
      user_id: context.userId,
      full_name: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      specializations: data.specializations,
      qualification: data.qualification || null,
      registration_number: data.registrationNumber?.trim() || null,
      years_experience: data.yearsExperience ?? null,
      areas: data.areas ?? [],
      city: data.city?.trim() || "Pune",
      home_visits: !!data.homeVisits,
      clinic_visits: !!data.clinicVisits,
      preferred_facilities: data.preferredFacilities ?? [],
      languages: data.languages ?? [],
      bio: data.bio?.trim() || null,
      recent_courses: data.recentCourses?.trim() || null,
      special_interests: data.specialInterests?.trim() || null,
      area: data.areas?.[0] ?? null,
    };

    const { data: existing } = await sb
      .from("physio_therapists")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) {
      const { error } = await sb.from("physio_therapists").update(row).eq("user_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("physio_therapists").insert({ ...row, active: true });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Physiotherapist goes online (taking sessions) or offline. */
export const setTherapistOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { online: boolean }) => ({ online: !!d?.online }))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("physio_therapists")
      .update({ is_online: data.online })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    await sb
      .from("provider_availability")
      .upsert({ user_id: context.userId, is_online: data.online }, { onConflict: "user_id" });
    return { ok: true, online: data.online };
  });
