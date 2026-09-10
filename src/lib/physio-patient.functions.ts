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
        urgency: data.urgency === "urgent" ? "urgent" : "routine",
        fee: data.fee ?? null,
        notes: data.notes?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, visitId: visit.id as string };
  });
