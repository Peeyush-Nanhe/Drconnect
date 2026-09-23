import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
import { t as THERAPY_LABEL } from "./physio-patient.functions-CymDwMqO.js";
//#region src/lib/physio-therapist.functions.ts?tss-serverfn-split
var mapVisit = (r) => ({
	id: r.id,
	patientName: r.patient_name ?? "Patient",
	therapyType: r.therapy_type,
	therapyLabel: THERAPY_LABEL[r.therapy_type] ?? r.therapy_type,
	area: r.area,
	city: r.city,
	address: r.address ?? null,
	scheduledAt: r.scheduled_at ?? null,
	durationMin: r.duration_min ?? 45,
	sessionNumber: r.session_number ?? 1,
	status: r.status,
	urgency: r.urgency,
	confirmedAt: r.confirmed_at ?? (r.status === "confirmed" ? r.created_at : null),
	checkedInAt: r.checked_in_at ?? null,
	checkedOutAt: r.checked_out_at ?? null,
	fee: r.fee === null || r.fee === void 0 ? null : Number(r.fee),
	paymentStatus: r.payment_status ?? "paid",
	fromPack: !!r.pack_id,
	notes: r.notes ?? null,
	therapistNote: r.therapist_note ?? r.notes ?? null,
	otp: r.otp ?? void 0
});
var VISIT_COLUMNS = "id, patient_name, therapy_type, area, city, address, scheduled_at, duration_min, session_number, status, urgency, confirmed_at, checked_in_at, checked_out_at, fee, notes, otp, created_at";
var STAGES = [
	"confirmed",
	"en_route",
	"in_progress",
	"completed",
	"no_show",
	"cancelled"
];
/** The signed-in therapist's own queue of home sessions. */
var getTherapistBoard_createServerFn_handler = createServerRpc({
	id: "75ec932fa304aa6de5363c266a38e22908fccbce154b85c2b3ea205247ab0e1d",
	name: "getTherapistBoard",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => getTherapistBoard.__executeServer(opts));
var getTherapistBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getTherapistBoard_createServerFn_handler, async ({ context }) => {
	const sb = context.supabase;
	const { data: therapist, error: tErr } = await sb.from("physio_therapists").select("id, full_name, area, city, verified").eq("user_id", context.userId).maybeSingle();
	if (tErr) throw new Error(tErr.message);
	if (!therapist) return {
		therapist: null,
		totals: {
			toConfirm: 0,
			today: 0,
			upcoming: 0,
			completed30d: 0,
			earnings30d: 0
		},
		visits: [],
		openRequests: []
	};
	const since = (/* @__PURE__ */ new Date(Date.now() - 2592e6)).toISOString();
	const [mine, openRows] = await Promise.all([sb.from("physio_visits").select(VISIT_COLUMNS).eq("therapist_id", therapist.id).gte("created_at", since).order("scheduled_at", {
		ascending: true,
		nullsFirst: false
	}).limit(300), sb.from("physio_visits").select(VISIT_COLUMNS).is("therapist_id", null).eq("status", "requested").eq("city", therapist.city).order("scheduled_at", {
		ascending: true,
		nullsFirst: false
	}).limit(50)]);
	if (mine.error) throw new Error(mine.error.message);
	if (openRows.error) throw new Error(openRows.error.message);
	const visits = (mine.data ?? []).map(mapVisit);
	const openRequests = (openRows.data ?? []).map(mapVisit);
	const startOfDay = /* @__PURE__ */ new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = startOfDay.getTime() + 864e5;
	const open = /* @__PURE__ */ new Set([
		"assigned",
		"confirmed",
		"en_route",
		"in_progress"
	]);
	const totals = {
		toConfirm: visits.filter((v) => v.status === "assigned").length,
		today: visits.filter((v) => {
			const t = v.scheduledAt ? new Date(v.scheduledAt).getTime() : null;
			return t != null && t >= startOfDay.getTime() && t < endOfDay;
		}).length,
		upcoming: visits.filter((v) => open.has(v.status) && v.scheduledAt && new Date(v.scheduledAt).getTime() >= Date.now()).length,
		completed30d: visits.filter((v) => v.status === "completed").length,
		earnings30d: Math.round(visits.filter((v) => v.status === "completed").reduce((sum, v) => sum + (v.fee ?? 0), 0))
	};
	return {
		therapist: {
			id: therapist.id,
			name: therapist.full_name,
			area: therapist.area ?? null,
			city: therapist.city,
			verified: !!therapist.verified
		},
		totals,
		visits,
		openRequests
	};
});
var claimPhysioVisit_createServerFn_handler = createServerRpc({
	id: "aff76b40267f887cae51ae3f53dc5af09e7f5a99425620f0ec167e817be4bd9a",
	name: "claimPhysioVisit",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => claimPhysioVisit.__executeServer(opts));
var claimPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	return input;
}).handler(claimPhysioVisit_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin || context.supabase;
	const { data: pt } = await sb.from("physio_therapists").select("id").eq("user_id", context.userId).maybeSingle();
	if (!pt) throw new Error("Physiotherapist record not found");
	if ((await sb.rpc("claim_physio_visit", {
		_visit_id: data.visitId,
		_therapist_id: pt.id
	})).error) {
		const { error: updErr } = await sb.from("physio_visits").update({
			therapist_id: pt.id,
			status: "assigned",
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		}).eq("id", data.visitId).is("therapist_id", null);
		if (updErr) throw new Error(updErr.message);
		return {
			ok: true,
			visitId: data.visitId
		};
	}
	return {
		ok: true,
		visitId: data.visitId
	};
});
var setPhysioVisitStage_createServerFn_handler = createServerRpc({
	id: "28c69544e4d5a8cfbeb499e554579e065d2af518d4a6e25aa5d18eb32ab0a0cc",
	name: "setPhysioVisitStage",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => setPhysioVisitStage.__executeServer(opts));
var setPhysioVisitStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	if (!STAGES.includes(input.stage)) throw new Error("Unknown stage");
	if (input.note && input.note.length > 1e3) throw new Error("Note must be under 1000 characters");
	return input;
}).handler(setPhysioVisitStage_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin || context.supabase;
	const rpcRes = await sb.rpc("set_physio_visit_stage", {
		_visit_id: data.visitId,
		_stage: data.stage,
		_note: data.note?.trim() || null
	});
	if (rpcRes.error && (rpcRes.error.code === "PGRST202" || rpcRes.error.message?.includes("schema cache"))) {
		const updates = {
			status: data.stage,
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		};
		if (data.stage === "confirmed") updates.confirmed_at = (/* @__PURE__ */ new Date()).toISOString();
		else if (data.stage === "in_progress") updates.checked_in_at = (/* @__PURE__ */ new Date()).toISOString();
		else if (data.stage === "completed") updates.checked_out_at = (/* @__PURE__ */ new Date()).toISOString();
		else if (data.stage === "no_show") updates.no_show = true;
		if (data.note) updates.notes = data.note.trim();
		const { error: updErr } = await sb.from("physio_visits").update(updates).eq("id", data.visitId);
		if (updErr) throw new Error(updErr.message);
		return { ok: true };
	}
	if (rpcRes.error) throw new Error(rpcRes.error.message);
	return { ok: true };
});
var getTherapistProfile_createServerFn_handler = createServerRpc({
	id: "fd113baf76520b7417af63b4b49c76f6ffbb2f1de1d5c4ff8ac84b3bce8a0e85",
	name: "getTherapistProfile",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => getTherapistProfile.__executeServer(opts));
var getTherapistProfile = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getTherapistProfile_createServerFn_handler, async ({ context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin || context.supabase;
	const [{ data: r, error }, { data: avail }] = await Promise.all([sb.from("physio_therapists").select("*").eq("user_id", context.userId).maybeSingle(), sb.from("provider_availability").select("is_online").eq("user_id", context.userId).maybeSingle()]);
	if (error) throw new Error(error.message);
	if (!r) return { profile: null };
	const isOnline = avail?.is_online !== void 0 ? !!avail.is_online : r.is_online !== void 0 ? !!r.is_online : true;
	return { profile: {
		id: r.id,
		fullName: r.full_name,
		phone: r.phone ?? null,
		specializations: r.specializations ?? [],
		qualification: r.qualification ?? null,
		registrationNumber: r.registration_number ?? null,
		yearsExperience: r.years_experience ?? null,
		areas: r.areas && r.areas.length ? r.areas : r.area ? [r.area] : ["Kothrud", "Pune"],
		city: r.city ?? "Pune",
		homeVisits: r.home_visits !== void 0 ? !!r.home_visits : true,
		clinicVisits: r.clinic_visits !== void 0 ? !!r.clinic_visits : true,
		preferredFacilities: r.preferred_facilities ?? [],
		languages: r.languages ?? [],
		bio: r.bio ?? null,
		recentCourses: r.recent_courses ?? null,
		specialInterests: r.special_interests ?? null,
		isOnline,
		verified: r.verified !== void 0 ? !!r.verified : true,
		active: r.active !== void 0 ? !!r.active : true
	} };
});
var saveTherapistProfile_createServerFn_handler = createServerRpc({
	id: "66d8a9e68e6f9eeab51c2f5a3f26077fc0e3eb753f96bf73b0e8c493fe122d0f",
	name: "saveTherapistProfile",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => saveTherapistProfile.__executeServer(opts));
var saveTherapistProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.fullName?.trim()) throw new Error("Your name is required");
	if (!Array.isArray(d.specializations) || d.specializations.length === 0) throw new Error("Pick at least one therapy you offer");
	if (d.bio && d.bio.length > 1e3) throw new Error("Keep the summary under 1000 characters");
	return d;
}).handler(saveTherapistProfile_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const row = {
		user_id: context.userId,
		full_name: data.fullName.trim(),
		phone: data.phone?.trim() || null,
		specializations: data.specializations,
		qualification: data.qualification || null,
		registration_number: data.registrationNumber?.trim() || null,
		years_experience: data.yearsExperience ?? null,
		areas: data.areas ?? [],
		city: data.city?.trim() || "Pune",
		home_visits: !!data.homeVisits,
		clinic_visits: !!data.clinicVisits,
		preferred_facilities: data.preferredFacilities ?? [],
		languages: data.languages ?? [],
		bio: data.bio?.trim() || null,
		recent_courses: data.recentCourses?.trim() || null,
		special_interests: data.specialInterests?.trim() || null,
		area: data.areas?.[0] ?? null
	};
	const { data: existing } = await sb.from("physio_therapists").select("id").eq("user_id", context.userId).maybeSingle();
	const baselineRow = {
		user_id: context.userId,
		full_name: data.fullName.trim(),
		phone: data.phone?.trim() || null,
		specializations: data.specializations,
		city: data.city?.trim() || "Pune",
		area: data.areas?.[0] ?? null,
		registration_number: data.registrationNumber?.trim() || null
	};
	if (existing) {
		let { error } = await sb.from("physio_therapists").update(row).eq("user_id", context.userId);
		if (error && error.message?.includes("schema cache")) error = (await sb.from("physio_therapists").update(baselineRow).eq("user_id", context.userId)).error;
		if (error) throw new Error(error.message);
	} else {
		let { error } = await sb.from("physio_therapists").insert({
			...row,
			active: true
		});
		if (error && error.message?.includes("schema cache")) error = (await sb.from("physio_therapists").insert({
			...baselineRow,
			active: true,
			verified: true
		})).error;
		if (error) throw new Error(error.message);
	}
	return { ok: true };
});
var setTherapistOnline_createServerFn_handler = createServerRpc({
	id: "fa62b2fad6bcc0bba7c23a166207e320f3108d951457c0766571c317a27612bd",
	name: "setTherapistOnline",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => setTherapistOnline.__executeServer(opts));
var setTherapistOnline = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ online: !!d?.online })).handler(setTherapistOnline_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin || context.supabase;
	try {
		await sb.from("physio_therapists").update({ is_online: data.online }).eq("user_id", context.userId);
	} catch {}
	await sb.from("provider_availability").upsert({
		user_id: context.userId,
		is_online: data.online
	}, { onConflict: "user_id" });
	return {
		ok: true,
		online: data.online
	};
});
var insertEmergencyPhysioVisit_createServerFn_handler = createServerRpc({
	id: "08ac15ab80fdc6e949cab8ed336d7ef5a231f648062c63fd8baf6fdb27583b3b",
	name: "insertEmergencyPhysioVisit",
	filename: "src/lib/physio-therapist.functions.ts"
}, (opts) => insertEmergencyPhysioVisit.__executeServer(opts));
var insertEmergencyPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((d) => d).handler(insertEmergencyPhysioVisit_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin || context.supabase;
	const { data: existing } = await sb.from("physio_visits").select("id").like("notes", `%${data.reqId}%`).maybeSingle();
	if (existing) return {
		ok: true,
		visitId: existing.id
	};
	const { data: therapist } = await sb.from("physio_therapists").select("id").eq("user_id", context.userId).maybeSingle();
	if (!therapist) throw new Error("You must be registered as a therapist to accept this.");
	const { data: existingRequested } = await sb.from("physio_visits").select("id, therapy_type, urgency, fee, scheduled_at, area").eq("patient_id", data.patientId).eq("status", "requested").order("created_at", { ascending: false }).limit(1).maybeSingle();
	if (existingRequested) {
		const isUrgent = data.urgency === "urgent" || existingRequested.urgency === "urgent";
		let finalFee = existingRequested.fee || data.fare || 0;
		if (isUrgent && existingRequested.urgency !== "urgent") finalFee = Math.round(finalFee * 1.2);
		const { error: updErr } = await sb.from("physio_visits").update({
			therapist_id: therapist.id,
			status: "assigned",
			fee: finalFee,
			urgency: isUrgent ? "urgent" : "planned"
		}).eq("id", existingRequested.id);
		if (updErr) throw new Error(updErr.message);
		return {
			ok: true,
			visitId: existingRequested.id
		};
	}
	const isUrgent = data.urgency === "urgent";
	const specLower = (data.specialty || data.therapyType || "").toLowerCase();
	const fallbackBase = specLower.includes("psych") ? 1500 : specLower.includes("speech") || specLower.includes("resp") ? 1200 : specLower.includes("occup") ? 1e3 : specLower.includes("neuro") ? 900 : specLower.includes("sport") || specLower.includes("geriatric") || specLower.includes("paed") ? 800 : 700;
	const baseFare = Number(data.fare) > 0 ? Number(data.fare) : fallbackBase;
	const visitFee = isUrgent ? Math.round(baseFare * 1.2) : baseFare;
	const allowedTherapies = [
		"neuro",
		"orthopaedic",
		"sports",
		"paediatric",
		"geriatric",
		"cardio_respiratory",
		"post_surgical",
		"pelvic_floor",
		"general"
	];
	let mappedType = (data.therapyType || data.specialty || "").toLowerCase().replace(/[^a-z_]/g, "_");
	if (!allowedTherapies.includes(mappedType)) {
		if (mappedType.includes("neuro")) mappedType = "neuro";
		else if (mappedType.includes("ortho")) mappedType = "orthopaedic";
		else if (mappedType.includes("sport")) mappedType = "sports";
		else if (mappedType.includes("paed") || mappedType.includes("pedi")) mappedType = "paediatric";
		else if (mappedType.includes("cardio")) mappedType = "cardio_respiratory";
		else mappedType = "general";
	}
	const { error } = await sb.from("physio_visits").insert({
		patient_id: data.patientId,
		patient_name: data.patientName,
		therapist_id: therapist.id,
		therapy_type: mappedType,
		area: data.area || (isUrgent ? "Emergency Location" : "Pune"),
		city: "Pune",
		scheduled_at: data.scheduledAt || (/* @__PURE__ */ new Date()).toISOString(),
		duration_min: 45,
		session_number: 1,
		status: "assigned",
		urgency: isUrgent ? "urgent" : "planned",
		fee: visitFee,
		notes: data.notes || (isUrgent ? `Emergency ${data.specialty} request (ID: ${data.reqId})` : `Consultation request (ID: ${data.reqId})`)
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { claimPhysioVisit_createServerFn_handler, getTherapistBoard_createServerFn_handler, getTherapistProfile_createServerFn_handler, insertEmergencyPhysioVisit_createServerFn_handler, saveTherapistProfile_createServerFn_handler, setPhysioVisitStage_createServerFn_handler, setTherapistOnline_createServerFn_handler };
