import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Road distance is longer than a straight line, and an ambulance moves faster
// than a therapist on a scooter, so each role gets its own rough speed.
const SPEED_KMPH: Record<string, number> = { ambulance: 34, physiotherapist: 22, nurse: 20, technician: 20, care_physician: 24, hospital: 24 };

export const shareProviderLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { lat: number; lng: number }) => {
    if (!input || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new Error("Location is required");
    if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) throw new Error("Invalid location");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = await adminClient();
    const { data: rows, error } = await sb.rpc("set_provider_live_location", { _actor_id: context.userId, _lat: data.lat, _lng: data.lng });
    if (error) throw new Error(error.message);
    return { ok: true, updated: Number(rows ?? 0) };
  });

export type LiveTrack = {
  bookingId: string;
  role: string;
  status: string;
  providerName: string | null;
  destination: { lat: number; lng: number } | null;
  provider: { lat: number; lng: number; updatedAt: string | null } | null;
  distanceKm: number | null;
  etaMinutes: number | null;
};

export const getBookingLiveTracks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await adminClient();
    const { data: bookings, error } = await sb
      .from("unified_bookings")
      .select("id, provider_role, status, assigned_provider_id, lat, lng, title")
      .or(`patient_id.eq.${context.userId},requested_by.eq.${context.userId}`)
      .in("status", ["accepted", "en_route", "arrived", "started"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const active = ((bookings ?? []) as any[]).filter((booking: any) => booking.assigned_provider_id);
    if (!active.length) return { tracks: [] as LiveTrack[] };
    const providerIds = [...new Set(active.map((booking: any) => booking.assigned_provider_id as string))];
    const [{ data: nurses }, { data: technicians }, { data: physios }, { data: ambulances }, { data: names }] = await Promise.all([
      sb.from("nurses").select("user_id, lat, lng, last_location_at").in("user_id", providerIds),
      sb.from("technicians").select("user_id, lat, lng, last_location_at").in("user_id", providerIds),
      sb.from("physio_therapists").select("user_id, lat, lng, last_location_at").in("user_id", providerIds),
      sb.from("ambulance_units").select("owner_id, lat, lng, last_location_at").in("owner_id", providerIds),
      sb.from("profiles").select("id, full_name").in("id", providerIds),
    ]);
    const pointById = new Map<string, { lat: number | null; lng: number | null; updatedAt: string | null }>();
    const put = (id: string | null, lat: number | null, lng: number | null, updatedAt: string | null) => {
      if (!id || lat == null || lng == null) return;
      const existing = pointById.get(id);
      if (existing && (existing.updatedAt ?? "") > (updatedAt ?? "")) return;
      pointById.set(id, { lat, lng, updatedAt });
    };
    for (const row of ((nurses ?? []) as any[])) put(row.user_id, row.lat, row.lng, row.last_location_at);
    for (const row of ((technicians ?? []) as any[])) put(row.user_id, row.lat, row.lng, row.last_location_at);
    for (const row of ((physios ?? []) as any[])) put(row.user_id, row.lat, row.lng, row.last_location_at);
    for (const row of ((ambulances ?? []) as any[])) put(row.owner_id, row.lat, row.lng, row.last_location_at);
    const nameById = new Map(((names ?? []) as any[]).map((profile: any) => [profile.id, profile.full_name]));

    const tracks: LiveTrack[] = active.map((booking: any) => {
      const point = pointById.get(booking.assigned_provider_id as string) ?? null;
      const destination = booking.lat != null && booking.lng != null ? { lat: booking.lat, lng: booking.lng } : null;
      const provider = point && point.lat != null && point.lng != null ? { lat: point.lat, lng: point.lng, updatedAt: point.updatedAt } : null;
      const distanceKm = destination && provider ? Number(haversineKm(provider.lat, provider.lng, destination.lat, destination.lng).toFixed(2)) : null;
      const speed = SPEED_KMPH[booking.provider_role] ?? 22;
      return {
        bookingId: booking.id,
        role: booking.provider_role,
        status: booking.status,
        providerName: nameById.get(booking.assigned_provider_id as string) ?? null,
        destination,
        provider,
        distanceKm,
        etaMinutes: distanceKm == null ? null : Math.max(1, Math.round((distanceKm * 1.35 * 60) / speed)),
      };
    });
    return { tracks };
  });

export type FacilityDutyInput = {
  hospitalId: string;
  skill: string;
  title: string;
  description?: string;
  shift: string;
  scheduledFor?: string;
  durationMinutes: number;
  payInr: number;
  priority: "normal" | "urgent" | "emergency";
};

