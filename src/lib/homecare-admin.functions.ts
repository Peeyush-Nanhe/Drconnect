import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admins and technicians may monitor the home-care board. */
async function assertMonitor(ctx: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isSuper }, tech] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" }),
    ctx.supabase.from("technicians").select("id").eq("user_id", ctx.userId).limit(1),
  ]);
  const isTechnician = ((tech?.data ?? []) as any[]).length > 0;
  if (!isAdmin && !isSuper && !isTechnician) throw new Error("Forbidden: admin or technician only");
  return { isAdmin: !!isAdmin || !!isSuper, isTechnician };
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const UPCOMING = ["open", "requested", "assigned", "accepted", "scheduled", "confirmed"];

/**
 * Combined monitoring board: home physiotherapy positions/visits and
 * home care (visiting) doctors — bookings plus who is available.
 */
export const getHomeCareBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => ({
    days: Math.min(Math.max(Number(d?.days ?? 30), 1), 365),
  }))
  .handler(async ({ data, context }) => {
    const scope = await assertMonitor(context as any);
    const sb = await adminClient();
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const [
      { data: visits },
      { data: therapists },
      { data: partners },
      { data: careRequests },
      { data: plans },
      { data: availability },
      { data: profiles },
    ] = await Promise.all([
      sb
        .from("physio_visits")
        .select(
          "id, area, city, therapy_type, status, urgency, scheduled_at, session_number, duration_min, fee, therapist_id, partner_id, patient_name, checked_in_at, checked_out_at, no_show, created_at",
        )
        .gte("created_at", since)
        .order("scheduled_at", { ascending: true }),
      sb
        .from("physio_therapists")
        .select("id, full_name, city, area, specializations, active, verified, partner_id, user_id, phone"),
      sb.from("physio_partners").select("id, name"),
      sb
        .from("care_requests")
        .select(
          "id, specialty, status, scheduled_for, my_doctor_id, preferred_id, accepted_by, patient_id, created_at, completed_at, amount",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      sb
        .from("family_physician_plans")
        .select("id, doctor_name, doctor_spec, status, price, purchased_at, expires_at, patient_id"),
      sb.from("provider_availability").select("user_id, is_online, service_online, working_hours, dnd_windows"),
      sb.from("profiles").select("id, full_name, phone"),
    ]);

    const nameOf = (id?: string | null) =>
      (id && ((profiles ?? []) as any[]).find((p) => p.id === id)?.full_name) || null;
    const partnerName = (id?: string | null) =>
      (id && ((partners ?? []) as any[]).find((p) => p.id === id)?.name) || null;

    const physioVisits = ((visits ?? []) as any[]).map((v) => ({
      id: v.id,
      area: v.area,
      city: v.city,
      therapyType: v.therapy_type,
      status: v.status,
      urgency: v.urgency,
      scheduledAt: v.scheduled_at,
      sessionNumber: v.session_number,
      durationMin: v.duration_min,
      fee: v.fee,
      patientName: v.patient_name ?? null,
      therapistName:
        ((therapists ?? []) as any[]).find((t) => t.id === v.therapist_id)?.full_name ?? null,
      partnerName: partnerName(v.partner_id),
      checkedIn: !!v.checked_in_at,
      checkedOut: !!v.checked_out_at,
      noShow: !!v.no_show,
      createdAt: v.created_at,
    }));

    const therapistRows = ((therapists ?? []) as any[]).map((t) => {
      const load = physioVisits.filter((v) => v.therapistName === t.full_name);
      const availRow = ((availability ?? []) as any[]).find((a) => a.user_id === t.user_id);
      return {
        id: t.id,
        name: t.full_name,
        city: t.city,
        area: t.area,
        phone: t.phone ?? null,
        specializations: t.specializations ?? [],
        active: !!t.active,
        verified: !!t.verified,
        partnerName: partnerName(t.partner_id),
        online: availRow ? !!availRow.is_online : null,
        upcoming: load.filter((v) => UPCOMING.includes(String(v.status))).length,
        completed: load.filter((v) => String(v.status) === "completed").length,
      };
    });

    const doctorBookings = ((careRequests ?? []) as any[]).map((r) => {
      const doctorId = r.accepted_by ?? r.my_doctor_id ?? r.preferred_id ?? null;
      return {
        id: r.id,
        specialty: r.specialty,
        status: r.status,
        scheduledFor: r.scheduled_for,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        amount: r.amount ?? null,
        doctorName: nameOf(doctorId),
        patientName: nameOf(r.patient_id),
      };
    });

    const doctorIds = Array.from(
      new Set(
        ((careRequests ?? []) as any[])
          .map((r) => r.accepted_by ?? r.my_doctor_id ?? r.preferred_id)
          .filter(Boolean),
      ),
    ) as string[];

    const doctorRoster = doctorIds.map((id) => {
      const availRow = ((availability ?? []) as any[]).find((a) => a.user_id === id);
      const mine = doctorBookings.filter((b) => b.doctorName === nameOf(id));
      return {
        id,
        name: nameOf(id) ?? "Doctor",
        online: availRow ? !!availRow.is_online : null,
        acceptingHomeVisits: availRow ? availRow.service_online !== false : null,
        upcoming: mine.filter((b) => UPCOMING.includes(String(b.status))).length,
        completed: mine.filter((b) => String(b.status) === "completed").length,
      };
    });

    const therapyMix: Record<string, number> = {};
    physioVisits.forEach((v) => (therapyMix[v.therapyType] = (therapyMix[v.therapyType] ?? 0) + 1));
    const areaMix: Record<string, number> = {};
    physioVisits.forEach((v) => (areaMix[v.area] = (areaMix[v.area] ?? 0) + 1));

    return {
      scope,
      days: data.days,
      totals: {
        physioVisits: physioVisits.length,
        physioUpcoming: physioVisits.filter((v) => UPCOMING.includes(String(v.status))).length,
        physioCompleted: physioVisits.filter((v) => String(v.status) === "completed").length,
        therapistsActive: therapistRows.filter((t) => t.active).length,
        doctorBookings: doctorBookings.length,
        doctorUpcoming: doctorBookings.filter((b) => UPCOMING.includes(String(b.status))).length,
        doctorsOnDuty: doctorRoster.filter((d) => d.online).length,
        homeCarePlans: ((plans ?? []) as any[]).filter((p) => p.status === "active").length,
      },
      therapyMix,
      areaMix,
      physioVisits: physioVisits.slice(0, 60),
      therapists: therapistRows,
      doctorBookings: doctorBookings.slice(0, 60),
      doctorRoster,
      homeCarePlans: ((plans ?? []) as any[]).slice(0, 40).map((p) => ({
        id: p.id,
        doctorName: p.doctor_name,
        doctorSpec: p.doctor_spec,
        status: p.status,
        price: p.price,
        purchasedAt: p.purchased_at,
        expiresAt: p.expires_at,
        patientName: nameOf(p.patient_id),
      })),
    };
  });
