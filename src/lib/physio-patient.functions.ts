import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const THERAPY_LABEL: Record<string, string> = {
  neuro: "Neuro physiotherapy",
  orthopaedic: "Orthopaedic therapy",
  sports: "Sports injury rehab",
  paediatric: "Paediatric therapy",
  geriatric: "Geriatric therapy",
  cardio_respiratory: "Cardio-respiratory",
  post_surgical: "Post-surgical rehab",
  pelvic_floor: "Pelvic floor",
  general: "General physiotherapy",
};

export type PatientPhysioVisit = {
  id: string;
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
  checkedInAt: string | null;
  checkedOutAt: string | null;
  noShow: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  fee: number | null;
  notes: string | null;
  therapistName: string | null;
  partnerName: string | null;
  feedback: {
    rating: number;
    punctuality: number | null;
    professionalism: number | null;
    wouldRebook: boolean | null;
    comment: string | null;
  } | null;
};

export const getMyPhysioVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PatientPhysioVisit[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = context.userId;

    const { data: visits, error } = await sb
      .from("physio_visits")
      .select(
        "id, therapy_type, area, city, address, scheduled_at, duration_min, session_number, status, urgency, checked_in_at, checked_out_at, no_show, cancelled_at, cancel_reason, fee, notes, therapist_id, partner_id, created_at",
      )
      .eq("patient_id", uid)
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows: any[] = visits ?? [];
    if (rows.length === 0) return [];

    const therapistIds = Array.from(new Set(rows.map((r) => r.therapist_id).filter(Boolean)));
    const partnerIds = Array.from(new Set(rows.map((r) => r.partner_id).filter(Boolean)));

    const [therapists, partners, feedback] = await Promise.all([
      therapistIds.length
        ? sb.from("physio_therapists").select("id, full_name").in("id", therapistIds)
        : Promise.resolve({ data: [] }),
      partnerIds.length
        ? sb.from("physio_partners").select("id, name").in("id", partnerIds)
        : Promise.resolve({ data: [] }),
      sb
        .from("physio_visit_feedback")
        .select("visit_id, rating, punctuality, professionalism, would_rebook, comment")
        .in(
          "visit_id",
          rows.map((r) => r.id),
        ),
    ]);

    const tName = new Map<string, string>((therapists.data ?? []).map((t: any) => [t.id, t.full_name]));
    const pName = new Map<string, string>((partners.data ?? []).map((p: any) => [p.id, p.name]));
    const fb = new Map<string, any>((feedback.data ?? []).map((f: any) => [f.visit_id, f]));

    return rows.map((r) => ({
      id: r.id,
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
      checkedInAt: r.checked_in_at ?? null,
      checkedOutAt: r.checked_out_at ?? null,
      noShow: !!r.no_show,
      cancelledAt: r.cancelled_at ?? null,
      cancelReason: r.cancel_reason ?? null,
      fee: r.fee === null || r.fee === undefined ? null : Number(r.fee),
      notes: r.notes ?? null,
      therapistName: r.therapist_id ? (tName.get(r.therapist_id) ?? null) : null,
      partnerName: r.partner_id ? (pName.get(r.partner_id) ?? null) : null,
      feedback: fb.has(r.id)
        ? {
            rating: fb.get(r.id).rating,
            punctuality: fb.get(r.id).punctuality ?? null,
            professionalism: fb.get(r.id).professionalism ?? null,
            wouldRebook: fb.get(r.id).would_rebook ?? null,
            comment: fb.get(r.id).comment ?? null,
          }
        : null,
    }));
  });

