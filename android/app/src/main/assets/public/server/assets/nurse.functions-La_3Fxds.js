import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/nurse.functions.ts?tss-serverfn-split
var NURSE_HINTS = [
	"nurse",
	"nursing",
	"icu",
	"ward",
	"ot",
	"scrub",
	"maternity",
	"neonatal",
	"attendant"
];
function looksLikeNurseJob(job) {
	const hay = `${job.job_type ?? ""} ${job.duty_type ?? ""} ${job.title ?? ""} ${job.specialty ?? ""} ${job.qualification ?? ""}`.toLowerCase();
	return NURSE_HINTS.some((h) => hay.includes(h));
}
var JOB_COLUMNS = "id, facility_id, job_type, duty_type, title, specialty, qualification, experience_years, area, shift_label, starts_at, ends_at, compensation, compensation_unit, capacity, urgency, description, status, created_at";
function mapProfile(r) {
	return {
		id: r.id,
		fullName: r.full_name,
		phone: r.phone ?? null,
		qualification: r.qualification ?? null,
		registrationNumber: r.registration_number ?? null,
		yearsExperience: r.years_experience ?? 0,
		skills: r.skills ?? [],
		specialty: r.specialty ?? null,
		shiftPrefs: r.shift_prefs ?? [],
		homeCare: !!r.home_care,
		hospitalDuty: !!r.hospital_duty,
		areas: r.areas ?? [],
		city: r.city ?? "Pune",
		preferredFacilities: r.preferred_facilities ?? [],
		languages: r.languages ?? [],
		bio: r.bio ?? null,
		isOnline: !!r.is_online,
		verified: !!r.verified,
		active: !!r.active,
		travelRadiusKm: r.travel_radius_km ?? 10,
		preferredDutyHours: r.preferred_duty_hours ?? 8,
		maxHoursPerDay: r.max_hours_per_day ?? 12,
		minimumPay: r.minimum_pay ?? 0,
		availableToday: !!r.available_today,
		locumAvailable: !!r.locum_available,
		fullTimeInterest: !!r.full_time_interest,
		workingDays: r.working_days ?? [],
		dndEnabled: !!r.dnd_enabled,
		dndStart: r.dnd_start ?? "22:00",
		dndEnd: r.dnd_end ?? "07:00",
		dndAllowEmergency: !!r.dnd_allow_emergency,
		notificationPreferences: r.notification_preferences ?? {},
		recentCourses: r.recent_courses ?? null,
		specialInterests: r.special_interests ?? null,
		certifications: r.certifications ?? []
	};
}
function mapJob(job, assignment, facilityName) {
	return {
		id: job.id,
		assignmentId: assignment?.id ?? null,
		title: job.title ?? "Nursing duty",
		jobType: job.job_type ?? "locum",
		dutyType: job.duty_type ?? null,
		specialty: job.specialty ?? null,
		facilityName,
		area: job.area ?? null,
		shiftLabel: job.shift_label ?? null,
		startsAt: job.starts_at ?? null,
		endsAt: job.ends_at ?? null,
		compensation: job.compensation === null || job.compensation === void 0 ? null : Number(job.compensation),
		compensationUnit: job.compensation_unit ?? null,
		urgency: job.urgency ?? "normal",
		description: job.description ?? null,
		status: assignment?.status ?? job.status ?? "open",
		jobStatus: job.status ?? "open",
		checkedInAt: assignment?.checked_in_at ?? null,
		checkedOutAt: assignment?.checked_out_at ?? null
	};
}
/** Everything the nurse home screen needs: profile, duty lists and open jobs. */
var getNurseBoard_createServerFn_handler = createServerRpc({
	id: "7d4e098907740836d6742a6d8e685ccbbca778d6c3fcdcc3f743e3c85ce67155",
	name: "getNurseBoard",
	filename: "src/lib/nurse.functions.ts"
}, (opts) => getNurseBoard.__executeServer(opts));
var getNurseBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getNurseBoard_createServerFn_handler, async ({ context }) => {
	const sb = context.supabase;
	const { data: nurse, error } = await sb.from("nurses").select("*").eq("user_id", context.userId).maybeSingle();
	if (error) throw new Error(error.message);
	const profile = nurse ? mapProfile(nurse) : null;
	const [assignments, openRows] = await Promise.all([sb.from("staffing_assignments").select("id, job_id, status, duty_type, applied_at, accepted_at, completed_at, checked_in_at, checked_out_at, no_show").eq("provider_id", context.userId).order("applied_at", { ascending: false }).limit(300), sb.from("staffing_jobs").select(JOB_COLUMNS).eq("status", "open").order("starts_at", { ascending: true }).limit(200)]);
	if (assignments.error) throw new Error(assignments.error.message);
	if (openRows.error) throw new Error(openRows.error.message);
	const myAssignments = assignments.data ?? [];
	const jobIds = myAssignments.map((a) => a.job_id);
	let myJobRows = [];
	if (jobIds.length) {
		const { data, error: jErr } = await sb.from("staffing_jobs").select(JOB_COLUMNS).in("id", jobIds);
		if (jErr) throw new Error(jErr.message);
		myJobRows = data ?? [];
	}
	const jobById = new Map(myJobRows.map((j) => [j.id, j]));
	const facilityIds = Array.from(new Set([...openRows.data ?? [], ...myJobRows].map((j) => j.facility_id).filter(Boolean)));
	const nameById = /* @__PURE__ */ new Map();
	if (facilityIds.length) {
		const [{ data: facs }, { data: profs }] = await Promise.all([sb.from("facilities").select("owner_id, name").in("owner_id", facilityIds), sb.from("profiles").select("id, full_name").in("id", facilityIds)]);
		(facs ?? []).forEach((f) => nameById.set(f.owner_id, f.name));
		(profs ?? []).forEach((p) => {
			if (!nameById.has(p.id) && p.full_name) nameById.set(p.id, p.full_name);
		});
	}
	const mine = myAssignments.filter((a) => jobById.has(a.job_id)).map((a) => {
		const job = jobById.get(a.job_id);
		return mapJob(job, a, nameById.get(job.facility_id) ?? null);
	});
	const startOfDay = /* @__PURE__ */ new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = startOfDay.getTime() + 864e5;
	const closed = /* @__PURE__ */ new Set([
		"completed",
		"cancelled",
		"rejected",
		"withdrawn"
	]);
	const today = mine.filter((j) => {
		const t = j.startsAt ? new Date(j.startsAt).getTime() : null;
		return !closed.has(j.status) && t != null && t >= startOfDay.getTime() && t < endOfDay;
	});
	const upcoming = mine.filter((j) => {
		const t = j.startsAt ? new Date(j.startsAt).getTime() : null;
		return !closed.has(j.status) && (t == null || t >= endOfDay);
	});
	const history = mine.filter((j) => {
		const t = j.startsAt ? new Date(j.startsAt).getTime() : null;
		return closed.has(j.status) || t != null && t < startOfDay.getTime();
	});
	const since = Date.now() - 2592e6;
	const earnings30d = Math.round(mine.filter((j) => j.status === "completed" && j.startsAt && new Date(j.startsAt).getTime() >= since).reduce((sum, j) => sum + (j.compensation ?? 0), 0));
	const appliedJobIds = new Set(myAssignments.map((a) => a.job_id));
	const openJobs = (openRows.data ?? []).filter((j) => looksLikeNurseJob(j) && !appliedJobIds.has(j.id)).filter((j) => {
		if (!profile) return true;
		if (profile.areas.length && j.area && !profile.areas.includes(j.area)) return false;
		return true;
	}).map((j) => mapJob(j, null, nameById.get(j.facility_id) ?? null));
	return {
		profile,
		totals: {
			today: today.length,
			upcoming: upcoming.length,
			completed: mine.filter((j) => j.status === "completed").length,
			earnings30d,
			openMatches: openJobs.length
		},
		today,
		upcoming,
		history,
		openJobs
	};
});
var saveNurseProfile_createServerFn_handler = createServerRpc({
	id: "dd0b9567264e249d03b4dedbe5bbd63991fd879a726db260e3f6b8b43dcde617",
	name: "saveNurseProfile",
	filename: "src/lib/nurse.functions.ts"
}, (opts) => saveNurseProfile.__executeServer(opts));
var saveNurseProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.fullName?.trim()) throw new Error("Your name is required");
	if (!Array.isArray(d.skills) || d.skills.length === 0) throw new Error("Pick at least one skill or ward");
	if (d.bio && d.bio.length > 1e3) throw new Error("Keep the summary under 1000 characters");
	return d;
}).handler(saveNurseProfile_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const row = {
		user_id: context.userId,
		full_name: data.fullName.trim(),
		phone: data.phone?.trim() || null,
		qualification: data.qualification || null,
		registration_number: data.registrationNumber?.trim() || null,
		years_experience: Math.max(0, Math.min(60, Number(data.yearsExperience ?? 0) || 0)),
		skills: data.skills,
		specialty: data.specialty?.trim() || null,
		shift_prefs: data.shiftPrefs ?? [],
		home_care: !!data.homeCare,
		hospital_duty: !!data.hospitalDuty,
		areas: data.areas ?? [],
		city: data.city?.trim() || "Pune",
		preferred_facilities: data.preferredFacilities ?? [],
		languages: data.languages ?? [],
		bio: data.bio?.trim() || null,
		travel_radius_km: data.travelRadiusKm ?? 10,
		preferred_duty_hours: data.preferredDutyHours ?? 8,
		max_hours_per_day: data.maxHoursPerDay ?? 12,
		minimum_pay: data.minimumPay ?? 0,
		available_today: !!data.availableToday,
		locum_available: !!data.locumAvailable,
		full_time_interest: !!data.fullTimeInterest,
		working_days: data.workingDays ?? [],
		dnd_enabled: !!data.dndEnabled,
		dnd_start: data.dndStart ?? "22:00",
		dnd_end: data.dndEnd ?? "07:00",
		dnd_allow_emergency: !!data.dndAllowEmergency,
		notification_preferences: data.notificationPreferences ?? {},
		recent_courses: data.recentCourses?.trim() || null,
		special_interests: data.specialInterests?.trim() || null,
		certifications: data.certifications ?? []
	};
	const { data: existing } = await sb.from("nurses").select("id").eq("user_id", context.userId).maybeSingle();
	if (existing) {
		const { error } = await sb.from("nurses").update(row).eq("user_id", context.userId);
		if (error) throw new Error(error.message);
	} else {
		const { error } = await sb.from("nurses").insert(row);
		if (error) throw new Error(error.message);
	}
	return { ok: true };
});
var setNurseOnline_createServerFn_handler = createServerRpc({
	id: "38dfa00c21f036c16151dbda3b01b563034820202b5c21eb4b67164a51b4772f",
	name: "setNurseOnline",
	filename: "src/lib/nurse.functions.ts"
}, (opts) => setNurseOnline.__executeServer(opts));
var setNurseOnline = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ online: !!d?.online })).handler(setNurseOnline_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const { error } = await sb.from("nurses").update({ is_online: data.online }).eq("user_id", context.userId);
	if (error) throw new Error(error.message);
	await sb.from("provider_availability").upsert({
		user_id: context.userId,
		is_online: data.online
	}, { onConflict: "user_id" });
	return {
		ok: true,
		online: data.online
	};
});
var applyToNurseJob_createServerFn_handler = createServerRpc({
	id: "25b1ff230c1e0132ceb16f531ed5589645d5ae9a1d76cc5e1d1f50d39fe9aaaa",
	name: "applyToNurseJob",
	filename: "src/lib/nurse.functions.ts"
}, (opts) => applyToNurseJob.__executeServer(opts));
var applyToNurseJob = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.jobId) throw new Error("jobId is required");
	if (d.note && d.note.length > 500) throw new Error("Keep the note under 500 characters");
	return d;
}).handler(applyToNurseJob_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const { data: job, error: jErr } = await sb.from("staffing_jobs").select("id, duty_type, status").eq("id", data.jobId).maybeSingle();
	if (jErr) throw new Error(jErr.message);
	if (!job || job.status !== "open") throw new Error("This job is no longer open");
	const { error } = await sb.from("staffing_assignments").insert({
		job_id: data.jobId,
		provider_id: context.userId,
		status: "applied",
		duty_type: job.duty_type ?? null,
		application_note: data.note?.trim() || null
	});
	if (error) throw new Error(error.message);
	return { ok: true };
});
var setNurseJobStage_createServerFn_handler = createServerRpc({
	id: "adf7a19fd18bdb3d3de1acc22e31c4634b89d06f48588218ebd6f5cbd25cd9d3",
	name: "setNurseJobStage",
	filename: "src/lib/nurse.functions.ts"
}, (opts) => setNurseJobStage.__executeServer(opts));
var setNurseJobStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.assignmentId) throw new Error("assignmentId is required");
	if (![
		"checked_in",
		"completed",
		"withdrawn"
	].includes(d.stage)) throw new Error("Unknown stage");
	return d;
}).handler(setNurseJobStage_createServerFn_handler, async ({ data, context }) => {
	const sb = context.supabase;
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const patch = data.stage === "checked_in" ? {
		status: "in_progress",
		checked_in_at: now
	} : data.stage === "completed" ? {
		status: "completed",
		checked_out_at: now,
		completed_at: now
	} : {
		status: "withdrawn",
		cancelled_at: now
	};
	const { error } = await sb.from("staffing_assignments").update(patch).eq("id", data.assignmentId).eq("provider_id", context.userId);
	if (error) throw new Error(error.message);
	return { ok: true };
});
var searchNurses_createServerFn_handler = createServerRpc({
	id: "b8168b802366012a48216678db1a059f07af75a97adf236574c81d2e3b4c72f1",
	name: "searchNurses",
	filename: "src/lib/nurse.functions.ts"
}, (opts) => searchNurses.__executeServer(opts));
var searchNurses = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => d ?? {}).handler(searchNurses_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("nurses").select("*").eq("active", true).limit(200);
	if (data.city) q = q.eq("city", data.city);
	if (data.onlineOnly) q = q.eq("is_online", true);
	if (data.homeCareOnly) q = q.eq("home_care", true);
	if (data.skills?.length) q = q.overlaps("skills", data.skills);
	if (data.area) q = q.contains("areas", [data.area]);
	if (data.minExperience) q = q.gte("years_experience", data.minExperience);
	const { data: rows, error } = await q;
	if (error) throw new Error(error.message);
	return { nurses: (rows ?? []).filter((r) => !data.shift || (r.shift_prefs ?? []).includes(data.shift)).map((r) => {
		const p = mapProfile(r);
		return {
			id: p.id,
			fullName: p.fullName,
			phone: p.phone,
			qualification: p.qualification,
			yearsExperience: p.yearsExperience,
			skills: p.skills,
			specialty: p.specialty,
			shiftPrefs: p.shiftPrefs,
			areas: p.areas,
			city: p.city,
			homeCare: p.homeCare,
			hospitalDuty: p.hospitalDuty,
			languages: p.languages,
			isOnline: p.isOnline,
			verified: p.verified,
			preferredFacilities: p.preferredFacilities
		};
	}).sort((a, b) => a.isOnline === b.isOnline ? b.yearsExperience - a.yearsExperience : a.isOnline ? -1 : 1) };
});
//#endregion
export { applyToNurseJob_createServerFn_handler, getNurseBoard_createServerFn_handler, saveNurseProfile_createServerFn_handler, searchNurses_createServerFn_handler, setNurseJobStage_createServerFn_handler, setNurseOnline_createServerFn_handler };
