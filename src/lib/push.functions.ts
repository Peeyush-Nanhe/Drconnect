import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PLATFORMS = ["android", "ios", "web"] as const;
const PROVIDERS = ["fcm", "apns", "expo", "webpush"] as const;

type RegisterInput = {
  token: string;
  platform: (typeof PLATFORMS)[number];
  provider?: (typeof PROVIDERS)[number];
  device_id?: string | null;
  app_version?: string | null;
  locale?: string | null;
};

/** Register (or refresh) the current user's push token for this device. */
export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: RegisterInput) => {
    if (!data || typeof data !== "object") throw new Error("invalid input");
    if (!data.token || typeof data.token !== "string" || data.token.length > 4096)
      throw new Error("token required");
    if (!PLATFORMS.includes(data.platform)) throw new Error("invalid platform");
    if (data.provider && !PROVIDERS.includes(data.provider))
      throw new Error("invalid provider");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const provider = data.provider ?? "fcm";

    const { data: row, error } = await supabase
      .from("device_tokens")
      .upsert(
        {
          user_id: userId,
          token: data.token,
          platform: data.platform,
          provider,
          device_id: data.device_id ?? null,
          app_version: data.app_version ?? null,
          locale: data.locale ?? null,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "provider,token" },
      )
      .select("id, platform, provider, enabled")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

/** Disable a push token (sign-out, notification opt-out, device removed). */
export const unregisterDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => {
    if (!data?.token || typeof data.token !== "string") throw new Error("token required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("device_tokens")
      .update({ enabled: false })
      .eq("user_id", userId)
      .eq("token", data.token);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Recent push deliveries for the signed-in user (RLS scoped). */
export const listMyPushDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("push_deliveries")
      .select("id, title, body, data, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
