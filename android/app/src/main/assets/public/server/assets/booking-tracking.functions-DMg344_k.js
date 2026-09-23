import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/booking-tracking.functions.ts?tss-serverfn-split
async function adminClient() {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	return supabaseAdmin;
}
function haversineKm(lat1, lng1, lat2, lng2) {
	const toRad = (value) => value * Math.PI / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
var SPEED_KMPH = {
	ambulance: 34,
	physiotherapist: 22,
	nurse: 20,
	technician: 20,
	care_physician: 24,
	hospital: 24
};
var shareProviderLocation_createServerFn_handler = createServerRpc({
	id: "060c918c7419996da5c9dffd2f70d0ad353eaa048e4782db830ad373ba87a7ca",
	name: "shareProviderLocation",
	filename: "src/lib/booking-tracking.functions.ts"
}, (opts) => shareProviderLocation.__executeServer(opts));
var shareProviderLocation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => {
	if (!input || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) throw new Error("Location is required");
	if (input.lat < -90 || input.lat > 90 || input.lng < -180 || input.lng > 180) throw new Error("Invalid location");
	return input;
}).handler(shareProviderLocation_createServerFn_handler, async ({ data, context }) => {
	const { data: rows, error } = await (await adminClient()).rpc("set_provider_live_location", {
		_actor_id: context.userId,
		_lat: data.lat,
		_lng: data.lng
	});
	if (error) throw new Error(error.message);
	return {
		ok: true,
		updated: Number(rows ?? 0)
	};
});
var getBookingLiveTracks_createServerFn_handler = createServerRpc({
	id: "a76fae128e3cb67a90a3f06d4f7543cce269ad791cd40c0f1b259ad460560b89",
	name: "getBookingLiveTracks",
	filename: "src/lib/booking-tracking.functions.ts"
}, (opts) => getBookingLiveTracks.__executeServer(opts));
var getBookingLiveTracks = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getBookingLiveTracks_createServerFn_handler, async ({ context }) => {
	const sb = await adminClient();
	const { data: bookings, error } = await sb.from("unified_bookings").select("id, provider_role, status, assigned_provider_id, lat, lng, title").or(`patient_id.eq.${context.userId},requested_by.eq.${context.userId}`).in("status", [
		"accepted",
		"en_route",
		"arrived",
		"started"
	]).order("created_at", { ascending: false }).limit(20);
	if (error) throw new Error(error.message);
	const active = (bookings ?? []).filter((booking) => booking.assigned_provider_id);
	if (!active.length) return { tracks: [] };
	const providerIds = [...new Set(active.map((booking) => booking.assigned_provider_id))];
	const [{ data: nurses }, { data: technicians }, { data: physios }, { data: ambulances }, { data: names }] = await Promise.all([
		sb.from("nurses").select("user_id, lat, lng, last_location_at").in("user_id", providerIds),
		sb.from("technicians").select("user_id, lat, lng, last_location_at").in("user_id", providerIds),
		sb.from("physio_therapists").select("user_id, lat, lng, last_location_at").in("user_id", providerIds),
		sb.from("ambulance_units").select("owner_id, lat, lng, last_location_at").in("owner_id", providerIds),
		sb.from("profiles").select("id, full_name").in("id", providerIds)
	]);
	const pointById = /* @__PURE__ */ new Map();
	const put = (id, lat, lng, updatedAt) => {
		if (!id || lat == null || lng == null) return;
		const existing = pointById.get(id);
		if (existing && (existing.updatedAt ?? "") > (updatedAt ?? "")) return;
		pointById.set(id, {
			lat,
			lng,
			updatedAt
		});
	};
	for (const row of nurses ?? []) put(row.user_id, row.lat, row.lng, row.last_location_at);
	for (const row of technicians ?? []) put(row.user_id, row.lat, row.lng, row.last_location_at);
	for (const row of physios ?? []) put(row.user_id, row.lat, row.lng, row.last_location_at);
	for (const row of ambulances ?? []) put(row.owner_id, row.lat, row.lng, row.last_location_at);
	const nameById = new Map((names ?? []).map((profile) => [profile.id, profile.full_name]));
	return { tracks: active.map((booking) => {
		const point = pointById.get(booking.assigned_provider_id) ?? null;
		const destination = booking.lat != null && booking.lng != null ? {
			lat: booking.lat,
			lng: booking.lng
		} : null;
		const provider = point && point.lat != null && point.lng != null ? {
			lat: point.lat,
			lng: point.lng,
			updatedAt: point.updatedAt
		} : null;
		const distanceKm = destination && provider ? Number(haversineKm(provider.lat, provider.lng, destination.lat, destination.lng).toFixed(2)) : null;
		const speed = SPEED_KMPH[booking.provider_role] ?? 22;
		return {
			bookingId: booking.id,
			role: booking.provider_role,
			status: booking.status,
			providerName: nameById.get(booking.assigned_provider_id) ?? null,
			destination,
			provider,
			distanceKm,
			etaMinutes: distanceKm == null ? null : Math.max(1, Math.round(distanceKm * 1.35 * 60 / speed))
		};
	}) };
});
var postFacilityNurseDuty_createServerFn_handler = createServerRpc({
	id: "af5b7e0438ba76ca97c727ccc9141e86cf65b4e13ffada5261c1b609487a161a",
	name: "postFacilityNurseDuty",
	filename: "src/lib/booking-tracking.functions.ts"
}, (opts) => postFacilityNurseDuty.__executeServer(opts));
var postFacilityNurseDuty = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => {
	if (!input?.hospitalId) throw new Error("Choose the hospital posting this duty");
	if (!input.skill?.trim()) throw new Error("Choose the nursing skill needed");
	if (!input.title?.trim() || input.title.trim().length > 160) throw new Error("Enter a duty title under 160 characters");
	if (input.description && input.description.length > 2e3) throw new Error("Details must be under 2,000 characters");
	if (![
		"normal",
		"urgent",
		"emergency"
	].includes(input.priority)) throw new Error("Choose a valid urgency");
	if (!Number.isFinite(input.durationMinutes) || input.durationMinutes < 30 || input.durationMinutes > 1440) throw new Error("Duty length must be between 30 minutes and 24 hours");
	if (!Number.isFinite(input.payInr) || input.payInr < 0 || input.payInr > 1e5) throw new Error("Enter a valid pay amount");
	return input;
}).handler(postFacilityNurseDuty_createServerFn_handler, async ({ data, context }) => {
	const sb = await adminClient();
	const { data: isAdmin } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "admin"
	});
	const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "super_admin"
	});
	const { data: hospital } = await sb.from("hospitals").select("id, name, area, city, lat, lng, owner_id, approval_status").eq("id", data.hospitalId).maybeSingle();
	let venue = hospital ?? null;
	if (!venue) {
		const { data: facility } = await sb.from("facilities").select("id, name, area, city, owner_id, approval_status").eq("id", data.hospitalId).maybeSingle();
		if (facility) venue = {
			...facility,
			lat: null,
			lng: null
		};
	}
	if (!venue) {
		const { data: hub } = await sb.from("hubs").select("id, name, area, lat, lng, owner_id").eq("id", data.hospitalId).maybeSingle();
		if (hub) venue = {
			...hub,
			city: null,
			approval_status: "approved"
		};
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
		_metadata: {
			shift: data.shift,
			hospitalName: hospitalRow.name,
			postedByFacility: true
		}
	});
	if (error) throw new Error(error.message);
	return booking;
});
var getFacilityNurseDuties_createServerFn_handler = createServerRpc({
	id: "c36fd4889d6522013b8958b4d176f56f9d3900a0891610b8d5307724ff78e6cb",
	name: "getFacilityNurseDuties",
	filename: "src/lib/booking-tracking.functions.ts"
}, (opts) => getFacilityNurseDuties.__executeServer(opts));
var getFacilityNurseDuties = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getFacilityNurseDuties_createServerFn_handler, async ({ context }) => {
	const sb = await adminClient();
	const { data: isAdmin } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "admin"
	});
	const { data: isSuperAdmin } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "super_admin"
	});
	const seeAll = Boolean(isAdmin || isSuperAdmin);
	const hospitalQuery = sb.from("hospitals").select("id, name, area, city, approval_status").order("name");
	const facilityQuery = sb.from("facilities").select("id, name, area, city, approval_status").in("kind", [
		"hub",
		"hospital",
		"clinic"
	]).order("name");
	const [{ data: hospitalRows }, { data: facilityRows }] = await Promise.all([seeAll ? hospitalQuery : hospitalQuery.eq("owner_id", context.userId), seeAll ? facilityQuery : facilityQuery.eq("owner_id", context.userId)]);
	const hubQuery = sb.from("hubs").select("id, name, area").order("name");
	const { data: hubRows } = await (seeAll ? hubQuery : hubQuery.eq("owner_id", context.userId));
	const hospitals = [
		...hospitalRows ?? [],
		...facilityRows ?? [],
		...(hubRows ?? []).map((hub) => ({
			...hub,
			city: null,
			approval_status: "approved"
		}))
	];
	const ids = (hospitals ?? []).map((hospital) => hospital.id);
	if (!ids.length) return {
		hospitals: [],
		duties: [],
		offers: [],
		nameById: {}
	};
	const { data: duties, error } = await sb.from("unified_bookings").select("*").eq("service_type", "nurse_duty").in("preferred_facility_id", ids).order("created_at", { ascending: false }).limit(60);
	if (error) throw new Error(error.message);
	const dutyIds = (duties ?? []).map((duty) => duty.id);
	const [{ data: offers }, { data: names }] = await Promise.all([dutyIds.length ? sb.from("booking_offers").select("id, booking_id, provider_id, status, distance_km, offered_at, responded_at").in("booking_id", dutyIds) : Promise.resolve({ data: [] }), sb.from("profiles").select("id, full_name").in("id", [...new Set((duties ?? []).map((duty) => duty.assigned_provider_id).filter((id) => Boolean(id)))].concat(["00000000-0000-0000-0000-000000000000"]))]);
	return {
		hospitals: hospitals ?? [],
		duties: duties ?? [],
		offers: offers ?? [],
		nameById: Object.fromEntries((names ?? []).map((profile) => [profile.id, profile.full_name ?? "Nurse"]))
	};
});
//#endregion
export { getBookingLiveTracks_createServerFn_handler, getFacilityNurseDuties_createServerFn_handler, postFacilityNurseDuty_createServerFn_handler, shareProviderLocation_createServerFn_handler };
