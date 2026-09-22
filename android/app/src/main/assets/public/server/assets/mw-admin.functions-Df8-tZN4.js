import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as createServerRpc } from "./createServerRpc-T5XsrZ9C.js";
//#region src/lib/mw-admin.functions.ts?tss-serverfn-split
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
function bandOf(instrument, score) {
	if (instrument === "GAD-7") {
		if (score <= 4) return "Minimal";
		if (score <= 9) return "Mild";
		if (score <= 14) return "Moderate";
		return "Severe";
	}
	if (score <= 4) return "Minimal";
	if (score <= 9) return "Mild";
	if (score <= 14) return "Moderate";
	if (score <= 19) return "Moderately severe";
	return "Severe";
}
async function buildOverview(days) {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.js");
	const since = (/* @__PURE__ */ new Date(Date.now() - days * 24 * H)).toISOString();
	const sb = supabaseAdmin;
	const [teamsRes, membersRes, measuresRes, providersRes, profilesRes] = await Promise.all([
		sb.from("mw_care_teams").select("*").gte("created_at", since).order("created_at", { ascending: false }),
		sb.from("mw_care_team_members").select("*"),
		sb.from("mw_measurements").select("*").order("taken_at", { ascending: true }),
		sb.from("provider_directory").select("id, name, specialty, verified, rating, active_case_load"),
		sb.from("profiles").select("id, full_name")
	]);
	for (const r of [
		teamsRes,
		membersRes,
		measuresRes,
		providersRes,
		profilesRes
	]) if (r.error) throw new Error(r.error.message);
	const teams = teamsRes.data ?? [];
	const teamIds = new Set(teams.map((t) => t.id));
	const members = (membersRes.data ?? []).filter((m) => teamIds.has(m.team_id));
	const measurements = (measuresRes.data ?? []).filter((m) => teamIds.has(m.team_id));
	const providers = providersRes.data ?? [];
	const coordinatorName = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name ?? "—"]));
	const now = Date.now();
	const count = (rows, key) => {
		const out = {};
		rows.forEach((r) => {
			const k = key(r);
			if (!k) return;
			out[k] = (out[k] ?? 0) + 1;
		});
		return out;
	};
	let fcMet = 0, fcBreached = 0, fcPending = 0, fcLateMs = 0, asMet = 0, asBreached = 0, asPending = 0;
	const fcTimes = [];
	const asTimes = [];
	teams.forEach((t) => {
		const created = new Date(t.created_at).getTime();
		if (t.first_contact_at) {
			const at = new Date(t.first_contact_at).getTime();
			fcTimes.push((at - created) / H);
			if (at <= new Date(t.first_contact_due_at).getTime()) fcMet++;
			else {
				fcBreached++;
				fcLateMs += at - new Date(t.first_contact_due_at).getTime();
			}
		} else if (now > new Date(t.first_contact_due_at).getTime()) fcBreached++;
		else fcPending++;
		if (t.assembled_at) {
			const at = new Date(t.assembled_at).getTime();
			asTimes.push((at - created) / H);
			if (at <= new Date(t.assembly_due_at).getTime()) asMet++;
			else asBreached++;
		} else if (now > new Date(t.assembly_due_at).getTime()) asBreached++;
		else asPending++;
	});
	const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
	const byTeamScores = /* @__PURE__ */ new Map();
	measurements.forEach((m) => {
		const arr = byTeamScores.get(m.team_id) ?? [];
		arr.push(m);
		byTeamScores.set(m.team_id, arr);
	});
	let improved = 0, worsened = 0, unchanged = 0, singleOnly = 0;
	const deltas = [];
	teams.forEach((t) => {
		const rows = byTeamScores.get(t.id) ?? [];
		if (rows.length === 0) return;
		const first = rows[0];
		const last = rows[rows.length - 1];
		if (rows.length === 1) singleOnly++;
		else {
			const d = last.score - first.score;
			if (d < 0) improved++;
			else if (d > 0) worsened++;
			else unchanged++;
		}
		deltas.push({
			teamId: t.id,
			track: t.track,
			instrument: last.instrument,
			first: first.score,
			latest: last.score,
			delta: last.score - first.score,
			band: last.band || bandOf(last.instrument, last.score),
			points: rows.length,
			lastAt: last.taken_at,
			urgent: !!t.urgent,
			reviewFlag: !!t.review_flag
		});
	});
	deltas.sort((a, b) => b.delta - a.delta);
	const instrumentStats = ["PHQ-9", "GAD-7"].map((instrument) => {
		const rows = measurements.filter((m) => m.instrument === instrument);
		const bands = count(rows, (r) => r.band || bandOf(instrument, r.score));
		return {
			instrument,
			measurements: rows.length,
			avgScore: rows.length ? Number(avg(rows.map((r) => r.score)).toFixed(1)) : null,
			redFlags: rows.filter((r) => r.red_flag).length,
			bands
		};
	});
	const providerMeta = new Map(providers.map((p) => [p.id, p]));
	const perProvider = /* @__PURE__ */ new Map();
	members.forEach((m) => {
		if (!m.provider_id) return;
		const meta = providerMeta.get(m.provider_id);
		const rec = perProvider.get(m.provider_id) ?? {
			providerId: m.provider_id,
			name: m.provider_name ?? meta?.name ?? "Unknown provider",
			specialty: meta?.specialty ?? null,
			verified: !!meta?.verified,
			rating: meta?.rating ?? null,
			assignments: 0,
			confirmed: 0,
			roles: /* @__PURE__ */ new Set(),
			fillHours: []
		};
		rec.assignments++;
		if (m.status === "confirmed") rec.confirmed++;
		rec.roles.add(m.role_label || m.role);
		if (m.created_at && m.updated_at) {
			const h = (new Date(m.updated_at).getTime() - new Date(m.created_at).getTime()) / H;
			if (h >= 0) rec.fillHours.push(h);
		}
		perProvider.set(m.provider_id, rec);
	});
	const providerPerformance = [...perProvider.values()].map((p) => ({
		providerId: p.providerId,
		name: p.name,
		specialty: p.specialty,
		verified: p.verified,
		rating: p.rating,
		assignments: p.assignments,
		confirmed: p.confirmed,
		confirmRate: p.assignments ? Math.round(p.confirmed / p.assignments * 100) : 0,
		roles: [...p.roles],
		avgFillHours: p.fillHours.length ? Number(avg(p.fillHours).toFixed(1)) : null
	})).sort((a, b) => b.assignments - a.assignments);
	const roleMap = /* @__PURE__ */ new Map();
	members.forEach((m) => {
		const rec = roleMap.get(m.role) ?? {
			role: m.role,
			label: m.role_label || m.role,
			total: 0,
			filled: 0,
			required: 0
		};
		rec.total++;
		if (m.provider_id) rec.filled++;
		if (m.required) rec.required++;
		roleMap.set(m.role, rec);
	});
	const roleCoverage = [...roleMap.values()].map((r) => ({
		...r,
		fillRate: r.total ? Math.round(r.filled / r.total * 100) : 0
	})).sort((a, b) => a.fillRate - b.fillRate);
	const coordMap = /* @__PURE__ */ new Map();
	teams.forEach((t) => {
		const id = t.assigned_coordinator_id;
		if (!id) return;
		const rec = coordMap.get(id) ?? {
			id,
			name: coordinatorName.get(id) ?? "Coordinator",
			teams: 0,
			open: 0,
			breaches: 0
		};
		rec.teams++;
		if (t.status !== "completed") rec.open++;
		if (!t.first_contact_at && now > new Date(t.first_contact_due_at).getTime()) rec.breaches++;
		coordMap.set(id, rec);
	});
	const attention = teams.filter((t) => t.review_flag || t.screening_red_flag || !t.first_contact_at && now > new Date(t.first_contact_due_at).getTime() || !t.assembled_at && now > new Date(t.assembly_due_at).getTime()).slice(0, 25).map((t) => ({
		id: t.id,
		track: t.track,
		status: t.status,
		urgent: !!t.urgent,
		redFlag: !!t.screening_red_flag,
		reviewFlag: !!t.review_flag,
		firstContactOverdue: !t.first_contact_at && now > new Date(t.first_contact_due_at).getTime(),
		assemblyOverdue: !t.assembled_at && now > new Date(t.assembly_due_at).getTime(),
		coordinator: t.assigned_coordinator_id ? coordinatorName.get(t.assigned_coordinator_id) ?? "Coordinator" : null,
		createdAt: t.created_at
	}));
	return {
		windowDays: days,
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		totals: {
			teams: teams.length,
			urgent: teams.filter((t) => t.urgent).length,
			redFlag: teams.filter((t) => t.screening_red_flag).length,
			reviewFlag: teams.filter((t) => t.review_flag).length,
			unassigned: teams.filter((t) => !t.assigned_coordinator_id).length,
			measurements: measurements.length,
			byTrack: count(teams, (t) => t.track),
			byStatus: count(teams, (t) => t.status),
			byModality: count(teams, (t) => t.anchor_modality)
		},
		sla: {
			firstContact: {
				met: fcMet,
				breached: fcBreached,
				pending: fcPending,
				avgHours: fcTimes.length ? Number(avg(fcTimes).toFixed(1)) : null,
				avgLateHours: fcBreached ? Number((fcLateMs / fcBreached / H).toFixed(1)) : null
			},
			assembly: {
				met: asMet,
				breached: asBreached,
				pending: asPending,
				avgHours: asTimes.length ? Number(avg(asTimes).toFixed(1)) : null
			}
		},
		scores: {
			instrumentStats,
			improved,
			worsened,
			unchanged,
			singleOnly,
			deltas: deltas.slice(0, 30)
		},
		providerPerformance,
		roleCoverage,
		coordinators: [...coordMap.values()].sort((a, b) => b.teams - a.teams),
		attention
	};
}
var getWellnessAdminOverview_createServerFn_handler = createServerRpc({
	id: "756c92b328e42c607c90caedc35d7e819b0846f0bca867a4775dfc7c0439a977",
	name: "getWellnessAdminOverview",
	filename: "src/lib/mw-admin.functions.ts"
}, (opts) => getWellnessAdminOverview.__executeServer(opts));
var getWellnessAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 90), 1), 365) })).handler(getWellnessAdminOverview_createServerFn_handler, async ({ data, context }) => {
	await assertAdmin(context);
	return buildOverview(data.days);
});
//#endregion
export { getWellnessAdminOverview_createServerFn_handler };
