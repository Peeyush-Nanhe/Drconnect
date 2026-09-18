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
  otp?: string;
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
  confirmedAt: r.confirmed_at ?? (r.status === "confirmed" ? r.created_at : null),
  checkedInAt: r.checked_in_at ?? null,
  checkedOutAt: r.checked_out_at ?? null,
  fee: r.fee === null || r.fee === undefined ? null : Number(r.fee),
  paymentStatus: r.payment_status ?? "paid",
  fromPack: !!r.pack_id,
  notes: r.notes ?? null,
  therapistNote: r.therapist_note ?? r.notes ?? null,
  otp: r.otp ?? undefined,
});

const VISIT_COLUMNS =
  "id, patient_name, therapy_type, area, city, address, scheduled_at, duration_min, session_number, status, urgency, confirmed_at, checked_in_at, checked_out_at, fee, notes, otp, created_at";

const STAGES = ["confirmed", "en_route", "in_progress", "completed", "no_show", "cancelled"] as const;

/** The signed-in therapist's own queue of home sessions. */
export const getTherapistBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TherapistBoard> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (supabaseAdmin || context.supabase) as any;

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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (supabaseAdmin || context.supabase) as any;
    const { data: pt } = await sb
      .from("physio_therapists")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!pt) throw new Error("Physiotherapist record not found");

    const rpcRes = await sb.rpc("claim_physio_visit", {
      _visit_id: data.visitId,
      _therapist_id: pt.id,
    });
    if (rpcRes.error) {
      const { error: updErr } = await sb
        .from("physio_visits")
        .update({ therapist_id: pt.id, status: "assigned", updated_at: new Date().toISOString() })
        .eq("id", data.visitId)
        .is("therapist_id", null);
      if (updErr) throw new Error(updErr.message);
      return { ok: true, visitId: data.visitId };
    }
    return { ok: true, visitId: data.visitId };
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (supabaseAdmin || context.supabase) as any;
    const rpcRes = await sb.rpc("set_physio_visit_stage", {
      _visit_id: data.visitId,
      _stage: data.stage,
      _note: data.note?.trim() || null,
    });
    if (rpcRes.error && (rpcRes.error.code === "PGRST202" || rpcRes.error.message?.includes("schema cache"))) {
      const updates: Record<string, any> = {
        status: data.stage,
        updated_at: new Date().toISOString(),
      };
      if (data.stage === "confirmed") {
        updates.confirmed_at = new Date().toISOString();
      } else if (data.stage === "in_progress") {
        updates.checked_in_at = new Date().toISOString();
      } else if (data.stage === "completed") {
        updates.checked_out_at = new Date().toISOString();
      } else if (data.stage === "no_show") {
        updates.no_show = true;
      }
      if (data.note) {
        updates.notes = data.note.trim();
      }
      const { error: updErr } = await sb
        .from("physio_visits")
        .update(updates)
        .eq("id", data.visitId);
      if (updErr) throw new Error(updErr.message);
      return { ok: true };
    }
    if (rpcRes.error) throw new Error(rpcRes.error.message);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (supabaseAdmin || context.supabase) as any;
    const [{ data: r, error }, { data: avail }] = await Promise.all([
      sb
        .from("physio_therapists")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
      sb
        .from("provider_availability")
        .select("is_online")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    if (!r) return { profile: null };
    const isOnline = avail?.is_online !== undefined ? !!avail.is_online : (r.is_online !== undefined ? !!r.is_online : true);
    return {
      profile: {
        id: r.id,
        fullName: r.full_name,
        phone: r.phone ?? null,
        specializations: r.specializations ?? [],
        qualification: r.qualification ?? null,
        registrationNumber: r.registration_number ?? null,
        yearsExperience: r.years_experience ?? null,
        areas: r.areas && r.areas.length ? r.areas : (r.area ? [r.area] : ["Kothrud", "Pune"]),
        city: r.city ?? "Pune",
        homeVisits: r.home_visits !== undefined ? !!r.home_visits : true,
        clinicVisits: r.clinic_visits !== undefined ? !!r.clinic_visits : true,
        preferredFacilities: r.preferred_facilities ?? [],
        languages: r.languages ?? [],
        bio: r.bio ?? null,
        recentCourses: r.recent_courses ?? null,
        specialInterests: r.special_interests ?? null,
        isOnline,
        verified: r.verified !== undefined ? !!r.verified : true,
        active: r.active !== undefined ? !!r.active : true,
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

    // Staging schema baseline columns
    const baselineRow = {
      user_id: context.userId,
      full_name: data.fullName.trim(),
      phone: data.phone?.trim() || null,
      specializations: data.specializations,
      city: data.city?.trim() || "Pune",
      area: data.areas?.[0] ?? null,
      registration_number: data.registrationNumber?.trim() || null,
    };

    if (existing) {
      let { error } = await sb.from("physio_therapists").update(row).eq("user_id", context.userId);
      if (error && error.message?.includes("schema cache")) {
        // Fallback to baseline columns if extended columns are not yet in PostgREST schema cache
        const res = await sb.from("physio_therapists").update(baselineRow).eq("user_id", context.userId);
        error = res.error;
      }
      if (error) throw new Error(error.message);
    } else {
      let { error } = await sb.from("physio_therapists").insert({ ...row, active: true });
      if (error && error.message?.includes("schema cache")) {
        const res = await sb.from("physio_therapists").insert({ ...baselineRow, active: true, verified: true });
        error = res.error;
      }
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Physiotherapist goes online (taking sessions) or offline. */
export const setTherapistOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { online: boolean }) => ({ online: !!d?.online }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (supabaseAdmin || context.supabase) as any;
    try {
      await sb
        .from("physio_therapists")
        .update({ is_online: data.online })
        .eq("user_id", context.userId);
    } catch {
      // is_online column may be absent in schema cache
    }
    await sb
      .from("provider_availability")
      .upsert({ user_id: context.userId, is_online: data.online }, { onConflict: "user_id" });
    return { ok: true, online: data.online };
  });

export const insertEmergencyPhysioVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { reqId: string, patientId: string, patientName: string, specialty: string, fare: number }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = (supabaseAdmin || context.supabase) as any;
    
    // Check if this request is already inserted? Optional, but insert might create duplicates if clicked multiple times.
    const { data: existing } = await sb.from("physio_visits").select("id").eq("notes", `Emergency ${data.specialty} request (ID: ${data.reqId})`).maybeSingle();
    if (existing) return { ok: true };

    const { data: therapist } = await sb.from("physio_therapists").select("id").eq("user_id", context.userId).maybeSingle();
    if (!therapist) {
      // If the user isn't in physio_therapists, they can't be assigned a visit.
      throw new Error("You must be registered as a therapist to accept this.");
    }

    const allowedTherapies = ['neuro','orthopaedic','sports','paediatric','geriatric','cardio_respiratory','post_surgical','pelvic_floor','general'];
    let mappedType = data.specialty.toLowerCase().replace(/[^a-z_]/g, '_');
    if (!allowedTherapies.includes(mappedType)) {
      // Basic heuristics for common names
      if (mappedType.includes("neuro")) mappedType = "neuro";
      else if (mappedType.includes("ortho")) mappedType = "orthopaedic";
      else if (mappedType.includes("sport")) mappedType = "sports";
      else if (mappedType.includes("paed") || mappedType.includes("pedi")) mappedType = "paediatric";
      else if (mappedType.includes("cardio")) mappedType = "cardio_respiratory";
      else mappedType = "general";
    }

    const { error } = await sb.from("physio_visits").insert({
        patient_id: data.patientId,
        patient_name: data.patientName,
        therapist_id: therapist.id,
        therapy_type: mappedType,
        area: "Emergency Location",
        city: "Pune",
        scheduled_at: new Date().toISOString(),
        duration_min: 45,
        session_number: 1,
        status: "assigned",
        urgency: "urgent",
        fee: data.fare,
        notes: `Emergency ${data.specialty} request (ID: ${data.reqId})`
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
