import { n as supabase } from "./client-BSmVQfT1.js";
import { r as createServerFn } from "./server-DyT3b58-.js";
import { B as useSession, C as matchesDoctorSpecialty, M as useLiveCareRequests, V as verifyAndCompleteConsultation, n as acceptCareRequest } from "./backend-eXdx240h.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { c as PUNE_AREAS, d as TECHNICIAN_QUALIFICATIONS, f as TECHNICIAN_TESTS, t as LANGUAGES } from "./care-staff-catalog-C1GuGVZe.js";
import { n as venueKindLabel, t as listCareVenues } from "./care-venues.functions-vV7C2ptZ.js";
import { a as OnlineToggle, c as Stat, d as fmtWhen, f as inputClass, i as Field, l as Switch, n as Chips, o as Section, r as Empty, s as StaffShell, t as Card, u as Tabs } from "./StaffUI-k1pvanXG.js";
import { t as UnifiedProviderOffers } from "./UnifiedProviderOffers-U5ao8Mat.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Activity, MapPin, Navigation, Radio, TestTube } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/lib/technician.functions.ts
/** Everything the technician home screen needs. */
var getTechnicianBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("8235ee35a4d51bc42475f4de7133bed011fb3d64f1f38db2e637eb1e40df9273"));
/** Technician builds their live profile: which tests they can run and where. */
var saveTechnicianProfile = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.fullName?.trim()) throw new Error("Your name is required");
	if (!Array.isArray(d.testTypes) || d.testTypes.length === 0) throw new Error("Pick at least one test you can run");
	if (d.bio && d.bio.length > 1e3) throw new Error("Keep the summary under 1000 characters");
	return d;
}).handler(createSsrRpc("d8c90a3ed9995e910f58a0fef874c31bd303790049fd968032270bc4dffff86b"));
/** Technician goes online or offline for new test requests. */
var setTechnicianOnline = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ online: !!d?.online })).handler(createSsrRpc("858236782376fd6e025790111c74aeb98e064e23dcdd04bb9bec552ba0598776"));
/** Technician takes an unassigned test request. */
var claimTechnicianTest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.testId) throw new Error("testId is required");
	return d;
}).handler(createSsrRpc("3e0adfcfa99dbbaeed1af3cabea5497613f909247f063ae1573c9251602a353b"));
/** Technician moves a test through accepted → on the way → running → done. */
var setTechnicianTestStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => {
	if (!d?.testId) throw new Error("testId is required");
	if (![
		"accepted",
		"en_route",
		"in_progress",
		"completed",
		"cancelled",
		"no_show"
	].includes(d.stage)) throw new Error("Unknown stage");
	if (d.note && d.note.length > 2e3) throw new Error("Keep findings under 2000 characters");
	return d;
}).handler(createSsrRpc("38c794b9772babb6fe869746ece222b657333a48ef4b40884f1b91ec9bde3413"));
//#endregion
//#region src/lib/technician-provider.functions.ts
var getTechnicianOffers = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("dc2488ffae7e1f0c66a77940813ee7f728a13ab17e219bf59e5d8ffbc5c2cf2e"));
var acceptTechnicianVisit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => input).handler(createSsrRpc("873af770fcb41d86fa63f76f6daa3796bdf74cde2e7c5fdc47d91237d86d4240"));
var advanceTechnicianStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => input).handler(createSsrRpc("19199a66eff4be13d10e8a0d50fa4e999f8d8133f3edca281c65987af7ac4f6c"));
//#endregion
//#region src/features/mydox/technician/TechnicianRequestsPanel.tsx
var POLL_MS = 1e4;
function money(n) {
	return "₹" + Number(n ?? 0).toLocaleString("en-IN");
}
function StatusChip({ status }) {
	const meta = {
		requested: {
			bg: "#FEF3C7",
			fg: "#92400E"
		},
		assigned: {
			bg: "#DBEAFE",
			fg: "#1E40AF"
		},
		en_route: {
			bg: "#E0F2FE",
			fg: "#0369A1"
		},
		arrived: {
			bg: "#D1FAE5",
			fg: "#065F46"
		},
		completed: {
			bg: "#E5E7EB",
			fg: "#374151"
		},
		cancelled: {
			bg: "#FEE2E2",
			fg: "#991B1B"
		}
	};
	const s = meta[status] || meta.requested;
	return /* @__PURE__ */ jsx("span", {
		style: {
			background: s.bg,
			color: s.fg,
			padding: "2px 8px",
			borderRadius: 99,
			fontSize: 10,
			fontWeight: 700,
			textTransform: "uppercase"
		},
		children: status.replace("_", " ")
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
function TechnicianRequestsPanel({ userId }) {
	const fetchOffers = useServerFn(getTechnicianOffers);
	const accept = useServerFn(acceptTechnicianVisit);
	const advance = useServerFn(advanceTechnicianStatus);
	const qc = useQueryClient();
	const lastOffersCount = useRef(0);
	const query = useQuery({
		queryKey: ["technician-offers"],
		queryFn: () => fetchOffers({}),
		refetchInterval: POLL_MS,
		enabled: !!userId
	});
	const acceptMutation = useMutation({
		mutationFn: (visitId) => accept({ data: { visitId } }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["technician-offers"] });
		}
	});
	const statusMutation = useMutation({
		mutationFn: (vars) => advance({ data: vars }),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["technician-offers"] });
		}
	});
	useEffect(() => {
		if (!userId) return;
		const channel = supabase.channel("technician_tests_live").on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "technician_tests"
		}, () => {
			qc.invalidateQueries({ queryKey: ["technician-offers"] });
		}).subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, qc]);
	if (!userId) return null;
	const data = query.data ?? [];
	const mine = data.filter((v) => v.technician_id === userId && v.status !== "completed" && v.status !== "cancelled");
	const offers = data.filter((v) => v.status === "requested");
	useEffect(() => {
		if (query.isSuccess && offers.length > lastOffersCount.current) notify(`🧪 New Lab/Technician Request in Koregaon Park!`);
		lastOffersCount.current = offers.length;
	}, [offers.length, query.isSuccess]);
	if (query.isLoading) return /* @__PURE__ */ jsx("div", {
		className: "p-4 text-center text-xs text-slate-500",
		children: "Loading technician work…"
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [mine.length > 0 && /* @__PURE__ */ jsxs("section", {
			className: "space-y-2",
			children: [/* @__PURE__ */ jsx("h3", {
				className: "text-xs font-bold uppercase tracking-wider text-slate-500",
				children: "Your Active Jobs"
			}), mine.map((v) => /* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl border border-blue-200 bg-blue-50 p-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start justify-between",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
						className: "text-sm font-extrabold text-slate-900",
						children: [v.test_type.toUpperCase(), " Visit"]
					}), /* @__PURE__ */ jsxs("div", {
						className: "text-xs text-slate-600",
						children: [
							v.patient_name,
							" · ",
							v.area
						]
					})] }), /* @__PURE__ */ jsx(StatusChip, { status: v.status })]
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-3 flex gap-2",
					children: [
						v.status === "assigned" && /* @__PURE__ */ jsx("button", {
							onClick: () => statusMutation.mutate({
								visitId: v.id,
								status: "en_route"
							}),
							className: "flex-1 rounded-full bg-blue-600 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95",
							children: "I'm on my way"
						}),
						v.status === "en_route" && /* @__PURE__ */ jsx("button", {
							onClick: () => statusMutation.mutate({
								visitId: v.id,
								status: "arrived"
							}),
							className: "flex-1 rounded-full bg-teal-600 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95",
							children: "Confirm Arrival"
						}),
						v.status === "arrived" && /* @__PURE__ */ jsx("button", {
							onClick: () => statusMutation.mutate({
								visitId: v.id,
								status: "completed"
							}),
							className: "flex-1 rounded-full bg-slate-900 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95",
							children: "Finish Visit"
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lng}`),
							className: "rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700",
							children: /* @__PURE__ */ jsx(Navigation, { size: 14 })
						})
					]
				})]
			}, v.id))]
		}), /* @__PURE__ */ jsxs("section", {
			className: "space-y-2",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "text-xs font-bold uppercase tracking-wider text-slate-500",
					children: "Available Near You"
				}), offers.length > 0 && /* @__PURE__ */ jsx("span", {
					className: "flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white",
					children: offers.length
				})]
			}), offers.length === 0 ? /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center",
				children: [/* @__PURE__ */ jsx(Radio, {
					size: 24,
					className: "mb-2 text-slate-300"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs font-medium text-slate-400",
					children: "Waiting for real-time requests in Pune..."
				})]
			}) : /* @__PURE__ */ jsx("div", {
				className: "space-y-2",
				children: offers.map((v) => /* @__PURE__ */ jsxs("div", {
					className: "rounded-2xl border border-red-200 bg-white p-4 shadow-sm",
					style: {
						animation: "slidedown .35s ease",
						boxShadow: "0 8px 22px rgba(239,68,68,0.08)"
					},
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3",
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 shadow-sm",
								children: v.test_type.includes("lab") ? /* @__PURE__ */ jsx(TestTube, { size: 20 }) : /* @__PURE__ */ jsx(Activity, { size: 20 })
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex-1 min-width-0",
								children: [/* @__PURE__ */ jsxs("div", {
									style: {
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center"
									},
									children: [/* @__PURE__ */ jsx("div", {
										className: "text-sm font-black text-slate-900",
										children: v.test_type.toUpperCase()
									}), /* @__PURE__ */ jsx("span", {
										style: {
											fontSize: 10,
											fontWeight: 800,
											color: "#EF4444"
										},
										children: "NEW"
									})]
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-[11px] text-slate-600 flex items-center gap-1 font-semibold",
									children: [
										/* @__PURE__ */ jsx(MapPin, { size: 10 }),
										" ",
										v.area,
										" · ",
										v.city
									]
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "text-right",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-sm font-black text-slate-900",
									children: money(v.fee)
								}), /* @__PURE__ */ jsx("div", {
									className: "text-[10px] font-bold text-red-600 uppercase tracking-tighter",
									children: v.urgency
								})]
							})
						]
					}), /* @__PURE__ */ jsx("div", {
						style: {
							display: "flex",
							gap: 10,
							marginTop: 12
						},
						children: /* @__PURE__ */ jsx("button", {
							onClick: () => acceptMutation.mutate(v.id),
							disabled: acceptMutation.isPending,
							className: "flex-1 rounded-xl bg-slate-900 py-3 text-xs font-black text-white shadow-lg transition active:scale-95 disabled:opacity-50",
							children: acceptMutation.isPending ? "Accepting..." : "ACCEPT JOB"
						})
					})]
				}, v.id))
			})]
		})]
	});
}
//#endregion
//#region src/routes/technician.tsx?tsr-split=component
function SessionOverDialog({ job, onClose, onConfirm }) {
	const [notes, setNotes] = useState(job.findings ?? "");
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
			const res = await verifyAndCompleteConsultation(job.id, otp, notes);
			if (res.success) onConfirm(job, notes);
			else setErrorMsg(res.error || "Incorrect OTP. Ask the patient to read the code shown in their app.");
		} catch (e) {
			setErrorMsg(e instanceof Error ? e.message : "Failed to verify test OTP.");
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
			"aria-label": "Test complete",
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
						children: "Test complete"
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
								children: job.patientName
							}),
							" · ",
							job.testLabel
						]
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
					children: "Technician findings / Notes"
				}), /* @__PURE__ */ jsx("textarea", {
					value: notes,
					onChange: (e) => setNotes(e.target.value.slice(0, 2e3)),
					maxLength: 2e3,
					rows: 4,
					placeholder: "Preliminary findings, observations during test...",
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
					children: busy ? "Verifying..." : "Verify OTP & complete test"
				})
			]
		})
	});
}
function VenueTag({ job }) {
	const label = job.venueKind === "home" ? "Home visit" : job.venueKind === "hub" ? "At tie-up hub" : "Clinic / hospital";
	return /* @__PURE__ */ jsx("span", {
		className: "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700",
		children: label
	});
}
function TestCard({ job, onClaim, onStage, busy, note, onNote }) {
	return /* @__PURE__ */ jsxs(Card, {
		accent: !!onClaim || job.urgency === "urgent",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "text-sm font-extrabold",
							children: [
								job.patientName,
								" · ",
								job.testLabel
							]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-500",
							children: fmtWhen(job.scheduledAt)
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "text-xs text-slate-500",
							children: [job.area, job.city ? `, ${job.city}` : ""]
						}),
						job.referringDoctor ? /* @__PURE__ */ jsxs("div", {
							className: "text-xs text-slate-500",
							children: ["Referred by ", job.referringDoctor]
						}) : null
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "shrink-0 text-right",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700",
						children: ["₹", job.fee ?? 0]
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-1 text-[10px] font-semibold text-slate-500",
						children: STATUS_LABEL[job.status] ?? job.status
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2 flex flex-wrap gap-2 text-[11px] font-semibold",
				children: [
					/* @__PURE__ */ jsx(VenueTag, { job }),
					job.urgency === "urgent" ? /* @__PURE__ */ jsx("span", {
						className: "rounded-full bg-red-50 px-2 py-1 text-red-700",
						children: "Urgent"
					}) : null,
					/* @__PURE__ */ jsx("span", {
						className: "rounded-full bg-slate-50 px-2 py-1 text-slate-600",
						children: job.paymentStatus === "paid" ? "Paid" : "Payment pending"
					})
				]
			}),
			job.machinePickupNeeded ? /* @__PURE__ */ jsxs("p", {
				className: "mt-2 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800",
				children: [
					"Carry the machine from ",
					job.pickupHub ?? "your tie-up hub",
					" — this venue has no equipment on site."
				]
			}) : job.venueKind === "hub" ? /* @__PURE__ */ jsx("p", {
				className: "mt-2 rounded-xl bg-teal-50 px-3 py-2 text-[11px] font-semibold text-teal-800",
				children: "Machine is already at the hub — no pickup needed."
			}) : null,
			job.notes ? /* @__PURE__ */ jsxs("p", {
				className: "mt-2 text-xs text-slate-600",
				children: ["Note: ", job.notes]
			}) : null,
			onStage && job.status === "in_progress" ? /* @__PURE__ */ jsx("textarea", {
				rows: 2,
				maxLength: 2e3,
				value: note ?? "",
				onChange: (e) => onNote?.(e.target.value),
				placeholder: "Findings / observations for the report (optional)",
				className: "mt-3 w-full rounded-xl border border-slate-200 p-2 text-xs"
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3",
				children: [onClaim ? /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: busy,
					onClick: () => onClaim(job.id),
					className: "min-h-[40px] rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
					children: "Take this test"
				}) : null, onStage ? (NEXT[job.status] ?? []).map((a) => /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: busy,
					onClick: () => onStage(job.id, a.stage),
					className: `min-h-[40px] rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-60 ${a.soft ? "bg-slate-100 text-slate-600" : "bg-teal-600 text-white"}`,
					children: a.label
				}, a.stage)) : null]
			})
		]
	});
}
function TechnicianHome() {
	const { session, user } = useSession();
	const uid = user?.id ?? null;
	const fetchBoard = useServerFn(getTechnicianBoard);
	const fetchVenues = useServerFn(listCareVenues);
	const saveProfile = useServerFn(saveTechnicianProfile);
	const goOnline = useServerFn(setTechnicianOnline);
	const claim = useServerFn(claimTechnicianTest);
	const stage = useServerFn(setTechnicianTestStage);
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
	const [notes, setNotes] = useState({});
	const board = useQuery({
		queryKey: ["technician-board"],
		queryFn: () => fetchBoard({}),
		refetchInterval: 3e4
	});
	const venues = useQuery({
		queryKey: ["care-venues"],
		queryFn: () => fetchVenues({}),
		staleTime: 3e5
	});
	const profile = board.data?.profile ?? null;
	const hubs = board.data?.hubs ?? [];
	const [form, setForm] = useState({
		fullName: "",
		phone: "",
		testTypes: [],
		org: "",
		qualification: "dmlt",
		yearsExperience: 0,
		areas: [],
		city: "Pune",
		homeVisits: true,
		clinicVisits: true,
		carriesMachine: true,
		preferredHubs: [],
		preferredFacilities: [],
		bio: "",
		travelRadiusKm: 10,
		preferredDutyHours: 8,
		maxHoursPerDay: 12,
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
		certifications: [],
		languages: []
	});
	useEffect(() => {
		if (!profile) return;
		setForm({
			fullName: profile.fullName,
			phone: profile.phone ?? "",
			testTypes: profile.testTypes,
			org: profile.org ?? "",
			qualification: profile.qualification ?? "dmlt",
			yearsExperience: profile.yearsExperience ?? 0,
			areas: profile.areas,
			city: profile.city,
			homeVisits: profile.homeVisits,
			clinicVisits: profile.clinicVisits,
			carriesMachine: profile.carriesMachine,
			preferredHubs: profile.preferredHubs,
			preferredFacilities: profile.preferredFacilities,
			bio: profile.bio ?? "",
			travelRadiusKm: profile.travelRadiusKm,
			preferredDutyHours: profile.preferredDutyHours,
			maxHoursPerDay: profile.maxHoursPerDay,
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
			certifications: profile.certifications,
			languages: profile.languages ?? []
		});
	}, [profile]);
	useEffect(() => {
		if (board.data && !board.data.profile) setTab("profile");
	}, [board.data]);
	const online = useMutation({
		mutationFn: (v) => goOnline({ data: { online: v } }),
		onSuccess: (r) => {
			setNotice(r?.online ? "You are online — new test requests will reach you." : "You are offline.");
			qc.invalidateQueries({ queryKey: ["technician-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not change your status")
	});
	const save = useMutation({
		mutationFn: (v) => saveProfile({ data: v }),
		onSuccess: () => {
			setNotice("Profile saved — your test list is live in the app.");
			qc.invalidateQueries({ queryKey: ["technician-board"] });
			setTab("today");
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not save your profile")
	});
	const claimMut = useMutation({
		mutationFn: (testId) => claim({ data: { testId } }),
		onSuccess: () => {
			setNotice("Test taken — accept it to confirm with the patient.");
			qc.invalidateQueries({ queryKey: ["technician-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not take this test")
	});
	const stageMut = useMutation({
		mutationFn: (v) => stage({ data: v }),
		onSuccess: () => {
			setNotice("Test updated — the patient has been notified.");
			qc.invalidateQueries({ queryKey: ["technician-board"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not update the test")
	});
	const toggle = (key, value) => setForm((f) => ({
		...f,
		[key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value]
	}));
	const hubOptions = useMemo(() => hubs.map((h) => ({
		value: h.name,
		label: h.area ? `${h.name} · ${h.area}` : h.name
	})), [hubs]);
	const venueOptions = useMemo(() => (venues.data?.venues ?? []).filter((v) => !v.isHub).map((v) => ({
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
		return (liveCareRequests || []).find((r) => r.status === "open" && !dismissedBroadcastIds[r.id] && matchesDoctorSpecialty("Diagnostic", r.specialty)) || null;
	}, [
		liveCareRequests,
		isOnline,
		dismissedBroadcastIds
	]);
	const handleAcceptCareRequest = async (reqId) => {
		setAcceptingId(reqId);
		try {
			const cr = await acceptCareRequest(reqId);
			if (cr && matchesDoctorSpecialty("Diagnostic", cr.specialty)) {
				const { data: pData } = await supabase.from("profiles").select("full_name").eq("id", cr.patient_id).maybeSingle();
				const { error: insertError } = await sb.from("technician_tests").insert({
					patient_id: cr.patient_id,
					patient_name: pData?.full_name || "Emergency Patient",
					technician_id: profile?.id,
					test_type: cr.specialty.toLowerCase(),
					test_label: cr.specialty,
					area: cr.notes?.replace(/^Hub:\s*/, "") || "Emergency Location",
					city: "Pune",
					scheduled_at: (/* @__PURE__ */ new Date()).toISOString(),
					status: "accepted",
					urgency: "urgent",
					fee: cr.fare || 700
				});
				if (insertError) throw new Error(`Accepted, but the test could not be created: ${insertError.message}`);
			}
			setNotice("Technician request accepted! Patient has been notified.");
			qc.invalidateQueries({ queryKey: ["technician-board"] });
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Could not accept request.";
			setNotice(msg);
		} finally {
			setAcceptingId(null);
		}
	};
	const handleSessionOverConfirm = (_job, _notes) => {
		setSessionOverJob(null);
		setNotice("Test completed — patient verified with OTP.");
		qc.invalidateQueries({ queryKey: ["technician-board"] });
	};
	const data = board.data;
	const missing = [];
	if (!profile?.testTypes?.length) missing.push("the tests you perform");
	return /* @__PURE__ */ jsxs(StaffShell, {
		title: "Technician test home",
		subtitle: profile ? `${profile.fullName} · ${profile.testTypes.length} tests · ${profile.city}` : "Set up which tests you can run",
		right: /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-center gap-2",
			children: [
				profile ? /* @__PURE__ */ jsx(OnlineToggle, {
					online: profile.isOnline,
					busy: online.isPending,
					onChange: (v) => online.mutate(v),
					onlineLabel: "Taking test visits"
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
				value: `₹${data.totals.earnings30d > 0 ? (Number(data.totals.earnings30d) / 8).toFixed(0) : "4,200"}`
			}),
			/* @__PURE__ */ jsx(Stat, {
				label: "Visits",
				value: data.totals.completed30d || 5
			}),
			/* @__PURE__ */ jsx(Stat, {
				label: "Score",
				value: "96%"
			})
		] }) : null,
		children: [board.isLoading ? /* @__PURE__ */ jsx(Empty, { children: "Loading your tests…" }) : board.isError ? /* @__PURE__ */ jsxs(Empty, { children: [
			board.error instanceof Error ? board.error.message : "Could not load your tests.",
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
			activeLiveCareRequest && /* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl border-2 border-teal-500 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 shadow-lg",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("span", { className: "flex size-3 rounded-full bg-teal-500 animate-ping" }), /* @__PURE__ */ jsxs("span", {
								className: "text-xs font-black uppercase tracking-wider text-teal-800",
								children: ["⚡ Live Incoming Broadcast · ", activeLiveCareRequest.specialty || "Diagnostic"]
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
								activeLiveCareRequest.specialty || "Diagnostic",
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
				children: [uid && /* @__PURE__ */ jsx(TechnicianRequestsPanel, { userId: uid }), /* @__PURE__ */ jsx(UnifiedProviderOffers, { roleLabel: "test" })]
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
						label: "New requests",
						count: data?.openTests.length
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
				title: "Today's test visits",
				count: data?.today.length,
				children: !data?.today.length ? /* @__PURE__ */ jsxs("div", {
					className: "space-y-4",
					children: [uid && /* @__PURE__ */ jsx(TechnicianRequestsPanel, { userId: uid }), /* @__PURE__ */ jsx(Empty, { children: "No tests booked for today." })]
				}) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: data.today.map((j) => /* @__PURE__ */ jsx(TestCard, {
						job: j,
						busy: stageMut.isPending,
						note: notes[j.id],
						onNote: (v) => setNotes((n) => ({
							...n,
							[j.id]: v
						})),
						onStage: (id, s) => {
							if (s === "completed") {
								setSessionOverJob(j);
								return;
							}
							stageMut.mutate({
								testId: id,
								stage: s,
								note: notes[id] ?? null
							});
						}
					}, j.id))
				})
			}) : null,
			tab === "open" ? /* @__PURE__ */ jsx(Section, {
				title: "New requests near you",
				count: data?.openTests.length,
				children: !profile ? /* @__PURE__ */ jsx(Empty, { children: "Add the tests you can run first — matching requests then appear here." }) : !data?.openTests.length ? /* @__PURE__ */ jsx(Empty, { children: "No open requests for your tests right now." }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: data.openTests.map((j) => /* @__PURE__ */ jsx(TestCard, {
						job: j,
						busy: claimMut.isPending,
						onClaim: (id) => claimMut.mutate(id)
					}, j.id))
				})
			}) : null,
			tab === "upcoming" ? /* @__PURE__ */ jsx(Section, {
				title: "Upcoming test visits",
				count: data?.upcoming.length,
				children: !data?.upcoming.length ? /* @__PURE__ */ jsx(Empty, { children: "Nothing scheduled ahead yet." }) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: data.upcoming.map((j) => /* @__PURE__ */ jsx(TestCard, {
						job: j,
						busy: stageMut.isPending,
						note: notes[j.id],
						onNote: (v) => setNotes((n) => ({
							...n,
							[j.id]: v
						})),
						onStage: (id, s) => {
							if (s === "completed") {
								setSessionOverJob(j);
								return;
							}
							stageMut.mutate({
								testId: id,
								stage: s,
								note: notes[id] ?? null
							});
						}
					}, j.id))
				})
			}) : null,
			tab === "history" ? /* @__PURE__ */ jsx(Section, {
				title: "Recent history",
				count: data?.history.length,
				children: !data?.history.length ? /* @__PURE__ */ jsx(Empty, { children: "No finished tests yet." }) : /* @__PURE__ */ jsx("div", {
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
									children: "Test"
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
									children: "Fee"
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", { children: data.history.map((j) => /* @__PURE__ */ jsxs("tr", {
							className: "border-t border-slate-100",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 font-semibold",
									children: j.patientName
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: j.testLabel
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: j.homeVisit ? "Home" : j.area || "Clinic"
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: fmtWhen(j.scheduledAt)
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: STATUS_LABEL[j.status] ?? j.status
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "px-3 py-2",
									children: ["₹", j.fee ?? 0]
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
									children: TECHNICIAN_QUALIFICATIONS.map((q) => /* @__PURE__ */ jsx("option", {
										value: q.value,
										children: q.label
									}, q.value))
								})
							}),
							/* @__PURE__ */ jsx(Field, {
								label: "Organisation / lab (optional)",
								children: /* @__PURE__ */ jsx("input", {
									className: inputClass,
									value: form.org ?? "",
									onChange: (e) => setForm((f) => ({
										...f,
										org: e.target.value
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
							children: "Tests you can run"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-3 text-xs text-slate-500",
							children: "Only these tests are offered to you. Patients and doctors searching for a test see your profile once you are online."
						}),
						/* @__PURE__ */ jsx(Chips, {
							options: TECHNICIAN_TESTS,
							selected: form.testTypes,
							onToggle: (v) => toggle("testTypes", v),
							grouped: true
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
									label: "Minimum pay per visit (₹)",
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
									label: "Available for test visits today"
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
									label: "Interested in full-time lab roles"
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
							children: "Where you work"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-2 sm:grid-cols-2",
							children: [
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.homeVisits,
									onChange: (v) => setForm((f) => ({
										...f,
										homeVisits: v
									})),
									label: "Home visits"
								}),
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.clinicVisits,
									onChange: (v) => setForm((f) => ({
										...f,
										clinicVisits: v
									})),
									label: "Clinics & hospitals"
								}),
								/* @__PURE__ */ jsx(Switch, {
									on: !!form.carriesMachine,
									onChange: (v) => setForm((f) => ({
										...f,
										carriesMachine: v
									})),
									label: "I can carry machines from a hub"
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3",
							children: [/* @__PURE__ */ jsx("h4", {
								className: "mb-1 text-xs font-bold text-slate-700",
								children: "Tie-up hubs you collect machines from"
							}), hubOptions.length ? /* @__PURE__ */ jsx(Chips, {
								options: hubOptions,
								selected: form.preferredHubs,
								onToggle: (v) => toggle("preferredHubs", v)
							}) : /* @__PURE__ */ jsx("p", {
								className: "text-xs text-slate-500",
								children: "No hubs listed yet — the care team will add them."
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3",
							children: [/* @__PURE__ */ jsx("h4", {
								className: "mb-1 text-xs font-bold text-slate-700",
								children: "Clinics & hospitals you prefer"
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
							placeholder: "Short summary about your experience (optional)",
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
								placeholder: "e.g. Advanced ECG Interpretation, DMLT Specialization",
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
								placeholder: "e.g. Portable X-ray, Home sample collection",
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
						children: save.isPending ? "Saving…" : profile ? "Save profile" : "Create my technician profile"
					})
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
export { TechnicianHome as component };
