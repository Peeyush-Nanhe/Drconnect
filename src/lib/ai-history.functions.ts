import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type Kind = "triage" | "report" | "voice";

function makeToken() {
  // 24-char URL-safe token
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export const saveAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { kind: Kind; title: string; payload: unknown }) => {
    if (!d || (d.kind !== "triage" && d.kind !== "report" && d.kind !== "voice")) {
      throw new Error("invalid kind");
    }
    const title = String(d.title || "Untitled").slice(0, 200);
    return { kind: d.kind, title, payload: d.payload ?? {} };
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_history")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        title: data.title,
        payload: data.payload as any,
      })
      .select("id, kind, title, created_at, share_token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listAiHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_history")
      .select("id, kind, title, created_at, share_token")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
  });

export const getAiHistoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id required");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ai_history")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const toggleShareAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; share: boolean }) => {
    if (!d?.id) throw new Error("id required");
    return { id: d.id, share: !!d.share };
  })
  .handler(async ({ data, context }) => {
    const token = data.share ? makeToken() : null;
    const { data: row, error } = await context.supabase
      .from("ai_history")
      .update({ share_token: token })
      .eq("id", data.id)
      .select("id, share_token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAiHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("id required");
    return { id: d.id };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ai_history").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public: read a shared item by token. No auth required.
export const getSharedAiHistory = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => {
    if (!d?.token || typeof d.token !== "string") throw new Error("token required");
    return { token: d.token.slice(0, 128) };
  })
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const isNew = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (isNew && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: row, error } = await supabase
      .from("ai_history")
      .select("kind, title, payload, created_at")
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Shared item not found or link revoked.");
    return row;
  });
