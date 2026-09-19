import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TECHNICIAN_TEST_LABEL } from "@/lib/care-staff-catalog";

export type PatientTechnicianVisit = {
  id: string;
  testType: string;
  testLabel: string;
  area: string;
  city: string;
  address: string | null;
  scheduledAt: string | null;
  status: string;
  urgency: string;
  checkedInAt: string | null;
  completedAt: string | null;
  fee: number | null;
  notes: string | null;
  findings: string | null;
  technicianName: string | null;
};

export const getMyTechnicianVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PatientTechnicianVisit[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = context.userId;

    const { data: visits, error } = await sb
      .from("technician_tests")
      .select("id, test_type, test_label, area, city, scheduled_at, urgency, status, checked_in_at, completed_at, fee, notes, findings, technician_id")
      .eq("patient_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    const rows = visits ?? [];
    if (rows.length === 0) return [];

    const techIds = Array.from(new Set(rows.map((r: any) => r.technician_id).filter(Boolean)));
    const nameMap = new Map<string, string>();
    if (techIds.length) {
      const { data: techs } = await sb.from("technicians").select("id, full_name").in("id", techIds);
      (techs ?? []).forEach((t: any) => nameMap.set(t.id, t.full_name));
    }

    return rows.map((r: any) => ({
      id: r.id,
      testType: r.test_type,
      testLabel: r.test_label ?? TECHNICIAN_TEST_LABEL[r.test_type] ?? r.test_type,
      area: r.area,
      city: r.city,
      address: null, // technician_tests table doesn't have address column currently
      scheduledAt: r.scheduled_at,
      status: r.status,
      urgency: r.urgency,
      checkedInAt: r.checked_in_at,
      completedAt: r.completed_at,
      fee: r.fee ? Number(r.fee) : null,
      notes: r.notes,
      findings: r.findings,
      technicianName: r.technician_id ? (nameMap.get(r.technician_id) ?? null) : null,
    }));
  });

export const bookTechnicianVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    testType: string;
    area: string;
    city: string;
    scheduledAt?: string | null;
    notes?: string | null;
    fee?: number | null;
    urgency?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", uid)
      .maybeSingle();

    const { data: visit, error } = await sb
      .from("technician_tests")
      .insert({
        patient_id: uid,
        patient_name: profile?.full_name ?? "Patient",
        test_type: data.testType,
        test_label: TECHNICIAN_TEST_LABEL[data.testType] ?? data.testType,
        area: data.area,
        city: data.city,
        scheduled_at: data.scheduledAt ?? null,
        urgency: data.urgency || (data.scheduledAt ? "planned" : "urgent"),
        fee: data.fee ?? null,
        notes: data.notes ?? null,
        status: "requested",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, visitId: visit.id };
  });

export const cancelTechnicianVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string; reason?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb
      .from("technician_tests")
      .update({ status: "cancelled", notes: data.reason ? `Cancelled: ${data.reason}` : "Cancelled" })
      .eq("id", data.visitId)
      .eq("patient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
