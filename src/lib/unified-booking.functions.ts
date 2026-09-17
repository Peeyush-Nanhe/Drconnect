import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server layer for the unified booking rail (handover section 8).
 *
 * Every function here is a thin wrapper over a SECURITY DEFINER database
 * function. That is deliberate: race safety, the privacy projection and the
 * matching settings all have to hold when the endpoint is called directly, so
 * none of them can live in this file or in the UI.
 *
 * The caller's own session is used rather than the service key wherever the
 * database already enforces the rule, so a bug here cannot widen access.
 */

type Db = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
  from: (t: string) => any;
};

/** The database prefixes its errors with a stable code; surface the sentence. */
function rethrow(error: { message?: string } | null): never | void {
  if (!error) return;
  const m = error.message ?? "Something went wrong.";
  throw new Error(m.replace(/^[A-Z_]+:\s*/, ""));
}

const one = <T,>(data: T | T[] | null): T | null =>
  Array.isArray(data) ? (data[0] ?? null) : (data ?? null);

// ============================================================ patient side ==

export const createUnifiedBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    serviceType: string;
    providerRole: "nurse" | "technician" | "physiotherapist" | "care_physician" | "ambulance";
    title: string;
    serviceCode?: string | null;
    description?: string | null;
    priority?: "routine" | "urgent" | "emergency";
    visitMode?: "home" | "clinic" | "hospital" | "hub";
    scheduledFor?: string | null;
    durationMinutes?: number;
    estimatedEarnings?: number;
    address?: string | null;
    area?: string | null;
    city?: string;
    lat?: number | null;
    lng?: number | null;
    metadata?: Record<string, unknown>;
  }) => {
    if (!input?.title?.trim()) throw new Error("Describe what you need");
    if (!input.providerRole) throw new Error("Choose who should come");
    if (input.title.length > 200) throw new Error("Keep the title under 200 characters");
    if (input.description && input.description.length > 2000) {
      throw new Error("Keep the description under 2000 characters");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("server_create_unified_booking", {
      p_service_type: data.serviceType,
      p_provider_role: data.providerRole,
      p_title: data.title.trim(),
      p_service_code: data.serviceCode ?? null,
      p_description: data.description?.trim() || null,
      p_priority: data.priority ?? "routine",
      p_visit_mode: data.visitMode ?? "home",
      p_scheduled_for: data.scheduledFor ?? null,
      p_duration_minutes: data.durationMinutes ?? 60,
      p_estimated_earnings: data.estimatedEarnings ?? 0,
      p_address: data.address?.trim() || null,
      p_area: data.area?.trim() || null,
      p_city: data.city ?? "Pune",
      p_lat: data.lat ?? null,
      p_lng: data.lng ?? null,
      p_metadata: data.metadata ?? {},
    });
    rethrow(error);
    return one(row);
  });

export const getPatientBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Db;
    const { data, error } = await sb
      .from("unified_bookings")
      .select("*")
      .eq("patient_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    rethrow(error);
    return data ?? [];
  });

export const getBookingTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: rows, error } = await sb
      .from("booking_status_history")
      .select("status, note, created_at")
      .eq("booking_id", data.bookingId)
      .order("created_at", { ascending: true });
    rethrow(error);
    return rows ?? [];
  });

export const retryBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("server_retry_unified_booking", {
      p_booking_id: data.bookingId,
    });
    rethrow(error);
    return one(row);
  });

export const submitBookingReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    bookingId: string; overall: number;
    quality?: number; punctuality?: number; professionalism?: number;
    communication?: number; wouldRecommend?: boolean; comment?: string;
  }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    if (!Number.isInteger(input.overall) || input.overall < 1 || input.overall > 5) {
      throw new Error("Give a rating between 1 and 5");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("server_submit_unified_booking_review", {
      p_booking_id: data.bookingId,
      p_overall: data.overall,
      p_quality: data.quality ?? null,
      p_punctuality: data.punctuality ?? null,
      p_professionalism: data.professionalism ?? null,
      p_communication: data.communication ?? null,
      p_would_recommend: data.wouldRecommend ?? null,
      p_comment: data.comment?.trim() || null,
    });
    rethrow(error);
    return one(row);
  });

