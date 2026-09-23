import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/locum-admin.functions.ts?tss-serverfn-split
async function assertAdmin(ctx) {
	const [{ data: isAdmin, error: e1 }, { data: isSuper, error: e2 }] = await Promise.all([ctx.supabase.rpc("has_role", {
		_user_id: ctx.userId,
		_role: "admin"
	}), ctx.supabase.rpc("has_role", {
		_user_id: ctx.userId,
		_role: "super_admin"
	})]);
	if (e1) throw new Error(e1.message);
	if (e2) throw new Error(e2.message);
	if (!isAdmin && !isSuper) throw new Error("Forbidden: admin only");
}
var H = 36e5;
var DUTY_LABEL = {
	ward: "Ward duty",
	icu: "ICU duty",
	emergency: "Emergency / casualty",
	special: "Special duty",
	ot: "OT / procedure cover"
};
function dutyOf(row) {
	if (row.duty_type) return row.duty_type;
	const hay = `${row.title ?? ""} ${row.specialty ?? ""}`.toLowerCase();
	if (hay.includes("icu") || hay.includes("critical")) return "icu";
	if (hay.includes("emergency") || hay.includes("casualty") || hay.includes("er ")) return "emergency";
	if (hay.includes("ot") || hay.includes("theatre")) return "ot";
	if (hay.includes("special")) return "special";
	return "ward";
}
async function buildLocumOverview(days) {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const since = (/* @__PURE__ */ new Date(Date.now() - days * 24 * H)).toISOString();
	const [jobsRes, asgRes, fbRes, profilesRes, hospitalsRes] = await Promise.all([
		sb.from("staffing_jobs").select("*").gte("created_at", since).order("created_at", { ascending: false }),
		sb.from("staffing_assignments").select("*"),
		sb.from("staffing_feedback").select("*").gte("created_at", since),
		sb.from("profiles").select("id, full_name, specialty, lat, lng"),
		sb.from("hospitals").select("id, name, area, city, lat, lng")
	]);
	for (const r of [
		jobsRes,
		asgRes,
		fbRes,
		profilesRes,
		hospitalsRes
	]) if (r.error) throw new Error(r.error.message);
	const jobs = jobsRes.data ?? [];
	const jobById = new Map(jobs.map((j) => [j.id, j]));
	const assignments = (asgRes.data ?? []).filter((a) => jobById.has(a.job_id));
	const feedback = fbRes.data ?? [];
	const nameOf = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? "—"]));
	const hospitals = hospitalsRes.data ?? [];
	const now = Date.now();
	const startOfDay = /* @__PURE__ */ new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = new Date(startOfDay.getTime() + 24 * H);
	const bump = (o, k) => {
		if (!k) return;
		o[k] = (o[k] ?? 0) + 1;
	};
	let onDuty = 0, enRoute = 0, absentToday = 0, completedToday = 0, committedToday = 0, notCommitted = 0, cancelledByProvider = 0;
	const dutyMix = {};
	const board = [];
	assignments.forEach((a) => {
		const job = jobById.get(a.job_id);
		const duty = dutyOf({
			duty_type: a.duty_type ?? job.duty_type,
			title: job.title,
			specialty: job.specialty
		});
		const starts = job.starts_at ? new Date(job.starts_at).getTime() : null;
		const ends = job.ends_at ? new Date(job.ends_at).getTime() : null;
		const isToday = starts != null && starts >= startOfDay.getTime() && starts < endOfDay.getTime();
		const committed = a.status === "accepted" || a.status === "completed";
		if (committed) bump(dutyMix, duty);
		if (a.cancelled_at) cancelledByProvider++;
		let state = "applied";
		if (a.status === "completed" || a.checked_out_at) state = "completed";
		else if (a.no_show) state = "absent";
		else if (a.cancelled_at) state = "cancelled";
		else if (a.checked_in_at) state = "on_duty";
		else if (committed && starts != null && starts - now <= 6 * H && starts > now) state = "en_route";
		else if (committed && starts != null && now > starts) state = "overdue";
		else if (committed) state = "scheduled";
		if (state === "on_duty") onDuty++;
		if (state === "en_route") enRoute++;
		if (state === "overdue" || state === "absent" && isToday) {
			if (state === "absent" && isToday) absentToday++;
		}
		if (state === "absent" && !isToday) {}
		if (isToday && committed) committedToday++;
		if (isToday && state === "completed") completedToday++;
		if (state === "overdue") notCommitted++;
		board.push({
			assignmentId: a.id,
			jobId: job.id,
			hospital: nameOf.get(job.facility_id) ?? "Hospital",
			title: job.title,
			duty,
			dutyLabel: DUTY_LABEL[duty] ?? duty,
			area: job.area,
			shift: job.shift_label,
			startsAt: job.starts_at,
			endsAt: job.ends_at,
			provider: nameOf.get(a.provider_id) ?? "Care physician",
			providerId: a.provider_id,
			state,
			urgency: job.urgency,
			checkedInAt: a.checked_in_at,
			minutesLate: state === "overdue" && starts != null ? Math.round((now - starts) / 6e4) : null,
			endsInMinutes: state === "on_duty" && ends != null ? Math.round((ends - now) / 6e4) : null
		});
	});
	const stateOrder = [
		"overdue",
		"absent",
		"en_route",
		"on_duty",
		"scheduled",
		"completed",
		"cancelled",
		"applied"
	];
	board.sort((a, b) => stateOrder.indexOf(a.state) - stateOrder.indexOf(b.state) || new Date(a.startsAt ?? 0).getTime() - new Date(b.startsAt ?? 0).getTime());
	const byHospital = /* @__PURE__ */ new Map();
	const jobStatus = {};
	const urgencyMix = {};
	const areaMap = /* @__PURE__ */ new Map();
	let totalSlots = 0, totalFilled = 0, unfilledUrgent = 0;
	jobs.forEach((j) => {
		const duty = dutyOf(j);
		bump(jobStatus, j.status);
		bump(urgencyMix, j.urgency);
		const accepted = assignments.filter((a) => a.job_id === j.id && (a.status === "accepted" || a.status === "completed")).length;
		const slots = j.capacity ?? 1;
		totalSlots += slots;
		totalFilled += Math.min(accepted, slots);
		if (accepted < slots && (j.urgency === "urgent" || j.urgency === "emergency")) unfilledUrgent++;
		const rec = byHospital.get(j.facility_id) ?? {
			facilityId: j.facility_id,
			hospital: nameOf.get(j.facility_id) ?? "Hospital",
			area: j.area ?? null,
			jobs: 0,
			slots: 0,
			filled: 0,
			open: 0,
			urgent: 0,
			duties: {},
			ratings: []
		};
		rec.jobs++;
		rec.slots += slots;
		rec.filled += Math.min(accepted, slots);
		if (accepted < slots) rec.open += slots - accepted;
		if (j.urgency !== "planned") rec.urgent++;
		bump(rec.duties, duty);
		byHospital.set(j.facility_id, rec);
		const areaKey = (j.area || "Unspecified").trim();
		const geo = hospitals.find((h) => (h.area || "").toLowerCase() === areaKey.toLowerCase());
		const arec = areaMap.get(areaKey) ?? {
			area: areaKey,
			city: geo?.city ?? null,
			jobs: 0,
			slots: 0,
			filled: 0,
			urgent: 0,
			lat: geo?.lat ?? j.lat ?? null,
			lng: geo?.lng ?? j.lng ?? null
		};
		arec.jobs++;
		arec.slots += slots;
		arec.filled += Math.min(accepted, slots);
		if (j.urgency !== "planned") arec.urgent++;
		if (arec.lat == null && j.lat != null) {
			arec.lat = j.lat;
			arec.lng = j.lng;
		}
		areaMap.set(areaKey, arec);
	});
	feedback.forEach((f) => {
		const rec = byHospital.get(f.facility_id);
		if (rec) rec.ratings.push(f.rating);
	});
	const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
	const hospitalDemand = [...byHospital.values()].map((h) => ({
		facilityId: h.facilityId,
		hospital: h.hospital,
		area: h.area,
		jobs: h.jobs,
		slots: h.slots,
		filled: h.filled,
		open: h.open,
		urgent: h.urgent,
		fillRate: h.slots ? Math.round(h.filled / h.slots * 100) : 0,
		topDuty: Object.entries(h.duties).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
		avgRatingGiven: h.ratings.length ? Number(avg(h.ratings).toFixed(2)) : null
	})).sort((a, b) => b.jobs - a.jobs);
	const hotspots = [...areaMap.values()].map((a) => ({
		...a,
		unfilled: Math.max(a.slots - a.filled, 0),
		fillRate: a.slots ? Math.round(a.filled / a.slots * 100) : 0
	})).sort((a, b) => b.unfilled - a.unfilled || b.jobs - a.jobs);
	const perProvider = /* @__PURE__ */ new Map();
	assignments.forEach((a) => {
		const job = jobById.get(a.job_id);
		const rec = perProvider.get(a.provider_id) ?? {
			providerId: a.provider_id,
			name: nameOf.get(a.provider_id) ?? "Care physician",
			applications: 0,
			accepted: 0,
			completed: 0,
			noShows: 0,
			cancellations: 0,
			duties: {},
			hospitals: {},
			ratings: [],
			punctuality: [],
			rehire: 0,
			rehireVotes: 0
		};
		rec.applications++;
		if (a.status === "accepted" || a.status === "completed") {
			rec.accepted++;
			bump(rec.duties, dutyOf({
				duty_type: a.duty_type ?? job.duty_type,
				title: job.title
			}));
			bump(rec.hospitals, nameOf.get(job.facility_id) ?? "Hospital");
		}
		if (a.status === "completed") rec.completed++;
		if (a.no_show) rec.noShows++;
		if (a.cancelled_at) rec.cancellations++;
		perProvider.set(a.provider_id, rec);
	});
	feedback.forEach((f) => {
		const rec = perProvider.get(f.provider_id);
		if (!rec) return;
		rec.ratings.push(f.rating);
		if (f.punctuality != null) rec.punctuality.push(f.punctuality);
		if (f.would_rehire != null) {
			rec.rehireVotes++;
			if (f.would_rehire) rec.rehire++;
		}
	});
	const providers = [...perProvider.values()].map((p) => ({
		providerId: p.providerId,
		name: p.name,
		applications: p.applications,
		accepted: p.accepted,
		completed: p.completed,
		noShows: p.noShows,
		cancellations: p.cancellations,
		reliability: p.accepted ? Math.round((p.accepted - p.noShows - p.cancellations) / p.accepted * 100) : null,
		avgRating: p.ratings.length ? Number(avg(p.ratings).toFixed(2)) : null,
		avgPunctuality: p.punctuality.length ? Number(avg(p.punctuality).toFixed(2)) : null,
		rehireRate: p.rehireVotes ? Math.round(p.rehire / p.rehireVotes * 100) : null,
		preferredHospital: Object.entries(p.hospitals).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
		topDuty: Object.entries(p.duties).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
		reviews: p.ratings.length
	})).sort((a, b) => b.accepted - a.accepted);
	const recentFeedback = [...feedback].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20).map((f) => ({
		id: f.id,
		hospital: nameOf.get(f.facility_id) ?? "Hospital",
		provider: nameOf.get(f.provider_id) ?? "Care physician",
		rating: f.rating,
		punctuality: f.punctuality,
		professionalism: f.professionalism,
		wouldRehire: f.would_rehire,
		comment: f.comment,
		createdAt: f.created_at
	}));
	return {
		windowDays: days,
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		dutyLabels: DUTY_LABEL,
		live: {
			onDuty,
			enRoute,
			absentToday,
			completedToday,
			committedToday,
			notCommitted,
			cancelledByProvider,
			dutyMix
		},
		demand: {
			jobs: jobs.length,
			hospitalsEnquired: byHospital.size,
			slots: totalSlots,
			filled: totalFilled,
			fillRate: totalSlots ? Math.round(totalFilled / totalSlots * 100) : 0,
			unfilled: Math.max(totalSlots - totalFilled, 0),
			unfilledUrgent,
			jobStatus,
			urgencyMix
		},
		board: board.slice(0, 40),
		hospitalDemand,
		hotspots,
		providers,
		feedback: {
			count: feedback.length,
			avgRating: feedback.length ? Number(avg(feedback.map((f) => f.rating)).toFixed(2)) : null,
			avgPunctuality: feedback.filter((f) => f.punctuality != null).length ? Number(avg(feedback.filter((f) => f.punctuality != null).map((f) => f.punctuality)).toFixed(2)) : null,
			rehireRate: (() => {
				const votes = feedback.filter((f) => f.would_rehire != null);
				return votes.length ? Math.round(votes.filter((f) => f.would_rehire).length / votes.length * 100) : null;
			})(),
			recent: recentFeedback
		}
	};
}
var getLocumAdminOverview_createServerFn_handler = createServerRpc({
	id: "1f1630e756fb283827dd4a53f2dc8dad4af1e9f9b43d0508457c74493ab3441c",
	name: "getLocumAdminOverview",
	filename: "src/lib/locum-admin.functions.ts"
}, (opts) => getLocumAdminOverview.__executeServer(opts));
var getLocumAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 90), 1), 365) })).handler(getLocumAdminOverview_createServerFn_handler, async ({ data, context }) => {
	await assertAdmin(context);
	return buildLocumOverview(data.days);
});
//#endregion
export { getLocumAdminOverview_createServerFn_handler };
