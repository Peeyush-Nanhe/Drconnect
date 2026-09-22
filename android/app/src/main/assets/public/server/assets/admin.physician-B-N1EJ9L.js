import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/lib/physician-portal.functions.ts
var getPhysicianPortal = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("321f0154e2b5df9f066bdee631238ec92b96cd85edaa1606828e51c95f50430b"));
var logDutyHours = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.assignmentId) throw new Error("assignmentId is required");
	if (input.action !== "check_in" && input.action !== "check_out") throw new Error("Invalid action");
	return input;
}).handler(createSsrRpc("acb244019fdd9c83f7d23857f133fc48eeecdab70e7c716bd842b1add5be6df2"));
var submitDutyFeedback = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.assignmentId) throw new Error("assignmentId is required");
	if (!(input.rating >= 1 && input.rating <= 5)) throw new Error("Rating must be 1-5");
	return input;
}).handler(createSsrRpc("6097cee794333289a93174d530ea7afaff8f37d660780f574992b78466c728c9"));
//#endregion
//#region src/routes/admin.physician.tsx?tsr-split=component
var STATE_META = {
	applied: {
		label: "Applied",
		color: "#7C3AED"
	},
	scheduled: {
		label: "Scheduled",
		color: "#64748B"
	},
	en_route: {
		label: "Starting soon",
		color: "#0284C7"
	},
	on_duty: {
		label: "On duty",
		color: "#059669"
	},
	overdue: {
		label: "Not reported",
		color: "#DC2626"
	},
	completed: {
		label: "Completed",
		color: "#15803D"
	},
	absent: {
		label: "Absent",
		color: "#B91C1C"
	},
	cancelled: {
		label: "Cancelled",
		color: "#94A3B8"
	}
};
function Card({ children, className = "" }) {
	return /* @__PURE__ */ jsx("div", {
		className: `rounded-2xl border border-slate-200 bg-white p-4 ${className}`,
		children
	});
}
function Stat({ label, value, color, sub }) {
	return /* @__PURE__ */ jsxs(Card, { children: [
		/* @__PURE__ */ jsx("div", {
			className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
			children: label
		}),
		/* @__PURE__ */ jsx("div", {
			className: "mt-1 text-2xl font-extrabold",
			style: { color: color ?? "#0f172a" },
			children: value
		}),
		sub ? /* @__PURE__ */ jsx("div", {
			className: "mt-0.5 text-[11px] text-slate-500",
			children: sub
		}) : null
	] });
}
function fmt(dt) {
	if (!dt) return "—";
	return new Date(dt).toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function PhysicianPortal() {
	const fetchPortal = useServerFn(getPhysicianPortal);
	const logHours = useServerFn(logDutyHours);
	const sendFeedback = useServerFn(submitDutyFeedback);
	const qc = useQueryClient();
	const [feedbackFor, setFeedbackFor] = useState(null);
	const [form, setForm] = useState({
		rating: 5,
		facilitySupport: 4,
		workload: 3,
		wouldWorkAgain: true,
		comment: ""
	});
	const [notice, setNotice] = useState("");
	const query = useQuery({
		queryKey: ["physician-portal"],
		queryFn: () => fetchPortal({}),
		refetchInterval: 6e4
	});
	const hoursMutation = useMutation({
		mutationFn: (vars) => logHours({ data: vars }),
		onSuccess: (_d, vars) => {
			setNotice(vars.action === "check_in" ? "Checked in — duty hours started." : "Checked out — duty hours logged.");
			qc.invalidateQueries({ queryKey: ["physician-portal"] });
		},
		onError: (e) => setNotice(e.message)
	});
	const feedbackMutation = useMutation({
		mutationFn: (vars) => sendFeedback({ data: {
			assignmentId: vars.assignmentId,
			rating: form.rating,
			facilitySupport: form.facilitySupport,
			workload: form.workload,
			wouldWorkAgain: form.wouldWorkAgain,
			comment: form.comment
		} }),
		onSuccess: () => {
			setNotice("Feedback submitted. Thank you.");
			setFeedbackFor(null);
			qc.invalidateQueries({ queryKey: ["physician-portal"] });
		},
		onError: (e) => setNotice(e.message)
	});
	const data = query.data;
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen px-4 py-8",
		style: {
			background: "#DCE6E1",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: [/* @__PURE__ */ jsx("link", {
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
		}), /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-5xl",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-5 flex flex-wrap items-start justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(Link, {
							to: "/admin",
							className: "text-xs font-semibold text-teal-700 hover:underline",
							children: "← Admin console"
						}),
						/* @__PURE__ */ jsx("h1", {
							className: "mt-1 text-2xl font-extrabold text-slate-900",
							children: "Care Physician Portal"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-slate-600",
							children: "Log your on-duty hours, rate the hospitals you cover and track your reliability score."
						})
					] }), data ? /* @__PURE__ */ jsxs("div", {
						className: "rounded-xl bg-white px-4 py-2 text-right shadow-sm",
						children: [
							/* @__PURE__ */ jsx("div", {
								className: "text-[11px] uppercase text-slate-500",
								children: "Signed in as"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "text-sm font-bold text-slate-900",
								children: data.profile.name
							}),
							data.profile.specialty ? /* @__PURE__ */ jsx("div", {
								className: "text-[11px] text-slate-500",
								children: data.profile.specialty
							}) : null
						]
					}) : null]
				}),
				notice ? /* @__PURE__ */ jsx("div", {
					className: "mb-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800",
					children: notice
				}) : null,
				query.isLoading ? /* @__PURE__ */ jsx(Card, { children: "Loading your duty record…" }) : null,
				query.error ? /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx("p", {
					className: "text-sm font-semibold text-rose-600",
					children: query.error.message.includes("Unauthorized") ? "Please sign in with your care physician account to open this portal." : query.error.message
				}) }) : null,
				data ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("section", {
						className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Reliability score",
								value: `${data.reliability.score}/100`,
								color: data.reliability.score >= 85 ? "#059669" : data.reliability.score >= 65 ? "#B45309" : "#DC2626",
								sub: `${data.reliability.completed} duties completed`
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Hours this month",
								value: data.hours.thisMonth,
								sub: `${data.hours.total} h lifetime · ${data.hours.avgPerDuty} h avg`
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Hospital rating",
								value: data.reliability.avgRating ? `${data.reliability.avgRating}★` : "—",
								color: "#0284C7",
								sub: `${data.reliability.ratingsCount} rating(s)${data.reliability.rehirePct != null ? ` · ${data.reliability.rehirePct}% would rehire` : ""}`
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Attendance issues",
								value: data.reliability.noShows + data.reliability.cancellations,
								color: data.reliability.noShows ? "#DC2626" : "#0f172a",
								sub: `${data.reliability.noShows} no-show · ${data.reliability.cancellations} cancelled · ${data.reliability.lateArrivals} late`
							})
						]
					}),
					/* @__PURE__ */ jsx("section", {
						className: "mt-4 grid gap-3 sm:grid-cols-3",
						children: [
							[
								"Attendance",
								data.reliability.attendancePct,
								"#059669"
							],
							[
								"Punctuality",
								data.reliability.punctualityPct,
								"#0284C7"
							],
							[
								"Hospital sentiment",
								data.reliability.avgRating ? Math.round(data.reliability.avgRating / 5 * 100) : 0,
								"#7C3AED"
							]
						].map(([label, pct, color]) => /* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between text-xs font-semibold text-slate-600",
							children: [/* @__PURE__ */ jsx("span", { children: label }), /* @__PURE__ */ jsxs("span", { children: [pct, "%"] })]
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100",
							children: /* @__PURE__ */ jsx("div", {
								className: "h-full rounded-full",
								style: {
									width: `${pct}%`,
									background: String(color)
								}
							})
						})] }, String(label)))
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "mt-7 mb-2 text-lg font-extrabold text-slate-900",
						children: "My duties"
					}),
					data.duties.length === 0 ? /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "No duties yet. Apply to hospital locum shifts from the Care Physician app to start logging hours."
					}) }) : /* @__PURE__ */ jsx("div", {
						className: "grid gap-3",
						children: data.duties.map((d) => {
							const meta = STATE_META[d.state] ?? {
								label: d.state,
								color: "#64748B"
							};
							const canCheckIn = !d.checkedInAt && (d.status === "accepted" || d.state === "en_route" || d.state === "scheduled" || d.state === "overdue");
							const canCheckOut = Boolean(d.checkedInAt) && !d.checkedOutAt;
							return /* @__PURE__ */ jsxs(Card, { children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex flex-wrap items-start justify-between gap-2",
									children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
										className: "text-sm font-extrabold text-slate-900",
										children: d.title
									}), /* @__PURE__ */ jsxs("div", {
										className: "text-xs text-slate-500",
										children: [
											d.hospital,
											" · ",
											d.dutyLabel,
											d.area ? ` · ${d.area}` : "",
											d.shiftLabel ? ` · ${d.shiftLabel}` : ""
										]
									})] }), /* @__PURE__ */ jsx("span", {
										className: "rounded-full px-2 py-1 text-[10px] font-extrabold uppercase text-white",
										style: { background: meta.color },
										children: meta.label
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-4",
									children: [
										/* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsx("div", {
												className: "font-semibold text-slate-500",
												children: "Shift"
											}),
											fmt(d.startsAt),
											" → ",
											fmt(d.endsAt)
										] }),
										/* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsx("div", {
												className: "font-semibold text-slate-500",
												children: "Checked in"
											}),
											fmt(d.checkedInAt),
											d.lateMinutes > 0 ? /* @__PURE__ */ jsxs("span", {
												className: "text-rose-600",
												children: [
													" (+",
													d.lateMinutes,
													"m)"
												]
											}) : null
										] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
											className: "font-semibold text-slate-500",
											children: "Checked out"
										}), fmt(d.checkedOutAt)] }),
										/* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsx("div", {
												className: "font-semibold text-slate-500",
												children: "Hours logged"
											}),
											d.loggedHours ? `${d.loggedHours} h` : "—",
											d.scheduledHours ? ` / ${d.scheduledHours} h` : ""
										] })
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 flex flex-wrap items-center gap-2",
									children: [
										canCheckIn ? /* @__PURE__ */ jsx("button", {
											onClick: () => hoursMutation.mutate({
												assignmentId: d.assignmentId,
												action: "check_in"
											}),
											disabled: hoursMutation.isPending,
											className: "rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60",
											children: "Check in"
										}) : null,
										canCheckOut ? /* @__PURE__ */ jsx("button", {
											onClick: () => hoursMutation.mutate({
												assignmentId: d.assignmentId,
												action: "check_out"
											}),
											disabled: hoursMutation.isPending,
											className: "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60",
											children: "Check out"
										}) : null,
										d.checkedOutAt ? /* @__PURE__ */ jsx("button", {
											onClick: () => {
												setFeedbackFor(feedbackFor === d.assignmentId ? null : d.assignmentId);
												const g = d.feedbackGiven;
												setForm({
													rating: g?.rating ?? 5,
													facilitySupport: g?.facility_support ?? 4,
													workload: g?.workload ?? 3,
													wouldWorkAgain: g?.would_work_again ?? true,
													comment: g?.comment ?? ""
												});
											},
											className: "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700",
											children: d.feedbackGiven ? "Edit my feedback" : "Give feedback"
										}) : null,
										d.compensation ? /* @__PURE__ */ jsxs("span", {
											className: "ml-auto text-xs font-bold text-slate-700",
											children: [
												"₹",
												d.compensation.toLocaleString("en-IN"),
												"/",
												d.compensationUnit
											]
										}) : null
									]
								}),
								feedbackFor === d.assignmentId ? /* @__PURE__ */ jsxs("div", {
									className: "mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3",
									children: [
										/* @__PURE__ */ jsx("div", {
											className: "grid gap-3 sm:grid-cols-3",
											children: [
												["Overall duty", "rating"],
												["Hospital support", "facilitySupport"],
												["Workload (1 light – 5 heavy)", "workload"]
											].map(([label, key]) => /* @__PURE__ */ jsxs("label", {
												className: "text-[11px] font-semibold text-slate-600",
												children: [label, /* @__PURE__ */ jsx("select", {
													value: form[key],
													onChange: (e) => setForm((f) => ({
														...f,
														[key]: Number(e.target.value)
													})),
													className: "mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm",
													children: [
														1,
														2,
														3,
														4,
														5
													].map((n) => /* @__PURE__ */ jsx("option", {
														value: n,
														children: n
													}, n))
												})]
											}, key))
										}),
										/* @__PURE__ */ jsxs("label", {
											className: "mt-3 flex items-center gap-2 text-xs font-semibold text-slate-700",
											children: [/* @__PURE__ */ jsx("input", {
												type: "checkbox",
												checked: form.wouldWorkAgain,
												onChange: (e) => setForm((f) => ({
													...f,
													wouldWorkAgain: e.target.checked
												}))
											}), "I would take a duty at this hospital again"]
										}),
										/* @__PURE__ */ jsx("textarea", {
											rows: 3,
											value: form.comment,
											onChange: (e) => setForm((f) => ({
												...f,
												comment: e.target.value
											})),
											placeholder: "What went well or what should the hospital improve?",
											className: "mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "mt-2 flex gap-2",
											children: [/* @__PURE__ */ jsx("button", {
												onClick: () => feedbackMutation.mutate({ assignmentId: d.assignmentId }),
												disabled: feedbackMutation.isPending,
												className: "rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60",
												children: "Submit feedback"
											}), /* @__PURE__ */ jsx("button", {
												onClick: () => setFeedbackFor(null),
												className: "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600",
												children: "Cancel"
											})]
										})
									]
								}) : null
							] }, d.assignmentId);
						})
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "mt-7 mb-2 text-lg font-extrabold text-slate-900",
						children: "Feedback hospitals gave me"
					}),
					data.receivedFeedback.length === 0 ? /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "No hospital feedback recorded yet."
					}) }) : /* @__PURE__ */ jsx("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: data.receivedFeedback.map((f) => /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "text-sm font-extrabold text-slate-900",
									children: [f.rating, "★"]
								}), /* @__PURE__ */ jsx("span", {
									className: "text-[11px] text-slate-500",
									children: fmt(f.createdAt)
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-1 text-[11px] text-slate-500",
								children: [
									"Punctuality ",
									f.punctuality ?? "—",
									" · Professionalism ",
									f.professionalism ?? "—",
									f.wouldRehire != null ? ` · ${f.wouldRehire ? "Would rehire" : "Would not rehire"}` : ""
								]
							}),
							f.comment ? /* @__PURE__ */ jsxs("p", {
								className: "mt-2 text-xs text-slate-700",
								children: [
									"“",
									f.comment,
									"”"
								]
							}) : null
						] }, f.id))
					})
				] }) : null
			]
		})]
	});
}
//#endregion
export { PhysicianPortal as component };