export const submitPhysioVisitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      visitId: string;
      rating: number;
      punctuality?: number | null;
      professionalism?: number | null;
      wouldRebook?: boolean | null;
      comment?: string | null;
    }) => {
      if (!input?.visitId) throw new Error("visitId is required");
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new Error("Rating must be a whole number between 1 and 5");
      }
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;

    const { data: visit, error: vErr } = await sb
      .from("physio_visits")
      .select("id, patient_id, therapist_id, partner_id, status")
      .eq("id", data.visitId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!visit || visit.patient_id !== context.userId) throw new Error("Visit not found");
    if (visit.status !== "completed") throw new Error("Feedback can only be given after the session is completed");

    const { error } = await sb.from("physio_visit_feedback").upsert(
      {
        visit_id: visit.id,
        patient_id: context.userId,
        therapist_id: visit.therapist_id,
        partner_id: visit.partner_id,
        rating: data.rating,
        punctuality: data.punctuality ?? null,
        professionalism: data.professionalism ?? null,
        would_rebook: data.wouldRebook ?? null,
        comment: data.comment?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "visit_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cancelPhysioVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string; reason?: string | null }) => {
    if (!input?.visitId) throw new Error("visitId is required");
    if (input.reason && input.reason.length > 300) throw new Error("Reason must be under 300 characters");
    return { visitId: String(input.visitId), reason: input.reason?.trim() || null };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;

    const { data: visit, error: vErr } = await sb
      .from("physio_visits")
      .select("id, patient_id, status")
      .eq("id", data.visitId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!visit || visit.patient_id !== context.userId) throw new Error("Visit not found");
    if (["completed", "cancelled", "no_show"].includes(visit.status)) {
      throw new Error("This visit can no longer be cancelled");
    }

    const { error } = await sb
      .from("physio_visits")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: data.reason,
      })
      .eq("id", data.visitId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bookPhysioVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      therapyType: string;
      area: string;
      city: string;
      address?: string | null;
      scheduledAt: string;
      durationMin?: number;
      sessionNumber?: number;
      urgency?: string;
      fee?: number | null;
      notes?: string | null;
      preferredTherapistId?: string | null;
    }) => {
      if (!input?.therapyType || !THERAPY_LABEL[input.therapyType]) throw new Error("Choose a valid therapy type");
      if (!input.area?.trim() || input.area.trim().length > 100) throw new Error("Area is required (max 100 chars)");
      if (!input.city?.trim() || input.city.trim().length > 100) throw new Error("City is required (max 100 chars)");
      const when = new Date(input.scheduledAt);
      if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date and time");
      if (when.getTime() < Date.now() - 5 * 60_000) throw new Error("Scheduled time must be in the future");
      if (input.address && input.address.length > 500) throw new Error("Address must be under 500 characters");
      if (input.notes && input.notes.length > 1000) throw new Error("Notes must be under 1000 characters");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    // A preferred therapist is a soft hint for the partner, never an assignment —
    // a stale/invalid id must never block the booking itself, so drop it silently.
    let preferredTherapistId: string | null = null;
    if (data.preferredTherapistId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: therapist } = await (supabaseAdmin as any)
        .from("physio_therapists")
        .select("id, verified, active")
        .eq("id", data.preferredTherapistId)
        .maybeSingle();
      if (therapist?.verified && therapist?.active) preferredTherapistId = therapist.id;
    }

    const { data: visit, error } = await sb
      .from("physio_visits")
      .insert({
        patient_id: context.userId,
        patient_name: profile?.full_name ?? null,
        therapy_type: data.therapyType,
        area: data.area.trim(),
        city: data.city.trim(),
        address: data.address?.trim() || null,
        scheduled_at: new Date(data.scheduledAt).toISOString(),
        duration_min: Number.isInteger(data.durationMin) && data.durationMin! >= 15 && data.durationMin! <= 180 ? data.durationMin : 45,
        session_number: Number.isInteger(data.sessionNumber) && data.sessionNumber! >= 1 ? data.sessionNumber : 1,
        status: "requested",
        urgency: data.urgency === "urgent" ? "urgent" : "planned",
        fee: data.fee ?? null,
        notes: data.notes?.trim() || null,
        preferred_therapist_id: preferredTherapistId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, visitId: visit.id as string };
  });

export type PhysioPriorProvider = {
  therapistId: string;
  name: string;
  isFavorite: boolean;
  pastVisits: number;
  rating: number | null;
};

