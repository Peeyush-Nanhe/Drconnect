import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyTechnicianVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = context.userId;

    const { data, error } = await sb
      .from("technician_visits")
      .select("*")
      .eq("patient_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const bookTechnicianVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    testType: string;
    scheduledAt?: string | null;
    notes?: string | null;
    fee?: number | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;

    // Get patient name
    const { data: profile } = await sb
      .from("profiles")
      .select("full_name")
      .eq("id", uid)
      .maybeSingle();

    const { data: visit, error } = await sb
      .from("technician_visits")
      .insert({
        patient_id: uid,
        patient_name: profile?.full_name ?? "Patient",
        test_type: data.testType,
        scheduled_at: data.scheduledAt ?? null,
        urgency: data.scheduledAt ? "scheduled" : "now",
        fee: data.fee ?? null,
        notes: data.notes ?? null,
        // Hardcoded location for testing
        lat: 18.5362,
        lng: 73.8930,
        area: "Koregaon Park",
        city: "Pune",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return { ok: true, visitId: visit.id };
  });
