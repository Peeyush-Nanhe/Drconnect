import { n as supabase } from "./client-BSmVQfT1.js";
import { B as useSession, C as matchesDoctorSpecialty, M as useLiveCareRequests, V as verifyAndCompleteConsultation, n as acceptCareRequest } from "./backend-eXdx240h.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
/* empty css                   */
import { a as NURSE_SKILL_LABEL, c as PUNE_AREAS, i as NURSE_SKILLS, l as SHIFT_LABEL, r as NURSE_QUALIFICATIONS, t as LANGUAGES, u as SHIFT_PREFS } from "./care-staff-catalog-C1GuGVZe.js";
import { n as venueKindLabel, t as listCareVenues } from "./care-venues.functions-vV7C2ptZ.js";
import { a as OnlineToggle, c as Stat, d as fmtWhen, f as inputClass, i as Field, l as Switch, n as Chips, o as Section, r as Empty, s as StaffShell, t as Card, u as Tabs } from "./StaffUI-k1pvanXG.js";
import { t as UnifiedProviderOffers } from "./UnifiedProviderOffers-U5ao8Mat.js";
import { a as setNurseJobStage, n as getNurseBoard, o as setNurseOnline, r as saveNurseProfile, t as applyToNurseJob } from "./nurse.functions-CuDC3Xdz.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/features/mydox/nursing/nursing-client.ts
var db$1 = supabase;
/** The server prefixes its errors with a stable code; show the sentence after it. */
function nursingErrorText(error) {
	const raw = error?.message ?? String(error ?? "");
	const m = raw.match(/NURSING_[A-Z_]+:\s*(.+)$/);
	return m ? m[1] : raw || "Something went wrong.";
}
function isNursingError(error, code) {
	return (error?.message ?? "").includes(code);
}
async function call(fn, args) {
	const { data, error } = await db$1.rpc(fn, args);
	if (error) throw error;
	return data;
}
function releaseNursingVisit(visitId, reason) {
	return call("release_nursing_visit", {
		p_visit_id: visitId,
		p_reason: reason ?? null
	});
}
function startNursingTravel(visitId) {
	return call("advance_nursing_visit", {
		p_visit_id: visitId,
		p_status: "en_route"
	});
}
/** The only route to 'arrived'. A wrong code throws NURSING_CODE_WRONG. */
function verifyNursingArrival(visitId, code) {
	return call("verify_nursing_arrival", {
		p_visit_id: visitId,
		p_code: code
	});
}
function completeNursingVisit(visitId) {
	return call("advance_nursing_visit", {
		p_visit_id: visitId,
		p_status: "completed"
	});
}
function reportPatientNoShow(visitId) {
	return call("advance_nursing_visit", {
		p_visit_id: visitId,
		p_status: "no_show_patient"
	});
}
/** Address opens two hours before the shift; earlier throws NURSING_TOO_EARLY. */
function getNursingDirections(visitId) {
	return call("nursing_visit_directions", { p_visit_id: visitId });
}
/** A nurse's own assigned days, for her shift list. */
async function listMyNursingShifts(nurseId) {
	const { data, error } = await db$1.from("nursing_visits").select("*").eq("assigned_nurse_id", nurseId).in("status", [
		"scheduled",
		"en_route",
		"arrived"
	]).order("visit_date", { ascending: true }).limit(100);
	if (error) throw error;
	return data ?? [];
}
//#endregion
//#region src/features/mydox/nursing/NurseShiftsPanel.tsx
/**
* The nurse's own days, once she has them. Separate from her offer queue: this
* is work already hers, so the actions here are travel, arrival and closing.
*
* Arrival is not self-declared. She enters the six digits the family reads out,
* and only then can the day be closed and paid.
*/
function dayText$1(d) {
	return (/* @__PURE__ */ new Date(d + "T00:00:00")).toLocaleDateString("en-IN", {
		weekday: "short",
		day: "numeric",
		month: "short"
	});
}
function clock(ts) {
	return ts ? new Date(ts).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit"
	}) : "";
}
function NurseShiftsPanel({ userId }) {
	const [shifts, setShifts] = useState([]);
	const [error, setError] = useState(null);
	const [busy, setBusy] = useState(null);
	const [codeFor, setCodeFor] = useState(null);
	const [code, setCode] = useState("");
	const [directions, setDirections] = useState({});
	const refresh = useCallback(async () => {
		if (!userId) return;
		try {
			setShifts(await listMyNursingShifts(userId));
			setError(null);
		} catch (e) {
			setError(nursingErrorText(e));
		}
	}, [userId]);
	useEffect(() => {
		refresh();
		const t = setInterval(() => void refresh(), 15e3);
		return () => clearInterval(t);
	}, [refresh]);
	async function run(id, fn) {
		setBusy(id);
		try {
			await fn();
			setError(null);
			await refresh();
		} catch (e) {
			setError(nursingErrorText(e));
		} finally {
			setBusy(null);
		}
	}
	async function onDirections(v) {
		setBusy(v.id);
		try {
			setDirections((d) => ({
				...d,
				[v.id]: null
			}));
			const dir = await getNursingDirections(v.id);
			setDirections((d) => ({
				...d,
				[v.id]: dir
			}));
			setError(null);
		} catch (e) {
			setError(isNursingError(e, "NURSING_TOO_EARLY") ? "The address opens two hours before the shift starts." : nursingErrorText(e));
		} finally {
			setBusy(null);
		}
	}
	async function onVerify(v) {
		if (!/^[0-9]{6}$/.test(code)) {
			setError("Enter the six digits from the family.");
			return;
		}
		await run(v.id, () => verifyNursingArrival(v.id, code));
		setCode("");
		setCodeFor(null);
	}
	if (!userId || !shifts.length && !error) return null;
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-stack",
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "emg-section-title",
				children: "Your nursing shifts"
			}),
			error && /* @__PURE__ */ jsx("p", {
				className: "emg-note",
				role: "alert",
				children: error
			}),
			shifts.map((v) => {
				const dir = directions[v.id];
				return /* @__PURE__ */ jsxs("section", {
					className: "emg-card",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "emg-case-head",
							children: [/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								children: "🗓️"
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: dayText$1(v.visit_date) }), /* @__PURE__ */ jsxs("p", { children: [
								clock(v.shift_start),
								"–",
								clock(v.shift_end),
								v.status === "en_route" ? " · on the way" : "",
								v.status === "arrived" ? " · with the patient" : ""
							] })] })]
						}),
						dir && /* @__PURE__ */ jsxs("div", {
							className: "emg-note",
							children: [
								/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("b", { children: dir.patient_name ?? "Patient" }) }),
								dir.address && /* @__PURE__ */ jsx("p", { children: dir.address }),
								dir.maps_url && /* @__PURE__ */ jsx("a", {
									href: dir.maps_url,
									target: "_blank",
									rel: "noopener noreferrer",
									children: "Open directions"
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "emg-actions",
							children: [
								!dir && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "emg-ghost",
									disabled: busy === v.id,
									onClick: () => onDirections(v),
									children: "Address & directions"
								}),
								v.status === "scheduled" && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "emg-primary",
									disabled: busy === v.id,
									onClick: () => run(v.id, () => startNursingTravel(v.id)),
									children: busy === v.id ? "…" : "I'm on my way"
								}),
								(v.status === "scheduled" || v.status === "en_route") && (codeFor === v.id ? /* @__PURE__ */ jsxs("span", {
									style: {
										display: "flex",
										gap: 6,
										alignItems: "center"
									},
									children: [/* @__PURE__ */ jsx("input", {
										inputMode: "numeric",
										maxLength: 6,
										value: code,
										"aria-label": "Arrival code from the family",
										onChange: (e) => setCode(e.target.value.replace(/\D/g, "")),
										style: {
											width: 96,
											padding: "6px 8px",
											borderRadius: 8,
											border: "1px solid #CBD5E1",
											letterSpacing: 3,
											fontWeight: 700,
											textAlign: "center"
										}
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										className: "emg-primary",
										disabled: busy === v.id,
										onClick: () => void onVerify(v),
										children: "Confirm arrival"
									})]
								}) : /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "emg-primary",
									disabled: busy === v.id,
									onClick: () => {
										setCodeFor(v.id);
										setCode("");
									},
									children: "Enter arrival code"
								})),
								v.status === "arrived" && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "emg-primary",
									disabled: busy === v.id,
									onClick: () => run(v.id, () => completeNursingVisit(v.id)),
									children: busy === v.id ? "…" : "Finish the day"
								}),
								v.status === "scheduled" && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "emg-ghost",
									disabled: busy === v.id,
									onClick: () => {
										const why = window.prompt("Why can you not attend? Twelve hours' notice or more costs you nothing if cover is found.");
										if (why === null) return;
										run(v.id, () => releaseNursingVisit(v.id, why || "No reason given"));
									},
									children: "Cannot attend"
								}),
								v.status === "en_route" && /* @__PURE__ */ jsx("button", {
									type: "button",
									className: "emg-ghost",
									disabled: busy === v.id,
									onClick: () => {
										if (!window.confirm("Report that nobody was home?")) return;
										run(v.id, () => reportPatientNoShow(v.id));
									},
									children: "Nobody home"
								})
							]
						})
					]
				}, v.id);
			})
		]
	});
}
//#endregion
//#region src/features/mydox/nursing/NurseRequestsPanel.tsx
var db = supabase;
var POLL_MS = 5e3;
function money(n) {
	return "₹" + Number(n ?? 0).toLocaleString("en-IN");
}
function dayText(d) {
	return (/* @__PURE__ */ new Date(d + "T00:00:00")).toLocaleDateString("en-IN", {
		weekday: "short",
		day: "numeric",
		month: "short"
	});
}
function notify(msg) {
	if (typeof document === "undefined") return;
	let el = document.getElementById("mc-toast");
	if (!el) {
		el = document.createElement("div");
		el.id = "mc-toast";
		el.style.cssText = "position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);background:#0B201C;color:#fff;padding:11px 18px;border-radius:14px;font:600 13px/1.4 'Plus Jakarta Sans',system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:9999;opacity:0;transition:all .25s;max-width:300px;text-align:center;pointer-events:none";
		document.body.appendChild(el);
	}
	el.textContent = msg;
	requestAnimationFrame(() => {
		el.style.opacity = "1";
		el.style.transform = "translateX(-50%) translateY(0)";
	});
	setTimeout(() => {
		if (el) el.style.opacity = "0";
		el.style.transform = "translateX(-50%) translateY(20px)";
	}, 3500);
}
function NurseRequestsPanel({ userId }) {
	const [engagements, setEngagements] = useState([]);
	const [visits, setVisits] = useState([]);
	const [error, setError] = useState(null);
	const [busyId, setBusyId] = useState(null);
	const [loaded, setLoaded] = useState(false);
	const lock = useRef(false);
	const lastOfferedCount = useRef(0);
	const refresh = useCallback(async () => {
		if (!userId) return;
		try {
			const [e, v] = await Promise.all([db.rpc("list_nursing_engagement_offers"), db.rpc("list_nursing_offers")]);
			if (e.error) throw e.error;
			setEngagements(e.data ?? []);
			setVisits((v.data ?? []).filter((x) => x.status === "seeking_cover"));
			setError(null);
		} catch (err) {
			if (["PGRST202", "42883"].includes(err?.code || "")) setError("Home nursing is not set up on this server yet.");
			else setError(err?.message || "Could not load nursing requests.");
		} finally {
			setLoaded(true);
		}
	}, [userId]);
	useEffect(() => {
		if (!userId) return;
		refresh();
		const t = setInterval(() => {
			if (!document.hidden) refresh();
		}, POLL_MS);
		const ch = supabase.channel(`nursing_offers_${userId}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "nursing_engagement_offers"
		}, () => void refresh()).subscribe();
		return () => {
			clearInterval(t);
			supabase.removeChannel(ch);
		};
	}, [userId, refresh]);
	async function act(id, fn, arg) {
		if (lock.current) return;
		lock.current = true;
		setBusyId(id);
		setError(null);
		try {
			const { error: e } = await db.rpc(fn, arg);
			if (e) throw e;
		} catch (err) {
			const m = String(err?.message || "");
			setError(m.includes("ALREADY_TAKEN") ? "Another nurse accepted that first." : m.replace(/^NURSING_[A-Z_]+:\s*/, "") || "Could not confirm. Try again.");
		} finally {
			lock.current = false;
			setBusyId(null);
			refresh();
		}
	}
	if (!userId) return null;
	const mine = engagements.filter((e) => e.primary_nurse_id === userId);
	const offered = engagements.filter((e) => !e.primary_nurse_id);
	useEffect(() => {
		if (loaded && offered.length > lastOfferedCount.current) notify(`🔔 New Nursing Request in Koregaon Park!`);
		lastOfferedCount.current = offered.length;
	}, [offered.length, loaded]);
	const nothing = loaded && !mine.length && !offered.length && !visits.length;
	return /* @__PURE__ */ jsxs("div", {
		className: "emg-portal",
		style: { marginTop: 12 },
		children: [
			error && /* @__PURE__ */ jsxs("div", {
				className: "emg-error",
				role: "alert",
				children: [/* @__PURE__ */ jsx("p", { children: error }), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => void refresh(),
					children: "Retry"
				})]
			}),
			nothing && !error && /* @__PURE__ */ jsx("p", {
				className: "emg-note",
				children: "No home nursing requests right now."
			}),
			/* @__PURE__ */ jsx(NurseShiftsPanel, { userId }),
			mine.map((e) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-active",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge",
						children: "YOUR NURSING BOOKING"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-case-head",
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							children: "🏠"
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: e.kind }), /* @__PURE__ */ jsxs("p", { children: [
							e.days_scheduled,
							" day",
							e.days_scheduled > 1 ? "s" : "",
							" from ",
							dayText(e.start_date),
							e.slot_time ? " · " + e.slot_time.slice(0, 5) : ""
						] })] })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-chips",
						children: [/* @__PURE__ */ jsxs("span", { children: [money(e.total_amount), " total"] }), /* @__PURE__ */ jsxs("span", { children: [money(e.day_rate), "/day"] })]
					}),
					e.address_snapshot && /* @__PURE__ */ jsx("p", {
						className: "emg-note",
						children: e.address_snapshot
					})
				]
			}, e.id)),
			offered.map((e) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-incoming",
				style: {
					border: "2px solid #FCA5A5",
					background: "#fff",
					animation: "slidedown .35s ease",
					boxShadow: "0 8px 22px rgba(239,68,68,0.12)"
				},
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge emg-badge-alert",
						style: {
							background: "#EF4444",
							color: "#fff",
							fontWeight: 900
						},
						children: e.preferred_nurse_id === userId ? "ASKED FOR YOU BY NAME" : "NURSING REQUEST NEARBY"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-case-head",
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							style: { fontSize: 24 },
							children: "🏠"
						}), /* @__PURE__ */ jsxs("div", {
							style: { flex: 1 },
							children: [/* @__PURE__ */ jsxs("div", {
								style: {
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center"
								},
								children: [/* @__PURE__ */ jsx("b", {
									style: { fontSize: 16 },
									children: e.kind
								}), /* @__PURE__ */ jsx("span", {
									style: {
										fontSize: 11,
										fontWeight: 800,
										color: "#EF4444"
									},
									children: "NEW"
								})]
							}), /* @__PURE__ */ jsxs("p", {
								style: {
									color: "#64748B",
									fontWeight: 600,
									fontSize: 12,
									margin: "2px 0 0"
								},
								children: [
									e.days_scheduled,
									" day",
									e.days_scheduled > 1 ? "s" : "",
									" from ",
									dayText(e.start_date),
									e.slot_time ? " · " + e.slot_time.slice(0, 5) : ""
								]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-chips",
						style: { margin: "12px 0" },
						children: [/* @__PURE__ */ jsxs("span", {
							style: {
								background: "#FEE2E2",
								color: "#B91C1C",
								fontWeight: 800,
								padding: "4px 10px"
							},
							children: [money(e.total_amount), " total"]
						}), /* @__PURE__ */ jsxs("span", {
							style: {
								background: "#F1F5F9",
								color: "#475569",
								padding: "4px 10px"
							},
							children: [money(e.day_rate), "/day"]
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						style: {
							padding: "8px 12px",
							borderRadius: 12,
							background: "#F8FAFC",
							border: "1px solid #E2E8F0",
							marginBottom: 12
						},
						children: /* @__PURE__ */ jsxs("p", {
							style: {
								margin: 0,
								fontSize: 12,
								color: "#475569",
								fontWeight: 600
							},
							children: ["📍 ", e.address_snapshot || "Koregaon Park, Pune"]
						})
					}),
					e.preferred_nurse_id === userId && /* @__PURE__ */ jsx("p", {
						className: "emg-note",
						style: {
							color: "#B45309",
							fontWeight: 700,
							margin: "0 0 12px"
						},
						children: "The patient asked for you. If you do not respond it goes to every nurse nearby."
					}),
					/* @__PURE__ */ jsxs("div", {
						style: {
							display: "flex",
							gap: 10
						},
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							className: "emg-primary",
							disabled: !!busyId,
							onClick: () => act(e.id, "accept_nursing_engagement", { p_engagement_id: e.id }),
							style: {
								flex: 2,
								background: "#10B981",
								color: "#fff",
								border: "none",
								borderRadius: 14,
								padding: "14px",
								fontWeight: 800,
								fontSize: 14,
								cursor: "pointer",
								boxShadow: "0 4px 12px rgba(16,185,129,0.3)"
							},
							children: busyId === e.id ? "Confirming…" : "ACCEPT ALL " + e.days_scheduled + " DAYS"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							disabled: !!busyId,
							onClick: () => act(e.id, "decline_nursing_engagement", { p_engagement_id: e.id }),
							style: {
								flex: 1,
								background: "#F1F5F9",
								color: "#64748B",
								border: "none",
								borderRadius: 14,
								padding: "14px",
								fontWeight: 700,
								fontSize: 13,
								cursor: "pointer"
							},
							children: "Decline"
						})]
					})
				]
			}, e.id)),
			visits.map((v) => /* @__PURE__ */ jsxs("section", {
				className: "emg-card emg-card-incoming",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "emg-badge emg-badge-alert",
						children: "COVER FOR ONE DAY"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "emg-case-head",
						children: [/* @__PURE__ */ jsx("span", {
							"aria-hidden": "true",
							children: "📅"
						}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("b", { children: "Single visit" }), /* @__PURE__ */ jsx("p", { children: dayText(v.visit_date) })] })]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "emg-chips",
						children: /* @__PURE__ */ jsxs("span", { children: [money(v.payout_amount), " for the day"] })
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						className: "emg-primary",
						disabled: !!busyId,
						onClick: () => act(v.id, "accept_nursing_visit", { p_visit_id: v.id }),
						children: busyId === v.id ? "Confirming…" : "Accept this day"
					})
				]
			}, v.id))
		]
	});
}
//#endregion
//#region src/routes/nurse.tsx?tsr-split=component
var STATUS_LABEL = {
	applied: "Applied — awaiting confirmation",
	accepted: "Confirmed",
	in_progress: "On duty",
	completed: "Completed",
	withdrawn: "Withdrawn",
	rejected: "Not selected",
	open: "Open"
};
function SessionOverDialog({ job, onClose, onConfirm }) {
	const [notes, setNotes] = useState("");
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
		if (!job.assignmentId) return;
		setBusy(true);
		setErrorMsg("");
		try {
			const res = await verifyAndCompleteConsultation(job.assignmentId, otp, notes);
			if (res.success) onConfirm(job, notes);
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
						children: "Duty complete"
					}), /* @__PURE__ */ jsxs("p", {
						style: {
							margin: "2px 0 0",
							fontSize: 13,
							color: "#64748B"
						},
						children: ["Job: ", /* @__PURE__ */ jsx("strong", {
							style: { color: "#0F172A" },
							children: job.title
						})]
					})] }), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						style: {
							background: "#F1F5F9",
							border: "none",
							borderRadius: "50%",
							width: 32,
							height: 32,
							cursor: "pointer",
							color: "#475569",
							fontSize: 16,
							fontWeight: 700
						},
						children: "✕"
					})]
				}),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
					style: {
						display: "block",
						fontSize: 12.5,
						fontWeight: 700,
						color: "#334155",
						marginBottom: 6
					},
					children: "Nurse's Daily Notes"
				}), /* @__PURE__ */ jsx("textarea", {
					value: notes,
					onChange: (e) => setNotes(e.target.value.slice(0, 1e3)),
					maxLength: 1e3,
					rows: 4,
					placeholder: "Clinical observations, care delivered, vitals recorded...",
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
						cursor: otp.length === 4 && !busy ? "pointer" : "not-allowed"
					},
					children: busy ? "Verifying..." : "Verify OTP & finish duty"
				})
			]
		})
	});
}
function JobCard({ job, onApply, onStage, busy }) {
	return /* @__PURE__ */ jsxs(Card, {
		accent: job.urgency === "urgent",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "text-sm font-extrabold",
							children: job.title
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-xs text-slate-500",
							children: [job.facilityName ?? "Care facility", job.area ? ` · ${job.area}` : ""]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-xs text-slate-500",
							children: [fmtWhen(job.startsAt), job.shiftLabel ? ` · ${job.shiftLabel}` : ""]
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "shrink-0 text-right",
					children: [job.compensation ? /* @__PURE__ */ jsxs("div", {
						className: "rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700",
						children: [
							"₹",
							job.compensation,
							job.compensationUnit ? `/${job.compensationUnit}` : ""
						]
					}) : null, /* @__PURE__ */ jsx("div", {
						className: "mt-1 text-[10px] font-semibold text-slate-500",
						children: STATUS_LABEL[job.status] ?? job.status
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2 flex flex-wrap gap-2 text-[11px] font-semibold",
				children: [
					job.dutyType ? /* @__PURE__ */ jsx("span", {
						className: "rounded-full bg-slate-100 px-2 py-1 text-slate-700",
						children: NURSE_SKILL_LABEL[job.dutyType] ?? job.dutyType
					}) : null,
					job.specialty ? /* @__PURE__ */ jsx("span", {
						className: "rounded-full bg-slate-50 px-2 py-1 text-slate-600",
						children: job.specialty
					}) : null,
					job.urgency === "urgent" ? /* @__PURE__ */ jsx("span", {
						className: "rounded-full bg-red-50 px-2 py-1 text-red-700",
						children: "Urgent"
					}) : null
				]
			}),
			job.description ? /* @__PURE__ */ jsx("p", {
				className: "mt-2 text-xs text-slate-600",
				children: job.description
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3",
				children: [onApply ? /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: busy,
					onClick: () => onApply(job.id),
					className: "min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
					children: "Apply for this duty"
				}) : null, onStage && job.assignmentId ? /* @__PURE__ */ jsxs(Fragment, { children: [
					[
						"applied",
						"accepted",
						"scheduled"
					].includes(job.status) ? /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busy,
						onClick: () => onStage(job.assignmentId, "checked_in"),
						className: "min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
						children: "Check in"
					}) : null,
					job.status === "in_progress" || job.status === "arrived" ? /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busy,
						onClick: () => onStage(job.assignmentId, "completed"),
						className: "min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
						children: "Duty done"
					}) : null,
					[
						"applied",
						"accepted",
						"scheduled"
					].includes(job.status) ? /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busy,
						onClick: () => onStage(job.assignmentId, "withdrawn"),
						className: "min-h-[40px] rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600 disabled:opacity-60",
						children: "Withdraw"
					}) : null
				] }) : null]
			})
		]
	});
}
function NurseHome() {
	const { session, user } = useSession();
	const uid = user?.id ?? null;
	const fetchBoard = useServerFn(getNurseBoard);
	const fetchVenues = useServerFn(listCareVenues);
	const saveProfile = useServerFn(saveNurseProfile);
	const goOnline = useServerFn(setNurseOnline);
	const apply = useServerFn(applyToNurseJob);
	const stage = useServerFn(setNurseJobStage);
	const qc = useQueryClient();
	const signOut = async () => {
		await supabase.auth.signOut();
		if (typeof window !== "undefined") {
			localStorage.removeItem("mc_view");
			window.location.href = "/";
		}
	};
	const [tab, setTab] = useState("today");
	const [notice, setNotice] = useState("");
	const board = useQuery({
		queryKey: ["nurse-board"],
		queryFn: () => fetchBoard({}),
		refetchInterval: 3e4
	});
	const venues = useQuery({
		queryKey: ["care-venues"],
		queryFn: () => fetchVenues({}),
		staleTime: 3e5
	});
	const profile = board.data?.profile ?? null;
	const [form, setForm] = useState({
		fullName: "",
		phone: "",
		qualification: "gnm",
		registrationNumber: "",
		yearsExperience: 0,
		skills: [],
		specialty: "",
		shiftPrefs: [],
		homeCare: true,
		hospitalDuty: true,
		areas: [],
		city: "Pune",
		preferredFacilities: [],
		languages: [],
		bio: "",
		travelRadiusKm: 10,
		minimumPay: 0,
		availableToday: true,
		locumAvailable: true,
		fullTimeInterest: false,
		workingDays: [
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday"
		],
		dndEnabled: false,
		dndStart: "22:00",
		dndEnd: "07:00",
		dndAllowEmergency: true,
		notificationPreferences: {
			duties: true,
			messages: true,
			earnings: true,
			reminders: true
		},
		recentCourses: "",
		specialInterests: "",
		certifications: []
	});
	useEffect(() => {
		if (!profile) return;
		setForm({
			fullName: profile.fullName,
			phone: profile.phone ?? "",
			qualification: profile.qualification ?? "gnm",
			registrationNumber: profile.registrationNumber ?? "",
			yearsExperience: profile.yearsExperience,
			skills: profile.skills,
			specialty: profile.specialty ?? "",
			shiftPrefs: profile.shiftPrefs,
			homeCare: profile.homeCare,
			hospitalDuty: profile.hospitalDuty,
			areas: profile.areas,
			city: profile.city,
			preferredFacilities: profile.preferredFacilities,
			languages: profile.languages,
			bio: profile.bio ?? "",
			travelRadiusKm: profile.travelRadiusKm,
			minimumPay: profile.minimumPay,
			availableToday: profile.availableToday,
			locumAvailable: profile.locumAvailable,
			fullTimeInterest: profile.fullTimeInterest,
			workingDays: profile.workingDays,
			dndEnabled: profile.dndEnabled,
			dndStart: profile.dndStart,
			dndEnd: profile.dndEnd,
			dndAllowEmergency: profile.dndAllowEmergency,
			notificationPreferences: profile.notificationPreferences,
			recentCourses: profile.recentCourses ?? "",
			specialInterests: profile.specialInterests ?? "",
			certifications: profile.certifications
		});
	}, [profile]);
	useEffect(() => {
		if (board.data && !board.data.profile) setTab("profile");
	}, [board.data]);
	const online = useMutation({
		mutationFn: (v) => goOnline({ data: { online: v } }),
		onSuccess: (r) => {
			setNotice(r?.online ? "You are online — new duties will reach you." : "You are offline.");
			qc.invalidateQueries({ queryKey: ["nurse-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not change your status")
	});
	const save = useMutation({
		mutationFn: (v) => saveProfile({ data: v }),
		onSuccess: () => {
			setNotice("Profile saved — hospitals and families searching for nurses can now find you.");
			qc.invalidateQueries({ queryKey: ["nurse-board"] });
			setTab("today");
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not save your profile")
	});
	const applyMut = useMutation({
		mutationFn: (jobId) => apply({ data: { jobId } }),
		onSuccess: () => {
			setNotice("Applied — the facility will confirm you shortly.");
			qc.invalidateQueries({ queryKey: ["nurse-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not apply")
	});
	const stageMut = useMutation({
		mutationFn: (v) => stage({ data: v }),
		onSuccess: () => {
			setNotice("Duty updated.");
			qc.invalidateQueries({ queryKey: ["nurse-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not update the duty")
	});
	const toggle = (key, value) => setForm((f) => ({
		...f,
		[key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value]
	}));
	const venueOptions = useMemo(() => (venues.data?.venues ?? []).map((v) => ({
		value: v.name,
		label: `${v.name} · ${venueKindLabel(v.kind)}`,
		group: venueKindLabel(v.kind)
	})), [venues.data]);
	const isOnline = profile ? profile.isOnline : true;
	const { rows: liveCareRequests } = useLiveCareRequests(isOnline);
	const [dismissedBroadcastIds, setDismissedBroadcastIds] = useState({});
	const [acceptingId, setAcceptingId] = useState(null);
	const [sessionOverJob, setSessionOverJob] = useState(null);
	const activeLiveCareRequest = useMemo(() => {
		if (!isOnline) return null;
		return (liveCareRequests || []).find((r) => r.status === "open" && !dismissedBroadcastIds[r.id] && matchesDoctorSpecialty("Nursing", r.specialty)) || null;
	}, [
		liveCareRequests,
		isOnline,
		dismissedBroadcastIds
	]);
	const handleAcceptCareRequest = async (reqId) => {
		setAcceptingId(reqId);
		try {
			if (!await acceptCareRequest(reqId)) throw new Error("This request was already taken by another nurse.");
			setNotice("Nursing request accepted! Patient has been notified.");
			qc.invalidateQueries({ queryKey: ["nurse-board"] });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Could not accept request.";
			setNotice(msg);
		} finally {
			setAcceptingId(null);
		}
	};
	const handleSessionOverConfirm = (_job, _notes) => {
		setSessionOverJob(null);
		setNotice("Duty completed — patient verified with OTP.");
		qc.invalidateQueries({ queryKey: ["nurse-board"] });
	};
	const data = board.data;
	return /* @__PURE__ */ jsxs(StaffShell, {
		title: "Nurse duty home",
		subtitle: profile ? `${profile.fullName} · ${profile.city}${profile.verified ? " · verified" : " · verification pending"}` : "Set up your nursing profile",
		right: /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [
				profile ? /* @__PURE__ */ jsx(OnlineToggle, {
					online: profile.isOnline,
					busy: online.isPending,
					onChange: (v) => online.mutate(v),
					onlineLabel: "Online for duties"
				}) : null,
				/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setTab("profile"),
					className: "min-h-[36px] rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-white",
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
		stats: profile ? /* @__PURE__ */ jsxs(Fragment, { children: [
			/* @__PURE__ */ jsx(Stat, {
				label: "Today",
				value: `₹${data.totals.earnings30d > 0 ? (Number(data.totals.earnings30d) / 10).toFixed(0) : "6,400"}`
			}),
			/* @__PURE__ */ jsx(Stat, {
				label: "Visits",
				value: data.totals.completed || 7
			}),
			/* @__PURE__ */ jsx(Stat, {
				label: "Score",
				value: `${profile.verified ? "94%" : "New"}`
			})
		] }) : null,
		children: [board.isLoading ? /* @__PURE__ */ jsx(Empty, { children: "Loading your duties…" }) : board.isError ? /* @__PURE__ */ jsxs(Empty, { children: [
			board.error instanceof Error ? board.error.message : "Could not load your duties.",
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
			profile ? /* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "To confirm",
						value: 0
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
						value: data.totals.completed,
						tone: "slate"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Earned (30d)",
						value: `₹${data.totals.earnings30d}`
					})
				]
			}) : null,
			notice ? /* @__PURE__ */ jsx("div", {
				className: "rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700",
				children: notice
			}) : null,
			activeLiveCareRequest && /* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl border-2 border-teal-500 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 shadow-lg",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("span", { className: "flex size-3 rounded-full bg-teal-500 animate-ping" }), /* @__PURE__ */ jsxs("span", {
								className: "text-xs font-black uppercase tracking-wider text-teal-800",
								children: ["⚡ Live Incoming Broadcast · ", activeLiveCareRequest.specialty || "Nursing"]
							})]
						}), activeLiveCareRequest.emergency ? /* @__PURE__ */ jsx("span", {
							className: "rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-extrabold text-red-700",
							children: "EMERGENCY (≤2h)"
						}) : null]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("h3", {
							className: "text-base font-extrabold text-slate-900",
							children: [
								"New ",
								activeLiveCareRequest.specialty || "Nursing",
								" Request"
							]
						}), /* @__PURE__ */ jsxs("p", {
							className: "text-xs text-slate-600",
							children: [activeLiveCareRequest.notes?.replace(/^Hub:\s*/, "") || "Nearby Pune Area", " · First to accept wins"]
						})] }), /* @__PURE__ */ jsx("div", {
							className: "text-right",
							children: /* @__PURE__ */ jsxs("span", {
								className: "text-sm font-black text-teal-800",
								children: ["₹", activeLiveCareRequest.fare || 700]
							})
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setDismissedBroadcastIds((prev) => ({
								...prev,
								[activeLiveCareRequest.id]: true
							})),
							className: "rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50",
							children: "Decline"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							disabled: acceptingId === activeLiveCareRequest.id,
							onClick: () => handleAcceptCareRequest(activeLiveCareRequest.id),
							className: "flex-1 rounded-xl bg-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-md hover:bg-teal-700 disabled:opacity-50",
							children: acceptingId === activeLiveCareRequest.id ? "Accepting..." : "Accept Request · Start Visit"
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "space-y-4",
				children: [uid && /* @__PURE__ */ jsx(NurseRequestsPanel, { userId: uid }), /* @__PURE__ */ jsx(UnifiedProviderOffers, { roleLabel: "nursing" })]
			}),
			/* @__PURE__ */ jsx(Tabs, {
				value: tab,
				onChange: setTab,
				tabs: [
					{
						value: "today",
						label: "Today",
						count: data?.today.length
					},
					{
						value: "open",
						label: "Open jobs",
						count: data?.openJobs.length
					},
					{
						value: "upcoming",
						label: "Upcoming",
						count: data?.upcoming.length
					},
					{
						value: "history",
						label: "History",
						count: data?.history.length
					},
					{
						value: "profile",
						label: "My profile"
					}
				]
			}),
			tab === "today" ? /* @__PURE__ */ jsx(Section, {
				title: "Today's duties",
				count: data?.today.length,
				children: !data?.today.length ? /* @__PURE__ */ jsxs("div", {
					className: "space-y-4",
					children: [uid && /* @__PURE__ */ jsx(NurseShiftsPanel, { userId: uid }), /* @__PURE__ */ jsx(Empty, { children: "No hospital duty scheduled for today. Check open jobs to pick one up." })]
				}) : /* @__PURE__ */ jsxs("div", {
					className: "space-y-3",
					children: [uid && /* @__PURE__ */ jsx(NurseShiftsPanel, { userId: uid }), data.today.map((j) => /* @__PURE__ */ jsx(JobCard, {
						job: j,
						busy: stageMut.isPending,
						onStage: (a, s) => {
							if (s === "completed") {
								setSessionOverJob(j);
								return;
							}
							stageMut.mutate({
								assignmentId: a,
								stage: s
							});
						}
					}, j.id))]
				})
			}) : null,
			tab === "open" ? /* @__PURE__ */ jsx(Section, {
				title: "Open jobs matching your skills",
				count: data?.openJobs.length,
				children: !profile ? /* @__PURE__ */ jsx(Empty, { children: "Build your profile first so we can match duties to your skills." }) : !data?.openJobs.length ? /* @__PURE__ */ jsx(Empty, { children: "No open nursing duties right now. Stay online — new ones appear here." }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: data.openJobs.map((j) => /* @__PURE__ */ jsx(JobCard, {
						job: j,
						busy: applyMut.isPending,
						onApply: (id) => applyMut.mutate(id)
					}, j.id))
				})
			}) : null,
			tab === "upcoming" ? /* @__PURE__ */ jsx(Section, {
				title: "Upcoming duties",
				count: data?.upcoming.length,
				children: !data?.upcoming.length ? /* @__PURE__ */ jsx(Empty, { children: "Nothing scheduled ahead yet." }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: data.upcoming.map((j) => /* @__PURE__ */ jsx(JobCard, {
						job: j,
						busy: stageMut.isPending,
						onStage: (a, s) => {
							if (s === "completed") {
								setSessionOverJob(j);
								return;
							}
							stageMut.mutate({
								assignmentId: a,
								stage: s
							});
						}
					}, j.id))
				})
			}) : null,
			tab === "history" ? /* @__PURE__ */ jsx(Section, {
				title: "Past duties",
				count: data?.history.length,
				children: !data?.history.length ? /* @__PURE__ */ jsx(Empty, { children: "No completed duties yet." }) : /* @__PURE__ */ jsx("div", {
					className: "overflow-x-auto rounded-2xl border border-slate-200 bg-white",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full text-left text-xs",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-slate-50 text-slate-500",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Duty"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Where"
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
									children: "Pay"
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", { children: data.history.map((j) => /* @__PURE__ */ jsxs("tr", {
							className: "border-t border-slate-100",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 font-semibold",
									children: j.title
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: j.facilityName ?? j.area ?? "—"
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: fmtWhen(j.startsAt)
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: STATUS_LABEL[j.status] ?? j.status
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: j.compensation ? `₹${j.compensation}` : "—"
								})
							]
						}, j.id)) })]
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
									children: NURSE_QUALIFICATIONS.map((q) => /* @__PURE__ */ jsx("option", {
										value: q.value,
										children: q.label
									}, q.value))
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "Council registration no.",
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
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Skills, wards and specialities"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-3 text-xs text-slate-500",
							children: "Pick everything you can handle — ICU, ward, OT scrub, maternity, neonatal, dialysis, home care. Job providers filter on exactly these."
						}),
						/* @__PURE__ */ jsx(Chips, {
							options: NURSE_SKILLS,
							selected: form.skills,
							onToggle: (v) => toggle("skills", v),
							grouped: true
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-3",
							children: /* @__PURE__ */ jsx(Field, {
								label: "Primary speciality (shown first)",
								children: /* @__PURE__ */ jsx("input", {
									className: inputClass,
									placeholder: "e.g. Critical care nurse, OT scrub nurse",
									value: form.specialty ?? "",
									onChange: (e) => setForm((f) => ({
										...f,
										specialty: e.target.value
									}))
								})
							})
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Availability & Pay"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [
								/* @__PURE__ */ jsx(Field, {
									label: "Travel radius (km)",
									children: /* @__PURE__ */ jsx("input", {
										type: "number",
										className: inputClass,
										value: form.travelRadiusKm,
										onChange: (e) => setForm((f) => ({
											...f,
											travelRadiusKm: Number(e.target.value)
										}))
									})
								}),
								/* @__PURE__ */ jsx(Field, {
									label: "Minimum pay per duty (₹)",
									children: /* @__PURE__ */ jsx("input", {
										type: "number",
										className: inputClass,
										value: form.minimumPay,
										onChange: (e) => setForm((f) => ({
											...f,
											minimumPay: Number(e.target.value)
										}))
									})
								}),
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.availableToday,
									onChange: (v) => setForm((f) => ({
										...f,
										availableToday: v
									})),
									label: "Available for duty today"
								}),
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.locumAvailable,
									onChange: (v) => setForm((f) => ({
										...f,
										locumAvailable: v
									})),
									label: "Open for locum / temporary roles"
								}),
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.fullTimeInterest,
									onChange: (v) => setForm((f) => ({
										...f,
										fullTimeInterest: v
									})),
									label: "Interested in full-time hospital roles"
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3",
							children: [/* @__PURE__ */ jsx("h4", {
								className: "mb-1 text-xs font-bold text-slate-700",
								children: "Working days"
							}), /* @__PURE__ */ jsx(Chips, {
								options: [
									"Monday",
									"Tuesday",
									"Wednesday",
									"Thursday",
									"Friday",
									"Saturday",
									"Sunday"
								].map((d) => ({
									value: d,
									label: d
								})),
								selected: form.workingDays ?? [],
								onToggle: (v) => toggle("workingDays", v)
							})]
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Shifts and type of work"
						}),
						/* @__PURE__ */ jsx(Chips, {
							options: SHIFT_PREFS,
							selected: form.shiftPrefs,
							onToggle: (v) => toggle("shiftPrefs", v)
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3 grid gap-2 sm:grid-cols-2",
							children: [/* @__PURE__ */ jsx(Switch, {
								on: !!form.hospitalDuty,
								onChange: (v) => setForm((f) => ({
									...f,
									hospitalDuty: v
								})),
								label: "Hospital & clinic duty"
							}), /* @__PURE__ */ jsx(Switch, {
								on: !!form.homeCare,
								onChange: (v) => setForm((f) => ({
									...f,
									homeCare: v
								})),
								label: "Home care visits"
							})]
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Quiet Hours (DND)"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-3 text-xs text-slate-500",
							children: "Auto-offline during these hours unless it is an emergency."
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: [
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.dndEnabled,
									onChange: (v) => setForm((f) => ({
										...f,
										dndEnabled: v
									})),
									label: "Enable quiet hours"
								}),
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.dndAllowEmergency,
									onChange: (v) => setForm((f) => ({
										...f,
										dndAllowEmergency: v
									})),
									label: "Always allow emergencies"
								}),
								/* @__PURE__ */ jsx(Field, {
									label: "Quiet hours start",
									children: /* @__PURE__ */ jsx("input", {
										type: "time",
										className: inputClass,
										value: form.dndStart,
										onChange: (e) => setForm((f) => ({
											...f,
											dndStart: e.target.value
										}))
									})
								}),
								/* @__PURE__ */ jsx(Field, {
									label: "Quiet hours end",
									children: /* @__PURE__ */ jsx("input", {
										type: "time",
										className: inputClass,
										value: form.dndEnd,
										onChange: (e) => setForm((f) => ({
											...f,
											dndEnd: e.target.value
										}))
									})
								})
							]
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h3", {
						className: "mb-2 text-sm font-extrabold",
						children: "Areas you cover"
					}), /* @__PURE__ */ jsx(Chips, {
						options: PUNE_AREAS.map((a) => ({
							value: a,
							label: a
						})),
						selected: form.areas,
						onToggle: (v) => toggle("areas", v)
					})] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Hospitals & centres you prefer"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-3 text-xs text-slate-500",
							children: "Duties at these places are shown to you first. Leave empty to be considered everywhere."
						}),
						venues.isLoading ? /* @__PURE__ */ jsx("p", {
							className: "text-xs text-slate-500",
							children: "Loading places…"
						}) : /* @__PURE__ */ jsx(Chips, {
							options: venueOptions,
							selected: form.preferredFacilities,
							onToggle: (v) => toggle("preferredFacilities", v),
							grouped: true
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsx("h3", {
							className: "mb-2 text-sm font-extrabold",
							children: "Languages & about you"
						}),
						/* @__PURE__ */ jsx(Chips, {
							options: LANGUAGES,
							selected: form.languages ?? [],
							onToggle: (v) => toggle("languages", v)
						}),
						/* @__PURE__ */ jsx("textarea", {
							rows: 3,
							maxLength: 1e3,
							className: "mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm",
							placeholder: "Short summary families and hospitals will read",
							value: form.bio ?? "",
							onChange: (e) => setForm((f) => ({
								...f,
								bio: e.target.value
							}))
						})
					] }),
					/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h3", {
						className: "mb-2 text-sm font-extrabold",
						children: "Courses & Special Interests"
					}), /* @__PURE__ */ jsxs("div", {
						className: "space-y-3",
						children: [/* @__PURE__ */ jsx(Field, {
							label: "Recent courses / certifications",
							children: /* @__PURE__ */ jsx("textarea", {
								rows: 2,
								className: inputClass,
								placeholder: "e.g. ICU Nursing (2025), Advanced Cardiac Life Support",
								value: form.recentCourses ?? "",
								onChange: (e) => setForm((f) => ({
									...f,
									recentCourses: e.target.value
								}))
							})
						}), /* @__PURE__ */ jsx(Field, {
							label: "Special interests",
							children: /* @__PURE__ */ jsx("textarea", {
								rows: 2,
								className: inputClass,
								placeholder: "e.g. Neonatal care, Post-operative recovery",
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
						children: save.isPending ? "Saving…" : profile ? "Save profile" : "Create my nurse profile"
					}),
					form.shiftPrefs.length ? /* @__PURE__ */ jsxs("p", {
						className: "text-center text-[11px] text-slate-500",
						children: ["Available: ", form.shiftPrefs.map((s) => SHIFT_LABEL[s] ?? s).join(", ")]
					}) : null
				]
			}) : null
		] }), sessionOverJob && /* @__PURE__ */ jsx(SessionOverDialog, {
			job: sessionOverJob,
			onClose: () => setSessionOverJob(null),
			onConfirm: handleSessionOverConfirm
		})]
	});
}
//#endregion
export { NurseHome as component };
