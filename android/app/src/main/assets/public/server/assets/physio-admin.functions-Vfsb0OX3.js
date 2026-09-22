import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/physio-admin.functions.ts?tss-serverfn-split
var H = 36e5;
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
async function resolveScope(ctx) {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const { data: roles, error: rErr } = await sb.from("user_roles").select("role").eq("user_id", ctx.userId);
	if (rErr) throw new Error(rErr.message);
	if ((roles ?? []).some((r) => r.role === "admin" || r.role === "super_admin")) return {
		isAdmin: true,
		partnerId: null,
		partnerName: null,
		areas: []
	};
	const { data: partner, error: pErr } = await sb.from("physio_partners").select("id, name, active").eq("user_id", ctx.userId).maybeSingle();
	if (pErr) throw new Error(pErr.message);
	if (!partner || !partner.active) throw new Error("Forbidden: this console is restricted to administrators and physiotherapy partners.");
	const { data: areas, error: aErr } = await sb.from("physio_partner_areas").select("area").eq("partner_id", partner.id);
	if (aErr) throw new Error(aErr.message);
	return {
		isAdmin: false,
		partnerId: partner.id,
		partnerName: partner.name,
		areas: (areas ?? []).map((a) => a.area)
	};
}
async function buildOverview(days, scope) {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const since = (/* @__PURE__ */ new Date(Date.now() - days * 24 * H)).toISOString();
	let visitsQ = sb.from("physio_visits").select("*").gte("created_at", since);
	if (!scope.isAdmin) visitsQ = visitsQ.eq("partner_id", scope.partnerId);
	let therapistsQ = sb.from("physio_therapists").select("*");
	if (!scope.isAdmin) therapistsQ = therapistsQ.eq("partner_id", scope.partnerId);
	let feedbackQ = sb.from("physio_visit_feedback").select("*").gte("created_at", since);
	if (!scope.isAdmin) feedbackQ = feedbackQ.eq("partner_id", scope.partnerId);
	const [vRes, tRes, fRes, pRes, paRes] = await Promise.all([
		visitsQ.order("scheduled_at", { ascending: false }),
		therapistsQ,
		feedbackQ,
		sb.from("physio_partners").select("*"),
		sb.from("physio_partner_areas").select("*")
	]);
	for (const r of [
		vRes,
		tRes,
		fRes,
		pRes,
		paRes
	]) if (r.error) throw new Error(r.error.message);
	const visits = vRes.data ?? [];
	const therapists = tRes.data ?? [];
	const feedback = fRes.data ?? [];
	const partners = (pRes.data ?? []).filter((p) => scope.isAdmin || p.id === scope.partnerId);
	const partnerAreas = (paRes.data ?? []).filter((a) => scope.isAdmin || a.partner_id === scope.partnerId);
	const thById = new Map(therapists.map((t) => [t.id, t]));
	const partnerById = new Map(partners.map((p) => [p.id, p]));
	const now = Date.now();
	const startOfDay = /* @__PURE__ */ new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(startOfDay.getTime() + 24 * H);
	const isToday = (iso) => {
		if (!iso) return false;
		const t = new Date(iso).getTime();
		return t >= startOfDay.getTime() && t < endOfDay.getTime();
	};
	const bump = (o, k, by = 1) => {
		if (!k) return;
		o[k] = (o[k] ?? 0) + by;
	};
	const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
	let todayTotal = 0, onVisit = 0, enRoute = 0, lateForDuty = 0, absentToday = 0, completedToday = 0, cancelledToday = 0, unassignedToday = 0;
	const todayTherapyMix = {};
	const todayAreaMix = {};
	const board = [];
	visits.forEach((v) => {
		const sched = v.scheduled_at ? new Date(v.scheduled_at).getTime() : null;
		const today = isToday(v.scheduled_at);
		let state = "scheduled";
		if (v.status === "completed") state = "completed";
		else if (v.status === "no_show" || v.no_show) state = "absent";
		else if (v.status === "cancelled") state = "cancelled";
		else if (v.status === "in_progress" || v.checked_in_at) state = "on_visit";
		else if (v.status === "en_route") state = "en_route";
		else if (v.status === "requested" || !v.therapist_id) state = "unassigned";
		else if (sched != null && now > sched) state = "late";
		else if (sched != null && sched - now <= 3 * H) state = "en_route";
		if (today) {
			todayTotal++;
			bump(todayTherapyMix, v.therapy_type);
			bump(todayAreaMix, v.area);
			if (state === "on_visit") onVisit++;
			if (state === "en_route") enRoute++;
			if (state === "late") lateForDuty++;
			if (state === "absent") absentToday++;
			if (state === "completed") completedToday++;
			if (state === "cancelled") cancelledToday++;
			if (state === "unassigned") unassignedToday++;
		}
		if (today || state === "late" || state === "on_visit" || state === "unassigned") board.push({
			id: v.id,
			patient: v.patient_name ?? "Patient",
			therapy: v.therapy_type,
			therapyLabel: THERAPY_LABEL[v.therapy_type] ?? v.therapy_type,
			area: v.area,
			scheduledAt: v.scheduled_at,
			urgency: v.urgency,
			therapist: v.therapist_id ? thById.get(v.therapist_id)?.full_name ?? "Therapist" : null,
			partner: v.partner_id ? partnerById.get(v.partner_id)?.name ?? null : null,
			state,
			status: v.status,
			therapistId: v.therapist_id ?? null,
			preferredTherapistId: v.preferred_therapist_id ?? null,
			minutesLate: state === "late" && sched != null ? Math.round((now - sched) / 6e4) : null,
			fee: v.fee
		});
	});
	const order = [
		"late",
		"unassigned",
		"absent",
		"en_route",
		"on_visit",
		"scheduled",
		"completed",
		"cancelled"
	];
	board.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state) || new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime());
	const therapyMix = {};
	const statusMix = {};
	const areaMap = /* @__PURE__ */ new Map();
	const perTherapist = /* @__PURE__ */ new Map();
	const perPartner = /* @__PURE__ */ new Map();
	let revenue = 0;
	visits.forEach((v) => {
		bump(therapyMix, v.therapy_type);
		bump(statusMix, v.status);
		if (v.status === "completed") revenue += Number(v.fee ?? 0);
		const a = areaMap.get(v.area) ?? {
			area: v.area,
			visits: 0,
			completed: 0,
			noShows: 0,
			cancelled: 0,
			urgent: 0,
			lat: null,
			lng: null,
			revenue: 0
		};
		a.visits++;
		if (v.status === "completed") {
			a.completed++;
			a.revenue += Number(v.fee ?? 0);
		}
		if (v.status === "no_show" || v.no_show) a.noShows++;
		if (v.status === "cancelled") a.cancelled++;
		if (v.urgency === "urgent") a.urgent++;
		if (a.lat == null && v.lat != null) {
			a.lat = v.lat;
			a.lng = v.lng;
		}
		areaMap.set(v.area, a);
		if (v.therapist_id) {
			const t = thById.get(v.therapist_id);
			const rec = perTherapist.get(v.therapist_id) ?? {
				id: v.therapist_id,
				name: t?.full_name ?? "Therapist",
				area: t?.area ?? null,
				partner: t?.partner_id ? partnerById.get(t.partner_id)?.name ?? null : null,
				specs: t?.specializations ?? [],
				visits: 0,
				completed: 0,
				noShows: 0,
				cancelled: 0,
				lateArrivals: 0,
				ratings: [],
				punctuality: [],
				rebook: 0,
				rebookVotes: 0,
				therapyMix: {}
			};
			rec.visits++;
			bump(rec.therapyMix, v.therapy_type);
			if (v.status === "completed") rec.completed++;
			if (v.status === "no_show" || v.no_show) rec.noShows++;
			if (v.status === "cancelled") rec.cancelled++;
			if (v.checked_in_at && v.scheduled_at) {
				if ((new Date(v.checked_in_at).getTime() - new Date(v.scheduled_at).getTime()) / 6e4 > 15) rec.lateArrivals++;
			}
			perTherapist.set(v.therapist_id, rec);
		}
		if (v.partner_id) {
			const rec = perPartner.get(v.partner_id) ?? {
				id: v.partner_id,
				name: partnerById.get(v.partner_id)?.name ?? "Partner",
				visits: 0,
				completed: 0,
				noShows: 0,
				cancelled: 0,
				ratings: [],
				revenue: 0
			};
			rec.visits++;
			if (v.status === "completed") {
				rec.completed++;
				rec.revenue += Number(v.fee ?? 0);
			}
			if (v.status === "no_show" || v.no_show) rec.noShows++;
			if (v.status === "cancelled") rec.cancelled++;
			perPartner.set(v.partner_id, rec);
		}
	});
	feedback.forEach((f) => {
		const t = f.therapist_id ? perTherapist.get(f.therapist_id) : null;
		if (t) {
			t.ratings.push(f.rating);
			if (f.punctuality != null) t.punctuality.push(f.punctuality);
			if (f.would_rebook != null) {
				t.rebookVotes++;
				if (f.would_rebook) t.rebook++;
			}
		}
		const p = f.partner_id ? perPartner.get(f.partner_id) : null;
		if (p) p.ratings.push(f.rating);
	});
	const therapistRows = [...perTherapist.values()].map((t) => ({
		id: t.id,
		name: t.name,
		area: t.area,
		partner: t.partner,
		specs: t.specs,
		visits: t.visits,
		completed: t.completed,
		noShows: t.noShows,
		cancelled: t.cancelled,
		lateArrivals: t.lateArrivals,
		reliability: t.visits ? Math.round((t.visits - t.noShows - t.cancelled) / t.visits * 100) : null,
		avgRating: t.ratings.length ? Number(avg(t.ratings).toFixed(2)) : null,
		avgPunctuality: t.punctuality.length ? Number(avg(t.punctuality).toFixed(2)) : null,
		rebookRate: t.rebookVotes ? Math.round(t.rebook / t.rebookVotes * 100) : null,
		topTherapy: Object.entries(t.therapyMix).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
		reviews: t.ratings.length
	})).sort((a, b) => b.visits - a.visits);
	const idleTherapists = therapists.filter((t) => !perTherapist.has(t.id)).map((t) => ({
		id: t.id,
		name: t.full_name,
		area: t.area,
		specs: t.specializations,
		active: t.active
	}));
	const hotspots = [...areaMap.values()].map((a) => ({
		...a,
		fillRate: a.visits ? Math.round(a.completed / a.visits * 100) : 0,
		perDay: Number((a.visits / days).toFixed(2))
	})).sort((a, b) => b.visits - a.visits);
	const partnerRows = [...perPartner.values()].map((p) => ({
		id: p.id,
		name: p.name,
		visits: p.visits,
		completed: p.completed,
		noShows: p.noShows,
		cancelled: p.cancelled,
		completionRate: p.visits ? Math.round(p.completed / p.visits * 100) : 0,
		avgRating: p.ratings.length ? Number(avg(p.ratings).toFixed(2)) : null,
		revenue: Math.round(p.revenue),
		areas: partnerAreas.filter((a) => a.partner_id === p.id).map((a) => a.area)
	})).sort((a, b) => b.visits - a.visits);
	const recentFeedback = [...feedback].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20).map((f) => ({
		id: f.id,
		therapist: f.therapist_id ? thById.get(f.therapist_id)?.full_name ?? "Therapist" : "Therapist",
		partner: f.partner_id ? partnerById.get(f.partner_id)?.name ?? null : null,
		rating: f.rating,
		punctuality: f.punctuality,
		professionalism: f.professionalism,
		wouldRebook: f.would_rebook,
		comment: f.comment,
		createdAt: f.created_at
	}));
	const totalVisits = visits.length;
	const completed = visits.filter((v) => v.status === "completed").length;
	const noShows = visits.filter((v) => v.status === "no_show" || v.no_show).length;
	const cancelled = visits.filter((v) => v.status === "cancelled").length;
	return {
		windowDays: days,
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		therapyLabels: THERAPY_LABEL,
		scope: {
			isAdmin: scope.isAdmin,
			partnerName: scope.partnerName,
			areas: scope.isAdmin ? [...areaMap.keys()] : scope.areas
		},
		today: {
			total: todayTotal,
			onVisit,
			enRoute,
			lateForDuty,
			absentToday,
			completedToday,
			cancelledToday,
			unassignedToday,
			therapyMix: todayTherapyMix,
			areaMix: todayAreaMix
		},
		totals: {
			visits: totalVisits,
			completed,
			noShows,
			cancelled,
			completionRate: totalVisits ? Math.round(completed / totalVisits * 100) : 0,
			noShowRate: totalVisits ? Math.round(noShows / totalVisits * 100) : 0,
			revenue: Math.round(revenue),
			therapists: therapists.length,
			activeTherapists: therapists.filter((t) => t.active).length,
			therapyMix,
			statusMix
		},
		board: board.slice(0, 40),
		hotspots,
		therapists: therapistRows,
		roster: therapists.map((t) => ({
			id: t.id,
			name: t.full_name,
			verified: !!t.verified,
			active: !!t.active,
			area: t.area ?? null
		})),
		idleTherapists,
		partners: partnerRows,
		feedback: {
			count: feedback.length,
			avgRating: feedback.length ? Number(avg(feedback.map((f) => f.rating)).toFixed(2)) : null,
			avgPunctuality: feedback.filter((f) => f.punctuality != null).length ? Number(avg(feedback.filter((f) => f.punctuality != null).map((f) => f.punctuality)).toFixed(2)) : null,
			rebookRate: (() => {
				const votes = feedback.filter((f) => f.would_rebook != null);
				return votes.length ? Math.round(votes.filter((f) => f.would_rebook).length / votes.length * 100) : null;
			})(),
			recent: recentFeedback
		}
	};
}
var getPhysioAdminOverview_createServerFn_handler = createServerRpc({
	id: "d66196e314dcb0921b8d6e94d9ec7b5a430af1532ed7cf4a9714895bbce7dc95",
	name: "getPhysioAdminOverview",
	filename: "src/lib/physio-admin.functions.ts"
}, (opts) => getPhysioAdminOverview.__executeServer(opts));
var getPhysioAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 30), 1), 365) })).handler(getPhysioAdminOverview_createServerFn_handler, async ({ data, context }) => {
	const scope = await resolveScope(context);
	return buildOverview(data.days, scope);
});
async function loadVisitForMutation(sb, visitId) {
	const { data, error } = await sb.from("physio_visits").select("id, status, area, therapist_id, partner_id").eq("id", visitId).maybeSingle();
	if (error) throw new Error(error.message);
	if (!data) throw new Error("Visit not found or outside your service area");
	return data;
}
var assignPhysioVisitTherapist_createServerFn_handler = createServerRpc({
	id: "a3e38f0f3330c5e5766ab18f217561c747d2e26fa1877813f3f68facef2ff20c",
	name: "assignPhysioVisitTherapist",
	filename: "src/lib/physio-admin.functions.ts"
}, (opts) => assignPhysioVisitTherapist.__executeServer(opts));
var assignPhysioVisitTherapist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId || !input?.therapistId) throw new Error("visitId and therapistId are required");
	return {
		visitId: String(input.visitId),
		therapistId: String(input.therapistId)
	};
}).handler(assignPhysioVisitTherapist_createServerFn_handler, async ({ data, context }) => {
	await resolveScope(context);
	const sb = context.supabase;
	const visit = await loadVisitForMutation(sb, data.visitId);
	if (!["requested", "assigned"].includes(visit.status)) throw new Error("This visit can no longer be (re)assigned");
	const { data: therapist, error: tErr } = await sb.from("physio_therapists").select("id, verified, active, partner_id").eq("id", data.therapistId).maybeSingle();
	if (tErr) throw new Error(tErr.message);
	if (!therapist) throw new Error("Therapist not found or not on your roster");
	if (!therapist.verified || !therapist.active) throw new Error("Only verified, active therapists can be assigned");
	const { error } = await sb.from("physio_visits").update({
		therapist_id: therapist.id,
		partner_id: therapist.partner_id ?? visit.partner_id,
		status: "assigned"
	}).eq("id", data.visitId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var VISIT_TRANSITIONS = {
	requested: ["cancelled"],
	assigned: ["en_route", "cancelled"],
	en_route: [
		"in_progress",
		"no_show",
		"cancelled"
	],
	in_progress: ["completed", "no_show"]
};
var updatePhysioVisitStatus_createServerFn_handler = createServerRpc({
	id: "b5e95878869b4154f8028652fe736e0199514b3e7f6256f6f9ea48cb5395abe8",
	name: "updatePhysioVisitStatus",
	filename: "src/lib/physio-admin.functions.ts"
}, (opts) => updatePhysioVisitStatus.__executeServer(opts));
var updatePhysioVisitStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	const action = String(input.action ?? "");
	if (![
		"en_route",
		"in_progress",
		"completed",
		"no_show",
		"cancelled"
	].includes(action)) throw new Error("Unknown action");
	if (action === "cancelled" && !input.reason?.trim()) throw new Error("A cancellation reason is required");
	return {
		visitId: String(input.visitId),
		action,
		reason: input.reason?.trim() || null
	};
}).handler(updatePhysioVisitStatus_createServerFn_handler, async ({ data, context }) => {
	await resolveScope(context);
	const sb = context.supabase;
	const visit = await loadVisitForMutation(sb, data.visitId);
	if (!(VISIT_TRANSITIONS[visit.status] ?? []).includes(data.action)) throw new Error(`Cannot move a "${visit.status}" visit to "${data.action}"`);
	if ([
		"en_route",
		"in_progress",
		"completed",
		"no_show"
	].includes(data.action) && !visit.therapist_id) throw new Error("Assign a therapist before updating this visit");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const patch = { status: data.action };
	if (data.action === "in_progress") patch.checked_in_at = now;
	if (data.action === "completed") patch.checked_out_at = now;
	if (data.action === "no_show") patch.no_show = true;
	if (data.action === "cancelled") {
		patch.cancelled_at = now;
		patch.cancel_reason = data.reason;
	}
	const { error } = await sb.from("physio_visits").update(patch).eq("id", data.visitId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var linkPhysioPartnerUser_createServerFn_handler = createServerRpc({
	id: "7d2eafda439d3b917f904844f5b8ee36deeb0d533c46a5cd543cf5033904b73f",
	name: "linkPhysioPartnerUser",
	filename: "src/lib/physio-admin.functions.ts"
}, (opts) => linkPhysioPartnerUser.__executeServer(opts));
var linkPhysioPartnerUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({
	partnerId: String(d.partnerId),
	email: String(d.email).trim().toLowerCase()
})).handler(linkPhysioPartnerUser_createServerFn_handler, async ({ data, context }) => {
	if (!(await resolveScope(context)).isAdmin) throw new Error("Forbidden: admin only");
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	let userId = null;
	for (let page = 1; page <= 10 && !userId; page++) {
		const { data: list, error } = await sb.auth.admin.listUsers({
			page,
			perPage: 200
		});
		if (error) throw new Error(error.message);
		const hit = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === data.email);
		if (hit) userId = hit.id;
		if ((list?.users ?? []).length < 200) break;
	}
	if (!userId) throw new Error("No account found with that email. Ask them to sign up first.");
	const { error } = await sb.from("physio_partners").update({ user_id: userId }).eq("id", data.partnerId);
	if (error) throw new Error(error.message);
	return {
		ok: true,
		userId
	};
});
var linkPhysioTherapistUser_createServerFn_handler = createServerRpc({
	id: "82a26d45a830a68c6a23d1d8eaa57338318486c87a0d858b4c13628e9cfc7292",
	name: "linkPhysioTherapistUser",
	filename: "src/lib/physio-admin.functions.ts"
}, (opts) => linkPhysioTherapistUser.__executeServer(opts));
var linkPhysioTherapistUser = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({
	therapistId: String(d.therapistId),
	email: String(d.email).trim().toLowerCase()
})).handler(linkPhysioTherapistUser_createServerFn_handler, async ({ data, context }) => {
	const scope = await resolveScope(context);
	const client = context.supabase;
	const { data: therapist, error: tErr } = await client.from("physio_therapists").select("id, partner_id").eq("id", data.therapistId).maybeSingle();
	if (tErr) throw new Error(tErr.message);
	if (!therapist) throw new Error("Therapist not found or outside your roster");
	if (!scope.isAdmin && therapist.partner_id !== scope.partnerId) throw new Error("Forbidden: this therapist is not on your roster");
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	let userId = null;
	for (let page = 1; page <= 10 && !userId; page++) {
		const { data: list, error } = await sb.auth.admin.listUsers({
			page,
			perPage: 200
		});
		if (error) throw new Error(error.message);
		const hit = (list?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === data.email);
		if (hit) userId = hit.id;
		if ((list?.users ?? []).length < 200) break;
	}
	if (!userId) throw new Error("No account found with that email. Ask them to sign up first.");
	const { error } = await client.from("physio_therapists").update({ user_id: userId }).eq("id", data.therapistId);
	if (error) throw new Error(error.message);
	return {
		ok: true,
		userId
	};
});
//#endregion
export { assignPhysioVisitTherapist_createServerFn_handler, getPhysioAdminOverview_createServerFn_handler, linkPhysioPartnerUser_createServerFn_handler, linkPhysioTherapistUser_createServerFn_handler, updatePhysioVisitStatus_createServerFn_handler };
