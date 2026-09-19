import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getTechnicianOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = context.userId;

    // Fetch open requests or requests assigned to this tech
    const { data, error } = await sb
      .from("technician_visits")
      .select("*")
      .or(`status.eq.requested,technician_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const acceptTechnicianVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const { data: updated, error } = await sb
      .from("technician_visits")
      .update({
        technician_id: uid,
        status: "assigned",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.visitId)
      .eq("status", "requested") // Ensure still open
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Job no longer available or already taken.");

    return { ok: true };
  });

export const advanceTechnicianStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { visitId: string, status: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const uid = context.userId;

    const { error } = await sb
      .from("technician_visits")
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.visitId)
      .eq("technician_id", uid);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