export const getPhysioPriorProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PhysioPriorProvider[]> => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const [favRes, priorRes] = await Promise.all([
      sb.from("physio_favorite_therapists").select("therapist_id").eq("patient_id", uid),
      sb
        .from("physio_visits")
        .select("therapist_id, scheduled_at")
        .eq("patient_id", uid)
        .eq("status", "completed")
        .not("therapist_id", "is", null)
        .order("scheduled_at", { ascending: false })
        .limit(1),
    ]);
    if (favRes.error) throw new Error(favRes.error.message);
    if (priorRes.error) throw new Error(priorRes.error.message);

    const favoriteIds: string[] = (favRes.data ?? []).map((r: any) => r.therapist_id);
    const priorId: string | null = (priorRes.data ?? [])[0]?.therapist_id ?? null;

    const orderedIds: string[] = [];
    if (priorId) orderedIds.push(priorId);
    favoriteIds.forEach((id) => { if (!orderedIds.includes(id)) orderedIds.push(id); });
    if (orderedIds.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: therapists, error: tErr } = await admin
      .from("physio_therapists")
      .select("id, full_name, verified, active")
      .in("id", orderedIds);
    if (tErr) throw new Error(tErr.message);
    const therapistById = new Map<string, any>((therapists ?? []).map((t: any) => [t.id, t]));

    const [visitsRes, feedbackRes] = await Promise.all([
      sb.from("physio_visits").select("therapist_id").eq("patient_id", uid).eq("status", "completed").in("therapist_id", orderedIds),
      sb.from("physio_visit_feedback").select("therapist_id, rating").eq("patient_id", uid).in("therapist_id", orderedIds),
    ]);
    if (visitsRes.error) throw new Error(visitsRes.error.message);
    if (feedbackRes.error) throw new Error(feedbackRes.error.message);

    const pastVisitCount = new Map<string, number>();
    (visitsRes.data ?? []).forEach((v: any) => pastVisitCount.set(v.therapist_id, (pastVisitCount.get(v.therapist_id) ?? 0) + 1));

    const ratingsByTherapist = new Map<string, number[]>();
    (feedbackRes.data ?? []).forEach((f: any) => {
      const list = ratingsByTherapist.get(f.therapist_id) ?? [];
      list.push(f.rating);
      ratingsByTherapist.set(f.therapist_id, list);
    });

    return orderedIds
      .filter((id) => therapistById.has(id) && therapistById.get(id).active)
      .map((id) => {
        const ratings = ratingsByTherapist.get(id) ?? [];
        return {
          therapistId: id,
          name: therapistById.get(id).full_name,
          isFavorite: favoriteIds.includes(id),
          pastVisits: pastVisitCount.get(id) ?? 0,
          rating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null,
        };
      });
  });

export const togglePhysioFavoriteTherapist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { therapistId: string }) => {
    if (!input?.therapistId) throw new Error("therapistId is required");
    return { therapistId: String(input.therapistId) };
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const { data: existing, error: exErr } = await sb
      .from("physio_favorite_therapists")
      .select("id")
      .eq("patient_id", uid)
      .eq("therapist_id", data.therapistId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    if (existing) {
      const { error } = await sb.from("physio_favorite_therapists").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { isFavorite: false };
    }

    const { count, error: cErr } = await sb
      .from("physio_favorite_therapists")
      .select("id", { count: "exact", head: true })
      .eq("patient_id", uid);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) >= 2) throw new Error("You can favourite up to 2 physiotherapists");

    const { error } = await sb.from("physio_favorite_therapists").insert({ patient_id: uid, therapist_id: data.therapistId });
    if (error) throw new Error(error.message);
    return { isFavorite: true };
  });

export type PhysioTherapistRosterEntry = {
  therapistId: string;
  name: string;
  area: string | null;
  city: string;
  specializations: string[];
  isFavorite: boolean;
};