export const reportBookingIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; category: string; details?: string }) => {
    if (!input?.bookingId || !input.category) throw new Error("Tell us what went wrong");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { error } = await sb.from("booking_issues").insert({
      booking_id: data.bookingId,
      reporter_id: context.userId,
      category: data.category,
      details: data.details?.trim() || null,
    });
    rethrow(error);
    return { ok: true };
  });

// ============================================================ staff side ====

/**
 * Pending offers only, and only the fields a pending offer is allowed to
 * carry. The projection is the database function's, not this file's: calling
 * the endpoint directly returns exactly the same columns.
 */
export const getProviderOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Db;
    const { data, error } = await sb.rpc("list_my_booking_offers");
    rethrow(error);
    return data ?? [];
  });

export const acceptOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("server_accept_unified_booking_offer", {
      p_booking_id: data.bookingId,
    });
    rethrow(error);
    return one(row);
  });

export const declineOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; reason?: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { error } = await sb.rpc("server_decline_unified_booking_offer", {
      p_booking_id: data.bookingId,
      p_reason: data.reason?.trim() || null,
    });
    rethrow(error);
    return { ok: true };
  });

/** Full details, released only to the person who actually accepted. */
export const getAssignedBooking = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("get_my_assigned_booking", {
      p_booking_id: data.bookingId,
    });
    rethrow(error);
    return row;
  });

export const transitionBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; status: string; note?: string }) => {
    const allowed = ["en_route", "arrived", "in_progress", "completed"];
    if (!input?.bookingId) throw new Error("bookingId is required");
    if (!allowed.includes(input.status)) throw new Error("That is not a stage you can set");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("server_transition_unified_booking", {
      p_booking_id: data.bookingId,
      p_status: data.status,
      p_note: data.note?.trim() || null,
    });
    rethrow(error);
    return one(row);
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; reason?: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("server_cancel_unified_booking", {
      p_booking_id: data.bookingId,
      p_reason: data.reason?.trim() || null,
    });
    rethrow(error);
    return one(row);
  });

export const getMyReliability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Db;
    const [score, events] = await Promise.all([
      sb.rpc("provider_reliability_score", { p_provider_id: context.userId }),
      sb.from("provider_reliability_events")
        .select("event_type, score_delta, note, created_at")
        .eq("provider_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    rethrow(score.error);
    return { score: score.data ?? 80, events: events.data ?? [] };
  });

// ============================================================== tracking ====

export const shareProviderLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string; lat: number; lng: number; accuracyM?: number }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    if (typeof input.lat !== "number" || typeof input.lng !== "number") {
      throw new Error("A latitude and longitude are required");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { error } = await sb.rpc("set_provider_live_location", {
      p_booking_id: data.bookingId,
      p_lat: data.lat,
      p_lng: data.lng,
      p_accuracy_m: data.accuracyM ?? null,
    });
    rethrow(error);
    return { ok: true };
  });

export const getBookingLiveTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bookingId: string }) => {
    if (!input?.bookingId) throw new Error("bookingId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("get_booking_live_tracks", {
      p_booking_id: data.bookingId,
    });
    rethrow(error);
    return row ?? { shared: false };
  });

// ================================================== hospital / clinic / hub ==

export const postFacilityNurseDuty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    facilityId: string; skill: string; shift: string; startAt: string;
    hours: number; pay: number; urgency?: string; area?: string; city?: string;
  }) => {
    if (!input?.facilityId) throw new Error("Choose the hospital, clinic or hub");
    if (!input.skill) throw new Error("Choose the skill the duty needs");
    if (!input.startAt || Number.isNaN(new Date(input.startAt).getTime())) {
      throw new Error("Choose a valid start time");
    }
    if (!Number.isInteger(input.hours) || input.hours < 1 || input.hours > 24) {
      throw new Error("A duty runs between 1 and 24 hours");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("post_facility_nurse_duty", {
      p_facility_id: data.facilityId,
      p_skill: data.skill,
      p_shift: data.shift,
      p_start: new Date(data.startAt).toISOString(),
      p_hours: data.hours,
      p_pay: data.pay,
      p_urgency: data.urgency ?? "routine",
      p_area: data.area ?? null,
      p_city: data.city ?? "Pune",
    });
    rethrow(error);
    return one(row);
  });

