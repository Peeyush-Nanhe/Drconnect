import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NURSE_SKILL_LABEL } from "@/lib/care-staff-catalog";

export type PatientNursingVisit = {
  id: string;
  engagementId: string;
  kind: string;
  kindLabel: string;
  area: string;
  city: string;
  scheduledAt: string | null;
  status: string;
  nurseName: string | null;
  fee: number | null;
  seq: number;
  totalDays: number;
};

export const getMyNursingVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PatientNursingVisit[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = context.userId;

    const { data: engagements, error: eErr } = await sb
      .from("nursing_engagements")
      .select("id, kind, address_snapshot, days_scheduled, day_rate")
      .eq("patient_id", uid)
      .order("created_at", { ascending: false });

    if (eErr) throw new Error(eErr.message);
    const engRows = engagements ?? [];
    if (engRows.length === 0) return [];

    const engIds = engRows.map((e: any) => e.id);
    const { data: visits, error: vErr } = await sb
      .from("nursing_visits")
      .select("id, engagement_id, visit_date, status, assigned_nurse_id, seq, payout_amount")
      .in("engagement_id", engIds)
      .order("visit_date", { ascending: false });

    if (vErr) throw new Error(vErr.message);
    const visitRows = visits ?? [];

    const nurseIds = Array.from(new Set(visitRows.map((v: any) => v.assigned_nurse_id).filter(Boolean)));
    const nurseMap = new Map<string, string>();
    if (nurseIds.length) {
      const { data: nurses } = await sb.from("nurses").select("user_id, full_name").in("user_id", nurseIds);
      (nurses ?? []).forEach((n: any) => nurseMap.set(n.user_id, n.full_name));
    }

    const engMap = new Map(engRows.map((e: any) => [e.id, e]));

    return visitRows.map((v: any) => {
      const eng = engMap.get(v.engagement_id);
      return {
        id: v.id,
        engagementId: v.engagement_id,
        kind: eng?.kind ?? "Nursing",
        kindLabel: NURSE_SKILL_LABEL[eng?.kind] ?? eng?.kind ?? "Nursing",
        area: eng?.address_snapshot?.split(",")[0] ?? "Koregaon Park",
        city: "Pune",
        scheduledAt: v.visit_date,
        status: v.status,
        nurseName: v.assigned_nurse_id ? (nurseMap.get(v.assigned_nurse_id) ?? "Nurse Assigned") : null,
        fee: v.payout_amount ? Number(v.payout_amount) : eng?.day_rate ? Number(eng.day_rate) : null,
        seq: v.seq,
        totalDays: eng?.days_scheduled ?? 1,
      };
    });
  });

export const bookNursingVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    kind: string;
    days: number;
    startDate: string;
    slotTime?: string | null;
    address?: string | null;
    fee?: number | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", uid)
      .maybeSingle();

    const { data: eng, error } = await sb.rpc("create_nursing_engagement", {
      p_days: data.days,
      p_start_date: data.startDate,
      p_slot_time: data.slotTime || null,
      p_kind: data.kind,
      p_address: data.address || "Koregaon Park, Pune",
    });

    if (error) throw new Error(error.message);
    return { ok: true, engagementId: eng.id };
  });

export const cancelNursingVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string; reason?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.rpc("cancel_nursing_visit_by_family", {
      p_visit_id: data.visitId,
      p_reason: data.reason || null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