export const getPhysioTherapistRoster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PhysioTherapistRosterEntry[]> => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const [therapistsRes, favRes] = await Promise.all([
      sb.from("physio_therapists").select("id, full_name, area, city, specializations").eq("verified", true).eq("active", true).order("full_name", { ascending: true }),
      sb.from("physio_favorite_therapists").select("therapist_id").eq("patient_id", uid),
    ]);
    if (therapistsRes.error) throw new Error(therapistsRes.error.message);
    if (favRes.error) throw new Error(favRes.error.message);

    const favoriteIds = new Set<string>((favRes.data ?? []).map((r: any) => r.therapist_id));
    return (therapistsRes.data ?? [])
      .map((t: any) => ({
        therapistId: t.id,
        name: t.full_name,
        area: t.area ?? null,
        city: t.city,
        specializations: t.specializations ?? [],
        isFavorite: favoriteIds.has(t.id),
      }))
      .sort((a: PhysioTherapistRosterEntry, b: PhysioTherapistRosterEntry) =>
        a.isFavorite === b.isFavorite ? a.name.localeCompare(b.name) : a.isFavorite ? -1 : 1,
      );
  });

export type PhysioTherapistSlot = { startTime: string; isAvailable: boolean };

export const getPhysioTherapistSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { therapistId: string; durationMin: number; startDate: string; endDate: string }) => {
    if (!input?.therapistId) throw new Error("therapistId is required");
    if (!Number.isInteger(input.durationMin) || input.durationMin < 15 || input.durationMin > 180) {
      throw new Error("Duration must be between 15 and 180 minutes");
    }
    if (!input.startDate || !input.endDate) throw new Error("startDate and endDate are required");
    return input;
  })
  .handler(async ({ data, context }): Promise<PhysioTherapistSlot[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: therapist, error: tErr } = await admin
      .from("physio_therapists")
      .select("id, user_id, verified, active")
      .eq("id", data.therapistId)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!therapist || !therapist.verified || !therapist.active) throw new Error("Therapist not found or not available");
    if (!therapist.user_id) return [];

    const sb = context.supabase as any;
    const { data: slots, error } = await sb.rpc("get_provider_slots", {
      p_provider_id: therapist.user_id,
      p_start_date: data.startDate,
      p_end_date: data.endDate,
      p_duration_minutes: data.durationMin,
    });
    if (error) throw new Error(error.message);
    return (slots ?? []).map((s: any) => ({ startTime: s.start_time, isAvailable: !!s.is_available }));
  });

export const bookPhysioVisitWithTherapist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      therapistId: string;
      therapyType: string;
      area: string;
      city: string;
      address?: string | null;
      startTime: string;
      durationMin: number;
      urgency?: string;
      notes?: string | null;
    }) => {
      if (!input?.therapistId) throw new Error("therapistId is required");
      if (!input?.therapyType || !THERAPY_LABEL[input.therapyType]) throw new Error("Choose a valid therapy type");
      if (!input.area?.trim() || input.area.trim().length > 100) throw new Error("Area is required (max 100 chars)");
      if (!input.city?.trim() || input.city.trim().length > 100) throw new Error("City is required (max 100 chars)");
      const when = new Date(input.startTime);
      if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date and time");
      if (when.getTime() < Date.now()) throw new Error("Scheduled time must be in the future");
      if (input.address && input.address.length > 500) throw new Error("Address must be under 500 characters");
      if (input.notes && input.notes.length > 1000) throw new Error("Notes must be under 1000 characters");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: visitId, error } = await sb.rpc("atomic_book_physio_visit", {
      p_therapist_id: data.therapistId,
      p_patient_id: context.userId,
      p_start_time: new Date(data.startTime).toISOString(),
      p_duration_min: data.durationMin,
      p_therapy_type: data.therapyType,
      p_area: data.area.trim(),
      p_city: data.city.trim(),
      p_address: data.address?.trim() || null,
      p_notes: data.notes?.trim() || null,
      p_urgency: data.urgency === "urgent" ? "urgent" : "planned",
    });
    if (error) throw new Error(error.message);
    return { ok: true, visitId: visitId as string };
  });