export const postFacilityNurseDuty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: FacilityDutyInput) => {
    if (!input?.hospitalId) throw new Error("Choose the hospital posting this duty");
    if (!input.skill?.trim()) throw new Error("Choose the nursing skill needed");
    if (!input.title?.trim() || input.title.trim().length > 160) throw new Error("Enter a duty title under 160 characters");
    if (input.description && input.description.length > 2000) throw new Error("Details must be under 2,000 characters");
    if (!["normal", "urgent", "emergency"].includes(input.priority)) throw new Error("Choose a valid urgency");
    if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 24 * 60) throw new Error("Duty length must be between 30 minutes and 24 hours");
    if (!Number.isFinite(input.payInr) || input.payInr < 0 || input.payInr > 100000) throw new Error("Enter a valid pay amount");
    return input;
  })
  .handler(async ({ data, context }) => {
    const sb = await adminClient();
    const { data: isAdmin } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuperAdmin } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "super_admin" });

    // A duty can be posted by a hospital or by a hub/clinic facility.
    const { data: hospital } = await sb
      .from("hospitals")
      .select("id, name, area, city, lat, lng, owner_id, approval_status")
      .eq("id", data.hospitalId)
      .maybeSingle();
    let venue: { id: string; name: string; area: string | null; city: string | null; lat: number | null; lng: number | null; owner_id: string | null; approval_status: string | null } | null = hospital ?? null;
    if (!venue) {
      const { data: facility } = await sb
        .from("facilities")
        .select("id, name, area, city, owner_id, approval_status")
        .eq("id", data.hospitalId)
        .maybeSingle();
      if (facility) venue = { ...facility, lat: null, lng: null };
    }
    if (!venue) {
      const { data: hub } = await sb
        .from("hubs")
        .select("id, name, area, lat, lng, owner_id")
        .eq("id", data.hospitalId)
        .maybeSingle();
      if (hub) venue = { ...hub, city: null, approval_status: "approved" };
    }
    if (!venue) throw new Error("Hospital or clinic not found");
    if (venue.owner_id !== context.userId && !isAdmin && !isSuperAdmin) throw new Error("Only this hospital's account can post its duties");
    if (venue.approval_status !== "approved" && !isSuperAdmin) throw new Error("This hospital is waiting for approval before it can post duties");
    const hospitalRow = venue;

    const { data: booking, error } = await sb.rpc("server_create_unified_booking", {
      _actor_id: context.userId,
      _service_type: "nurse_duty",
      _provider_role: "nurse",
      _service_code: data.skill.trim(),
      _title: data.title.trim(),
      _description: data.description?.trim() || null,
      _priority: data.priority,
      _visit_mode: "facility",
      _scheduled_for: data.scheduledFor || null,
      _duration_minutes: Math.round(data.durationMinutes),
      _estimated_earnings: Math.round(data.payInr),
      _address: `${hospitalRow.name}${hospitalRow.area ? `, ${hospitalRow.area}` : ""}`,
      _area: hospitalRow.area || null,
      _city: hospitalRow.city || null,
      _lat: hospitalRow.lat ?? null,
      _lng: hospitalRow.lng ?? null,
      _preferred_facility_id: hospitalRow.id,
      _metadata: { shift: data.shift, hospitalName: hospitalRow.name, postedByFacility: true },
    } as never);
    if (error) throw new Error(error.message);
    return booking;
  });

export const getFacilityNurseDuties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await adminClient();
    const { data: isAdmin } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isSuperAdmin } = await (context.supabase as any).rpc("has_role", { _user_id: context.userId, _role: "super_admin" });
    const seeAll = Boolean(isAdmin || isSuperAdmin);
    const hospitalQuery = sb.from("hospitals").select("id, name, area, city, approval_status").order("name");
    const facilityQuery = sb.from("facilities").select("id, name, area, city, approval_status").in("kind", ["hub", "hospital", "clinic"]).order("name");
    const [{ data: hospitalRows }, { data: facilityRows }] = await Promise.all([
      seeAll ? hospitalQuery : hospitalQuery.eq("owner_id", context.userId),
      seeAll ? facilityQuery : facilityQuery.eq("owner_id", context.userId),
    ]);
    const hubQuery = sb.from("hubs").select("id, name, area").order("name");
    const { data: hubRows } = await (seeAll ? hubQuery : hubQuery.eq("owner_id", context.userId));
    const hospitals = [
      ...(hospitalRows ?? []),
      ...(facilityRows ?? []),
      ...((hubRows ?? []) as any[]).map((hub: any) => ({ ...hub, city: null, approval_status: "approved" })),
    ];
    const ids = ((hospitals ?? []) as any[]).map((hospital: any) => hospital.id);
    if (!ids.length) return { hospitals: [], duties: [], offers: [], nameById: {} as Record<string, string> };
    const { data: duties, error } = await sb
      .from("unified_bookings")
      .select("*")
      .eq("service_type", "nurse_duty")
      .in("preferred_facility_id", ids)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const dutyIds = ((duties ?? []) as any[]).map((duty: any) => duty.id);
    const [{ data: offers }, { data: names }] = await Promise.all([
      dutyIds.length ? sb.from("booking_offers").select("id, booking_id, provider_id, status, distance_km, offered_at, responded_at").in("booking_id", dutyIds) : Promise.resolve({ data: [] }),
      sb.from("profiles").select("id, full_name").in("id", [...new Set(((duties ?? []) as any[]).map((duty: any) => duty.assigned_provider_id).filter((id): id is string => Boolean(id)))].concat(["00000000-0000-0000-0000-000000000000"])),
    ]);
    return {
      hospitals: hospitals ?? [],
      duties: duties ?? [],
      offers: offers ?? [],
      nameById: Object.fromEntries(((names ?? []) as any[]).map((profile: any) => [profile.id, profile.full_name ?? "Nurse"])) as Record<string, string>,
    };
  });
