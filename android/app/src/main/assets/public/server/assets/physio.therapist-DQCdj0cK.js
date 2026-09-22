import { n as supabase } from "./client-BSmVQfT1.js";
import { r as createServerFn } from "./server-DyT3b58-.js";
import { C as matchesDoctorSpecialty, M as useLiveCareRequests, V as verifyAndCompleteConsultation, _ as getSpecialtyBaseFare, n as acceptCareRequest } from "./backend-eXdx240h.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { c as PUNE_AREAS, o as PHYSIO_QUALIFICATIONS, s as PHYSIO_SPECIALIZATIONS, t as LANGUAGES } from "./care-staff-catalog-C1GuGVZe.js";
import { n as venueKindLabel, t as listCareVenues } from "./care-venues.functions-vV7C2ptZ.js";
import { a as OnlineToggle, c as Stat, d as fmtWhen, f as inputClass, i as Field, l as Switch, n as Chips, o as Section, r as Empty, s as StaffShell, t as Card, u as Tabs } from "./StaffUI-k1pvanXG.js";
import { t as UnifiedProviderOffers } from "./UnifiedProviderOffers-U5ao8Mat.js";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/lib/physio-therapist.functions.ts
var STAGES = [
	"confirmed",
	"en_route",
	"in_progress",
	"completed",
	"no_show",
	"cancelled"
];
/** The signed-in therapist's own queue of home sessions. */
var getTherapistBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("75ec932fa304aa6de5363c266a38e22908fccbce154b85c2b3ea205247ab0e1d"));
/** Therapist takes an unassigned home-session request in their city. */
var claimPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	return input;
}).handler(createSsrRpc("aff76b40267f887cae51ae3f53dc5af09e7f5a99425620f0ec167e817be4bd9a"));
/** Therapist confirms a session or moves it through the stages. */
var setPhysioVisitStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	if (!STAGES.includes(input.stage)) throw new Error("Unknown stage");
	if (input.note && input.note.length > 1e3) throw new Error("Note must be under 1000 characters");
	return input;
}).handler(createSsrRpc("28c69544e4d5a8cfbeb499e554579e065d2af518d4a6e25aa5d18eb32ab0a0cc"));
/** The signed-in physiotherapist's own profile row (null when not registered). */
var getTherapistProfile = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("fd113baf76520b7417af63b4b49c76f6ffbb2f1de1d5c4ff8ac84b3bce8a0e85"));
/** Physiotherapist updates their own profile and preferred centres. */
var saveTherapistProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.fullName?.trim()) throw new Error("Your name is required");
	if (!Array.isArray(d.specializations) || d.specializations.length === 0) throw new Error("Pick at least one therapy you offer");
	if (d.bio && d.bio.length > 1e3) throw new Error("Keep the summary under 1000 characters");
	return d;
}).handler(createSsrRpc("66d8a9e68e6f9eeab51c2f5a3f26077fc0e3eb753f96bf73b0e8c493fe122d0f"));
/** Physiotherapist goes online (taking sessions) or offline. */
var setTherapistOnline = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ online: !!d?.online })).handler(createSsrRpc("fa62b2fad6bcc0bba7c23a166207e320f3108d951457c0766571c317a27612bd"));
var insertEmergencyPhysioVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((d) => d).handler(createSsrRpc("08ac15ab80fdc6e949cab8ed336d7ef5a231f648062c63fd8baf6fdb27583b3b"));
//#endregion
//#region src/routes/physio.therapist.tsx?tsr-split=component
var NEXT_STAGES = {
	assigned: [{
		stage: "confirmed",
		label: "Confirm this session"
	}, {
		stage: "cancelled",
		label: "Can't take it"
	}],
	confirmed: [{
		stage: "en_route",
		label: "I'm on the way"
	}, {
		stage: "cancelled",
		label: "Cancel"
	}],
	en_route: [{
		stage: "in_progress",
		label: "Start session"
	}, {
		stage: "no_show",
		label: "Patient not available"
	}],
	in_progress: [{
		stage: "completed",
		label: "Complete session"
	}],
	requested: [{
		stage: "confirmed",
		label: "Accept session"
	}]
};
var STATUS_LABEL = {
	requested: "Awaiting assignment",
	assigned: "Needs your confirmation",
	confirmed: "Confirmed",
	en_route: "On the way",
	in_progress: "In progress",
	completed: "Session over",
	cancelled: "Cancelled",
	no_show: "Patient absent"
};
var CLOSED = [
	"completed",
	"cancelled",
	"no_show"
];
function SessionOverDialog({ visit, onClose, onConfirm }) {
	const [notes, setNotes] = useState(() => visit.notes && visit.notes.includes("request (ID:") ? "" : visit.notes ?? "");
	const [otp, setOtp] = useState("");
	const [errorMsg, setErrorMsg] = useState("");
	const [busy, setBusy] = useState(false);
	const handleOtpChange = (e) => {
		const val = e.target.value.replace(/\D/g, "").slice(0, 4);
		setOtp(val);
		if (errorMsg) setErrorMsg("");
	};
	const handleVerify = async () => {
		if (otp.length !== 4 || busy) return;
		setBusy(true);
		setErrorMsg("");
		try {
			const res = await verifyAndCompleteConsultation(visit.id, otp, notes);
			if (res.success) onConfirm(visit, notes);
			else setErrorMsg(res.error || "Incorrect OTP. Ask the patient to read the code shown in their app.");
		} catch (e) {
			setErrorMsg(e instanceof Error ? e.message : "Failed to verify session OTP.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ jsx("div", {
		style: {
			position: "fixed",
			inset: 0,
			zIndex: 70,
			background: "rgba(15,23,42,0.55)",
			display: "flex",
			alignItems: "flex-end",
			justifyContent: "center",
			fontFamily: "'Plus Jakarta Sans', sans-serif"
		},
		onClick: onClose,
		children: /* @__PURE__ */ jsxs("div", {
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "Session over",
			style: {
				background: "#ffffff",
				width: "100%",
				maxWidth: 540,
				borderRadius: "24px 24px 0 0",
				padding: "20px 20px calc(24px + env(safe-area-inset-bottom))",
				boxShadow: "0 -10px 30px rgba(0,0,0,0.15)",
				display: "flex",
				flexDirection: "column",
				gap: 16
			},
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between"
					},
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
						style: {
							margin: 0,
							fontSize: 18,
							fontWeight: 800,
							color: "#0F172A"
						},
						children: "Session over"
					}), /* @__PURE__ */ jsxs("p", {
						style: {
							margin: "2px 0 0",
							fontSize: 13,
							color: "#64748B"
						},
						children: [
							"Patient: ",
							/* @__PURE__ */ jsx("strong", {
								style: { color: "#0F172A" },
								children: visit.patientName
							}),
							" · ",
							visit.therapyLabel
						]
					})] }), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						"aria-label": "Close",
						style: {
							background: "#F1F5F9",
							border: "none",
							borderRadius: "50%",
							width: 32,
							height: 32,
							cursor: "pointer",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#475569",
							fontSize: 16,
							fontWeight: 700
						},
						children: "✕"
					})]
				}),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						justifyContent: "space-between",
						marginBottom: 6
					},
					children: [/* @__PURE__ */ jsx("label", {
						style: {
							fontSize: 12.5,
							fontWeight: 700,
							color: "#334155"
						},
						children: "Therapist's Instructions & Notes"
					}), /* @__PURE__ */ jsxs("span", {
						style: {
							fontSize: 11,
							color: "#94A3B8"
						},
						children: [notes.length, "/1000"]
					})]
				}), /* @__PURE__ */ jsx("textarea", {
					value: notes,
					onChange: (e) => setNotes(e.target.value.slice(0, 1e3)),
					maxLength: 1e3,
					rows: 4,
					placeholder: "Advice, exercise plan, recovery observations, follow-up…",
					style: {
						width: "100%",
						boxSizing: "border-box",
						padding: "12px 14px",
						borderRadius: 14,
						border: "1.5px solid #E2E8F0",
						fontSize: 13.5,
						fontFamily: "inherit",
						resize: "none",
						outline: "none",
						color: "#0F172A",
						background: "#F8FAFC"
					}
				})] }),
				/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("label", {
						style: {
							display: "block",
							fontSize: 12.5,
							fontWeight: 700,
							color: "#334155",
							marginBottom: 6
						},
						children: "Patient Verification Code"
					}),
					/* @__PURE__ */ jsx("input", {
						type: "text",
						inputMode: "numeric",
						value: otp,
						onChange: handleOtpChange,
						placeholder: "• • • •",
						maxLength: 4,
						style: {
							width: "100%",
							boxSizing: "border-box",
							padding: "12px 16px",
							borderRadius: 14,
							border: errorMsg ? "1.5px solid #EF4444" : "1.5px solid #E2E8F0",
							fontSize: 24,
							fontWeight: 800,
							letterSpacing: "12px",
							textAlign: "center",
							fontFamily: "monospace",
							outline: "none",
							color: "#0F172A",
							background: "#F8FAFC"
						}
					}),
					/* @__PURE__ */ jsx("p", {
						style: {
							margin: "6px 0 0",
							fontSize: 11.5,
							color: "#64748B",
							textAlign: "center"
						},
						children: "Ask the patient to read the 4-digit code shown in their app"
					}),
					errorMsg && /* @__PURE__ */ jsx("p", {
						style: {
							margin: "6px 0 0",
							fontSize: 12,
							color: "#DC2626",
							fontWeight: 600,
							textAlign: "center"
						},
						children: errorMsg
					})
				] }),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: handleVerify,
					disabled: otp.length !== 4 || busy,
					style: {
						width: "100%",
						padding: "14px",
						borderRadius: 14,
						border: "none",
						background: otp.length === 4 && !busy ? "#0D9488" : "#CBD5E1",
						color: "#ffffff",
						fontSize: 14.5,
						fontWeight: 800,
						cursor: otp.length === 4 && !busy ? "pointer" : "not-allowed",
						transition: "all 0.15s",
						boxShadow: otp.length === 4 && !busy ? "0 4px 12px rgba(13,148,136,0.3)" : "none"
					},
					children: busy ? "Verifying with backend…" : "Verify OTP & close"
				})
			]
		})
	});
}
function PatientName({ patientId }) {
	const [name, setName] = useState(null);
	useEffect(() => {
		if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) {
			if (patientId.includes("kavita")) setName("Kavita (Demo)");
			else if (patientId.includes("priya")) setName("Priya (Demo)");
			return;
		}
		supabase.from("profiles").select("full_name").eq("id", patientId).maybeSingle().then(({ data }) => {
			if (data?.full_name) setName(data.full_name);
		});
	}, [patientId]);
	return /* @__PURE__ */ jsx(Fragment, { children: name ? name : "Patient" });
}
function VisitCard({ v, note, onNote, onStage, onClaim, busy }) {
	const displayFee = v.fee ?? 0;
	return /* @__PURE__ */ jsxs(Card, {
		accent: !!onClaim || v.urgency === "urgent",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "text-sm font-extrabold",
							children: [
								v.patientName,
								" · ",
								v.therapyLabel
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-xs text-slate-500",
							children: [
								fmtWhen(v.scheduledAt),
								" · ",
								v.durationMin,
								" min · session ",
								v.sessionNumber
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-xs text-slate-500",
							children: [
								v.area,
								", ",
								v.city,
								v.address ? ` · ${v.address}` : ""
							]
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "shrink-0 text-right",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700",
						children: ["₹", displayFee]
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-1 text-[10px] font-semibold text-slate-500",
						children: STATUS_LABEL[v.status] ?? v.status
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2 flex flex-wrap gap-2 text-[11px] font-semibold",
				children: [v.urgency === "urgent" ? /* @__PURE__ */ jsx("span", {
					className: "rounded-full bg-red-50 px-2 py-1 text-red-700",
					children: "Urgent"
				}) : null, /* @__PURE__ */ jsx("span", {
					className: "rounded-full bg-slate-50 px-2 py-1 text-slate-600",
					children: v.fromPack ? "Paid from session pack" : v.paymentStatus === "paid" ? `Paid ₹${displayFee}` : `Payment pending ₹${displayFee}`
				})]
			}),
			v.notes && !v.notes.includes("request (ID:") ? /* @__PURE__ */ jsxs("div", {
				className: "mt-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-700",
				children: [/* @__PURE__ */ jsx("span", {
					className: "font-semibold text-slate-500",
					children: v.status === "completed" ? "Session notes: " : "Note: "
				}), v.notes]
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3",
				children: [onClaim ? /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: busy,
					onClick: () => onClaim(v.id),
					className: "min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
					children: "Take this session"
				}) : null, onStage ? (NEXT_STAGES[v.status] ?? []).map((a) => /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: busy,
					onClick: () => onStage(v.id, a.stage),
					className: `min-h-[40px] rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-60 ${a.stage === "cancelled" || a.stage === "no_show" ? "bg-slate-100 text-slate-600" : "bg-teal-600 text-white"}`,
					children: a.label
				}, a.stage)) : null]
			})
		]
	});
}
function TherapistHome() {
	const fetchBoard = useServerFn(getTherapistBoard);
	const fetchProfile = useServerFn(getTherapistProfile);
	const fetchVenues = useServerFn(listCareVenues);
	const saveProfileFn = useServerFn(saveTherapistProfile);
	const goOnline = useServerFn(setTherapistOnline);
	const setStage = useServerFn(setPhysioVisitStage);
	const claimVisit = useServerFn(claimPhysioVisit);
	const insertVisit = useServerFn(insertEmergencyPhysioVisit);
	const qc = useQueryClient();
	const signOut = async () => {
		const { supabase } = await import("./client-BSmVQfT1.js").then((n) => n.t);
		await supabase.auth.signOut();
		if (typeof window !== "undefined") {
			localStorage.removeItem("mc_view");
			window.location.href = "/";
		}
	};
	const [tab, setTab] = useState("today");
	const [notes, setNotes] = useState({});
	const [notice, setNotice] = useState("");
	const board = useQuery({
		queryKey: ["therapist-board"],
		queryFn: () => fetchBoard({}),
		refetchInterval: 3e4
	});
	const profileQ = useQuery({
		queryKey: ["therapist-profile"],
		queryFn: () => fetchProfile({})
	});
	const venues = useQuery({
		queryKey: ["care-venues"],
		queryFn: () => fetchVenues({}),
		staleTime: 3e5
	});
	const profile = profileQ.data?.profile ?? null;
	const [form, setForm] = useState({
		fullName: "",
		phone: "",
		specializations: [],
		qualification: "bpt",
		registrationNumber: "",
		yearsExperience: 0,
		areas: [],
		city: "Pune",
		homeVisits: true,
		clinicVisits: true,
		preferredFacilities: [],
		languages: [],
		bio: "",
		recentCourses: "",
		specialInterests: ""
	});
	useEffect(() => {
		if (!profile) return;
		setForm({
			fullName: profile.fullName,
			phone: profile.phone ?? "",
			specializations: profile.specializations,
			qualification: profile.qualification ?? "bpt",
			registrationNumber: profile.registrationNumber ?? "",
			yearsExperience: profile.yearsExperience ?? 0,
			areas: profile.areas,
			city: profile.city,
			homeVisits: profile.homeVisits,
			clinicVisits: profile.clinicVisits,
			preferredFacilities: profile.preferredFacilities,
			languages: profile.languages,
			bio: profile.bio ?? "",
			recentCourses: profile.recentCourses ?? "",
			specialInterests: profile.specialInterests ?? ""
		});
	}, [profile]);
	useEffect(() => {
		if (profileQ.data && !profileQ.data.profile) setTab("profile");
	}, [profileQ.data]);
	const online = useMutation({
		mutationFn: (v) => goOnline({ data: { online: v } }),
		onSuccess: (r) => {
			setNotice(r?.online ? "You are online — new session requests will reach you." : "You are offline.");
			qc.invalidateQueries({ queryKey: ["therapist-profile"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not change your status")
	});
	const save = useMutation({
		mutationFn: (v) => saveProfileFn({ data: v }),
		onSuccess: () => {
			setNotice("Profile saved — patients booking these therapies can now be matched to you.");
			qc.invalidateQueries({ queryKey: ["therapist-profile"] });
			qc.invalidateQueries({ queryKey: ["therapist-board"] });
			setTab("today");
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not save your profile")
	});
	const stageMut = useMutation({
		mutationFn: (v) => setStage({ data: v }),
		onSuccess: () => {
			setNotice("Session updated — the patient has been notified.");
			qc.invalidateQueries({ queryKey: ["therapist-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not update the session")
	});
	const claim = useMutation({
		mutationFn: (visitId) => claimVisit({ data: { visitId } }),
		onSuccess: (_data, visitId) => {
			setNotice("Session taken — confirm the slot to let the patient know.");
			qc.invalidateQueries({ queryKey: ["therapist-board"] });
			const claimedVisit = (board.data?.openRequests ?? []).find((v) => v.id === visitId);
			if (claimedVisit?.scheduledAt) {
				const sod = /* @__PURE__ */ new Date();
				sod.setHours(0, 0, 0, 0);
				const eod = sod.getTime() + 864e5;
				if (new Date(claimedVisit.scheduledAt).getTime() >= eod) {
					setTab("upcoming");
					return;
				}
			}
			setTab("today");
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not take this session")
	});
	const toggle = (key, value) => setForm((f) => ({
		...f,
		[key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value]
	}));
	const venueOptions = useMemo(() => (venues.data?.venues ?? []).map((v) => ({
		value: v.name,
		label: v.area ? `${v.name} · ${v.area}` : v.name,
		group: venueKindLabel(v.kind)
	})), [venues.data]);
	const data = board.data;
	const visits = data?.visits ?? [];
	const startOfDay = /* @__PURE__ */ new Date();
	startOfDay.setHours(0, 0, 0, 0);
	const endOfDay = startOfDay.getTime() + 864e5;
	const today = visits.filter((v) => {
		const t = v.scheduledAt ? new Date(v.scheduledAt).getTime() : null;
		return !CLOSED.includes(v.status) && t != null && t >= startOfDay.getTime() && t < endOfDay;
	});
	const upcoming = visits.filter((v) => {
		const t = v.scheduledAt ? new Date(v.scheduledAt).getTime() : null;
		return !CLOSED.includes(v.status) && (t == null || t >= endOfDay);
	});
	const history = visits.filter((v) => CLOSED.includes(v.status));
	const openRequests = data?.openRequests ?? [];
	const [sessionOverVisit, setSessionOverVisit] = useState(null);
	const stageProps = (v) => ({
		note: notes[v.id],
		onNote: (val) => setNotes((n) => ({
			...n,
			[v.id]: val
		})),
		onStage: (id, s) => {
			if (s === "completed") {
				setSessionOverVisit(v);
				return;
			}
			setNotice("");
			stageMut.mutate({
				visitId: id,
				stage: s,
				note: notes[id] ?? null
			});
		},
		busy: stageMut.isPending
	});
	const handleSessionOverConfirm = (_visit, _completionNotes) => {
		setSessionOverVisit(null);
		setNotice("Session completed — patient verified with OTP.");
		qc.invalidateQueries({ queryKey: ["therapist-board"] });
	};
	const isOnline = profile ? profile.isOnline : true;
	const { rows: liveCareRequests } = useLiveCareRequests(isOnline);
	const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState({});
	const [acceptingId, setAcceptingId] = useState(null);
	const activeLiveCareRequests = useMemo(() => {
		if (!isOnline) return [];
		return (liveCareRequests || []).filter((r) => r.status === "open" && !dismissedBroadcastIds[r.id] && matchesDoctorSpecialty("Physiotherapy", r.specialty));
	}, [
		liveCareRequests,
		isOnline,
		dismissedBroadcastIds
	]);
	const handleAcceptCareRequest = async (reqId) => {
		setAcceptingId(reqId);
		try {
			const cr = await acceptCareRequest(reqId);
			if (cr && (String(cr.specialty || "").toLowerCase().includes("physio") || String(cr.specialty || "").toLowerCase().includes("therap"))) {
				const isEmergency = !!cr.emergency;
				const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", cr.patient_id).maybeSingle();
				const baseFare = Number(cr.fare) > 0 ? Number(cr.fare) : getSpecialtyBaseFare(cr.specialty);
				await insertVisit({ data: {
					reqId: cr.id,
					patientId: cr.patient_id,
					patientName: pData?.full_name || (isEmergency ? "Emergency Patient" : "Patient"),
					specialty: cr.specialty || "Physiotherapy",
					fare: baseFare,
					urgency: isEmergency ? "urgent" : "planned",
					notes: cr.notes || void 0
				} });
			}
			setNotice("Physiotherapy request accepted! Patient has been notified.");
			qc.invalidateQueries({ queryKey: ["therapist-board"] });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Could not accept request.";
			setNotice(msg);
		} finally {
			setAcceptingId(null);
		}
	};
	return /* @__PURE__ */ jsxs(StaffShell, {
		title: "Physiotherapist home",
		subtitle: profile ? `${profile.fullName} · ${profile.specializations.length} therapies · ${profile.areas[0] ?? profile.city}` : "Set up your therapy profile",
		right: /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [
				profile ? /* @__PURE__ */ jsx(OnlineToggle, {
					online: profile.isOnline,
					busy: online.isPending,
					onChange: (v) => online.mutate(v),
					onlineLabel: "Taking sessions"
				}) : null,
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setTab("profile"),
					className: "min-h-[36px] rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700",
					children: "Profile & settings"
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: signOut,
					className: "min-h-[36px] rounded-full bg-slate-900 px-3 text-xs font-bold text-white",
					children: "Log out"
				})
			]
		}),
		children: [board.isLoading || profileQ.isLoading ? /* @__PURE__ */ jsx(Empty, { children: "Loading your sessions…" }) : board.isError ? /* @__PURE__ */ jsxs(Empty, { children: [
			board.error instanceof Error ? board.error.message : "Could not load your sessions.",
			" ",
			/* @__PURE__ */ jsx(Link, {
				to: "/auth",
				search: {
					admin: void 0,
					next: void 0
				},
				className: "font-semibold underline",
				children: "Sign in"
			})
		] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
			data?.therapist ? /* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "To confirm",
						value: data.totals.toConfirm
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Today",
						value: data.totals.today
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Upcoming",
						value: data.totals.upcoming
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Completed (30d)",
						value: data.totals.completed30d,
						tone: "slate"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Earnings (30d)",
						value: `₹${data.totals.earnings30d}`
					})
				]
			}) : null,
			notice ? /* @__PURE__ */ jsx("div", {
				className: "rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700",
				children: notice
			}) : null,
			activeLiveCareRequests.length > 0 && /* @__PURE__ */ jsxs("div", {
				className: "space-y-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between px-1",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "text-xs font-black uppercase tracking-wider text-teal-800 flex items-center gap-2",
						children: [
							/* @__PURE__ */ jsx("span", { className: "size-2 rounded-full bg-teal-500 animate-ping" }),
							"Live Incoming Broadcasts (",
							activeLiveCareRequests.length,
							")"
						]
					}), /* @__PURE__ */ jsx("span", {
						className: "text-[11px] font-semibold text-slate-500",
						children: "First to accept wins"
					})]
				}), /* @__PURE__ */ jsx("div", {
					className: "flex flex-col gap-3",
					children: activeLiveCareRequests.map((req) => {
						const base = Number(req.fare) > 0 ? Number(req.fare) : getSpecialtyBaseFare(req.specialty);
						const displayFare = req.emergency ? Math.round(base * 1.2) : base;
						return /* @__PURE__ */ jsxs("div", {
							className: "rounded-2xl border-2 border-teal-500 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 shadow-lg transition-all",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ jsxs("div", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ jsx("span", { className: "flex size-3 rounded-full bg-teal-500 animate-ping" }), /* @__PURE__ */ jsxs("span", {
											className: "text-xs font-black uppercase tracking-wider text-teal-800",
											children: ["⚡ Live Incoming Broadcast · ", req.specialty || "Physiotherapy"]
										})]
									}), req.emergency ? /* @__PURE__ */ jsx("span", {
										className: "rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold text-red-700",
										children: "EMERGENCY (≤2h)"
									}) : /* @__PURE__ */ jsx("span", {
										className: "rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-extrabold text-blue-700",
										children: "Scheduled"
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
									children: [/* @__PURE__ */ jsxs("div", { children: [
										/* @__PURE__ */ jsxs("h3", {
											className: "text-base font-extrabold text-slate-900",
											children: [
												"New ",
												req.specialty || "Physiotherapy",
												" Request"
											]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "text-sm font-semibold text-slate-800 mt-0.5",
											children: [
												"Patient: ",
												/* @__PURE__ */ jsx(PatientName, { patientId: req.patient_id }),
												req.scheduled_at ? ` · ${new Date(req.scheduled_at).toLocaleString()}` : ""
											]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "text-xs text-slate-600 mt-1",
											children: [req.notes?.replace(/^Hub:\s*/, "") || "Nearby Pune Area", " · First to accept wins"]
										})
									] }), /* @__PURE__ */ jsx("div", {
										className: "text-right",
										children: /* @__PURE__ */ jsxs("span", {
											className: "text-sm font-black text-teal-800",
											children: ["₹", displayFare]
										})
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 flex gap-2",
									children: [/* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => setDismissedBroadcastIds((prev) => ({
											...prev,
											[req.id]: true
										})),
										className: "rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors",
										children: "Decline"
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										disabled: acceptingId === req.id,
										onClick: () => handleAcceptCareRequest(req.id),
										className: "flex-1 rounded-xl bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-teal-700 disabled:opacity-50 transition-colors",
										children: acceptingId === req.id ? "Accepting..." : "Accept Request · Start Visit"
									})]
								})
							]
						}, req.id);
					})
				})]
			}),
			tab !== "profile" ? /* @__PURE__ */ jsx(UnifiedProviderOffers, { roleLabel: "physiotherapy" }) : null,
			/* @__PURE__ */ jsx(Tabs, {
				value: tab,
				onChange: setTab,
				tabs: [
					{
						value: "today",
						label: "Today",
						count: today.length
					},
					{
						value: "open",
						label: "New requests",
						count: openRequests.length
					},
					{
						value: "upcoming",
						label: "Upcoming",
						count: upcoming.length
					},
					{
						value: "history",
						label: "History",
						count: history.length
					},
					{
						value: "profile",
						label: "My profile"
					}
				]
			}),
			tab === "today" ? /* @__PURE__ */ jsx(Section, {
				title: "Today's sessions",
				count: today.length,
				children: !today.length ? /* @__PURE__ */ jsx(Empty, { children: "No sessions booked for today." }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: today.map((v) => /* @__PURE__ */ jsx(VisitCard, {
						v,
						...stageProps(v)
					}, v.id))
				})
			}) : null,
			tab === "open" ? /* @__PURE__ */ jsx(Section, {
				title: "New requests near you",
				count: openRequests.length,
				children: !openRequests.length ? /* @__PURE__ */ jsxs(Empty, { children: [
					"No unassigned home sessions in ",
					data?.therapist?.city ?? "your city",
					" right now."
				] }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: openRequests.map((v) => /* @__PURE__ */ jsx(VisitCard, {
						v,
						busy: claim.isPending,
						onClaim: (id) => {
							setNotice("");
							claim.mutate(id);
						}
					}, v.id))
				})
			}) : null,
			tab === "upcoming" ? /* @__PURE__ */ jsx(Section, {
				title: "Upcoming sessions",
				count: upcoming.length,
				children: !upcoming.length ? /* @__PURE__ */ jsx(Empty, { children: "Nothing scheduled ahead yet." }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: upcoming.map((v) => /* @__PURE__ */ jsx(VisitCard, {
						v,
						...stageProps(v)
					}, v.id))
				})
			}) : null,
			tab === "history" ? /* @__PURE__ */ jsx(Section, {
				title: "Recent history",
				count: history.length,
				children: !history.length ? /* @__PURE__ */ jsx(Empty, { children: "Nothing closed in the last 30 days." }) : /* @__PURE__ */ jsx("div", {
					className: "overflow-x-auto rounded-2xl border border-slate-200 bg-white",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full text-left text-xs",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-slate-50 text-slate-500",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Patient"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Therapy"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "When"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Outcome"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Fee"
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", { children: history.map((v) => /* @__PURE__ */ jsxs("tr", {
							className: "border-t border-slate-100",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 font-semibold",
									children: v.patientName
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: v.therapyLabel
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: fmtWhen(v.scheduledAt)
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: STATUS_LABEL[v.status] ?? v.status
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-3 py-2",
									children: ["₹", v.fee ?? 0]
								})
							]
						}, v.id)) })]
					})
				})
			}) : null,
			tab === "profile" ? /* @__PURE__ */ jsxs("form", {
				className: "space-y-4",
				onSubmit: (e) => {
					e.preventDefault();
					setNotice("");
					save.mutate(form);
				},
				children: [
					/* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsxs("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [
							/* @__PURE__ */ jsx(Field, {
								label: "Full name",
								children: /* @__PURE__ */ jsx("input", {
									className: inputClass,
									value: form.fullName,
									onChange: (e) => setForm((f) => ({
										...f,
										fullName: e.target.value
									})),
									required: true
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "Phone",
								children: /* @__PURE__ */ jsx("input", {
									className: inputClass,
									value: form.phone ?? "",
									onChange: (e) => setForm((f) => ({
										...f,
										phone: e.target.value
									}))
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "Qualification",
								children: /* @__PURE__ */ jsx("select", {
									className: inputClass,
									value: form.qualification ?? "",
									onChange: (e) => setForm((f) => ({
										...f,
										qualification: e.target.value
									})),
									children: PHYSIO_QUALIFICATIONS.map((q) => /* @__PURE__ */ jsx("option", {
										value: q.value,
										children: q.label
									}, q.value))
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "Registration number",
								children: /* @__PURE__ */ jsx("input", {
									className: inputClass,
									value: form.registrationNumber ?? "",
									onChange: (e) => setForm((f) => ({
										...f,
										registrationNumber: e.target.value
									}))
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "Years of experience",
								children: /* @__PURE__ */ jsx("input", {
									type: "number",
									min: 0,
									max: 60,
									className: inputClass,
									value: form.yearsExperience ?? 0,
									onChange: (e) => setForm((f) => ({
										...f,
										yearsExperience: Number(e.target.value)
									}))
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "City",
								children: /* @__PURE__ */ jsx("input", {
									className: inputClass,
									value: form.city,
									onChange: (e) => setForm((f) => ({
										...f,
										city: e.target.value
									}))
								})
							})
						]
					}) }),
					/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h3", {
						className: "mb-2 text-sm font-extrabold",
						children: "Therapies you offer"
					}), /* @__PURE__ */ jsx(Chips, {
						options: PHYSIO_SPECIALIZATIONS,
						selected: form.specializations,
						onToggle: (v) => toggle("specializations", v)
					})] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Where you work"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-2 sm:grid-cols-2",
							children: [/* @__PURE__ */ jsx(Switch, {
								on: form.homeVisits,
								onChange: (v) => setForm((f) => ({
									...f,
									homeVisits: v
								})),
								label: "Home visits"
							}), /* @__PURE__ */ jsx(Switch, {
								on: form.clinicVisits,
								onChange: (v) => setForm((f) => ({
									...f,
									clinicVisits: v
								})),
								label: "Clinics, centres & hospitals"
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3",
							children: [/* @__PURE__ */ jsx("h4", {
								className: "mb-1 text-xs font-bold text-slate-700",
								children: "Physiotherapy centres, clinics & hospitals you prefer"
							}), venues.isLoading ? /* @__PURE__ */ jsx("p", {
								className: "text-xs text-slate-500",
								children: "Loading places…"
							}) : /* @__PURE__ */ jsx(Chips, {
								options: venueOptions,
								selected: form.preferredFacilities,
								onToggle: (v) => toggle("preferredFacilities", v),
								grouped: true
							})]
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Areas you cover"
						}),
						/* @__PURE__ */ jsx(Chips, {
							options: PUNE_AREAS.map((a) => ({
								value: a,
								label: a
							})),
							selected: form.areas,
							onToggle: (v) => toggle("areas", v)
						}),
						/* @__PURE__ */ jsx("h4", {
							className: "mt-3 mb-1 text-xs font-bold text-slate-700",
							children: "Languages"
						}),
						/* @__PURE__ */ jsx(Chips, {
							options: LANGUAGES,
							selected: form.languages,
							onToggle: (v) => toggle("languages", v)
						}),
						/* @__PURE__ */ jsx("textarea", {
							rows: 3,
							maxLength: 1e3,
							className: "mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm",
							placeholder: "Short summary patients will see (optional)",
							value: form.bio ?? "",
							onChange: (e) => setForm((f) => ({
								...f,
								bio: e.target.value
							}))
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h3", {
						className: "mb-2 text-sm font-extrabold",
						children: "Recent courses & special interest"
					}), /* @__PURE__ */ jsxs("div", {
						className: "space-y-3",
						children: [/* @__PURE__ */ jsx(Field, {
							label: "New courses, certifications or specialities completed",
							children: /* @__PURE__ */ jsx("textarea", {
								rows: 3,
								maxLength: 1e3,
								className: "w-full rounded-xl border border-slate-200 p-3 text-sm",
								placeholder: "e.g. Certified Dry Needling (2026), Advanced Manual Therapy — Pune, Vestibular rehab course",
								value: form.recentCourses ?? "",
								onChange: (e) => setForm((f) => ({
									...f,
									recentCourses: e.target.value
								}))
							})
						}), /* @__PURE__ */ jsx(Field, {
							label: "Special interest",
							children: /* @__PURE__ */ jsx("textarea", {
								rows: 2,
								maxLength: 500,
								className: "w-full rounded-xl border border-slate-200 p-3 text-sm",
								placeholder: "e.g. post-stroke gait training, sports shoulder, paediatric neuro",
								value: form.specialInterests ?? "",
								onChange: (e) => setForm((f) => ({
									...f,
									specialInterests: e.target.value
								}))
							})
						})]
					})] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-1 text-sm font-extrabold",
							children: "Account"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-3 text-xs text-slate-500",
							children: "Sign out of this device."
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: signOut,
							className: "min-h-[44px] w-full rounded-full border border-slate-300 px-6 text-sm font-bold text-slate-700",
							children: "Log out"
						})
					] }),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: save.isPending,
						className: "min-h-[48px] w-full rounded-full bg-teal-600 px-6 text-sm font-bold text-white disabled:opacity-60",
						children: save.isPending ? "Saving…" : profile ? "Save profile" : "Create my physiotherapist profile"
					})
				]
			}) : null
		] }), sessionOverVisit && /* @__PURE__ */ jsx(SessionOverDialog, {
			visit: sessionOverVisit,
			onClose: () => setSessionOverVisit(null),
			onConfirm: handleSessionOverConfirm
		})]
	});
}
//#endregion
export { TherapistHome as component };
