import { n as supabase } from "./client-BSmVQfT1.js";
/* empty css                 */
import { B as useSession } from "./backend-eXdx240h.js";
/* empty css                   */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { AlertTriangle, Ambulance, Building2, Car, Check, ChevronRight, Loader2, MessageCircle, Navigation, Phone, RefreshCw, ShieldCheck, Stethoscope, Timer, X } from "lucide-react";
//#region src/features/mydox/emergency/catalog.ts
var EMERGENCY_CATALOG = [
	{
		id: "cardiac",
		label: "Cardiac / Chest pain",
		emoji: "❤️",
		routing: "Will route to a cath-lab–ready hospital",
		team: "Cardiac team",
		triage: [{
			q: "When did the pain start?",
			opts: [
				"<30 min",
				"30–60 min",
				">1 hour"
			],
			red: ["<30 min"]
		}, {
			q: "Sweating or breathless?",
			opts: ["Yes", "No"],
			red: ["Yes"]
		}]
	},
	{
		id: "stroke",
		label: "Brain / Stroke",
		emoji: "🧠",
		routing: "Will route to a stroke-ready hospital",
		team: "Neuro team",
		triage: [
			{
				q: "Face drooping on one side?",
				opts: ["Yes", "No"],
				red: ["Yes"]
			},
			{
				q: "Arm weakness or numbness?",
				opts: ["Yes", "No"],
				red: ["Yes"]
			},
			{
				q: "Speech slurred?",
				opts: ["Yes", "No"],
				red: ["Yes"]
			},
			{
				q: "When did it start?",
				opts: [
					"<1 hr",
					"1–3 hr",
					">3 hr"
				],
				red: ["<1 hr"]
			}
		]
	},
	{
		id: "trauma",
		label: "Ortho / Trauma",
		emoji: "🩸",
		routing: "Will route to a trauma centre with blood bank",
		team: "Trauma team",
		triage: [{
			q: "Heavy bleeding?",
			opts: ["Yes", "No"],
			red: ["Yes"]
		}, {
			q: "Is the person conscious?",
			opts: ["Yes", "No"],
			red: ["No"]
		}]
	},
	{
		id: "breathing",
		label: "Chest / Breathing",
		emoji: "🫁",
		routing: "Will route to a hospital with ICU beds",
		team: "Pulmonary team",
		triage: [{
			q: "Can they speak full sentences?",
			opts: ["Yes", "No"],
			red: ["No"]
		}, {
			q: "Lips or face turning bluish?",
			opts: ["Yes", "No"],
			red: ["Yes"]
		}]
	},
	{
		id: "pregnancy",
		label: "Pregnancy / Obstetrics",
		emoji: "🤰",
		routing: "Will route to an OB-ready hospital with neonatal cover",
		team: "OB & neonatal team",
		triage: [{
			q: "How many weeks pregnant?",
			opts: [
				"<28 wk",
				"28–36 wk",
				"37+ wk"
			],
			red: ["<28 wk"]
		}, {
			q: "Main problem?",
			opts: [
				"Bleeding",
				"Contractions",
				"Less movement"
			],
			red: ["Bleeding"]
		}]
	},
	{
		id: "other",
		label: "Something else",
		emoji: "🚑",
		routing: "Will route to the nearest equipped emergency room",
		team: "ER team",
		triage: [{
			q: "Is the person conscious?",
			opts: ["Yes", "No"],
			red: ["No"]
		}, {
			q: "Is there heavy bleeding?",
			opts: ["Yes", "No"],
			red: ["Yes"]
		}]
	}
];
function categoryDef(id) {
	return EMERGENCY_CATALOG.find((c) => c.id === id) ?? null;
}
//#endregion
//#region src/features/mydox/emergency/service.ts
var db$1 = supabase;
var TIMEOUT_MS = 15e3;
async function withDeadline(build) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await build(controller.signal);
	} finally {
		clearTimeout(timer);
	}
}
/** Turns Postgres plumbing into something a person in a crisis can act on. */
function emergencyError(error, fallback) {
	const message = error?.message ?? "";
	if (message.includes("EMERGENCY_ALREADY_TAKEN")) return /* @__PURE__ */ new Error("Someone else accepted this case first. Refresh the queue.");
	if (message.includes("EMERGENCY_CREW_BUSY")) return /* @__PURE__ */ new Error("This crew is already on an active case. Finish or hand it over first.");
	if (message.includes("EMERGENCY_FORBIDDEN")) return /* @__PURE__ */ new Error("This account is not authorised for that action on this case.");
	if (message.includes("EMERGENCY_DISABLED")) return /* @__PURE__ */ new Error("Coordinated dispatch is switched off on this environment. Call 108.");
	if (message.includes("EMERGENCY_LEGACY_ACTIVE")) return new Error(message.replace(/^.*EMERGENCY_LEGACY_ACTIVE[: ]*/, ""));
	if (message.includes("EMERGENCY_NO_RECEIVER")) return /* @__PURE__ */ new Error("No hospital has accepted yet. Do not start transport without a receiving hospital.");
	if (message.includes("EMERGENCY_NO_AMBULANCE")) return /* @__PURE__ */ new Error("This patient is travelling by their own vehicle. No crew is being sent.");
	if (message.includes("EMERGENCY_NO_LOCATION")) return /* @__PURE__ */ new Error("Share your location or type a pickup address before sending.");
	if (message.includes("EMERGENCY_AUTH_REQUIRED")) return /* @__PURE__ */ new Error("Sign in to raise an emergency. Call 108 now if this cannot wait.");
	if (message.includes("EMERGENCY_CLOSED")) return /* @__PURE__ */ new Error("This case has already ended.");
	if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202") return /* @__PURE__ */ new Error("Emergency dispatch is not set up on this database. Apply the emergency dispatch migration. Use the 108 button for urgent help.");
	if (error?.code === "42501") return /* @__PURE__ */ new Error("Access denied for this emergency case.");
	return new Error(message || fallback);
}
async function createEmergencyCase(input) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("create_emergency_case", {
		p_category: input.category,
		p_triage: input.triage,
		p_lat: input.location?.lat ?? null,
		p_lng: input.location?.lng ?? null,
		p_accuracy_m: input.location?.accuracy ?? null,
		p_captured_at: input.location?.capturedAt ?? null,
		p_transport: input.transport,
		p_request_key: input.requestKey
	}).abortSignal(signal).single());
	if (error || !data) throw emergencyError(error, "The emergency could not be confirmed. Call 108 and retry.");
	return data;
}
/** First tap to land in the database wins; everyone else gets ALREADY_TAKEN. */
async function acceptEmergencyCase(caseId, role, options = {}) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("accept_emergency_case", {
		p_case_id: caseId,
		p_role: role,
		p_hospital_id: options.hospitalId ?? null,
		p_bed_label: options.bedLabel ?? null
	}).abortSignal(signal).single());
	if (error || !data) throw emergencyError(error, "Acceptance could not be confirmed. Refresh the queue.");
	return data;
}
async function advanceEmergencyCase(caseId, status, reason) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("advance_emergency_case", {
		p_case_id: caseId,
		p_status: status,
		p_reason: reason ?? null
	}).abortSignal(signal).single());
	if (error || !data) throw emergencyError(error, "The status change could not be confirmed. Refresh before continuing.");
	return data;
}
/**
* Advances the specialist page one wave: in-house first choice, then the rest
* of that hospital's in-house doctors, then every matching specialist in the
* area. The server decides whether enough time has passed.
*/
async function escalateSpecialists(caseId, afterSeconds) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("escalate_emergency_specialists", {
		p_case_id: caseId,
		p_after_seconds: afterSeconds ?? null
	}).abortSignal(signal));
	if (error) throw emergencyError(error, "Could not widen the specialist search.");
	return typeof data === "number" ? data : 0;
}
/**
* Pushes the search radius out one step when nobody has accepted. Starts at
* 4 km and grows a step roughly every 22 seconds, up to the case ceiling. Pass
* nothing and the server uses its own emergency_settings row. Safe to call on a
* timer: calls that arrive early are ignored.
*/
async function expandSearch(caseId, afterSeconds, stepKm) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("expand_emergency_search", {
		p_case_id: caseId,
		p_after_seconds: afterSeconds ?? null,
		p_step_km: stepKm ?? null
	}).abortSignal(signal));
	if (error) throw emergencyError(error, "Could not widen the search area.");
	return typeof data === "number" ? data : null;
}
/** Passes on a case without affecting anyone else's copy of it. */
async function declineEmergencyCase(caseId, role) {
	const { error } = await db$1.rpc("decline_emergency_case", {
		p_case_id: caseId,
		p_role: role
	});
	if (error) throw emergencyError(error, "Could not pass on this case.");
}
async function postAmbulancePing(caseId, location) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("post_emergency_ambulance_ping", {
		p_case_id: caseId,
		p_lat: location.lat,
		p_lng: location.lng,
		p_accuracy_m: location.accuracy ?? null,
		p_heading_deg: location.heading ?? null,
		p_speed_kph: location.speed ?? null,
		p_captured_at: location.capturedAt ?? (/* @__PURE__ */ new Date()).toISOString()
	}).abortSignal(signal).single());
	if (error || !data) throw emergencyError(error, "Crew location could not be sent.");
	return data;
}
async function fetchLatestPing(caseId) {
	const { data, error } = await withDeadline((signal) => db$1.from("emergency_ambulance_pings").select("*").eq("case_id", caseId).order("captured_at", { ascending: false }).limit(1).abortSignal(signal).maybeSingle());
	if (error) throw emergencyError(error, "Ambulance location could not be read.");
	return data ?? null;
}
/** Recent breadcrumbs so the map can draw the route actually driven. */
async function fetchPingTrail(caseId, limit = 60) {
	const { data, error } = await withDeadline((signal) => db$1.from("emergency_ambulance_pings").select("*").eq("case_id", caseId).order("captured_at", { ascending: false }).limit(limit).abortSignal(signal));
	if (error) throw emergencyError(error, "Ambulance route could not be read.");
	return (data ?? []).slice().reverse();
}
async function fetchMyActiveCase(userId) {
	const { data, error } = await withDeadline((signal) => db$1.from("emergency_cases").select("*").eq("patient_id", userId).order("created_at", { ascending: false }).limit(1).abortSignal(signal));
	if (error) throw emergencyError(error, "Your emergency status could not be refreshed.");
	return (data ?? [])[0] ?? null;
}
async function fetchDispatchQueue(role) {
	const { data, error } = await withDeadline((signal) => db$1.rpc("list_emergency_dispatch_queue", { p_role: role }).abortSignal(signal));
	if (error) throw emergencyError(error, "The emergency queue could not be refreshed.");
	return data ?? [];
}
/** Keeps this responder in the "online nearby" pool that new cases page. */
async function heartbeatResponder(lat, lng) {
	const { error } = await db$1.rpc("heartbeat_responder", {
		p_lat: lat,
		p_lng: lng
	});
	if (error) throw emergencyError(error, "Could not report this crew as online.");
}
/** The hospital this account manages, if any. Drives the hospital console. */
async function fetchMyHospital(userId) {
	const { data, error } = await db$1.from("hospitals").select("id,name,area,emergency_mode,er_beds_available,has_icu,has_ot,has_cath_lab,has_nicu,has_blood_bank,lat,lng").eq("owner_id", userId).limit(1).maybeSingle();
	if (error) throw emergencyError(error, "Could not load this hospital.");
	return data ?? null;
}
/** Flips this hospital in or out of emergency mode. Off means it is not paged. */
async function setHospitalEmergencyMode(hospitalId, on) {
	const { error } = await db$1.from("hospitals").update({
		emergency_mode: on,
		emergency_mode_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", hospitalId);
	if (error) throw emergencyError(error, "Could not change emergency mode.");
}
/** Admin operations view. RLS lets only the admin role read across all cases. */
async function fetchAllOpenCases() {
	const { data, error } = await withDeadline((signal) => db$1.from("emergency_cases").select("*").not("status", "in", "(cancelled,closed,admitted)").order("created_at", { ascending: false }).limit(100).abortSignal(signal));
	if (error) throw emergencyError(error, "The emergency board could not be loaded.");
	return data ?? [];
}
//#endregion
//#region src/features/mydox/emergency/types.ts
var OPEN_STATUSES = [
	"searching",
	"hospital_assigned",
	"ambulance_en_route",
	"ambulance_arrived",
	"transporting",
	"handed_over"
];
function isOpenCase(c) {
	return !!c && OPEN_STATUSES.includes(c.status);
}
/** Reads the way a frightened person reads, not the way the column is named. */
function statusHeadline(c) {
	if (!c) return "No emergency raised";
	switch (c.status) {
		case "handed_over": return "Handed over to the hospital team";
		case "searching":
			if (c.location_status === "needs_location") return "Waiting for your location";
			return c.transport_mode === "self" ? "Finding a hospital that can take you now" : "Alerting ambulances and hospitals near you";
		case "hospital_assigned": return "Hospital ready · drive there now";
		case "ambulance_en_route": return "Ambulance on the way to you";
		case "ambulance_arrived": return "Ambulance has reached you";
		case "transporting": return "On the way to the hospital";
		case "admitted": return "Admitted at the hospital";
		case "cancelled": return "Emergency cancelled";
		case "closed": return "Emergency closed";
	}
}
/** "6 min" reads better than "352 seconds" when someone is frightened. */
function etaLabel(seconds) {
	if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null;
	const minutes = Math.max(1, Math.round(seconds / 60));
	return minutes === 1 ? "about 1 min away" : `about ${minutes} min away`;
}
function emergencyContacts(c) {
	return [{
		name: c.contact_1_name,
		phone: c.contact_1_phone
	}, {
		name: c.contact_2_name,
		phone: c.contact_2_phone
	}].filter((entry) => !!entry.phone);
}
//#endregion
//#region src/features/mydox/emergency/hooks.ts
/** Realtime is the fast path; the interval is the safety net on a flaky link. */
var POLL_MS = 4e3;
var PING_INTERVAL_MS = 1e4;
var HEARTBEAT_MS = 45e3;
/** Radius grows 4 km -> 5 -> 6 ... one step per interval until someone accepts. */
/**
* Left undefined on purpose: the server reads its own emergency_settings row,
* so the 20-25 second window is tuned in the database, not in a rebuild. These
* client timers are a backup for the pg_cron worker, not the source of truth.
*/
var RADIUS_STEP_SECONDS = void 0;
var SPECIALIST_WAVE_SECONDS = void 0;
/** The server owns the clock, so asking often is cheap and never skips ahead. */
var ESCALATION_TICK_MS = 5e3;
function useLiveRefresh(key, refresh, table, filter) {
	useEffect(() => {
		if (!key) return;
		refresh();
		const channel = supabase.channel(`emergency:${table}:${key}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table,
			...filter ? { filter } : {}
		}, () => refresh()).subscribe((status) => {
			if (status === "SUBSCRIBED") refresh();
		});
		const poll = setInterval(() => {
			if (!document.hidden) refresh();
		}, POLL_MS);
		const onWake = () => {
			if (!document.hidden) refresh();
		};
		window.addEventListener("online", onWake);
		document.addEventListener("visibilitychange", onWake);
		return () => {
			clearInterval(poll);
			window.removeEventListener("online", onWake);
			document.removeEventListener("visibilitychange", onWake);
			supabase.removeChannel(channel);
		};
	}, [
		key,
		table,
		filter,
		refresh
	]);
}
function useEmergencyCase() {
	const { user, loading: authLoading } = useSession();
	const userId = user?.id ?? null;
	const [state, setState] = useState({
		row: null,
		loading: true,
		error: null
	});
	const [busy, setBusy] = useState(false);
	const alive = useRef(true);
	const inFlight = useRef(false);
	useEffect(() => {
		alive.current = true;
		return () => {
			alive.current = false;
		};
	}, []);
	const refresh = useCallback(async () => {
		if (!userId || inFlight.current) return;
		inFlight.current = true;
		try {
			const row = await fetchMyActiveCase(userId);
			if (alive.current) setState({
				row,
				loading: false,
				error: null
			});
		} catch (error) {
			if (alive.current) setState((prev) => ({
				...prev,
				loading: false,
				error: error instanceof Error ? error.message : "Status could not be refreshed."
			}));
		} finally {
			inFlight.current = false;
		}
	}, [userId]);
	const refreshNow = useCallback(() => {
		refresh();
	}, [refresh]);
	useLiveRefresh(userId ?? "", refreshNow, "emergency_cases", userId ? `patient_id=eq.${userId}` : void 0);
	const row = state.row;
	const open = isOpenCase(row);
	const caseId = open && row ? row.id : "";
	const needsAmbulance = open && !!row && !row.ambulance_id && row.transport_mode === "ambulance";
	const needsHospital = open && !!row && !row.hospital_id;
	const needsDoctor = open && !!row && !row.doctor_id;
	/**
	* Drives both escalations while nobody has accepted: widen the radius, and
	* step the specialist page through its waves. Each call is a no-op until the
	* server's own timer says it is due.
	*/
	useEffect(() => {
		if (!caseId || !needsAmbulance && !needsHospital && !needsDoctor) return;
		const tick = () => {
			if (document.hidden) return;
			if (needsAmbulance || needsHospital) expandSearch(caseId, RADIUS_STEP_SECONDS).then(() => refreshNow()).catch(() => void 0);
			if (needsDoctor) escalateSpecialists(caseId, SPECIALIST_WAVE_SECONDS).then((added) => {
				if (added) refreshNow();
			}).catch(() => void 0);
		};
		const timer = setInterval(tick, ESCALATION_TICK_MS);
		return () => clearInterval(timer);
	}, [
		caseId,
		needsAmbulance,
		needsHospital,
		needsDoctor,
		refreshNow
	]);
	const run = useCallback(async (operation) => {
		setBusy(true);
		try {
			return await operation();
		} finally {
			if (alive.current) setBusy(false);
			refreshNow();
		}
	}, [refreshNow]);
	return {
		userId,
		case: row,
		open,
		busy,
		loading: authLoading || !!userId && state.loading,
		error: !authLoading && !userId ? "Sign in to raise an emergency." : state.error,
		refresh: refreshNow,
		create: (input) => run(async () => {
			const created = await createEmergencyCase(input);
			if (alive.current) setState({
				row: created,
				loading: false,
				error: null
			});
			return created;
		}),
		cancel: (reason) => run(async () => {
			if (!row) throw new Error("No emergency to cancel.");
			const next = await advanceEmergencyCase(row.id, "cancelled", reason);
			if (alive.current) setState({
				row: next,
				loading: false,
				error: null
			});
			return next;
		})
	};
}
/** Patient-side view of the crew's GPS. Draws only points the crew actually sent. */
function useAmbulanceTrack(caseRow) {
	const enabled = !!caseRow?.ambulance_id && isOpenCase(caseRow);
	const caseId = enabled ? caseRow.id : "";
	const [latest, setLatest] = useState(null);
	const [trail, setTrail] = useState([]);
	const [error, setError] = useState(null);
	const refresh = useCallback(() => {
		if (!caseId) return;
		fetchLatestPing(caseId).then((ping) => {
			setLatest(ping);
			setError(null);
		}).catch((e) => setError(e.message));
		fetchPingTrail(caseId).then(setTrail).catch(() => void 0);
	}, [caseId]);
	useLiveRefresh(caseId, refresh, "emergency_ambulance_pings", caseId ? `case_id=eq.${caseId}` : void 0);
	useEffect(() => {
		if (!caseId) {
			setLatest(null);
			setTrail([]);
		}
	}, [caseId]);
	return {
		enabled,
		latest,
		trail,
		live: useMemo(() => !!latest && Date.now() - Date.parse(latest.received_at) < 3e4, [latest]),
		error,
		refresh
	};
}
/**
* Paging for an ambulance, hospital or doctor account. Keeps the account in the
* online pool and surfaces only cases it was actually targeted for.
* Pass nulls for a patient session and the hook does nothing.
*/
function useEmergencyNotifications(lat, lng, role = "ambulance") {
	const { user } = useSession();
	const userId = user?.id ?? null;
	const enabled = !!userId && lat !== null && lng !== null;
	const [cases, setCases] = useState([]);
	const [error, setError] = useState(null);
	const seen = useRef(/* @__PURE__ */ new Set());
	const [incoming, setIncoming] = useState(null);
	const refresh = useCallback(() => {
		if (!enabled) return;
		fetchDispatchQueue(role).then((rows) => {
			setCases(rows);
			setError(null);
			const fresh = rows.find((row) => !seen.current.has(row.id));
			rows.forEach((row) => seen.current.add(row.id));
			if (fresh) setIncoming(fresh);
		}).catch((e) => setError(e.message));
	}, [enabled, role]);
	useLiveRefresh(enabled ? `${userId}:${role}` : "", refresh, "emergency_dispatch_targets");
	useEffect(() => {
		if (!enabled) return;
		const usable = lat !== null && lng !== null && (Math.abs(lat) > .001 || Math.abs(lng) > .001);
		const beat = () => {
			heartbeatResponder(usable ? lat : null, usable ? lng : null).catch(() => void 0);
		};
		beat();
		const timer = setInterval(beat, HEARTBEAT_MS);
		return () => clearInterval(timer);
	}, [
		enabled,
		lat,
		lng
	]);
	return {
		enabled,
		cases,
		incoming,
		error,
		refresh,
		dismissIncoming: () => setIncoming(null),
		accept: async (caseId, options) => {
			const saved = await acceptEmergencyCase(caseId, role, options ?? {});
			refresh();
			return saved;
		},
		decline: async (caseId) => {
			await declineEmergencyCase(caseId, role);
			setCases((prev) => prev.filter((row) => row.id !== caseId));
			refresh();
		},
		advance: async (caseId, status) => {
			const saved = await advanceEmergencyCase(caseId, status);
			refresh();
			return saved;
		}
	};
}
/**
* Posts the crew's GPS roughly every ten seconds while a case is live, so the
* patient watches a vehicle that is really moving.
*/
function useAmbulanceBeacon(caseRow, userId) {
	const active = !!caseRow && caseRow.ambulance_id === userId && isOpenCase(caseRow);
	const caseId = active ? caseRow.id : "";
	const [lastSentAt, setLastSentAt] = useState(null);
	const [error, setError] = useState(null);
	const sending = useRef(false);
	useEffect(() => {
		if (!caseId || typeof navigator === "undefined" || !navigator.geolocation) return;
		let cancelled = false;
		const send = () => {
			if (sending.current || cancelled) return;
			navigator.geolocation.getCurrentPosition((position) => {
				if (cancelled) return;
				sending.current = true;
				postAmbulancePing(caseId, {
					lat: position.coords.latitude,
					lng: position.coords.longitude,
					accuracy: position.coords.accuracy,
					heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
					speed: Number.isFinite(position.coords.speed) ? (position.coords.speed ?? 0) * 3.6 : null,
					capturedAt: new Date(position.timestamp).toISOString()
				}).then((ping) => {
					if (!cancelled) {
						setLastSentAt(ping.received_at);
						setError(null);
					}
				}).catch((e) => {
					if (!cancelled) setError(e.message);
				}).finally(() => {
					sending.current = false;
				});
			}, (geoError) => {
				if (!cancelled) setError(geoError.message || "Allow location so the patient can see the ambulance moving.");
			}, {
				enableHighAccuracy: true,
				maximumAge: 5e3,
				timeout: 9e3
			});
		};
		send();
		const timer = setInterval(send, PING_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [caseId]);
	return {
		active,
		lastSentAt,
		error
	};
}
function validCoordinates(lat, lng) {
	return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 && typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}
function validLocation(location) {
	return !!location && validCoordinates(location.lat, location.lng) && Number.isFinite(location.accuracy) && location.accuracy >= 0 && location.accuracy <= 1e5 && Number.isFinite(Date.parse(location.capturedAt));
}
function isFreshLocation(location, now = Date.now()) {
	if (!validLocation(location)) return false;
	const age = now - Date.parse(location.capturedAt);
	return age >= -5e3 && age <= 6e4;
}
function locationFromPosition(position) {
	const { latitude: lat, longitude: lng, accuracy } = position.coords;
	if (!Number.isFinite(position.timestamp)) throw new Error("The phone returned an invalid location time. Retry location.");
	const location = {
		lat,
		lng,
		accuracy,
		capturedAt: new Date(position.timestamp).toISOString()
	};
	if (!validLocation(location)) throw new Error("The phone returned an invalid location. Retry or enter the pickup manually.");
	if (!isFreshLocation(location)) throw new Error("The phone returned an old location. Retry to get your current position.");
	return location;
}
function locationErrorMessage(code) {
	if (code === 1) return "Location permission is blocked. Allow location for this app/site in your device settings, then retry.";
	if (code === 3) return "Location timed out. Turn on device location and retry, or enter the pickup manually.";
	return "Current location is unavailable. Turn on device location and retry, or enter the pickup manually.";
}
/** A cancellable watcher used by both portals. No database, profile writes or fallback coordinates. */
function watchDeviceLocation(onLocation, onError, geo = typeof navigator === "undefined" ? void 0 : navigator.geolocation, secure = typeof window !== "undefined" && window.isSecureContext) {
	let stopped = false;
	let watchId;
	if (!secure) {
		onError("Location needs a secure HTTPS app/site (or localhost for development).");
		return () => {};
	}
	if (!geo) {
		onError("This device does not support location. Enter the pickup manually or call for help.");
		return () => {};
	}
	const stop = () => {
		stopped = true;
		if (watchId !== void 0) geo.clearWatch(watchId);
	};
	try {
		watchId = geo.watchPosition((position) => {
			if (stopped) return;
			try {
				onLocation(locationFromPosition(position));
			} catch (error) {
				onError(error instanceof Error ? error.message : "Location unavailable.");
			}
		}, (error) => {
			if (!stopped) onError(locationErrorMessage(error.code));
		}, {
			enableHighAccuracy: true,
			maximumAge: 0,
			timeout: 12e3
		});
	} catch {
		onError("The device could not start location detection. Retry or enter the pickup manually.");
	}
	return stop;
}
//#endregion
//#region src/features/mydox/ambulance/LocationMap.tsx
/** Real received points only. Short interpolation smooths two measurements;
* there is no extrapolation, fabricated route, ETA, acceptance or arrival timer.
*/
function LocationMap({ own, pickup, ownLabel = "This device", pickupLabel = "Patient pickup", height = 210, ownIsAmbulance = false, ownStale = false, navigationUrl }) {
	const host = useRef(null);
	const mapRef = useRef(null);
	const libRef = useRef(null);
	const ownMarker = useRef(null), pickupMarker = useRef(null);
	const ownCircle = useRef(null), pickupCircle = useRef(null);
	const frame = useRef(0), fitted = useRef("");
	const navigation = useRef(navigationUrl);
	navigation.current = navigationUrl;
	const [ready, setReady] = useState(false), [error, setError] = useState(null), [center, setCenter] = useState(0);
	const hasOwn = validLocation(own), hasPickup = validLocation(pickup), available = hasOwn || hasPickup;
	useEffect(() => {
		if (!available || !host.current) return;
		let alive = true;
		let observer;
		let created = null;
		import("leaflet").then((L) => {
			if (!alive || !host.current) return;
			libRef.current = L;
			const map = L.map(host.current, {
				scrollWheelZoom: false,
				attributionControl: true
			});
			created = map;
			mapRef.current = map;
			map.on("click", () => {
				if (navigation.current) window.open(navigation.current, "_blank", "noopener,noreferrer");
			});
			L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
				maxZoom: 19,
				attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
			}).on("tileerror", () => {
				if (alive) setError("Map tiles unavailable. The Maps navigation link still works.");
			}).addTo(map);
			if (typeof ResizeObserver !== "undefined") {
				observer = new ResizeObserver(() => map.invalidateSize());
				observer.observe(host.current);
			}
			setReady(true);
		}).catch(() => {
			if (alive) setError("Map could not load. Use the Maps navigation link.");
		});
		return () => {
			alive = false;
			observer?.disconnect();
			cancelAnimationFrame(frame.current);
			created?.remove();
			mapRef.current = null;
			ownMarker.current = null;
			pickupMarker.current = null;
			ownCircle.current = null;
			pickupCircle.current = null;
			fitted.current = "";
			setReady(false);
		};
	}, [available]);
	useEffect(() => {
		const map = mapRef.current, L = libRef.current;
		if (!ready || !map || !L) return;
		cancelAnimationFrame(frame.current);
		const points = [];
		if (validLocation(own)) {
			const point = [own.lat, own.lng];
			points.push(point);
			const icon = L.divIcon({
				className: "",
				html: ownIsAmbulance ? `<span class="amb-vehicle-marker${ownStale ? " amb-vehicle-stale" : ""}" aria-label="Ambulance">🚑</span>` : "<span class=\"amb-device-marker\"></span>",
				iconSize: [36, 36],
				iconAnchor: [18, 18]
			});
			if (!ownMarker.current) {
				ownMarker.current = L.marker(point, {
					icon,
					title: ownLabel
				}).addTo(map);
				ownMarker.current.on("click", () => {
					if (navigation.current) window.open(navigation.current, "_blank", "noopener,noreferrer");
				});
				ownCircle.current = L.circle(point, {
					radius: own.accuracy,
					color: "#2563EB",
					weight: 1,
					fillOpacity: .06
				}).addTo(map);
			} else {
				const marker = ownMarker.current, from = marker.getLatLng();
				const start = performance.now();
				const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
				if (ownStale || reduced) marker.setLatLng(point);
				else {
					const move = (time) => {
						const progress = Math.min(1, (time - start) / 650);
						marker.setLatLng([from.lat + (own.lat - from.lat) * progress, from.lng + (own.lng - from.lng) * progress]);
						if (progress < 1) frame.current = requestAnimationFrame(move);
					};
					frame.current = requestAnimationFrame(move);
				}
				marker.setIcon(icon);
			}
			ownMarker.current.bindTooltip(`${ownLabel}${ownStale ? " · last known" : ""}`, { direction: "top" });
			ownCircle.current?.setLatLng(point).setRadius(own.accuracy);
		} else {
			ownMarker.current?.remove();
			ownMarker.current = null;
			ownCircle.current?.remove();
			ownCircle.current = null;
		}
		if (validLocation(pickup)) {
			const point = [pickup.lat, pickup.lng];
			points.push(point);
			if (!pickupMarker.current) {
				const icon = L.divIcon({
					className: "",
					html: "<span class=\"amb-pickup-marker\">📍</span>",
					iconSize: [32, 32],
					iconAnchor: [16, 28]
				});
				pickupMarker.current = L.marker(point, {
					icon,
					title: pickupLabel
				}).bindTooltip(pickupLabel, { direction: "top" }).addTo(map);
				pickupMarker.current.on("click", () => {
					if (navigation.current) window.open(navigation.current, "_blank", "noopener,noreferrer");
				});
				pickupCircle.current = L.circle(point, {
					radius: pickup.accuracy,
					color: "#DC2626",
					weight: 1,
					fillOpacity: .06
				}).addTo(map);
			} else pickupMarker.current.setLatLng(point);
			pickupMarker.current.bindTooltip(pickupLabel, { direction: "top" });
			pickupCircle.current?.setLatLng(point).setRadius(pickup.accuracy);
		} else {
			pickupMarker.current?.remove();
			pickupMarker.current = null;
			pickupCircle.current?.remove();
			pickupCircle.current = null;
		}
		const key = `${hasOwn}:${hasPickup}:${pickup?.lat}:${pickup?.lng}:${center}`;
		const outsideView = !!fitted.current && points.some((point) => !map.getBounds().contains(point));
		if (points.length && (key !== fitted.current || outsideView)) {
			fitted.current = key;
			if (points.length > 1) map.fitBounds(L.latLngBounds(points), {
				padding: [38, 38],
				maxZoom: 16
			});
			else map.setView(points[0], 16);
		}
		return () => cancelAnimationFrame(frame.current);
	}, [
		ready,
		own,
		pickup,
		ownLabel,
		pickupLabel,
		ownIsAmbulance,
		ownStale,
		center,
		hasOwn,
		hasPickup
	]);
	if (!available) return /* @__PURE__ */ jsx("p", {
		className: "amb-panel-note",
		children: "Waiting for a location update."
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "amb-location-map",
		children: [
			/* @__PURE__ */ jsx("div", {
				ref: host,
				style: {
					height,
					width: "100%",
					background: "#E6EDE8",
					borderRadius: 12
				},
				"aria-label": `Map of ambulance and ${pickupLabel.toLowerCase()}`
			}),
			error && /* @__PURE__ */ jsx("p", {
				className: "amb-panel-note",
				role: "status",
				children: error
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "amb-map-legend",
				children: [/* @__PURE__ */ jsxs("span", { children: [
					hasOwn && `${ownIsAmbulance ? "🚑" : "🔵"} ${ownLabel}${ownStale ? " · last known" : ""}`,
					hasOwn && hasPickup ? " · " : "",
					hasPickup && `📍 ${pickupLabel}`
				] }), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setCenter((n) => n + 1),
					children: "Recenter"
				})]
			}),
			navigationUrl && /* @__PURE__ */ jsxs("a", {
				className: "amb-map-navigate",
				href: navigationUrl,
				target: "_blank",
				rel: "noopener noreferrer",
				children: [
					"Tap the map or here to navigate to ",
					pickupLabel.toLowerCase(),
					" in Maps →"
				]
			})
		]
	});
}
//#endregion
//#region src/features/mydox/ambulance/useDeviceLocation.ts
/** Per-account, foreground-only GPS. Nothing is written to the shared profiles directory. */
function useDeviceLocation(scope, enabled = true) {
	const [retry, setRetry] = useState(0);
	const [now, setNow] = useState(Date.now);
	const [snapshot, setSnapshot] = useState({
		scope: null,
		retry: -1,
		location: null,
		loading: false,
		error: null
	});
	useEffect(() => {
		if (!scope || !enabled) return;
		let alive = true;
		let stopWatch = () => {};
		let watchdog;
		let generation = 0;
		const stop = () => {
			generation++;
			stopWatch();
			clearTimeout(watchdog);
		};
		const start = () => {
			stop();
			if (document.hidden) return;
			const token = generation;
			setSnapshot({
				scope,
				retry,
				location: null,
				loading: true,
				error: null
			});
			const fail = (error) => {
				if (!alive || generation !== token) return;
				clearTimeout(watchdog);
				setSnapshot({
					scope,
					retry,
					location: null,
					loading: false,
					error
				});
			};
			watchdog = setTimeout(() => fail("Still waiting for location. Allow the permission prompt, retry, or enter the pickup manually."), 16e3);
			stopWatch = watchDeviceLocation((location) => {
				if (!alive || generation !== token) return;
				clearTimeout(watchdog);
				setNow(Date.now());
				setSnapshot({
					scope,
					retry,
					location,
					loading: false,
					error: null
				});
			}, fail);
		};
		const visibility = () => {
			if (document.hidden) {
				stop();
				setSnapshot({
					scope,
					retry,
					location: null,
					loading: false,
					error: "Location paused while the app is in the background."
				});
			} else start();
		};
		start();
		const clock = setInterval(() => setNow(Date.now()), 5e3);
		document.addEventListener("visibilitychange", visibility);
		return () => {
			alive = false;
			stop();
			clearInterval(clock);
			document.removeEventListener("visibilitychange", visibility);
		};
	}, [
		scope,
		enabled,
		retry
	]);
	const current = !!scope && enabled && snapshot.scope === scope && snapshot.retry === retry;
	const location = current ? snapshot.location : null;
	const fresh = isFreshLocation(location, now);
	return {
		location,
		fresh,
		refresh: useCallback(() => setRetry((value) => value + 1), []),
		loading: !!scope && enabled && (!current || snapshot.loading),
		error: current ? snapshot.error || (location && !fresh ? "Location is old. Retry before using it as your current position." : null) : null
	};
}
//#endregion
//#region src/features/mydox/emergency/EmergencyProfile.tsx
/**
* Emergency profile — the details an ER / ambulance crew needs if the patient
* cannot talk. Saved on `profiles` (columns created by the emergency dispatch
* migration) and copied into every emergency case automatically by
* create_emergency_case(), so nothing has to be typed during an emergency.
*/
var db = supabase;
var BLOOD_GROUPS = [
	"A+",
	"A-",
	"B+",
	"B-",
	"AB+",
	"AB-",
	"O+",
	"O-"
];
var FIELDS = "phone, blood_group, allergies, conditions, medications, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_2_name, emergency_contact_2_phone";
/** Same rule as public.emergency_profile_ready(): own phone + one contact. */
function isEmergencyReady(p) {
	if (!p) return false;
	const ok = (v) => (v ?? "").replace(/\D/g, "").length >= 8;
	return ok(p.phone) && ok(p.emergency_contact_1_phone);
}
function useEmergencyProfile() {
	const { user } = useSession();
	const userId = user?.id ?? null;
	const [profile, setProfile] = useState(null);
	const [loading, setLoading] = useState(true);
	const reload = useCallback(async () => {
		if (!userId) {
			setProfile(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		const { data } = await db.from("profiles").select(FIELDS).eq("id", userId).maybeSingle();
		setProfile(data ? {
			...data,
			allergies: data.allergies ?? [],
			conditions: data.conditions ?? [],
			medications: data.medications ?? []
		} : null);
		setLoading(false);
	}, [userId]);
	useEffect(() => {
		reload();
	}, [reload]);
	return {
		userId,
		profile,
		loading,
		ready: isEmergencyReady(profile),
		reload
	};
}
var digits = (v) => v.replace(/\D/g, "");
/** Indian mobile → "+91XXXXXXXXXX"; anything else is kept as typed. */
function normalisePhone(v) {
	const d = digits(v);
	if (d.length === 10) return `+91${d}`;
	if (d.length === 12 && d.startsWith("91")) return `+${d}`;
	return v.trim();
}
var validMobile = (v) => {
	const d = digits(v);
	return d.length === 10 || d.length === 12 && d.startsWith("91");
};
var toList = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);
var fromList = (v) => (v ?? []).join(", ");
var font = "'Plus Jakarta Sans', system-ui, sans-serif";
var label = {
	display: "block",
	fontSize: 12,
	fontWeight: 800,
	color: "#374151",
	margin: "0 0 5px"
};
var input = {
	width: "100%",
	boxSizing: "border-box",
	border: "1.5px solid #E5E7EB",
	borderRadius: 12,
	padding: "11px 12px",
	fontSize: 14,
	fontFamily: font,
	outline: "none",
	background: "#fff",
	color: "#111827"
};
var card = {
	background: "#fff",
	border: "1px solid #E5E7EB",
	borderRadius: 16,
	padding: 14,
	marginBottom: 12
};
function EmergencyProfileForm({ onClose, onSaved }) {
	const { userId, profile, loading, reload } = useEmergencyProfile();
	const [f, setF] = useState({
		phone: "",
		blood: "",
		allergies: "",
		conditions: "",
		medications: "",
		c1n: "",
		c1p: "",
		c2n: "",
		c2p: ""
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState(null);
	const [saved, setSaved] = useState(false);
	useEffect(() => {
		if (!profile) return;
		setF({
			phone: profile.phone ?? "",
			blood: profile.blood_group ?? "",
			allergies: fromList(profile.allergies),
			conditions: fromList(profile.conditions),
			medications: fromList(profile.medications),
			c1n: profile.emergency_contact_1_name ?? "",
			c1p: profile.emergency_contact_1_phone ?? "",
			c2n: profile.emergency_contact_2_name ?? "",
			c2p: profile.emergency_contact_2_phone ?? ""
		});
	}, [profile]);
	const set = (k) => (e) => setF((s) => ({
		...s,
		[k]: e.target.value
	}));
	async function save() {
		setError(null);
		if (!userId) return setError("Please sign in again.");
		if (!validMobile(f.phone)) return setError("Enter your own 10-digit mobile number.");
		if (!f.c1n.trim() || !validMobile(f.c1p)) return setError("Add at least one emergency contact with a 10-digit mobile.");
		if (f.c2p.trim() && !validMobile(f.c2p)) return setError("Second contact's mobile must be 10 digits (or leave it empty).");
		if (digits(f.c1p) === digits(f.phone) || f.c2p && digits(f.c2p) === digits(f.phone)) return setError("Emergency contacts must be someone other than you.");
		setSaving(true);
		const { error: err } = await db.from("profiles").update({
			phone: normalisePhone(f.phone),
			blood_group: f.blood || null,
			allergies: toList(f.allergies),
			conditions: toList(f.conditions),
			medications: toList(f.medications),
			emergency_contact_1_name: f.c1n.trim(),
			emergency_contact_1_phone: normalisePhone(f.c1p),
			emergency_contact_2_name: f.c2n.trim() || null,
			emergency_contact_2_phone: f.c2p.trim() ? normalisePhone(f.c2p) : null
		}).eq("id", userId);
		setSaving(false);
		if (err) return setError(`Could not save: ${err.message}`);
		setSaved(true);
		await reload();
		onSaved?.();
		setTimeout(onClose, 900);
	}
	return /* @__PURE__ */ jsxs("div", {
		style: {
			position: "absolute",
			inset: 0,
			zIndex: 95,
			background: "#F4F7F6",
			display: "flex",
			flexDirection: "column",
			fontFamily: font
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				flexShrink: 0,
				background: "linear-gradient(135deg,#DC2626,#B91C1C)",
				color: "#fff",
				padding: "14px 16px",
				display: "flex",
				alignItems: "center",
				gap: 10
			},
			children: [
				/* @__PURE__ */ jsx(ShieldCheck, { size: 20 }),
				/* @__PURE__ */ jsxs("div", {
					style: { flex: 1 },
					children: [/* @__PURE__ */ jsx("p", {
						style: {
							margin: 0,
							fontWeight: 800,
							fontSize: 16
						},
						children: "Emergency profile"
					}), /* @__PURE__ */ jsx("p", {
						style: {
							margin: "2px 0 0",
							fontSize: 11.5,
							opacity: .9
						},
						children: "Shared with the ambulance & ER only during an emergency"
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					onClick: onClose,
					"aria-label": "Close",
					style: {
						background: "rgba(255,255,255,.2)",
						border: 0,
						color: "#fff",
						borderRadius: "50%",
						width: 32,
						height: 32,
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center"
					},
					children: /* @__PURE__ */ jsx(X, { size: 16 })
				})
			]
		}), /* @__PURE__ */ jsx("div", {
			style: {
				flex: 1,
				minHeight: 0,
				overflowY: "auto",
				padding: "14px 14px 24px"
			},
			children: loading ? /* @__PURE__ */ jsxs("p", {
				style: {
					textAlign: "center",
					color: "#6B7280",
					marginTop: 40
				},
				children: [/* @__PURE__ */ jsx(Loader2, {
					size: 18,
					className: "animate-spin"
				}), " Loading…"]
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					style: card,
					children: [
						/* @__PURE__ */ jsx("p", {
							style: {
								margin: "0 0 10px",
								fontWeight: 800,
								fontSize: 14,
								color: "#111827"
							},
							children: "Your details"
						}),
						/* @__PURE__ */ jsx("span", {
							style: label,
							children: "Your mobile number *"
						}),
						/* @__PURE__ */ jsx("input", {
							style: input,
							inputMode: "tel",
							placeholder: "98XXXXXXXX",
							value: f.phone,
							onChange: set("phone")
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								...label,
								marginTop: 12
							},
							children: "Blood group"
						}),
						/* @__PURE__ */ jsx("div", {
							style: {
								display: "flex",
								flexWrap: "wrap",
								gap: 6
							},
							children: BLOOD_GROUPS.map((b) => /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setF((s) => ({
									...s,
									blood: s.blood === b ? "" : b
								})),
								style: {
									border: `1.5px solid ${f.blood === b ? "#DC2626" : "#E5E7EB"}`,
									background: f.blood === b ? "#FEF2F2" : "#fff",
									color: f.blood === b ? "#B91C1C" : "#374151",
									borderRadius: 99,
									padding: "6px 12px",
									fontWeight: 800,
									fontSize: 12.5,
									cursor: "pointer",
									fontFamily: font
								},
								children: b
							}, b))
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: card,
					children: [
						/* @__PURE__ */ jsx("p", {
							style: {
								margin: "0 0 10px",
								fontWeight: 800,
								fontSize: 14,
								color: "#111827"
							},
							children: "Medical information"
						}),
						/* @__PURE__ */ jsx("span", {
							style: label,
							children: "Allergies"
						}),
						/* @__PURE__ */ jsx("input", {
							style: input,
							placeholder: "e.g. Penicillin, Sulfa (comma separated)",
							value: f.allergies,
							onChange: set("allergies")
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								...label,
								marginTop: 12
							},
							children: "Conditions"
						}),
						/* @__PURE__ */ jsx("input", {
							style: input,
							placeholder: "e.g. Hypertension, Diabetes",
							value: f.conditions,
							onChange: set("conditions")
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								...label,
								marginTop: 12
							},
							children: "Regular medicines"
						}),
						/* @__PURE__ */ jsx("input", {
							style: input,
							placeholder: "e.g. Telmisartan 40mg, Metformin 500mg",
							value: f.medications,
							onChange: set("medications")
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: card,
					children: [
						/* @__PURE__ */ jsx("p", {
							style: {
								margin: "0 0 2px",
								fontWeight: 800,
								fontSize: 14,
								color: "#111827"
							},
							children: "Emergency contacts"
						}),
						/* @__PURE__ */ jsx("p", {
							style: {
								margin: "0 0 10px",
								fontSize: 11.5,
								color: "#6B7280"
							},
							children: "The crew calls them if you can't talk, and you can alert them in one tap."
						}),
						/* @__PURE__ */ jsx("span", {
							style: label,
							children: "Contact 1 — name & relation *"
						}),
						/* @__PURE__ */ jsx("input", {
							style: input,
							placeholder: "e.g. Sunita (Wife)",
							value: f.c1n,
							onChange: set("c1n")
						}),
						/* @__PURE__ */ jsx("input", {
							style: {
								...input,
								marginTop: 6
							},
							inputMode: "tel",
							placeholder: "Mobile *",
							value: f.c1p,
							onChange: set("c1p")
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								...label,
								marginTop: 12
							},
							children: "Contact 2 — name & relation"
						}),
						/* @__PURE__ */ jsx("input", {
							style: input,
							placeholder: "e.g. Rohan (Son)",
							value: f.c2n,
							onChange: set("c2n")
						}),
						/* @__PURE__ */ jsx("input", {
							style: {
								...input,
								marginTop: 6
							},
							inputMode: "tel",
							placeholder: "Mobile",
							value: f.c2p,
							onChange: set("c2p")
						})
					]
				}),
				error && /* @__PURE__ */ jsxs("p", {
					style: {
						display: "flex",
						gap: 6,
						alignItems: "flex-start",
						background: "#FEF2F2",
						border: "1px solid #FECACA",
						color: "#B91C1C",
						borderRadius: 12,
						padding: "10px 12px",
						fontSize: 12.5,
						fontWeight: 700,
						margin: "0 0 12px"
					},
					children: [
						/* @__PURE__ */ jsx(AlertTriangle, {
							size: 15,
							style: {
								flexShrink: 0,
								marginTop: 1
							}
						}),
						" ",
						error
					]
				}),
				/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: save,
					disabled: saving || saved,
					style: {
						width: "100%",
						border: 0,
						borderRadius: 14,
						padding: "14px",
						fontWeight: 800,
						fontSize: 15,
						color: "#fff",
						cursor: "pointer",
						fontFamily: font,
						background: saved ? "#059669" : "linear-gradient(135deg,#DC2626,#B91C1C)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						gap: 8
					},
					children: [saving ? /* @__PURE__ */ jsx(Loader2, {
						size: 17,
						className: "animate-spin"
					}) : saved ? /* @__PURE__ */ jsx(Check, { size: 17 }) : null, saved ? "Saved" : saving ? "Saving…" : "Save emergency profile"]
				})
			] })
		})]
	});
}
function EmergencyProfileNudge({ onOpen, refreshKey }) {
	const { profile, loading, ready, reload } = useEmergencyProfile();
	useEffect(() => {
		reload();
	}, [refreshKey, reload]);
	if (loading || !profile || ready) return null;
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		onClick: onOpen,
		style: {
			flexShrink: 0,
			margin: "8px 14px 0",
			display: "flex",
			alignItems: "center",
			gap: 10,
			background: "#FEF2F2",
			border: "1.5px solid #FECACA",
			borderRadius: 14,
			padding: "10px 12px",
			cursor: "pointer",
			textAlign: "left",
			fontFamily: font
		},
		children: [
			/* @__PURE__ */ jsx("span", {
				style: {
					width: 32,
					height: 32,
					borderRadius: "50%",
					background: "#DC2626",
					color: "#fff",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0
				},
				children: /* @__PURE__ */ jsx(ShieldCheck, { size: 16 })
			}),
			/* @__PURE__ */ jsxs("span", {
				style: {
					flex: 1,
					minWidth: 0
				},
				children: [/* @__PURE__ */ jsx("span", {
					style: {
						display: "block",
						fontWeight: 800,
						fontSize: 12.5,
						color: "#111827"
					},
					children: "Complete your emergency profile"
				}), /* @__PURE__ */ jsx("span", {
					style: {
						display: "block",
						fontSize: 10.5,
						color: "#B91C1C",
						fontWeight: 700
					},
					children: "Add family contacts & blood group — takes 1 minute"
				})]
			}),
			/* @__PURE__ */ jsx(ChevronRight, {
				size: 16,
				color: "#DC2626"
			})
		]
	});
}
function familyAlertMessage(opts) {
	const where = opts.lat != null && opts.lng != null ? ` My location: https://maps.google.com/?q=${opts.lat},${opts.lng}` : "";
	return `EMERGENCY: I have raised a ${opts.category ?? "medical"} emergency on MyDox. An ambulance and hospital are being arranged.${where}`;
}
function FamilyAlert({ contacts, message }) {
	if (!contacts.length) return null;
	const text = encodeURIComponent(message);
	return /* @__PURE__ */ jsxs("section", {
		style: {
			...card,
			background: "#F0FDF4",
			borderColor: "#BBF7D0",
			fontFamily: font
		},
		"aria-label": "Alert your family",
		children: [/* @__PURE__ */ jsx("p", {
			style: {
				margin: "0 0 8px",
				fontWeight: 800,
				fontSize: 13,
				color: "#166534"
			},
			children: "Alert your family with your live location"
		}), contacts.map((c) => {
			const d = digits(c.phone);
			const wa = d.length === 10 ? `91${d}` : d;
			return /* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 6,
					marginTop: 6
				},
				children: [
					/* @__PURE__ */ jsx("span", {
						style: {
							flex: 1,
							minWidth: 0,
							fontSize: 12.5,
							fontWeight: 700,
							color: "#111827",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						},
						children: c.name || "Emergency contact"
					}),
					/* @__PURE__ */ jsxs("a", {
						href: `https://wa.me/${wa}?text=${text}`,
						target: "_blank",
						rel: "noreferrer",
						style: {
							display: "flex",
							alignItems: "center",
							gap: 4,
							background: "#16A34A",
							color: "#fff",
							borderRadius: 99,
							padding: "6px 10px",
							fontSize: 11.5,
							fontWeight: 800,
							textDecoration: "none"
						},
						children: [/* @__PURE__ */ jsx(MessageCircle, { size: 13 }), " WhatsApp"]
					}),
					/* @__PURE__ */ jsx("a", {
						href: `sms:${c.phone}?body=${text}`,
						style: {
							display: "flex",
							alignItems: "center",
							gap: 4,
							background: "#fff",
							color: "#166534",
							border: "1px solid #86EFAC",
							borderRadius: 99,
							padding: "6px 10px",
							fontSize: 11.5,
							fontWeight: 800,
							textDecoration: "none"
						},
						children: "SMS"
					}),
					/* @__PURE__ */ jsx("a", {
						href: `tel:${c.phone}`,
						"aria-label": `Call ${c.name ?? "contact"}`,
						style: {
							display: "flex",
							alignItems: "center",
							background: "#fff",
							color: "#166534",
							border: "1px solid #86EFAC",
							borderRadius: "50%",
							width: 30,
							height: 30,
							justifyContent: "center"
						},
						children: /* @__PURE__ */ jsx(Phone, { size: 13 })
					})
				]
			}, c.phone);
		})]
	});
}
//#endregion
//#region src/features/mydox/emergency/EmergencyUI.tsx
/** 108 and 112 stay on screen at every step. The app is never the only option. */
function EmergencyCalls() {
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-calls",
		children: [/* @__PURE__ */ jsxs("a", {
			href: "tel:108",
			children: [/* @__PURE__ */ jsx(Phone, { size: 17 }), " Call 108 · Ambulance"]
		}), /* @__PURE__ */ jsxs("a", {
			href: "tel:112",
			children: [/* @__PURE__ */ jsx(Phone, { size: 16 }), " 112"]
		})]
	});
}
function Elapsed({ since }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1e3);
		return () => clearInterval(timer);
	}, []);
	const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1e3));
	const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
	const ss = String(seconds % 60).padStart(2, "0");
	return /* @__PURE__ */ jsxs("span", {
		className: "emg-elapsed",
		children: [
			mm,
			":",
			ss
		]
	});
}
function TrackRow({ icon, title, waiting, done, doneText, detail }) {
	return /* @__PURE__ */ jsxs("div", {
		className: `emg-track ${done ? "emg-track-done" : ""}`,
		children: [/* @__PURE__ */ jsx("span", {
			className: "emg-track-icon",
			"aria-hidden": "true",
			children: done ? /* @__PURE__ */ jsx(Check, { size: 18 }) : icon
		}), /* @__PURE__ */ jsxs("div", { children: [
			/* @__PURE__ */ jsx("b", { children: title }),
			/* @__PURE__ */ jsx("p", { children: done ? doneText : waiting }),
			done && detail
		] })]
	});
}
/** Snapshotted at the moment of the emergency, so the ER reads what was true then. */
function MedicalSummary({ emergency }) {
	const rows = [];
	if (emergency.blood_group) rows.push(["Blood group", emergency.blood_group]);
	if (emergency.allergies.length) rows.push(["Allergies", emergency.allergies.join(", ")]);
	if (emergency.conditions.length) rows.push(["Conditions", emergency.conditions.join(", ")]);
	if (emergency.medications.length) rows.push(["Medicines", emergency.medications.join(", ")]);
	if (!rows.length) return /* @__PURE__ */ jsx("section", {
		className: "emg-medical emg-medical-thin",
		children: /* @__PURE__ */ jsx("p", { children: "Your profile has no blood group, allergies or regular medicines saved. Add them in your profile so the ER has them next time." })
	});
	return /* @__PURE__ */ jsxs("section", {
		className: "emg-medical",
		"aria-label": "Medical information shared with the hospital",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "emg-medical-head",
			children: [/* @__PURE__ */ jsx(Check, { size: 15 }), " Shared with the ER from your profile"]
		}), /* @__PURE__ */ jsx("dl", { children: rows.map(([label, value]) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: label }), /* @__PURE__ */ jsx("dd", { children: value })] }, label)) })]
	});
}
/** The crew rings these if the patient cannot speak. Saved once, in the emergency profile. */
function ContactsCard({ emergency }) {
	const caseContacts = emergencyContacts(emergency);
	const { profile, reload } = useEmergencyProfile();
	const [editing, setEditing] = useState(false);
	const saved = profile ? [{
		name: profile.emergency_contact_1_name,
		phone: profile.emergency_contact_1_phone
	}, {
		name: profile.emergency_contact_2_name,
		phone: profile.emergency_contact_2_phone
	}].filter((c) => !!c.phone) : [];
	const contacts = caseContacts.length ? caseContacts : saved;
	const message = familyAlertMessage({
		category: categoryDef(emergency.category)?.label ?? null,
		lat: emergency.pickup_lat,
		lng: emergency.pickup_lng
	});
	if (!contacts.length) return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("section", {
		className: "emg-contacts emg-contacts-empty",
		children: [/* @__PURE__ */ jsx("p", { children: "No emergency contact saved. Add one so you can alert your family and the crew can reach them." }), /* @__PURE__ */ jsx("button", {
			type: "button",
			className: "emg-add-contacts",
			onClick: () => setEditing(true),
			children: "Add emergency contacts"
		})]
	}), editing && /* @__PURE__ */ jsx(EmergencyProfileForm, {
		onClose: () => setEditing(false),
		onSaved: () => void reload()
	})] });
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(FamilyAlert, {
		contacts,
		message
	}), caseContacts.length > 0 && /* @__PURE__ */ jsxs("section", {
		className: "emg-contacts",
		"aria-label": "Emergency contacts shared with the crew",
		children: [/* @__PURE__ */ jsx("b", { children: "The crew can call" }), caseContacts.map((contact) => /* @__PURE__ */ jsxs("a", {
			href: `tel:${contact.phone}`,
			children: [
				/* @__PURE__ */ jsx(Phone, { size: 14 }),
				" ",
				contact.name || "Emergency contact",
				" · ",
				contact.phone
			]
		}, contact.phone))]
	})] });
}
/** Live dispatch board. Nothing here is asked of the patient — it only reports. */
function LiveDispatch({ emergency, busy, onCancel, onRefresh }) {
	const track = useAmbulanceTrack(emergency);
	const def = categoryDef(emergency.category);
	const eta = etaLabel(track.latest?.eta_seconds ?? emergency.ambulance_eta_seconds);
	const pickup = useMemo(() => emergency.pickup_lat != null && emergency.pickup_lng != null ? {
		lat: emergency.pickup_lat,
		lng: emergency.pickup_lng,
		accuracy: emergency.pickup_accuracy_m ?? 50,
		capturedAt: emergency.pickup_captured_at ?? emergency.created_at
	} : null, [
		emergency.pickup_lat,
		emergency.pickup_lng,
		emergency.pickup_accuracy_m,
		emergency.pickup_captured_at,
		emergency.created_at
	]);
	const vehicle = track.latest ? {
		lat: track.latest.lat,
		lng: track.latest.lng,
		accuracy: track.latest.accuracy_m ?? 30,
		capturedAt: track.latest.captured_at
	} : null;
	const searching = emergency.status === "searching";
	const self = emergency.transport_mode === "self";
	const radius = Math.round(emergency.search_radius_km);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		def && /* @__PURE__ */ jsxs("div", {
			className: "emg-banner",
			children: [/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				children: def.emoji
			}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: def.label }), /* @__PURE__ */ jsx("p", { children: def.routing })] })]
		}),
		/* @__PURE__ */ jsx("p", {
			className: "emg-headline",
			role: "status",
			children: statusHeadline(emergency)
		}),
		emergency.location_status === "needs_location" && /* @__PURE__ */ jsxs("div", {
			className: "emg-nogps",
			role: "alert",
			children: [/* @__PURE__ */ jsx("p", { children: "Nobody can be matched to you without a location. Turn location on, or keep this screen open — the control room can confirm your pickup by phone." }), /* @__PURE__ */ jsx("a", {
				href: "tel:108",
				children: "Call 108 now"
			})]
		}),
		self ? /* @__PURE__ */ jsx(TrackRow, {
			icon: /* @__PURE__ */ jsx(Car, { size: 18 }),
			title: "Travelling by own vehicle",
			waiting: "No ambulance is being sent.",
			done: true,
			doneText: emergency.hospital_id ? "Drive straight to the hospital below." : "Drive once a hospital accepts, or call 108 if this worsens."
		}) : /* @__PURE__ */ jsx(TrackRow, {
			icon: /* @__PURE__ */ jsx(Ambulance, { size: 18 }),
			title: "Ambulance",
			waiting: searching ? `Paging crews within ${radius} km · widening every 20 seconds` : "Waiting for a crew to accept…",
			done: !!emergency.ambulance_id,
			doneText: emergency.status === "ambulance_arrived" ? "Crew has reached you" : emergency.status === "transporting" ? "Taking you to the hospital" : eta ? `On the way · ${eta}` : "Accepted · on the way",
			detail: track.enabled && !track.live && vehicle ? /* @__PURE__ */ jsx("span", {
				className: "emg-stale",
				children: "Last position shown · waiting for a newer GPS update"
			}) : null
		}),
		/* @__PURE__ */ jsx(TrackRow, {
			icon: /* @__PURE__ */ jsx(Building2, { size: 18 }),
			title: "Hospital",
			waiting: `Alerting emergency-ready hospitals within ${radius} km…`,
			done: !!emergency.hospital_id,
			doneText: emergency.bed_label ? `Bed ready · ${emergency.bed_label}` : "Bed being kept ready"
		}),
		/* @__PURE__ */ jsx(TrackRow, {
			icon: /* @__PURE__ */ jsx(Stethoscope, { size: 18 }),
			title: def?.team ?? "Specialist",
			waiting: emergency.doctor_wave >= 3 ? `Asking every ${def?.team?.toLowerCase() ?? "specialist"} in the area…` : emergency.doctor_wave === 2 ? "Asking the other doctors on duty…" : "Asking the hospital's on-call specialist…",
			done: !!emergency.doctor_id,
			doneText: "Specialist accepted and heading in"
		}),
		track.enabled && pickup && /* @__PURE__ */ jsxs("section", {
			className: "emg-map",
			"aria-label": "Ambulance position",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "emg-map-head",
					children: [
						/* @__PURE__ */ jsx(Ambulance, { size: 16 }),
						/* @__PURE__ */ jsx("b", { children: "Your ambulance" }),
						/* @__PURE__ */ jsx("span", { className: track.live ? "emg-dot-live" : "emg-dot-stale" })
					]
				}),
				/* @__PURE__ */ jsx(LocationMap, {
					own: vehicle,
					pickup,
					ownLabel: "Ambulance",
					ownIsAmbulance: true,
					ownStale: !track.live,
					height: 240
				}),
				/* @__PURE__ */ jsx("p", {
					className: "emg-note",
					children: track.latest ? `Last update ${new Date(track.latest.captured_at).toLocaleTimeString()}. The pin moves only when the crew's phone sends a new position.` : "Waiting for the crew to start sharing position."
				})
			]
		}),
		/* @__PURE__ */ jsx(MedicalSummary, { emergency }),
		/* @__PURE__ */ jsx(ContactsCard, { emergency }),
		/* @__PURE__ */ jsxs("button", {
			type: "button",
			className: "emg-ghost",
			onClick: onRefresh,
			disabled: busy,
			children: [/* @__PURE__ */ jsx(RefreshCw, { size: 14 }), " Refresh"]
		}),
		/* @__PURE__ */ jsx("button", {
			type: "button",
			className: "emg-cancel",
			disabled: busy,
			onClick: () => {
				if (window.confirm("Cancel this emergency? If a crew has already accepted, call them as well.")) onCancel();
			},
			children: "Cancel emergency"
		}),
		/* @__PURE__ */ jsx("p", {
			className: "emg-note",
			children: "Closing this screen does not cancel the emergency."
		})
	] });
}
/**
* The whole patient flow: tap a symptom, answer two or three questions, done.
* Phone number, name, emergency contacts and pickup are never typed — they come
* from the profile and the live GPS fix.
*/
function EmergencyWizard({ onClose }) {
	const controller = useEmergencyCase();
	const emergency = controller.case;
	const live = controller.open && !!emergency;
	const [category, setCategory] = useState(null);
	const [answers, setAnswers] = useState({});
	const [stage, setStage] = useState("entry");
	const [actionError, setActionError] = useState(null);
	const requestKey = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
	const gps = useDeviceLocation(controller.userId ? `emergency:${controller.userId}` : null, !live);
	const def = categoryDef(category);
	/**
	* Losing GPS must never lose the emergency. Without a fix the case is still
	* saved, flagged for a callback, and matching starts the moment a pin lands.
	*/
	async function send(transport, withoutLocation = false) {
		if (!def) return;
		if (!withoutLocation && (!gps.fresh || !gps.location)) {
			setActionError("Turn on location. Help goes to your live position.");
			gps.refresh();
			return;
		}
		const triage = def.triage.map((question, index) => ({
			q: question.q,
			a: answers[index]
		})).filter((entry) => !!entry.a);
		setActionError(null);
		try {
			await controller.create({
				category: def.id,
				triage,
				transport,
				location: withoutLocation ? null : gps.location,
				requestKey: requestKey.current
			});
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Could not send. Call 108 now.");
		}
	}
	const error = actionError || controller.error;
	const ready = !!def && !!gps.fresh && !controller.busy;
	const canSendWithoutGps = !!def && !gps.fresh && !gps.loading && !controller.busy;
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-shell",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": "Emergency",
		children: [/* @__PURE__ */ jsx("header", {
			className: "emg-header",
			children: /* @__PURE__ */ jsxs("div", {
				className: "emg-header-inner",
				children: [
					/* @__PURE__ */ jsx("button", {
						onClick: onClose,
						"aria-label": "Close emergency screen",
						children: /* @__PURE__ */ jsx(X, { size: 17 })
					}),
					/* @__PURE__ */ jsx(AlertTriangle, { size: 18 }),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-header-text",
						children: [/* @__PURE__ */ jsx("h2", { children: "EMERGENCY" }), /* @__PURE__ */ jsx("p", { children: live ? "Help is being arranged" : "Routed to the right hospital" })]
					}),
					live && emergency && /* @__PURE__ */ jsx(Elapsed, { since: emergency.created_at })
				]
			})
		}), /* @__PURE__ */ jsx("div", {
			className: "emg-body",
			children: /* @__PURE__ */ jsxs("div", {
				className: "emg-column",
				children: [
					/* @__PURE__ */ jsx(EmergencyCalls, {}),
					/* @__PURE__ */ jsx("p", {
						className: "emg-note",
						children: "If this is life-threatening, call 108 first. The steps below alert an ambulance, a hospital and a specialist at the same time."
					}),
					error && /* @__PURE__ */ jsx("div", {
						className: "emg-error",
						role: "alert",
						children: error
					}),
					live && emergency ? /* @__PURE__ */ jsx(LiveDispatch, {
						emergency,
						busy: controller.busy,
						onCancel: () => {
							controller.cancel().catch((e) => setActionError(e.message));
						},
						onRefresh: controller.refresh
					}) : /* @__PURE__ */ jsxs(Fragment, { children: [
						stage === "entry" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("h3", { children: "What is happening?" }), /* @__PURE__ */ jsx("div", {
							className: "emg-grid",
							children: EMERGENCY_CATALOG.map((entry) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => {
									setCategory(entry.id);
									setAnswers({});
									setStage("triage");
								},
								children: [/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									children: entry.emoji
								}), /* @__PURE__ */ jsx("b", { children: entry.label })]
							}, entry.id))
						})] }),
						stage === "triage" && def && /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "emg-banner",
								children: [/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									children: def.emoji
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: def.label }), /* @__PURE__ */ jsx("p", { children: def.routing })] })]
							}),
							def.triage.map((question, index) => /* @__PURE__ */ jsxs("div", {
								className: "emg-question",
								children: [/* @__PURE__ */ jsx("p", { children: question.q }), /* @__PURE__ */ jsx("div", { children: question.opts.map((option) => /* @__PURE__ */ jsx("button", {
									type: "button",
									"aria-pressed": answers[index] === option,
									onClick: () => setAnswers((prev) => ({
										...prev,
										[index]: option
									})),
									children: option
								}, option)) })]
							}, question.q)),
							/* @__PURE__ */ jsx("div", {
								className: "emg-auto",
								"aria-live": "polite",
								children: gps.loading && !gps.fresh ? /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx(Loader2, {
									size: 14,
									className: "emg-spin"
								}), " Getting your live location…"] }) : gps.fresh ? /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx(Check, { size: 14 }), " Your live location and phone number go with the alert. Nothing to type."] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("p", {
									role: "alert",
									children: gps.error || "Location is off. The ambulance needs your live position."
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: gps.refresh,
									children: "Turn on location and retry"
								})] })
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: "emg-send",
								disabled: !ready,
								onClick: () => setStage("transport"),
								children: "Continue"
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: "emg-ghost",
								onClick: () => {
									setCategory(null);
									setStage("entry");
									setActionError(null);
								},
								children: "Back"
							})
						] }),
						stage === "transport" && def && /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "emg-banner",
								children: [/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									children: def.emoji
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: def.label }), /* @__PURE__ */ jsx("p", { children: def.routing })] })]
							}),
							/* @__PURE__ */ jsx("h3", { children: "How will the patient reach the hospital?" }),
							/* @__PURE__ */ jsx("p", {
								className: "emg-note",
								children: "Either way, the hospital bed and the specialist are booked right now."
							}),
							/* @__PURE__ */ jsxs("button", {
								type: "button",
								className: "emg-transport",
								disabled: !ready,
								onClick: () => send("ambulance"),
								children: [/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									children: "🚑"
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: controller.busy ? "Sending…" : "Send an ambulance to me" }), /* @__PURE__ */ jsx("p", { children: "Every crew nearby is alerted at once. You can track the ambulance live." })] })]
							}),
							/* @__PURE__ */ jsxs("button", {
								type: "button",
								className: "emg-transport",
								disabled: !ready,
								onClick: () => send("self"),
								children: [/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									children: "🚗"
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: "We will drive to the hospital" }), /* @__PURE__ */ jsx("p", { children: "No crew is sent. The hospital keeps the bed and team ready for you." })] })]
							}),
							canSendWithoutGps && /* @__PURE__ */ jsxs("div", {
								className: "emg-nogps",
								children: [
									/* @__PURE__ */ jsx("p", {
										role: "alert",
										children: gps.error || "Still no location fix."
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: gps.refresh,
										children: "Retry location"
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => send("ambulance", true),
										children: "Send without location · we will call you"
									})
								]
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								className: "emg-ghost",
								onClick: () => setStage("triage"),
								children: "Back"
							})
						] })
					] })
				]
			})
		})]
	});
}
//#endregion
//#region src/features/mydox/emergency/AmbulanceEmergencyPortal.tsx
function mapsUrl(emergency) {
	return `https://www.google.com/maps/dir/?api=1&destination=${emergency.pickup_lat},${emergency.pickup_lng}&travelmode=driving`;
}
/** A case with no confirmed pin must not send a crew to coordinates we invented. */
function hasPickup(emergency) {
	return emergency.pickup_lat != null && emergency.pickup_lng != null;
}
function Waiting({ since }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1e3);
		return () => clearInterval(timer);
	}, []);
	const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1e3));
	return /* @__PURE__ */ jsxs("span", {
		className: "emg-waiting",
		children: [
			/* @__PURE__ */ jsx(Timer, { size: 13 }),
			" waiting ",
			Math.floor(seconds / 60),
			"m ",
			String(seconds % 60).padStart(2, "0"),
			"s"
		]
	});
}
/** Everything the crew needs before they move, none of it typed by the patient. */
function CaseDetails({ emergency }) {
	const def = categoryDef(emergency.category);
	const contacts = emergencyContacts(emergency);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "emg-case-head",
			children: [/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				children: def?.emoji ?? "🚑"
			}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: def?.label ?? "Emergency" }), /* @__PURE__ */ jsx("p", { children: emergency.patient_name || "Patient" })] })]
		}),
		!!emergency.triage.length && /* @__PURE__ */ jsx("ul", {
			className: "emg-triage-list",
			children: emergency.triage.map((entry) => /* @__PURE__ */ jsxs("li", { children: [
				entry.q,
				" ",
				/* @__PURE__ */ jsx("b", { children: entry.a })
			] }, entry.q))
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "emg-chips",
			children: [
				emergency.blood_group && /* @__PURE__ */ jsxs("span", { children: ["Blood ", emergency.blood_group] }),
				emergency.allergies.map((item) => /* @__PURE__ */ jsxs("span", {
					className: "emg-chip-warn",
					children: ["Allergy: ", item]
				}, item)),
				emergency.conditions.map((item) => /* @__PURE__ */ jsx("span", { children: item }, item))
			]
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "emg-phones",
			children: [emergency.patient_phone && /* @__PURE__ */ jsxs("a", {
				href: `tel:${emergency.patient_phone}`,
				children: [
					/* @__PURE__ */ jsx(Phone, { size: 14 }),
					" Patient · ",
					emergency.patient_phone
				]
			}), contacts.map((contact) => /* @__PURE__ */ jsxs("a", {
				href: `tel:${contact.phone}`,
				children: [
					/* @__PURE__ */ jsx(Phone, { size: 14 }),
					" ",
					contact.name || "Family",
					" · ",
					contact.phone
				]
			}, contact.phone))]
		})
	] });
}
/** The assigned trip. The beacon runs here, so the patient sees the van move. */
function ActiveTrip({ emergency, userId, onAdvance, busy }) {
	const beacon = useAmbulanceBeacon(emergency, userId);
	return /* @__PURE__ */ jsxs("section", {
		className: "emg-card emg-card-active",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "emg-badge",
				children: ["ACCEPTED · ", emergency.status.replace(/_/g, " ").toUpperCase()]
			}),
			/* @__PURE__ */ jsx(CaseDetails, { emergency }),
			/* @__PURE__ */ jsx("p", {
				className: "emg-note",
				role: "status",
				children: beacon.error ? beacon.error : beacon.lastSentAt ? `Sharing position every 10 seconds · last sent ${new Date(beacon.lastSentAt).toLocaleTimeString()}` : "Starting position sharing…"
			}),
			hasPickup(emergency) ? /* @__PURE__ */ jsxs("a", {
				className: "emg-primary",
				href: mapsUrl(emergency),
				target: "_blank",
				rel: "noopener noreferrer",
				children: [/* @__PURE__ */ jsx(Navigation, { size: 16 }), " Navigate to patient"]
			}) : /* @__PURE__ */ jsx("p", {
				className: "emg-note",
				role: "alert",
				children: "No confirmed pickup on this case. Call the patient or the control room before moving."
			}),
			emergency.status === "ambulance_en_route" && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "emg-ghost",
				disabled: busy,
				onClick: () => onAdvance("ambulance_arrived"),
				children: "Confirm arrival at pickup"
			}),
			emergency.status === "ambulance_arrived" && !!emergency.hospital_id && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "emg-ghost",
				disabled: busy,
				onClick: () => onAdvance("transporting"),
				children: "Start transport to hospital"
			}),
			emergency.status === "ambulance_arrived" && !emergency.hospital_id && /* @__PURE__ */ jsx("p", {
				className: "emg-note",
				children: "No hospital has accepted yet. Transport cannot start without a receiving hospital."
			}),
			emergency.status === "transporting" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("p", {
				className: "emg-note",
				children: emergency.bed_label ? `Hospital bed ${emergency.bed_label} is held for this patient.` : "Hospital has been alerted."
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "emg-ghost",
				disabled: busy,
				onClick: () => onAdvance("handed_over"),
				children: "Handed over to hospital team"
			})] }),
			emergency.status === "handed_over" && /* @__PURE__ */ jsx("p", {
				className: "emg-note",
				children: "Handed over. The hospital confirms admission from its own screen."
			})
		]
	});
}
/**
* Crew-facing dispatch portal. Shows only cases this crew was paged for, and
* locks the first tap in atomically — two crews cannot both win the same case.
*/
function AmbulanceEmergencyPortal({ lat, lng, onNavigate }) {
	const dispatch = useEmergencyNotifications(lat, lng, "ambulance");
	const [busyId, setBusyId] = useState(null);
	const [actionError, setActionError] = useState(null);
	const lock = useRef(false);
	const userId = useMemo(() => dispatch.cases.find((row) => row.ambulance_id)?.ambulance_id ?? null, [dispatch.cases]);
	const mine = dispatch.cases.filter((row) => !!row.ambulance_id && isOpenCase(row));
	const incoming = dispatch.cases.filter((row) => !row.ambulance_id);
	async function guard(id, operation) {
		if (lock.current) return;
		lock.current = true;
		setBusyId(id);
		setActionError(null);
		try {
			await operation();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Could not confirm. Refresh the queue.");
			dispatch.refresh();
		} finally {
			lock.current = false;
			setBusyId(null);
		}
	}
	if (!dispatch.enabled) return /* @__PURE__ */ jsx("p", {
		className: "emg-note",
		children: "Turn on location to receive emergency cases. Crews are paged by distance from the patient."
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-portal",
		children: [
			(actionError || dispatch.error) && /* @__PURE__ */ jsxs("div", {
				className: "emg-error",
				role: "alert",
				children: [/* @__PURE__ */ jsx("p", { children: actionError || dispatch.error }), /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => {
						setActionError(null);
						dispatch.refresh();
					},
					children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), " Retry"]
				})]
			}),
			/* @__PURE__ */ jsxs("h3", {
				className: "emg-section-title",
				children: [
					"Emergency alerts (",
					mine.length ? 0 : incoming.length,
					")"
				]
			}),
			mine.length > 0 ? /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "New alerts are paused while you have an active case."
			}) : !incoming.length ? /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "No emergency alerts nearby right now."
			}) : null,
			!mine.length && incoming.map((emergency) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-incoming",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "emg-badge emg-badge-alert",
						children: ["EMERGENCY NEARBY ", /* @__PURE__ */ jsx(Waiting, { since: emergency.created_at })]
					}),
					/* @__PURE__ */ jsx(CaseDetails, { emergency }),
					/* @__PURE__ */ jsxs("p", {
						className: "emg-note",
						children: [
							"Pickup is the patient's live GPS position. Search radius is ",
							Math.round(emergency.search_radius_km),
							" km and widening."
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-primary",
						disabled: !!busyId,
						onClick: () => guard(emergency.id, async () => {
							const saved = await dispatch.accept(emergency.id);
							onNavigate?.(saved);
						}),
						children: [
							/* @__PURE__ */ jsx(Check, { size: 16 }),
							" ",
							busyId === emergency.id ? "Confirming…" : "Accept case"
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-ghost",
						disabled: !!busyId,
						onClick: () => guard(emergency.id, () => dispatch.decline(emergency.id)),
						children: [/* @__PURE__ */ jsx(X, { size: 14 }), " Pass"]
					})
				]
			}, emergency.id)),
			/* @__PURE__ */ jsxs("h3", {
				className: "emg-section-title",
				children: [
					"Active assignments (",
					mine.length,
					")"
				]
			}),
			!mine.length && /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "No active assignments."
			}),
			mine.map((emergency) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(ActiveTrip, {
				emergency,
				userId: emergency.ambulance_id ?? userId,
				busy: busyId === emergency.id,
				onAdvance: (status) => guard(emergency.id, () => dispatch.advance(emergency.id, status))
			}), onNavigate && /* @__PURE__ */ jsx("button", {
				type: "button",
				className: "emg-ghost",
				onClick: () => onNavigate(emergency),
				children: "Open in trip screen"
			})] }, emergency.id))
		]
	});
}
//#endregion
//#region src/features/mydox/emergency/DispatchScreens.tsx
/**
* Patient entry point. Both the SOS button and the guided pathway land here —
* the flow is identical, because there is nothing left to vary: pick a symptom,
* answer the triage questions, send. Phone and pickup come from the profile and
* the live GPS fix, never from a form.
*/
function EmergencyPatient({ onClose, variant = "guided" }) {
	return /* @__PURE__ */ jsx(EmergencyWizard, { onClose });
}
function CaseSummary({ emergency, showPhones }) {
	const def = categoryDef(emergency.category);
	const contacts = emergencyContacts(emergency);
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "emg-case-head",
			children: [/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				children: def?.emoji ?? "🚑"
			}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: def?.label ?? "Emergency" }), /* @__PURE__ */ jsx("p", { children: emergency.patient_name || "Patient" })] })]
		}),
		!!emergency.triage.length && /* @__PURE__ */ jsx("ul", {
			className: "emg-triage-list",
			children: emergency.triage.map((entry) => /* @__PURE__ */ jsxs("li", { children: [
				entry.q,
				" ",
				/* @__PURE__ */ jsx("b", { children: entry.a })
			] }, entry.q))
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "emg-chips",
			children: [
				emergency.blood_group && /* @__PURE__ */ jsxs("span", { children: ["Blood ", emergency.blood_group] }),
				emergency.allergies.map((item) => /* @__PURE__ */ jsxs("span", {
					className: "emg-chip-warn",
					children: ["Allergy: ", item]
				}, item)),
				emergency.conditions.map((item) => /* @__PURE__ */ jsx("span", { children: item }, item)),
				emergency.medications.map((item) => /* @__PURE__ */ jsx("span", { children: item }, item))
			]
		}),
		showPhones && /* @__PURE__ */ jsxs("div", {
			className: "emg-phones",
			children: [emergency.patient_phone && /* @__PURE__ */ jsxs("a", {
				href: `tel:${emergency.patient_phone}`,
				children: [
					/* @__PURE__ */ jsx(Phone, { size: 14 }),
					" Patient · ",
					emergency.patient_phone
				]
			}), contacts.map((contact) => /* @__PURE__ */ jsxs("a", {
				href: `tel:${contact.phone}`,
				children: [
					/* @__PURE__ */ jsx(Phone, { size: 14 }),
					" ",
					contact.name || "Family",
					" · ",
					contact.phone
				]
			}, contact.phone))]
		})
	] });
}
/** Hospital console: emergency mode, incoming cases, bed assignment on accept. */
function HospitalPanel() {
	const { user } = useSession();
	const userId = user?.id ?? null;
	const [hospital, setHospital] = useState(null);
	const [loadError, setLoadError] = useState(null);
	const [beds, setBeds] = useState({});
	const [busyId, setBusyId] = useState(null);
	const [actionError, setActionError] = useState(null);
	const load = useCallback(() => {
		if (!userId) return;
		fetchMyHospital(userId).then((row) => {
			setHospital(row);
			setLoadError(null);
		}).catch((e) => setLoadError(e.message));
	}, [userId]);
	useEffect(load, [load]);
	const dispatch = useEmergencyNotifications(hospital?.lat ?? null, hospital?.lng ?? null, "hospital");
	if (!userId) return null;
	if (loadError) return /* @__PURE__ */ jsx("div", {
		className: "emg-error",
		role: "alert",
		children: loadError
	});
	if (!hospital) return /* @__PURE__ */ jsxs("p", {
		className: "emg-note",
		children: [
			"No hospital is linked to this account yet. An administrator sets ",
			/* @__PURE__ */ jsx("code", { children: "hospitals.owner_id" }),
			" before emergency cases can be routed here."
		]
	});
	const assigned = dispatch.cases.filter((row) => row.hospital_id === hospital.id);
	const incoming = dispatch.cases.filter((row) => !row.hospital_id);
	async function guard(id, operation) {
		setBusyId(id);
		setActionError(null);
		try {
			await operation();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Could not confirm. Refresh the queue.");
			dispatch.refresh();
		} finally {
			setBusyId(null);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-portal",
		children: [
			/* @__PURE__ */ jsxs("section", {
				className: "emg-card",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "emg-case-head",
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							children: /* @__PURE__ */ jsx(Building2, { size: 19 })
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: hospital.name }), /* @__PURE__ */ jsx("p", { children: hospital.area || "Emergency department" })] })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-chips",
						children: [
							hospital.has_cath_lab && /* @__PURE__ */ jsx("span", { children: "Cath lab" }),
							hospital.has_icu && /* @__PURE__ */ jsx("span", { children: "ICU" }),
							hospital.has_ot && /* @__PURE__ */ jsx("span", { children: "OT" }),
							hospital.has_nicu && /* @__PURE__ */ jsx("span", { children: "NICU" }),
							hospital.has_blood_bank && /* @__PURE__ */ jsx("span", { children: "Blood bank" }),
							/* @__PURE__ */ jsxs("span", { children: [hospital.er_beds_available, " ER beds free"] })
						]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: hospital.emergency_mode ? "emg-ghost" : "emg-primary",
						disabled: busyId === hospital.id,
						onClick: () => guard(hospital.id, async () => {
							await setHospitalEmergencyMode(hospital.id, !hospital.emergency_mode);
							load();
						}),
						children: hospital.emergency_mode ? "Emergency mode is ON · turn off" : "Turn on emergency mode"
					}),
					!hospital.emergency_mode && /* @__PURE__ */ jsx("p", {
						className: "emg-note",
						children: "While this is off, no emergency case is routed to this hospital."
					})
				]
			}),
			(actionError || dispatch.error) && /* @__PURE__ */ jsxs("div", {
				className: "emg-error",
				role: "alert",
				children: [/* @__PURE__ */ jsx("p", { children: actionError || dispatch.error }), /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => dispatch.refresh(),
					children: [/* @__PURE__ */ jsx(RefreshCw, { size: 13 }), " Retry"]
				})]
			}),
			/* @__PURE__ */ jsxs("h3", {
				className: "emg-section-title",
				children: [
					"Emergency alerts (",
					incoming.length,
					")"
				]
			}),
			!incoming.length && /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "No new emergency alerts for this hospital."
			}),
			incoming.map((emergency) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-incoming",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge emg-badge-alert",
						children: "INCOMING EMERGENCY"
					}),
					/* @__PURE__ */ jsx(CaseSummary, {
						emergency,
						showPhones: false
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "emg-bed",
						children: ["Bed or bay", /* @__PURE__ */ jsx("input", {
							value: beds[emergency.id] ?? "",
							onChange: (event) => setBeds((prev) => ({
								...prev,
								[emergency.id]: event.target.value
							})),
							placeholder: "e.g. Red Bay 2",
							maxLength: 40
						})]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-primary",
						disabled: !!busyId,
						onClick: () => guard(emergency.id, () => dispatch.accept(emergency.id, {
							hospitalId: hospital.id,
							bedLabel: beds[emergency.id]
						})),
						children: [
							/* @__PURE__ */ jsx(Check, { size: 16 }),
							" ",
							busyId === emergency.id ? "Confirming…" : "Accept · keep a bed ready"
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-ghost",
						disabled: !!busyId,
						onClick: () => guard(emergency.id, () => dispatch.decline(emergency.id)),
						children: [/* @__PURE__ */ jsx(X, { size: 14 }), " Cannot take this case"]
					})
				]
			}, emergency.id)),
			/* @__PURE__ */ jsxs("h3", {
				className: "emg-section-title",
				children: [
					"Active assignments (",
					assigned.length,
					")"
				]
			}),
			!assigned.length && /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "No active emergency admissions."
			}),
			assigned.map((emergency) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-active",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge",
						children: "ACCEPTED · BED READY"
					}),
					/* @__PURE__ */ jsx(CaseSummary, {
						emergency,
						showPhones: true
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "emg-note",
						children: [
							emergency.bed_label ? `Bed ${emergency.bed_label} held.` : "No bed label recorded.",
							" ",
							emergency.doctor_id ? "Specialist accepted." : "Still paging a specialist.",
							" ",
							emergency.ambulance_id ? "Ambulance assigned." : "No crew assigned yet."
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-ghost",
						disabled: busyId === emergency.id,
						onClick: () => guard(emergency.id, () => dispatch.advance(emergency.id, "admitted")),
						children: [/* @__PURE__ */ jsx(Check, { size: 15 }), " Mark admitted"]
					})
				]
			}, emergency.id))
		]
	});
}
/** Specialist console. Shows which wave paged them and which hospital to reach. */
function DoctorPanel({ onDuty }) {
	const { user } = useSession();
	const userId = user?.id ?? null;
	const gps = useDeviceLocation(userId ? `doctor:${userId}` : null, onDuty);
	const dispatch = useEmergencyNotifications(gps.location?.lat ?? null, gps.location?.lng ?? null, "doctor");
	const [busyId, setBusyId] = useState(null);
	const [actionError, setActionError] = useState(null);
	const mine = useMemo(() => dispatch.cases.filter((row) => row.doctor_id === userId), [dispatch.cases, userId]);
	const offers = dispatch.cases.filter((row) => !row.doctor_id);
	if (!onDuty) return /* @__PURE__ */ jsx("p", {
		className: "emg-note",
		children: "Off duty. Emergency cases are not being offered to this account."
	});
	if (!dispatch.enabled) return /* @__PURE__ */ jsx("p", {
		className: "emg-note",
		children: "Turn on location to be offered emergency cases in your area."
	});
	async function guard(id, operation) {
		setBusyId(id);
		setActionError(null);
		try {
			await operation();
		} catch (error) {
			setActionError(error instanceof Error ? error.message : "Could not confirm. Refresh the queue.");
			dispatch.refresh();
		} finally {
			setBusyId(null);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-portal",
		children: [
			(actionError || dispatch.error) && /* @__PURE__ */ jsx("div", {
				className: "emg-error",
				role: "alert",
				children: /* @__PURE__ */ jsx("p", { children: actionError || dispatch.error })
			}),
			/* @__PURE__ */ jsxs("h3", {
				className: "emg-section-title",
				children: [
					"Emergency alerts (",
					mine.length ? 0 : offers.length,
					")"
				]
			}),
			mine.length > 0 ? /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "New calls are paused while you are attending a case."
			}) : !offers.length ? /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "No emergency calls right now."
			}) : null,
			!mine.length && offers.map((emergency) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-incoming",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge emg-badge-alert",
						children: emergency.doctor_wave >= 3 ? "AREA CALL · ANY SPECIALIST" : emergency.doctor_wave === 2 ? "SECOND CALL · ON-DUTY DOCTORS" : "FIRST CALL · YOU ARE ON CALL"
					}),
					/* @__PURE__ */ jsx(CaseSummary, {
						emergency,
						showPhones: false
					}),
					/* @__PURE__ */ jsx("p", {
						className: "emg-note",
						children: emergency.hospital_id ? "The hospital has accepted and is holding a bed. Confirm if you can reach it." : "A hospital has not accepted yet. You would be attending wherever the case lands."
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-primary",
						disabled: !!busyId,
						onClick: () => guard(emergency.id, () => dispatch.accept(emergency.id)),
						children: [
							/* @__PURE__ */ jsx(Stethoscope, { size: 16 }),
							" ",
							busyId === emergency.id ? "Confirming…" : "Accept · I can attend"
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "emg-ghost",
						disabled: !!busyId,
						onClick: () => guard(emergency.id, () => dispatch.decline(emergency.id)),
						children: [/* @__PURE__ */ jsx(X, { size: 14 }), " Cannot attend"]
					})
				]
			}, emergency.id)),
			/* @__PURE__ */ jsxs("h3", {
				className: "emg-section-title",
				children: [
					"Active assignments (",
					mine.length,
					")"
				]
			}),
			!mine.length && /* @__PURE__ */ jsx("p", {
				className: "emg-empty",
				children: "No active assignments."
			}),
			mine.map((emergency) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-active",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge",
						children: "ACCEPTED · ATTENDING"
					}),
					/* @__PURE__ */ jsx(CaseSummary, {
						emergency,
						showPhones: true
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "emg-note",
						children: [
							emergency.bed_label ? `Bed ${emergency.bed_label}.` : "",
							" ",
							emergency.ambulance_id ? "Ambulance is bringing the patient in." : "Patient is making their own way in."
						]
					})
				]
			}, emergency.id))
		]
	});
}
function CrewPanel({ onDuty }) {
	const { user } = useSession();
	const userId = user?.id ?? null;
	const gps = useDeviceLocation(userId ? `ambulance:${userId}` : null, onDuty);
	if (!onDuty) return /* @__PURE__ */ jsx("p", {
		className: "emg-note",
		children: "Off duty. New cases are hidden; any accepted case stays active."
	});
	return /* @__PURE__ */ jsx(AmbulanceEmergencyPortal, {
		lat: gps.location?.lat ?? null,
		lng: gps.location?.lng ?? null
	});
}
/**
* One responder surface for all three roles. Each only ever sees cases it was
* actually paged for, and accepting is a single atomic call: two responders
* tapping at the same moment cannot both win.
*/
function EmergencyResponderPanel({ kind, onDuty = true }) {
	if (kind === "hospital") return /* @__PURE__ */ jsx(HospitalPanel, {});
	if (kind === "doctor") return /* @__PURE__ */ jsx(DoctorPanel, { onDuty });
	return /* @__PURE__ */ jsx(CrewPanel, { onDuty });
}
/** Read-only operations board. Admins watch every live case without touching it. */
function AdminBoard() {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState(null);
	useEffect(() => {
		const load = () => {
			fetchAllOpenCases().then((next) => {
				setRows(next);
				setError(null);
			}).catch((e) => setError(e.message));
		};
		load();
		const timer = setInterval(load, 5e3);
		return () => clearInterval(timer);
	}, []);
	if (error) return /* @__PURE__ */ jsx("div", {
		className: "emg-error",
		role: "alert",
		children: error
	});
	if (!rows.length) return /* @__PURE__ */ jsx("p", {
		className: "emg-note",
		children: "No live emergency cases."
	});
	return /* @__PURE__ */ jsx("div", {
		className: "emg-portal",
		children: rows.map((emergency) => /* @__PURE__ */ jsxs("section", {
			className: "emg-card",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "emg-badge",
					children: emergency.status.replace(/_/g, " ").toUpperCase()
				}),
				/* @__PURE__ */ jsx(CaseSummary, {
					emergency,
					showPhones: false
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "emg-note",
					children: [
						"Radius ",
						Math.round(emergency.search_radius_km),
						" km · specialist wave ",
						emergency.doctor_wave,
						" ·",
						" ",
						emergency.ambulance_id ? "crew assigned" : "no crew",
						" ·",
						" ",
						emergency.hospital_id ? "hospital accepted" : "no hospital",
						" ·",
						" ",
						emergency.doctor_id ? "specialist accepted" : "no specialist"
					]
				})
			]
		}, emergency.id))
	});
}
/**
* Standalone page for each role, used by the /emergency/* and /admin/emergency
* routes. The in-app panels above are the same components without the shell.
*/
function EmergencyPortal({ kind }) {
	const goBack = useCallback(() => {
		if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
	}, []);
	if (kind === "patient") return /* @__PURE__ */ jsx("div", {
		className: "emg-standalone",
		children: /* @__PURE__ */ jsx(EmergencyPatient, { onClose: goBack })
	});
	return /* @__PURE__ */ jsxs("div", {
		className: kind === "admin" ? "emg-page emg-page-wide" : "emg-page",
		children: [/* @__PURE__ */ jsxs("header", {
			className: "emg-page-head",
			children: [/* @__PURE__ */ jsx("h1", { children: kind === "admin" ? "Emergency dispatch operations" : kind === "hospital" ? "Emergency department" : "Emergency cases" }), /* @__PURE__ */ jsxs("a", {
				href: "tel:108",
				children: [/* @__PURE__ */ jsx(Phone, { size: 15 }), " 108"]
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "emg-page-body",
			children: kind === "admin" ? /* @__PURE__ */ jsx(AdminBoard, {}) : /* @__PURE__ */ jsx(EmergencyResponderPanel, { kind })
		})]
	});
}
//#endregion
export { EmergencyProfileNudge as a, EmergencyProfileForm as i, EmergencyPortal as n, EmergencyResponderPanel as r, EmergencyPatient as t };
