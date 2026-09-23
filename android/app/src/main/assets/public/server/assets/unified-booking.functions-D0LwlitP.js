import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/unified-booking.functions.ts?tss-serverfn-split
var allowedRoles = /* @__PURE__ */ new Set([
	"nurse",
	"technician",
	"care_physician",
	"hospital",
	"physiotherapist",
	"ambulance"
]);
var allowedPriorities = /* @__PURE__ */ new Set([
	"normal",
	"urgent",
	"emergency"
]);
var allowedModes = /* @__PURE__ */ new Set([
	"home",
	"facility",
	"virtual",
	"locum"
]);
var allowedTransitions = /* @__PURE__ */ new Set([
	"en_route",
	"arrived",
	"started",
	"completed",
	"disputed"
]);
function validateBooking(input) {
	if (!input || !allowedRoles.has(input.providerRole)) throw new Error("Choose a valid professional type");
	if (!allowedPriorities.has(input.priority)) throw new Error("Choose a valid priority");
	if (!allowedModes.has(input.visitMode)) throw new Error("Choose a valid visit type");
	if (!input.title?.trim() || input.title.trim().length > 160) throw new Error("Enter a service title under 160 characters");
	if (input.description && input.description.length > 2e3) throw new Error("Details must be under 2,000 characters");
	if (input.lat !== void 0 && (input.lat < -90 || input.lat > 90)) throw new Error("Invalid latitude");
	if (input.lng !== void 0 && (input.lng < -180 || input.lng > 180)) throw new Error("Invalid longitude");
	return input;
}
async function adminClient() {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	return supabaseAdmin;
}
var createUnifiedBooking_createServerFn_handler = createServerRpc({
	id: "332b06966b339fdcde0d586dd0105897cd04a425b947b2d924555ba0c0f3fad3",
	name: "createUnifiedBooking",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => createUnifiedBooking.__executeServer(opts));
var createUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(validateBooking).handler(createUnifiedBooking_createServerFn_handler, async ({ data, context }) => {
	const [{ data: patient }, { data: admin }, { data: superAdmin }] = await Promise.all([
		context.supabase.rpc("has_role", {
			_user_id: context.userId,
			_role: "patient"
		}),
		context.supabase.rpc("has_role", {
			_user_id: context.userId,
			_role: "admin"
		}),
		context.supabase.rpc("has_role", {
			_user_id: context.userId,
			_role: "super_admin"
		})
	]);
	if (!patient && !admin && !superAdmin) throw new Error("Only patient accounts can request care");
	const { data: booking, error } = await (await adminClient()).rpc("server_create_unified_booking", {
		_actor_id: context.userId,
		_service_type: data.serviceType.trim(),
		_provider_role: data.providerRole,
		_service_code: data.serviceCode?.trim() || null,
		_title: data.title.trim(),
		_description: data.description?.trim() || null,
		_priority: data.priority,
		_visit_mode: data.visitMode,
		_scheduled_for: data.scheduledFor || null,
		_duration_minutes: data.durationMinutes ?? null,
		_estimated_earnings: data.estimatedEarnings ?? null,
		_address: data.address?.trim() || null,
		_area: data.area?.trim() || null,
		_city: data.city?.trim() || "Pune",
		_lat: data.lat ?? null,
		_lng: data.lng ?? null,
		_preferred_facility_id: data.preferredFacilityId || null,
		_metadata: {}
	});
	if (error) throw new Error(error.message);
	return booking;
});
var getMyUnifiedBookingHub_createServerFn_handler = createServerRpc({
	id: "951db98fef047462dd3ad5ea77fa9095f7b480ef8c51bd9f760c6417ea61ab61",
	name: "getMyUnifiedBookingHub",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => getMyUnifiedBookingHub.__executeServer(opts));
var getMyUnifiedBookingHub = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getMyUnifiedBookingHub_createServerFn_handler, async ({ context }) => {
	const sb = await adminClient();
	const uid = context.userId;
	const { data: ownedHospitals } = await sb.from("hospitals").select("id").eq("owner_id", uid);
	const hospitalIds = (ownedHospitals ?? []).map((hospital) => hospital.id);
	const offerFilter = hospitalIds.length ? `provider_id.eq.${uid},facility_id.in.(${hospitalIds.join(",")})` : `provider_id.eq.${uid}`;
	const participantFilter = hospitalIds.length ? `patient_id.eq.${uid},assigned_provider_id.eq.${uid},requested_by.eq.${uid},assigned_facility_id.in.(${hospitalIds.join(",")}),preferred_facility_id.in.(${hospitalIds.join(",")})` : `patient_id.eq.${uid},assigned_provider_id.eq.${uid},requested_by.eq.${uid}`;
	const [{ data: participantBookings, error: bookingError }, { data: offers, error: offerError }, { data: reliability }, { data: notifications }] = await Promise.all([
		sb.from("unified_bookings").select("*").or(participantFilter).order("created_at", { ascending: false }).limit(100),
		sb.from("booking_offers").select("*").or(offerFilter).order("offered_at", { ascending: false }).limit(100),
		sb.from("provider_reliability_events").select("event_type, score_delta, created_at").eq("provider_id", uid).order("created_at", { ascending: false }).limit(100),
		sb.from("app_notifications").select("id,kind,title,body,metadata,read_at,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(50)
	]);
	if (bookingError || offerError) {
		const err = bookingError || offerError;
		if (err?.code === "PGRST205" || err?.message?.includes("schema cache") || err?.message?.includes("does not exist")) return {
			bookings: [],
			offers: [],
			notifications: [],
			reliability: {
				score: 80,
				events: []
			},
			reviews: []
		};
		if (bookingError) throw new Error(bookingError.message);
		if (offerError) throw new Error(offerError.message);
	}
	const offeredBookingIds = [...new Set((offers ?? []).map((offer) => offer.booking_id))];
	const participantIds = new Set((participantBookings ?? []).map((booking) => booking.id));
	const missingIds = offeredBookingIds.filter((id) => !participantIds.has(id));
	const { data: offeredBookings, error: offeredBookingError } = missingIds.length ? await sb.from("unified_bookings").select("*").in("id", missingIds) : {
		data: [],
		error: null
	};
	if (offeredBookingError) throw new Error(offeredBookingError.message);
	const safeOfferedBookings = (offeredBookings ?? []).map((booking) => ({
		...booking,
		patient_id: null,
		description: null,
		address: null,
		lat: null,
		lng: null,
		metadata: {}
	}));
	const bookings = [...participantBookings ?? [], ...safeOfferedBookings];
	bookings.map((booking) => booking.id);
	const participantBookingIds = (participantBookings ?? []).map((booking) => booking.id);
	const participantProviderIds = [...new Set((participantBookings ?? []).map((booking) => booking.assigned_provider_id).filter((id) => Boolean(id)))];
	const participantFacilityIds = [...new Set((participantBookings ?? []).map((booking) => booking.assigned_facility_id).filter((id) => Boolean(id)))];
	const [{ data: history }, { data: reviews }, { data: names }, { data: nurses }, { data: technicians }, { data: physicians }, { data: facilities }, { data: physios }, { data: ambulances }] = await Promise.all([
		participantBookingIds.length ? sb.from("booking_status_history").select("*").in("booking_id", participantBookingIds).order("created_at") : Promise.resolve({ data: [] }),
		participantBookingIds.length ? sb.from("booking_reviews").select("*").in("booking_id", participantBookingIds) : Promise.resolve({ data: [] }),
		bookings.length ? sb.from("profiles").select("id,full_name").in("id", [...new Set(bookings.flatMap((b) => [b.assigned_provider_id, b.patient_id]).filter((id) => Boolean(id)))]) : Promise.resolve({ data: [] }),
		participantProviderIds.length ? sb.from("nurses").select("user_id,full_name,qualification,specialty,profile_photo_url,phone").in("user_id", participantProviderIds) : Promise.resolve({ data: [] }),
		participantProviderIds.length ? sb.from("technicians").select("user_id,full_name,qualification,org,profile_photo_url,phone").in("user_id", participantProviderIds) : Promise.resolve({ data: [] }),
		participantProviderIds.length ? sb.from("provider_directory").select("id,name,specialty,registration_body,phone,rating").in("id", participantProviderIds) : Promise.resolve({ data: [] }),
		participantFacilityIds.length ? sb.from("hospitals").select("id,name,phone,specialties").in("id", participantFacilityIds) : Promise.resolve({ data: [] }),
		participantProviderIds.length ? sb.from("physio_therapists").select("user_id,full_name,qualification,specializations,phone").in("user_id", participantProviderIds) : Promise.resolve({ data: [] }),
		participantProviderIds.length ? sb.from("ambulance_units").select("owner_id,label,vehicle_type,city").in("owner_id", participantProviderIds) : Promise.resolve({ data: [] })
	]);
	const nameById = Object.fromEntries((names ?? []).map((profile) => [profile.id, profile.full_name ?? "MedConnect member"]));
	const reliabilityScore = Math.max(0, Math.min(100, 80 + (reliability ?? []).reduce((sum, event) => sum + Number(event.score_delta), 0)));
	const reviewRows = reviews ?? [];
	const completedByProvider = /* @__PURE__ */ new Map();
	for (const booking of participantBookings ?? []) if (booking.status === "completed" && booking.assigned_provider_id) completedByProvider.set(booking.assigned_provider_id, (completedByProvider.get(booking.assigned_provider_id) ?? 0) + 1);
	const ratingFor = (providerId) => {
		const providerReviews = reviewRows.filter((review) => review.reviewee_id === providerId);
		return {
			averageRating: providerReviews.length ? Number((providerReviews.reduce((sum, review) => sum + review.overall_rating, 0) / providerReviews.length).toFixed(1)) : null,
			ratingCount: providerReviews.length
		};
	};
	const providerDetails = {};
	for (const nurse of nurses ?? []) if (nurse.user_id) providerDetails[nurse.user_id] = {
		id: nurse.user_id,
		name: nurse.full_name,
		role: "nurse",
		qualification: nurse.qualification,
		specialty: nurse.specialty,
		photoUrl: nurse.profile_photo_url,
		phone: nurse.phone,
		...ratingFor(nurse.user_id),
		completedJobs: completedByProvider.get(nurse.user_id) ?? 0
	};
	for (const technician of technicians ?? []) if (technician.user_id) providerDetails[technician.user_id] = {
		id: technician.user_id,
		name: technician.full_name,
		role: "technician",
		qualification: technician.qualification,
		specialty: technician.org,
		photoUrl: technician.profile_photo_url,
		phone: technician.phone,
		...ratingFor(technician.user_id),
		completedJobs: completedByProvider.get(technician.user_id) ?? 0
	};
	for (const physician of physicians ?? []) providerDetails[physician.id] = {
		id: physician.id,
		name: physician.name,
		role: "care_physician",
		qualification: physician.registration_body,
		specialty: physician.specialty,
		photoUrl: null,
		phone: physician.phone,
		averageRating: physician.rating == null ? ratingFor(physician.id).averageRating : Number(physician.rating),
		ratingCount: ratingFor(physician.id).ratingCount,
		completedJobs: completedByProvider.get(physician.id) ?? 0
	};
	for (const facility of facilities ?? []) providerDetails[facility.id] = {
		id: facility.id,
		name: facility.name,
		role: "hospital",
		qualification: null,
		specialty: facility.specialties.join(", ") || "Hospital services",
		photoUrl: null,
		phone: facility.phone,
		averageRating: null,
		ratingCount: 0,
		completedJobs: 0
	};
	for (const physio of physios ?? []) if (physio.user_id) providerDetails[physio.user_id] = {
		id: physio.user_id,
		name: physio.full_name,
		role: "physiotherapist",
		qualification: physio.qualification,
		specialty: (physio.specializations ?? []).join(", ") || "Physiotherapy",
		photoUrl: null,
		phone: physio.phone,
		...ratingFor(physio.user_id),
		completedJobs: completedByProvider.get(physio.user_id) ?? 0
	};
	for (const unit of ambulances ?? []) if (unit.owner_id && !providerDetails[unit.owner_id]) providerDetails[unit.owner_id] = {
		id: unit.owner_id,
		name: unit.label,
		role: "ambulance",
		qualification: null,
		specialty: unit.vehicle_type ?? "Ambulance",
		photoUrl: null,
		phone: null,
		...ratingFor(unit.owner_id),
		completedJobs: completedByProvider.get(unit.owner_id) ?? 0
	};
	return {
		bookings,
		offers: offers ?? [],
		history: history ?? [],
		reviews: reviewRows,
		notifications: notifications ?? [],
		reliability: {
			score: reliabilityScore,
			events: reliability ?? []
		},
		nameById,
		providerDetails
	};
});
var acceptUnifiedOffer_createServerFn_handler = createServerRpc({
	id: "2dac4cf5c5c08a4c27c98b920dccd945943de669fcc6d86935cae745d45362d4",
	name: "acceptUnifiedOffer",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => acceptUnifiedOffer.__executeServer(opts));
var acceptUnifiedOffer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.offerId) throw new Error("Offer is required");
	return input;
}).handler(acceptUnifiedOffer_createServerFn_handler, async ({ data, context }) => {
	const { data: booking, error } = await (await adminClient()).rpc("server_accept_unified_booking_offer", {
		_actor_id: context.userId,
		_offer_id: data.offerId
	});
	if (error) throw new Error(error.message);
	return booking;
});
var declineUnifiedOffer_createServerFn_handler = createServerRpc({
	id: "1f1a7fdbc09ec28584ca610717f8271e497d24f56781273bdb63914a924a9d0a",
	name: "declineUnifiedOffer",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => declineUnifiedOffer.__executeServer(opts));
var declineUnifiedOffer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.offerId) throw new Error("Offer is required");
	return input;
}).handler(declineUnifiedOffer_createServerFn_handler, async ({ data, context }) => {
	const { error } = await (await adminClient()).rpc("server_decline_unified_booking_offer", {
		_actor_id: context.userId,
		_offer_id: data.offerId,
		_note: data.note
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var transitionUnifiedBooking_createServerFn_handler = createServerRpc({
	id: "2ea15a834436b39627bc463b89ba2696645c6b3956ebfddaaa32073b9d40ad83",
	name: "transitionUnifiedBooking",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => transitionUnifiedBooking.__executeServer(opts));
var transitionUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId || !allowedTransitions.has(input.status)) throw new Error("Invalid status change");
	return input;
}).handler(transitionUnifiedBooking_createServerFn_handler, async ({ data, context }) => {
	const { data: booking, error } = await (await adminClient()).rpc("server_transition_unified_booking", {
		_actor_id: context.userId,
		_booking_id: data.bookingId,
		_status: data.status,
		_note: data.note
	});
	if (error) throw new Error(error.message);
	return booking;
});
var cancelUnifiedBooking_createServerFn_handler = createServerRpc({
	id: "14143d2091efb7aa042b7d292c712d752fed2e89e7cfbd4505300bbf430e5b01",
	name: "cancelUnifiedBooking",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => cancelUnifiedBooking.__executeServer(opts));
var cancelUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId || !input.reason?.trim()) throw new Error("Please add a cancellation reason");
	return input;
}).handler(cancelUnifiedBooking_createServerFn_handler, async ({ data, context }) => {
	const { data: booking, error } = await (await adminClient()).rpc("server_cancel_unified_booking", {
		_actor_id: context.userId,
		_booking_id: data.bookingId,
		_reason: data.reason.trim()
	});
	if (error) throw new Error(error.message);
	return booking;
});
var retryUnifiedBooking_createServerFn_handler = createServerRpc({
	id: "350250d664f391ccc1a71e2a3ad0b01d35ae87dae5c33be1538129d147c0bc98",
	name: "retryUnifiedBooking",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => retryUnifiedBooking.__executeServer(opts));
var retryUnifiedBooking = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId) throw new Error("Booking is required");
	return input;
}).handler(retryUnifiedBooking_createServerFn_handler, async ({ data, context }) => {
	const { data: booking, error } = await (await adminClient()).rpc("server_retry_unified_booking", {
		_actor_id: context.userId,
		_booking_id: data.bookingId
	});
	if (error) throw new Error(error.message);
	return booking;
});
var submitUnifiedBookingReview_createServerFn_handler = createServerRpc({
	id: "aca68a1d0de84bcc5c14b5539ada80141f527eab0ac154fe443bcbe789f0baf3",
	name: "submitUnifiedBookingReview",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => submitUnifiedBookingReview.__executeServer(opts));
var submitUnifiedBookingReview = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.bookingId || ![
		input.overall,
		input.quality,
		input.punctuality,
		input.professionalism,
		input.communication
	].every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) throw new Error("All ratings must be between 1 and 5");
	return input;
}).handler(submitUnifiedBookingReview_createServerFn_handler, async ({ data, context }) => {
	const { data: review, error } = await (await adminClient()).rpc("server_submit_unified_booking_review", {
		_actor_id: context.userId,
		_booking_id: data.bookingId,
		_overall: data.overall,
		_quality: data.quality,
		_punctuality: data.punctuality,
		_professionalism: data.professionalism,
		_communication: data.communication,
		_would_recommend: data.wouldRecommend,
		_comment: data.comment ?? "",
		_report_issue: data.reportIssue ?? false
	});
	if (error) throw new Error(error.message);
	return review;
});
var markUnifiedNotificationsRead_createServerFn_handler = createServerRpc({
	id: "eaa766175c22b5fe8c5956b29fbe7eac3c32327b98dcfc13da7ac51c929f966c",
	name: "markUnifiedNotificationsRead",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => markUnifiedNotificationsRead.__executeServer(opts));
var markUnifiedNotificationsRead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => ({ ids: Array.isArray(input?.ids) ? input.ids.slice(0, 100) : [] })).handler(markUnifiedNotificationsRead_createServerFn_handler, async ({ data, context }) => {
	if (!data.ids.length) return { ok: true };
	const { error } = await context.supabase.from("app_notifications").update({ read_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("user_id", context.userId).in("id", data.ids);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var getUnifiedBookingOperations_createServerFn_handler = createServerRpc({
	id: "6aeb407b344520828681c5d87b4ff8de6ef4dddd7fa425cb874cc1af4fba7066",
	name: "getUnifiedBookingOperations",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => getUnifiedBookingOperations.__executeServer(opts));
var getUnifiedBookingOperations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getUnifiedBookingOperations_createServerFn_handler, async ({ context }) => {
	const { data: allowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "admin"
	});
	const { data: superAllowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "super_admin"
	});
	if (!allowed && !superAllowed) throw new Error("Administrator access required");
	const sb = await adminClient();
	const [{ data: bookings }, { data: settings }, { data: issues }, { data: events }, { data: offers }, { data: reviews }] = await Promise.all([
		sb.from("unified_bookings").select("*").order("created_at", { ascending: false }).limit(250),
		sb.from("booking_matching_settings").select("*").eq("id", true).single(),
		sb.from("booking_issues").select("*").order("created_at", { ascending: false }).limit(100),
		sb.from("provider_reliability_events").select("*").order("created_at", { ascending: false }).limit(300),
		sb.from("booking_offers").select("*").order("offered_at", { ascending: false }).limit(300),
		sb.from("booking_reviews").select("reviewee_id,overall_rating").limit(1e3)
	]);
	const offerRows = offers ?? [];
	const eventRows = events ?? [];
	const bookingTitleById = Object.fromEntries((bookings ?? []).map((booking) => [booking.id, booking.title]));
	const providerIds = [...new Set([
		...offerRows.map((offer) => offer.provider_id),
		...eventRows.map((event) => event.provider_id),
		...(bookings ?? []).map((booking) => booking.assigned_provider_id)
	].filter((id) => Boolean(id)))];
	const { data: names } = providerIds.length ? await sb.from("profiles").select("id,full_name").in("id", providerIds) : { data: [] };
	const nameById = Object.fromEntries((names ?? []).map((profile) => [profile.id, profile.full_name ?? "MedConnect member"]));
	const reviewRows = reviews ?? [];
	const staff = providerIds.map((providerId) => {
		const providerEvents = eventRows.filter((event) => event.provider_id === providerId);
		const providerOffers = offerRows.filter((offer) => offer.provider_id === providerId);
		const providerReviews = reviewRows.filter((review) => review.reviewee_id === providerId);
		const accepted = providerOffers.filter((offer) => offer.status === "accepted").length;
		const responded = providerOffers.filter((offer) => offer.status !== "pending").length;
		return {
			providerId,
			name: nameById[providerId] ?? "MedConnect member",
			score: Math.max(0, Math.min(100, 80 + providerEvents.reduce((sum, event) => sum + Number(event.score_delta), 0))),
			offers: providerOffers.length,
			accepted,
			declined: providerOffers.filter((offer) => offer.status === "declined").length,
			expired: providerOffers.filter((offer) => offer.status === "expired").length,
			acceptanceRate: responded ? Math.round(accepted / responded * 100) : null,
			completed: (bookings ?? []).filter((booking) => booking.assigned_provider_id === providerId && booking.status === "completed").length,
			cancellations: providerEvents.filter((event) => event.event_type.includes("cancel")).length,
			averageRating: providerReviews.length ? Number((providerReviews.reduce((sum, review) => sum + review.overall_rating, 0) / providerReviews.length).toFixed(1)) : null,
			events: providerEvents.slice(0, 6)
		};
	}).sort((a, b) => a.score - b.score);
	return {
		bookings: bookings ?? [],
		settings,
		issues: issues ?? [],
		reliabilityEvents: eventRows,
		offers: offerRows,
		bookingTitleById,
		nameById,
		staff
	};
});
var adjustProviderReliability_createServerFn_handler = createServerRpc({
	id: "501998ae371bd5ddfb44bc38026523b5823a8bcb268d1c3d7587afcfd8c63de5",
	name: "adjustProviderReliability",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => adjustProviderReliability.__executeServer(opts));
var adjustProviderReliability = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.providerId) throw new Error("Choose a staff member");
	if (!Number.isFinite(input.scoreDelta) || input.scoreDelta < -50 || input.scoreDelta > 50 || input.scoreDelta === 0) throw new Error("Adjustment must be between -50 and +50");
	if (!input.note?.trim() || input.note.trim().length > 500) throw new Error("Add a short reason (under 500 characters)");
	return input;
}).handler(adjustProviderReliability_createServerFn_handler, async ({ data, context }) => {
	const { data: superAllowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "super_admin"
	});
	if (!superAllowed) throw new Error("Super administrator access required");
	const { error } = await (await adminClient()).from("provider_reliability_events").insert({
		provider_id: data.providerId,
		event_type: data.scoreDelta > 0 ? "admin_credit" : "admin_penalty",
		score_delta: Math.round(data.scoreDelta),
		note: `${data.note.trim()} (by admin)`
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var updateUnifiedMatchingSettings_createServerFn_handler = createServerRpc({
	id: "38a07ab6878fae81a3a1f5dfe9b6b8fd2080560870fd22584af89225d7b194f9",
	name: "updateUnifiedMatchingSettings",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => updateUnifiedMatchingSettings.__executeServer(opts));
var updateUnifiedMatchingSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input || input.initialRadiusKm < 1 || input.maxRadiusKm < input.initialRadiusKm || input.expansionIntervalMinutes < 1 || input.offerExpiryMinutes < 1 || input.minimumReliabilityScore < 0 || input.minimumReliabilityScore > 100 || [
		input.providerCancellationPenalty,
		input.lateArrivalPenalty,
		input.noShowPenalty
	].some((value) => value > 0 || value < -100)) throw new Error("Invalid matching settings");
	return input;
}).handler(updateUnifiedMatchingSettings_createServerFn_handler, async ({ data, context }) => {
	const { data: allowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "admin"
	});
	const { data: superAllowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "super_admin"
	});
	if (!allowed && !superAllowed) throw new Error("Administrator access required");
	const { error } = await (await adminClient()).from("booking_matching_settings").update({
		initial_radius_km: data.initialRadiusKm,
		expansion_interval_minutes: data.expansionIntervalMinutes,
		expansion_step_km: data.expansionStepKm,
		max_radius_km: data.maxRadiusKm,
		offer_expiry_minutes: data.offerExpiryMinutes,
		minimum_reliability_score: data.minimumReliabilityScore,
		provider_cancellation_penalty: data.providerCancellationPenalty,
		late_arrival_penalty: data.lateArrivalPenalty,
		no_show_penalty: data.noShowPenalty,
		updated_by: context.userId,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", true);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var resolveUnifiedBookingIssue_createServerFn_handler = createServerRpc({
	id: "5434617f6cd719585ea5357a889596f0853c8bf4f1ce5b15bf6a561c6169b257",
	name: "resolveUnifiedBookingIssue",
	filename: "src/lib/unified-booking.functions.ts"
}, (opts) => resolveUnifiedBookingIssue.__executeServer(opts));
var resolveUnifiedBookingIssue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.issueId || !input.resolution?.trim()) throw new Error("Add a review note");
	return input;
}).handler(resolveUnifiedBookingIssue_createServerFn_handler, async ({ data, context }) => {
	const { data: allowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "admin"
	});
	const { data: superAllowed } = await context.supabase.rpc("has_role", {
		_user_id: context.userId,
		_role: "super_admin"
	});
	if (!allowed && !superAllowed) throw new Error("Administrator access required");
	const { error } = await (await adminClient()).from("booking_issues").update({
		status: data.status,
		resolution: data.resolution.trim(),
		resolved_by: context.userId,
		resolved_at: data.status === "resolved" || data.status === "dismissed" ? (/* @__PURE__ */ new Date()).toISOString() : null
	}).eq("id", data.issueId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { acceptUnifiedOffer_createServerFn_handler, adjustProviderReliability_createServerFn_handler, cancelUnifiedBooking_createServerFn_handler, createUnifiedBooking_createServerFn_handler, declineUnifiedOffer_createServerFn_handler, getMyUnifiedBookingHub_createServerFn_handler, getUnifiedBookingOperations_createServerFn_handler, markUnifiedNotificationsRead_createServerFn_handler, resolveUnifiedBookingIssue_createServerFn_handler, retryUnifiedBooking_createServerFn_handler, submitUnifiedBookingReview_createServerFn_handler, transitionUnifiedBooking_createServerFn_handler, updateUnifiedMatchingSettings_createServerFn_handler };