export const getFacilityNurseDuties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { facilityId: string }) => {
    if (!input?.facilityId) throw new Error("facilityId is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: rows, error } = await sb
      .from("unified_bookings")
      .select("*")
      .eq("owner_facility_id", data.facilityId)
      .eq("service_type", "nurse_duty")
      .order("created_at", { ascending: false })
      .limit(100);
    rethrow(error);
    return rows ?? [];
  });

// ================================================================== admin ===
// The role is re-checked inside each database function. The check here is so
// the console fails early with a readable message, not as the security border.

export const getUnifiedBookingOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as unknown as Db;
    const [settings, queue, offers, issues] = await Promise.all([
      sb.from("booking_matching_settings").select("*").eq("id", 1).maybeSingle(),
      sb.from("unified_bookings").select("*")
        .in("status", ["requested", "searching", "expanded", "offered", "accepted",
          "en_route", "arrived", "in_progress"])
        .order("created_at", { ascending: false }).limit(200),
      sb.from("booking_offers").select("*")
        .order("offered_at", { ascending: false }).limit(300),
      sb.from("booking_issues").select("*")
        .order("created_at", { ascending: false }).limit(100),
    ]);
    rethrow(settings.error);

    // Response time per offer, which is what tells you whether the roster is
    // actually awake rather than merely online.
    const offerRows = (offers.data ?? []) as any[];
    const responded = offerRows.filter(o => o.responded_at);
    const avgSeconds = responded.length
      ? Math.round(responded.reduce((n, o) =>
        n + (new Date(o.responded_at).getTime() - new Date(o.offered_at).getTime()) / 1000, 0)
        / responded.length)
      : null;

    return {
      settings: settings.data ?? null,
      queue: queue.data ?? [],
      offers: offerRows,
      issues: issues.data ?? [],
      offerStats: {
        total: offerRows.length,
        accepted: offerRows.filter(o => o.status === "accepted").length,
        declined: offerRows.filter(o => o.status === "declined").length,
        expired: offerRows.filter(o => o.status === "expired").length,
        averageResponseSeconds: avgSeconds,
      },
    };
  });

export const updateMatchingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Record<string, number>) => {
    const allowed = ["initial_radius_km", "expansion_step_km", "expansion_interval_minutes",
      "max_radius_km", "offer_expiry_minutes", "minimum_reliability_score",
      "max_active_jobs", "provider_cancellation_penalty", "late_arrival_penalty",
      "no_show_penalty"];
    const patch: Record<string, number> = {};
    for (const [k, v] of Object.entries(input ?? {})) {
      if (allowed.includes(k) && Number.isFinite(Number(v))) patch[k] = Number(v);
    }
    if (Object.keys(patch).length === 0) throw new Error("Nothing to change");
    return patch;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: row, error } = await sb.rpc("admin_update_matching_settings", { p_patch: data });
    rethrow(error);
    return one(row);
  });

export const adjustProviderReliability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { providerId: string; delta: number; reason: string }) => {
    if (!input?.providerId) throw new Error("providerId is required");
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new Error("Enter how many points to add or take away");
    }
    if (!input.reason?.trim()) throw new Error("Write why you are changing this score");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = context.supabase as unknown as Db;
    const { data: score, error } = await sb.rpc("admin_adjust_provider_reliability", {
      p_provider_id: data.providerId,
      p_delta: data.delta,
      p_reason: data.reason.trim(),
    });
    rethrow(error);
    return { score };
  });

/**
 * Scheduled matching (section 7.5). Runs as the service role, so the trigger
 * must stay behind a shared secret read inside the handler, never at module
 * scope. Point an external scheduler or pg_cron at this.
 */
export const runMatchingTick = createServerFn({ method: "POST" })
  .inputValidator((input: { secret: string }) => {
    if (!input?.secret) throw new Error("Unauthorized");
    return input;
  })
  .handler(async ({ data }) => {
    const expected = process.env.MATCHING_TICK_SECRET;
    if (!expected || data.secret !== expected) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as unknown as Db;
    const { data: out, error } = await sb.rpc("unified_booking_tick");
    rethrow(error);
    return out ?? { offers_created: 0, offers_expired: 0 };
  });
