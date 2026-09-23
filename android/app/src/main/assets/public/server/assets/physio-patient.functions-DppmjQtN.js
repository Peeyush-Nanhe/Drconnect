import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/physio-patient.functions.ts?tss-serverfn-split
var THERAPY_LABEL = {
	neuro: "Neuro physiotherapy",
	orthopaedic: "Orthopaedic therapy",
	sports: "Sports injury rehab",
	paediatric: "Paediatric therapy",
	geriatric: "Geriatric therapy",
	cardio_respiratory: "Cardio-respiratory",
	post_surgical: "Post-surgical rehab",
	pelvic_floor: "Pelvic floor",
	general: "General physiotherapy"
};
var getMyPhysioVisits_createServerFn_handler = createServerRpc({
	id: "2d2b535363a649e3dd6aad5a3c74633f34cd498fe827d7391c4798ac9e859b46",
	name: "getMyPhysioVisits",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => getMyPhysioVisits.__executeServer(opts));
var getMyPhysioVisits = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getMyPhysioVisits_createServerFn_handler, async ({ context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const uid = context.userId;
	const { data: visits, error } = await sb.from("physio_visits").select("id, therapy_type, area, city, address, scheduled_at, duration_min, session_number, status, urgency, checked_in_at, checked_out_at, no_show, cancelled_at, cancel_reason, fee, notes, therapist_id, partner_id, created_at").eq("patient_id", uid).order("scheduled_at", {
		ascending: false,
		nullsFirst: false
	}).limit(200);
	if (error) throw new Error(error.message);
	const rows = visits ?? [];
	if (rows.length === 0) return [];
	const therapistIds = Array.from(new Set(rows.map((r) => r.therapist_id).filter(Boolean)));
	const partnerIds = Array.from(new Set(rows.map((r) => r.partner_id).filter(Boolean)));
	const [therapists, partners, feedback] = await Promise.all([
		therapistIds.length ? sb.from("physio_therapists").select("id, full_name").in("id", therapistIds) : Promise.resolve({ data: [] }),
		partnerIds.length ? sb.from("physio_partners").select("id, name").in("id", partnerIds) : Promise.resolve({ data: [] }),
		sb.from("physio_visit_feedback").select("visit_id, rating, punctuality, professionalism, would_rebook, comment").in("visit_id", rows.map((r) => r.id))
	]);
	const tName = new Map((therapists.data ?? []).map((t) => [t.id, t.full_name]));
	const pName = new Map((partners.data ?? []).map((p) => [p.id, p.name]));
	const fb = new Map((feedback.data ?? []).map((f) => [f.visit_id, f]));
	return rows.map((r) => ({
		id: r.id,
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
		checkedInAt: r.checked_in_at ?? null,
		checkedOutAt: r.checked_out_at ?? null,
		noShow: !!r.no_show,
		cancelledAt: r.cancelled_at ?? null,
		cancelReason: r.cancel_reason ?? null,
		fee: r.fee === null || r.fee === void 0 ? null : Number(r.fee),
		notes: r.notes ?? null,
		therapistName: r.therapist_id ? tName.get(r.therapist_id) ?? null : null,
		partnerName: r.partner_id ? pName.get(r.partner_id) ?? null : null,
		feedback: fb.has(r.id) ? {
			rating: fb.get(r.id).rating,
			punctuality: fb.get(r.id).punctuality ?? null,
			professionalism: fb.get(r.id).professionalism ?? null,
			wouldRebook: fb.get(r.id).would_rebook ?? null,
			comment: fb.get(r.id).comment ?? null
		} : null
	}));
});
var submitPhysioVisitFeedback_createServerFn_handler = createServerRpc({
	id: "6af742f862fe7044d8e5ceb6b8ed6dbc8da4f83fc6302cd8454eb8f7a352ff17",
	name: "submitPhysioVisitFeedback",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => submitPhysioVisitFeedback.__executeServer(opts));
var submitPhysioVisitFeedback = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Rating must be a whole number between 1 and 5");
	return input;
}).handler(submitPhysioVisitFeedback_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const { data: visit, error: vErr } = await sb.from("physio_visits").select("id, patient_id, therapist_id, partner_id, status").eq("id", data.visitId).maybeSingle();
	if (vErr) throw new Error(vErr.message);
	if (!visit || visit.patient_id !== context.userId) throw new Error("Visit not found");
	if (visit.status !== "completed") throw new Error("Feedback can only be given after the session is completed");
	const { error } = await sb.from("physio_visit_feedback").upsert({
		visit_id: visit.id,
		patient_id: context.userId,
		therapist_id: visit.therapist_id,
		partner_id: visit.partner_id,
		rating: data.rating,
		punctuality: data.punctuality ?? null,
		professionalism: data.professionalism ?? null,
		would_rebook: data.wouldRebook ?? null,
		comment: data.comment?.trim() || null,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	}, { onConflict: "visit_id" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
var cancelPhysioVisit_createServerFn_handler = createServerRpc({
	id: "f49b30aad92cae3fa588c99d3e444aefa2136e33b19b3c4d90ff988227cab92d",
	name: "cancelPhysioVisit",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => cancelPhysioVisit.__executeServer(opts));
var cancelPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	if (input.reason && input.reason.length > 300) throw new Error("Reason must be under 300 characters");
	return {
		visitId: String(input.visitId),
		reason: input.reason?.trim() || null
	};
}).handler(cancelPhysioVisit_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const { data: visit, error: vErr } = await sb.from("physio_visits").select("id, patient_id, status").eq("id", data.visitId).maybeSingle();
	if (vErr) throw new Error(vErr.message);
	if (!visit || visit.patient_id !== context.userId) throw new Error("Visit not found");
	if ([
		"completed",
		"cancelled",
		"no_show"
	].includes(visit.status)) throw new Error("This visit can no longer be cancelled");
	const { error } = await sb.from("physio_visits").update({
		status: "cancelled",
		cancelled_at: (/* @__PURE__ */ new Date()).toISOString(),
		cancel_reason: data.reason
	}).eq("id", data.visitId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var bookPhysioVisit_createServerFn_handler = createServerRpc({
	id: "4eec26c95cde3817f2c746d4a8a4a1f3822c23c9a7f6c594a5315fae33da90bf",
	name: "bookPhysioVisit",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => bookPhysioVisit.__executeServer(opts));
var bookPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapyType || !THERAPY_LABEL[input.therapyType]) throw new Error("Choose a valid therapy type");
	if (!input.area?.trim() || input.area.trim().length > 100) throw new Error("Area is required (max 100 chars)");
	if (!input.city?.trim() || input.city.trim().length > 100) throw new Error("City is required (max 100 chars)");
	const when = new Date(input.scheduledAt);
	if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date and time");
	if (when.getTime() < Date.now() - 3e5) throw new Error("Scheduled time must be in the future");
	if (input.address && input.address.length > 500) throw new Error("Address must be under 500 characters");
	if (input.notes && input.notes.length > 1e3) throw new Error("Notes must be under 1000 characters");
	return input;
}).handler(bookPhysioVisit_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const { data: profile } = await sb.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
	let preferredTherapistId = null;
	if (data.preferredTherapistId) {
		const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
		const { data: therapist } = await supabaseAdmin.from("physio_therapists").select("id, verified, active").eq("id", data.preferredTherapistId).maybeSingle();
		if (therapist?.verified && therapist?.active) preferredTherapistId = therapist.id;
	}
	const { data: visit, error } = await sb.from("physio_visits").insert({
		patient_id: context.userId,
		patient_name: profile?.full_name ?? null,
		therapy_type: data.therapyType,
		area: data.area.trim(),
		city: data.city.trim(),
		address: data.address?.trim() || null,
		scheduled_at: new Date(data.scheduledAt).toISOString(),
		duration_min: Number.isInteger(data.durationMin) && data.durationMin >= 15 && data.durationMin <= 180 ? data.durationMin : 45,
		session_number: Number.isInteger(data.sessionNumber) && data.sessionNumber >= 1 ? data.sessionNumber : 1,
		status: "requested",
		urgency: data.urgency === "urgent" ? "urgent" : "planned",
		fee: data.fee ?? null,
		notes: data.notes?.trim() || null,
		preferred_therapist_id: preferredTherapistId
	}).select("id").single();
	if (error) throw new Error(error.message);
	return {
		ok: true,
		visitId: visit.id
	};
});
var getPhysioPriorProviders_createServerFn_handler = createServerRpc({
	id: "91ecfe3ca4d4ef57aeca0f8329bd9634af3a5aaaef415754999286e1625e820c",
	name: "getPhysioPriorProviders",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => getPhysioPriorProviders.__executeServer(opts));
var getPhysioPriorProviders = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getPhysioPriorProviders_createServerFn_handler, async ({ context }) => {
	const sb = context.supabase;
	const uid = context.userId;
	const [favRes, priorRes] = await Promise.all([sb.from("physio_favorite_therapists").select("therapist_id").eq("patient_id", uid), sb.from("physio_visits").select("therapist_id, scheduled_at").eq("patient_id", uid).eq("status", "completed").not("therapist_id", "is", null).order("scheduled_at", { ascending: false }).limit(1)]);
	if (favRes.error) throw new Error(favRes.error.message);
	if (priorRes.error) throw new Error(priorRes.error.message);
	const favoriteIds = (favRes.data ?? []).map((r) => r.therapist_id);
	const priorId = (priorRes.data ?? [])[0]?.therapist_id ?? null;
	const orderedIds = [];
	if (priorId) orderedIds.push(priorId);
	favoriteIds.forEach((id) => {
		if (!orderedIds.includes(id)) orderedIds.push(id);
	});
	if (orderedIds.length === 0) return [];
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { data: therapists, error: tErr } = await supabaseAdmin.from("physio_therapists").select("id, full_name, verified, active").in("id", orderedIds);
	if (tErr) throw new Error(tErr.message);
	const therapistById = new Map((therapists ?? []).map((t) => [t.id, t]));
	const [visitsRes, feedbackRes] = await Promise.all([sb.from("physio_visits").select("therapist_id").eq("patient_id", uid).eq("status", "completed").in("therapist_id", orderedIds), sb.from("physio_visit_feedback").select("therapist_id, rating").eq("patient_id", uid).in("therapist_id", orderedIds)]);
	if (visitsRes.error) throw new Error(visitsRes.error.message);
	if (feedbackRes.error) throw new Error(feedbackRes.error.message);
	const pastVisitCount = /* @__PURE__ */ new Map();
	(visitsRes.data ?? []).forEach((v) => pastVisitCount.set(v.therapist_id, (pastVisitCount.get(v.therapist_id) ?? 0) + 1));
	const ratingsByTherapist = /* @__PURE__ */ new Map();
	(feedbackRes.data ?? []).forEach((f) => {
		const list = ratingsByTherapist.get(f.therapist_id) ?? [];
		list.push(f.rating);
		ratingsByTherapist.set(f.therapist_id, list);
	});
	return orderedIds.filter((id) => therapistById.has(id) && therapistById.get(id).active).map((id) => {
		const ratings = ratingsByTherapist.get(id) ?? [];
		return {
			therapistId: id,
			name: therapistById.get(id).full_name,
			isFavorite: favoriteIds.includes(id),
			pastVisits: pastVisitCount.get(id) ?? 0,
			rating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)) : null
		};
	});
});
var togglePhysioFavoriteTherapist_createServerFn_handler = createServerRpc({
	id: "7bd61c673b6dc4dd2aad106ec35d8915ad551a1e6f2592d477885f1e622109a6",
	name: "togglePhysioFavoriteTherapist",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => togglePhysioFavoriteTherapist.__executeServer(opts));
var togglePhysioFavoriteTherapist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapistId) throw new Error("therapistId is required");
	return { therapistId: String(input.therapistId) };
}).handler(togglePhysioFavoriteTherapist_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const uid = context.userId;
	const { data: existing, error: exErr } = await sb.from("physio_favorite_therapists").select("id").eq("patient_id", uid).eq("therapist_id", data.therapistId).maybeSingle();
	if (exErr) throw new Error(exErr.message);
	if (existing) {
		const { error } = await sb.from("physio_favorite_therapists").delete().eq("id", existing.id);
		if (error) throw new Error(error.message);
		return { isFavorite: false };
	}
	const { count, error: cErr } = await sb.from("physio_favorite_therapists").select("id", {
		count: "exact",
		head: true
	}).eq("patient_id", uid);
	if (cErr) throw new Error(cErr.message);
	if ((count ?? 0) >= 2) throw new Error("You can favourite up to 2 physiotherapists");
	const { error } = await sb.from("physio_favorite_therapists").insert({
		patient_id: uid,
		therapist_id: data.therapistId
	});
	if (error) throw new Error(error.message);
	return { isFavorite: true };
});
var getPhysioTherapistRoster_createServerFn_handler = createServerRpc({
	id: "b48304ea7e9068fb00e995d8ccaf816f401e1619f92ce0849e018a1e0efbde19",
	name: "getPhysioTherapistRoster",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => getPhysioTherapistRoster.__executeServer(opts));
var getPhysioTherapistRoster = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getPhysioTherapistRoster_createServerFn_handler, async ({ context }) => {
	const sb = context.supabase;
	const uid = context.userId;
	const [therapistsRes, favRes] = await Promise.all([sb.from("physio_therapists").select("id, full_name, area, city, specializations").eq("verified", true).eq("active", true).order("full_name", { ascending: true }), sb.from("physio_favorite_therapists").select("therapist_id").eq("patient_id", uid)]);
	if (therapistsRes.error) throw new Error(therapistsRes.error.message);
	if (favRes.error) throw new Error(favRes.error.message);
	const favoriteIds = new Set((favRes.data ?? []).map((r) => r.therapist_id));
	return (therapistsRes.data ?? []).map((t) => ({
		therapistId: t.id,
		name: t.full_name,
		area: t.area ?? null,
		city: t.city,
		specializations: t.specializations ?? [],
		isFavorite: favoriteIds.has(t.id)
	})).sort((a, b) => a.isFavorite === b.isFavorite ? a.name.localeCompare(b.name) : a.isFavorite ? -1 : 1);
});
var getPhysioTherapistSlots_createServerFn_handler = createServerRpc({
	id: "b5d9321a855f0a1cdbe6b676688d49274bd069863491dcf6fdc95dfcf772a5e0",
	name: "getPhysioTherapistSlots",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => getPhysioTherapistSlots.__executeServer(opts));
var getPhysioTherapistSlots = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapistId) throw new Error("therapistId is required");
	if (!Number.isInteger(input.durationMin) || input.durationMin < 15 || input.durationMin > 180) throw new Error("Duration must be between 15 and 180 minutes");
	if (!input.startDate || !input.endDate) throw new Error("startDate and endDate are required");
	return input;
}).handler(getPhysioTherapistSlots_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const { data: therapist, error: tErr } = await supabaseAdmin.from("physio_therapists").select("id, user_id, verified, active").eq("id", data.therapistId).maybeSingle();
	if (tErr) throw new Error(tErr.message);
	if (!therapist || !therapist.verified || !therapist.active) throw new Error("Therapist not found or not available");
	if (!therapist.user_id) return [];
	const { data: slots, error } = await context.supabase.rpc("get_provider_slots", {
		p_provider_id: therapist.user_id,
		p_start_date: data.startDate,
		p_end_date: data.endDate,
		p_duration_minutes: data.durationMin
	});
	if (error) throw new Error(error.message);
	return (slots ?? []).map((s) => ({
		startTime: s.start_time,
		isAvailable: !!s.is_available
	}));
});
var bookPhysioVisitWithTherapist_createServerFn_handler = createServerRpc({
	id: "ff933326d21b98766e8c156753fd5a384391f6cfc685392511de4398eda229c3",
	name: "bookPhysioVisitWithTherapist",
	filename: "src/lib/physio-patient.functions.ts"
}, (opts) => bookPhysioVisitWithTherapist.__executeServer(opts));
var bookPhysioVisitWithTherapist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.therapistId) throw new Error("therapistId is required");
	if (!input?.therapyType || !THERAPY_LABEL[input.therapyType]) throw new Error("Choose a valid therapy type");
	if (!input.area?.trim() || input.area.trim().length > 100) throw new Error("Area is required (max 100 chars)");
	if (!input.city?.trim() || input.city.trim().length > 100) throw new Error("City is required (max 100 chars)");
	const when = new Date(input.startTime);
	if (Number.isNaN(when.getTime())) throw new Error("Choose a valid date and time");
	if (when.getTime() < Date.now()) throw new Error("Scheduled time must be in the future");
	if (input.address && input.address.length > 500) throw new Error("Address must be under 500 characters");
	if (input.notes && input.notes.length > 1e3) throw new Error("Notes must be under 1000 characters");
	return input;
}).handler(bookPhysioVisitWithTherapist_createServerFn_handler, async ({ data, context }) => {
	const { data: visitId, error } = await context.supabase.rpc("atomic_book_physio_visit", {
		p_therapist_id: data.therapistId,
		p_patient_id: context.userId,
		p_start_time: new Date(data.startTime).toISOString(),
		p_duration_min: data.durationMin,
		p_therapy_type: data.therapyType,
		p_area: data.area.trim(),
		p_city: data.city.trim(),
		p_address: data.address?.trim() || null,
		p_notes: data.notes?.trim() || null,
		p_urgency: data.urgency === "urgent" ? "urgent" : "planned"
	});
	if (error) throw new Error(error.message);
	return {
		ok: true,
		visitId
	};
});
//#endregion
export { bookPhysioVisitWithTherapist_createServerFn_handler, bookPhysioVisit_createServerFn_handler, cancelPhysioVisit_createServerFn_handler, getMyPhysioVisits_createServerFn_handler, getPhysioPriorProviders_createServerFn_handler, getPhysioTherapistRoster_createServerFn_handler, getPhysioTherapistSlots_createServerFn_handler, submitPhysioVisitFeedback_createServerFn_handler, togglePhysioFavoriteTherapist_createServerFn_handler };
