import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const [{ data: isAdmin, error: adminError }, { data: isSuper, error: superError }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" }),
  ]);
  if (adminError) throw new Error(adminError.message);
  if (superError) throw new Error(superError.message);
  if (!isAdmin && !isSuper) throw new Error("Forbidden: admin only");
}

export const getCarePhysicianVerificationQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: profiles, error } = await sb
      .from("care_physician_profiles")
      .select("*")
      .order("registration_verified", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = [...new Set((profiles ?? []).map((row: any) => row.user_id))];
    const identityRes = ids.length
      ? await sb.from("profiles").select("id, full_name, specialty").in("id", ids)
      : { data: [], error: null };
    if (identityRes.error) throw new Error(identityRes.error.message);
    const identities = new Map((identityRes.data ?? []).map((row: any) => [row.id, row]));

    return (profiles ?? []).map((row: any) => {
      const identity: any = identities.get(row.user_id) ?? {};
      return {
        ...row,
        full_name: identity.full_name ?? "Care physician",
        primary_specialty: identity.specialty ?? null,
      };
    });
  });

export const setCarePhysicianRegistrationVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; verified: boolean }) => {
    if (!input?.userId) throw new Error("userId is required");
    return { userId: input.userId, verified: Boolean(input.verified) };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("care_physician_profiles")
      .update({
        registration_verified: data.verified,
        verified_at: data.verified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
