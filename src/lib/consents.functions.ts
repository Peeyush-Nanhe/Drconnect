import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = {
  booking_id: string;
  policy_version: string;
  document_text: string;
};

export const recordHomeVisitConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Input) => {
    if (!data || typeof data !== "object") throw new Error("invalid input");
    if (!data.booking_id || typeof data.booking_id !== "string")
      throw new Error("booking_id required");
    if (!data.policy_version || typeof data.policy_version !== "string")
      throw new Error("policy_version required");
    if (!data.document_text || typeof data.document_text !== "string")
      throw new Error("document_text required");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let ip: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      ip = null;
    }
    const user_agent = getRequestHeader("user-agent") ?? null;

    const { data: row, error } = await supabase
      .from("consents")
      .insert({
        user_id: userId,
        booking_kind: "care_request",
        booking_id: data.booking_id,
        consent_type: "home_visit",
        policy_version: data.policy_version,
        document_text: data.document_text,
        ip,
        user_agent,
      })
      .select("id, granted_at")
      .single();

    if (error) {
      // Unique index means a re-submit for the same booking is a no-op.
      if ((error as { code?: string }).code === "23505") {
        return { id: null, granted_at: null, duplicate: true as const };
      }
      throw new Error(error.message);
    }

    return { id: row.id, granted_at: row.granted_at, duplicate: false as const };
  });
