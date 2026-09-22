import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/physician-portal.functions.ts?tss-serverfn-split
var DUTY_LABEL = {
	ward: "Ward duty",
	icu: "ICU duty",
	emergency: "Emergency / casualty",
	special: "Special duty",
	ot: "OT / procedure cover"
};
function hoursBetween(a, b) {
	if (!a || !b) return 0;
	const ms = new Date(b).getTime() - new Date(a).getTime();
	return ms > 0 ? ms / 36e5 : 0;
}
async function buildPortal(userId) {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const asgRes = await sb.from("staffing_assignments").select("*").eq("provider_id", userId).order("applied_at", { ascending: false });
	if (asgRes.error) throw new Error(asgRes.error.message);
	const assignments = asgRes.data ?? [];
	const jobIds = [...new Set(assignments.map((a) => a.job_id))];
	const [jobsRes, fbInRes, fbOutRes, profileRes] = await Promise.all([
		jobIds.length ? sb.from("staffing_jobs").select("*").in("id", jobIds) : Promise.resolve({
			data: [],
			error: null
		}),
		sb.from("staffing_feedback").select("*").eq("provider_id", userId),
		sb.from("physician_duty_feedback").select("*").eq("provider_id", userId),
		sb.from("profiles").select("id, full_name, specialty").eq("id", userId).maybeSingle()
	]);
	for (const r of [
		jobsRes,
		fbInRes,
		fbOutRes,
		profileRes
	]) if (r.error) throw new Error(r.error.message);
	const jobs = jobsRes.data ?? [];
	const jobById = new Map(jobs.map((j) => [j.id, j]));
	const facilityIds = [...new Set(jobs.map((j) => j.facility_id).filter(Boolean))];
	const facRes = facilityIds.length ? await sb.from("profiles").select("id, full_name").in("id", facilityIds) : {
		data: [],
		error: null
	};
	const facilityName = new Map((facRes.data ?? []).map((p) => [p.id, p.full_name ?? "Hospital"]));
	const received = fbInRes.data ?? [];
	const given = fbOutRes.data ?? [];
	const givenByAssignment = new Map(given.map((g) => [g.assignment_id, g]));
	const now = Date.now();
	const duties = assignments.map((a) => {
		const job = jobById.get(a.job_id) ?? {};
		const duty = a.duty_type ?? job.duty_type ?? "ward";
		const starts = job.starts_at ? new Date(job.starts_at).getTime() : null;
		const ends = job.ends_at ? new Date(job.ends_at).getTime() : null;
		let state = a.status;
		if (a.no_show) state = "absent";
		else if (a.cancelled_at) state = "cancelled";
		else if (a.checked_out_at) state = "completed";
		else if (a.checked_in_at) state = "on_duty";
		else if (a.status === "accepted") {
			if (ends && now > ends) state = "overdue";
			else if (starts && now >= starts - 72e5) state = "en_route";
			else state = "scheduled";
		}
		const loggedHours = hoursBetween(a.checked_in_at, a.checked_out_at);
		const scheduledHours = job.starts_at && job.ends_at ? hoursBetween(job.starts_at, job.ends_at) : 0;
		const lateMinutes = a.checked_in_at && job.starts_at ? Math.max(0, Math.round((new Date(a.checked_in_at).getTime() - starts) / 6e4)) : 0;
		return {
			assignmentId: a.id,
			jobId: a.job_id,
			title: job.title ?? "Duty",
			specialty: job.specialty ?? "",
			hospital: facilityName.get(job.facility_id) ?? "Hospital",
			area: job.area ?? "",
			dutyType: duty,
			dutyLabel: DUTY_LABEL[duty] ?? duty,
			shiftLabel: job.shift_label ?? "",
			startsAt: job.starts_at ?? null,
			endsAt: job.ends_at ?? null,
			compensation: job.compensation != null ? Number(job.compensation) : null,
			compensationUnit: job.compensation_unit ?? "shift",
			status: a.status,
			state,
			checkedInAt: a.checked_in_at ?? null,
			checkedOutAt: a.checked_out_at ?? null,
			noShow: Boolean(a.no_show),
			cancelledAt: a.cancelled_at ?? null,
			loggedHours: Math.round(loggedHours * 100) / 100,
			scheduledHours: Math.round(scheduledHours * 100) / 100,
			lateMinutes,
			feedbackGiven: givenByAssignment.get(a.id) ?? null
		};
	});
	const completed = duties.filter((d) => d.state === "completed");
	const commitments = duties.filter((d) => d.status !== "applied" && d.status !== "rejected");
	const noShows = duties.filter((d) => d.noShow).length;
	const cancellations = duties.filter((d) => d.cancelledAt).length;
	const lateArrivals = completed.filter((d) => d.lateMinutes > 15).length;
	const totalHours = duties.reduce((s, d) => s + d.loggedHours, 0);
	const monthStart = /* @__PURE__ */ new Date();
	monthStart.setDate(1);
	monthStart.setHours(0, 0, 0, 0);
	const hoursThisMonth = duties.filter((d) => d.checkedInAt && new Date(d.checkedInAt).getTime() >= monthStart.getTime()).reduce((s, d) => s + d.loggedHours, 0);
	const ratings = received.map((f) => Number(f.rating)).filter((n) => Number.isFinite(n));
	const avgRating = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : null;
	const rehireYes = received.filter((f) => f.would_rehire === true).length;
	const rehireRated = received.filter((f) => f.would_rehire !== null).length;
	const attendance = commitments.length ? (commitments.length - noShows - cancellations) / commitments.length : 1;
	const punctuality = completed.length ? (completed.length - lateArrivals) / completed.length : 1;
	const ratingScore = avgRating ? avgRating / 5 : .8;
	const reliability = Math.round((attendance * .5 + punctuality * .25 + ratingScore * .25) * 100);
	return {
		profile: {
			name: profileRes.data?.full_name ?? "Care physician",
			specialty: profileRes.data?.specialty ?? ""
		},
		reliability: {
			score: Math.max(0, Math.min(100, reliability)),
			attendancePct: Math.round(attendance * 100),
			punctualityPct: Math.round(punctuality * 100),
			avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
			ratingsCount: ratings.length,
			rehirePct: rehireRated ? Math.round(rehireYes / rehireRated * 100) : null,
			noShows,
			cancellations,
			lateArrivals,
			commitments: commitments.length,
			completed: completed.length
		},
		hours: {
			total: Math.round(totalHours * 10) / 10,
			thisMonth: Math.round(hoursThisMonth * 10) / 10,
			avgPerDuty: completed.length ? Math.round(totalHours / completed.length * 10) / 10 : 0
		},
		duties,
		receivedFeedback: received.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 10).map((f) => ({
			id: f.id,
			rating: Number(f.rating),
			punctuality: f.punctuality != null ? Number(f.punctuality) : null,
			professionalism: f.professionalism != null ? Number(f.professionalism) : null,
			wouldRehire: f.would_rehire,
			comment: f.comment ?? "",
			createdAt: f.created_at
		}))
	};
}
var getPhysicianPortal_createServerFn_handler = createServerRpc({
	id: "321f0154e2b5df9f066bdee631238ec92b96cd85edaa1606828e51c95f50430b",
	name: "getPhysicianPortal",
	filename: "src/lib/physician-portal.functions.ts"
}, (opts) => getPhysicianPortal.__executeServer(opts));
var getPhysicianPortal = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getPhysicianPortal_createServerFn_handler, async ({ context }) => buildPortal(context.userId));
var logDutyHours_createServerFn_handler = createServerRpc({
	id: "acb244019fdd9c83f7d23857f133fc48eeecdab70e7c716bd842b1add5be6df2",
	name: "logDutyHours",
	filename: "src/lib/physician-portal.functions.ts"
}, (opts) => logDutyHours.__executeServer(opts));
var logDutyHours = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.assignmentId) throw new Error("assignmentId is required");
	if (input.action !== "check_in" && input.action !== "check_out") throw new Error("Invalid action");
	return input;
}).handler(logDutyHours_createServerFn_handler, async ({ data, context }) => {
	const patch = data.action === "check_in" ? {
		checked_in_at: (/* @__PURE__ */ new Date()).toISOString(),
		no_show: false
	} : {
		checked_out_at: (/* @__PURE__ */ new Date()).toISOString(),
		status: "completed",
		completed_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	const { error } = await context.supabase.from("staffing_assignments").update(patch).eq("id", data.assignmentId).eq("provider_id", context.userId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var submitDutyFeedback_createServerFn_handler = createServerRpc({
	id: "6097cee794333289a93174d530ea7afaff8f37d660780f574992b78466c728c9",
	name: "submitDutyFeedback",
	filename: "src/lib/physician-portal.functions.ts"
}, (opts) => submitDutyFeedback.__executeServer(opts));
var submitDutyFeedback = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.assignmentId) throw new Error("assignmentId is required");
	if (!(input.rating >= 1 && input.rating <= 5)) throw new Error("Rating must be 1-5");
	return input;
}).handler(submitDutyFeedback_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const sb = supabaseAdmin;
	const { data: asg, error: asgErr } = await sb.from("staffing_assignments").select("id, job_id, provider_id").eq("id", data.assignmentId).eq("provider_id", context.userId).maybeSingle();
	if (asgErr) throw new Error(asgErr.message);
	if (!asg) throw new Error("Duty not found for this account");
	const { data: job, error: jobErr } = await sb.from("staffing_jobs").select("id, facility_id").eq("id", asg.job_id).maybeSingle();
	if (jobErr) throw new Error(jobErr.message);
	const { error } = await context.supabase.from("physician_duty_feedback").upsert({
		assignment_id: data.assignmentId,
		job_id: asg.job_id,
		facility_id: job?.facility_id,
		provider_id: context.userId,
		rating: data.rating,
		facility_support: data.facilitySupport ?? null,
		workload: data.workload ?? null,
		would_work_again: data.wouldWorkAgain ?? null,
		comment: data.comment?.trim() || null
	}, { onConflict: "assignment_id" });
	if (error) throw new Error(error.message);
	return { ok: true };
});
//#endregion
export { getPhysicianPortal_createServerFn_handler, logDutyHours_createServerFn_handler, submitDutyFeedback_createServerFn_handler };
