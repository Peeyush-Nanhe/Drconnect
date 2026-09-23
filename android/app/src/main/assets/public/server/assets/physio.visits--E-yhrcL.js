import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { a as getMyPhysioVisits, c as submitPhysioVisitFeedback, i as cancelPhysioVisit } from "./physio-patient.functions-CymDwMqO.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/routes/physio.visits.tsx?tsr-split=component
var STATUS_META = {
	requested: {
		label: "Awaiting therapist",
		color: "#92400E",
		bg: "#FEF3C7"
	},
	assigned: {
		label: "Therapist assigned",
		color: "#1E40AF",
		bg: "#DBEAFE"
	},
	en_route: {
		label: "Therapist on the way",
		color: "#0369A1",
		bg: "#E0F2FE"
	},
	in_progress: {
		label: "Session in progress",
		color: "#065F46",
		bg: "#D1FAE5"
	},
	completed: {
		label: "Completed",
		color: "#374151",
		bg: "#E5E7EB"
	},
	cancelled: {
		label: "Cancelled",
		color: "#991B1B",
		bg: "#FEE2E2"
	},
	no_show: {
		label: "Missed",
		color: "#991B1B",
		bg: "#FEE2E2"
	}
};
var UPCOMING = /* @__PURE__ */ new Set([
	"requested",
	"assigned",
	"en_route",
	"in_progress"
]);
function fmt(dt) {
	if (!dt) return "—";
	return new Date(dt).toLocaleString("en-IN", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function fmtTime(dt) {
	if (!dt) return "—";
	return new Date(dt).toLocaleTimeString("en-IN", {
		hour: "2-digit",
		minute: "2-digit"
	});
}
function Stars({ value, onChange }) {
	return /* @__PURE__ */ jsx("div", {
		className: "flex gap-1",
		children: [
			1,
			2,
			3,
			4,
			5
		].map((n) => /* @__PURE__ */ jsx("button", {
			type: "button",
			disabled: !onChange,
			onClick: () => onChange?.(n),
			"aria-label": `${n} star${n > 1 ? "s" : ""}`,
			className: `text-lg leading-none ${onChange ? "cursor-pointer" : "cursor-default"}`,
			style: { color: n <= value ? "#F59E0B" : "#CBD5E1" },
			children: "★"
		}, n))
	});
}
function PatientPhysioVisits() {
	const fetchVisits = useServerFn(getMyPhysioVisits);
	const sendFeedback = useServerFn(submitPhysioVisitFeedback);
	const sendCancel = useServerFn(cancelPhysioVisit);
	const qc = useQueryClient();
	const [tab, setTab] = useState("upcoming");
	const [feedbackFor, setFeedbackFor] = useState(null);
	const [form, setForm] = useState({
		rating: 5,
		punctuality: 5,
		professionalism: 5,
		wouldRebook: true,
		comment: ""
	});
	const [notice, setNotice] = useState("");
	const [cancellingFor, setCancellingFor] = useState(null);
	const [cancelReason, setCancelReason] = useState("");
	const query = useQuery({
		queryKey: ["my-physio-visits"],
		queryFn: () => fetchVisits({}),
		refetchInterval: 6e4
	});
	const feedbackMutation = useMutation({
		mutationFn: (vars) => sendFeedback({ data: vars }),
		onSuccess: () => {
			setFeedbackFor(null);
			setNotice("Thanks — your feedback was recorded.");
			qc.invalidateQueries({ queryKey: ["my-physio-visits"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not save feedback")
	});
	const cancelMutation = useMutation({
		mutationFn: (vars) => sendCancel({ data: vars }),
		onSuccess: () => {
			setCancellingFor(null);
			setCancelReason("");
			setNotice("Your visit has been cancelled.");
			qc.invalidateQueries({ queryKey: ["my-physio-visits"] });
		},
		onError: (e) => setNotice(e instanceof Error ? e.message : "Could not cancel visit")
	});
	const visits = query.data ?? [];
	const shown = visits.filter((v) => tab === "upcoming" ? UPCOMING.has(v.status) : !UPCOMING.has(v.status));
	const upcomingCount = visits.filter((v) => UPCOMING.has(v.status)).length;
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-[100dvh] bg-[#DCE6E1] text-slate-900",
		children: [/* @__PURE__ */ jsx("header", {
			className: "border-b border-slate-200 bg-white px-4 py-4",
			children: /* @__PURE__ */ jsxs("div", {
				className: "mx-auto flex max-w-3xl items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-lg font-extrabold",
					children: "My physiotherapy visits"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs text-slate-500",
					children: "Home sessions, therapist arrival status and session feedback"
				})] }), /* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3",
					children: [/* @__PURE__ */ jsx(Link, {
						to: "/physio/book",
						className: "rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white",
						children: "+ Book a session"
					}), /* @__PURE__ */ jsx(Link, {
						to: "/bookings",
						className: "text-xs font-semibold text-teal-700",
						children: "All bookings →"
					})]
				})]
			})
		}), /* @__PURE__ */ jsx("main", {
			className: "mx-auto max-w-3xl px-4 py-4",
			children: query.isLoading ? /* @__PURE__ */ jsx("div", {
				className: "rounded-2xl bg-white p-6 text-sm text-slate-500",
				children: "Loading your sessions…"
			}) : query.isError ? /* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl bg-white p-6 text-sm text-red-600",
				children: [
					query.error instanceof Error ? query.error.message : "Could not load your physiotherapy visits.",
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
				]
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("div", {
					className: "mb-3 flex gap-2",
					children: ["upcoming", "previous"].map((t) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setTab(t),
						className: `rounded-full px-4 py-1.5 text-xs font-bold capitalize ${tab === t ? "bg-teal-600 text-white" : "bg-white text-slate-600"}`,
						children: [t, t === "upcoming" && upcomingCount ? ` (${upcomingCount})` : ""]
					}, t))
				}),
				notice ? /* @__PURE__ */ jsx("div", {
					className: "mb-3 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-teal-700",
					children: notice
				}) : null,
				shown.length === 0 ? /* @__PURE__ */ jsxs("div", {
					className: "rounded-2xl bg-white p-6 text-sm text-slate-500",
					children: [
						"No ",
						tab,
						" physiotherapy sessions yet."
					]
				}) : /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: shown.map((v) => {
						const meta = STATUS_META[v.status] ?? {
							label: v.status,
							color: "#374151",
							bg: "#E5E7EB"
						};
						const editing = feedbackFor === v.id;
						return /* @__PURE__ */ jsxs("article", {
							className: "rounded-2xl border border-slate-200 bg-white p-4",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
										className: "text-sm font-extrabold",
										children: v.therapyLabel
									}), /* @__PURE__ */ jsxs("div", {
										className: "text-xs text-slate-500",
										children: [
											"Session ",
											v.sessionNumber,
											" · ",
											v.durationMin,
											" min · ",
											v.area,
											", ",
											v.city
										]
									})] }), /* @__PURE__ */ jsx("span", {
										className: "whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold",
										style: {
											background: meta.bg,
											color: meta.color
										},
										children: meta.label
									})]
								}),
								/* @__PURE__ */ jsxs("dl", {
									className: "mt-3 grid grid-cols-2 gap-2 text-xs",
									children: [
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
											className: "text-slate-500",
											children: "Scheduled"
										}), /* @__PURE__ */ jsx("dd", {
											className: "font-semibold",
											children: fmt(v.scheduledAt)
										})] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
											className: "text-slate-500",
											children: "Therapist"
										}), /* @__PURE__ */ jsx("dd", {
											className: "font-semibold",
											children: v.therapistName ?? "Being assigned"
										})] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
											className: "text-slate-500",
											children: "Checked in"
										}), /* @__PURE__ */ jsx("dd", {
											className: "font-semibold",
											style: { color: v.checkedInAt ? "#047857" : void 0 },
											children: v.checkedInAt ? fmtTime(v.checkedInAt) : "Not yet"
										})] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
											className: "text-slate-500",
											children: "Checked out"
										}), /* @__PURE__ */ jsx("dd", {
											className: "font-semibold",
											style: { color: v.checkedOutAt ? "#047857" : void 0 },
											children: v.checkedOutAt ? fmtTime(v.checkedOutAt) : "Not yet"
										})] }),
										v.partnerName ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
											className: "text-slate-500",
											children: "Service partner"
										}), /* @__PURE__ */ jsx("dd", {
											className: "font-semibold",
											children: v.partnerName
										})] }) : null,
										v.fee !== null ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
											className: "text-slate-500",
											children: "Fee"
										}), /* @__PURE__ */ jsxs("dd", {
											className: "font-semibold",
											children: ["₹", v.fee]
										})] }) : null
									]
								}),
								v.address ? /* @__PURE__ */ jsx("p", {
									className: "mt-2 text-xs text-slate-500",
									children: v.address
								}) : null,
								v.cancelledAt ? /* @__PURE__ */ jsxs("p", {
									className: "mt-2 text-xs text-red-600",
									children: [
										"Cancelled ",
										fmt(v.cancelledAt),
										v.cancelReason ? ` · ${v.cancelReason}` : ""
									]
								}) : null,
								UPCOMING.has(v.status) ? /* @__PURE__ */ jsx("div", {
									className: "mt-3 border-t border-slate-100 pt-3",
									children: cancellingFor === v.id ? /* @__PURE__ */ jsxs("form", {
										className: "space-y-2",
										onSubmit: (e) => {
											e.preventDefault();
											setNotice("");
											cancelMutation.mutate({
												visitId: v.id,
												reason: cancelReason
											});
										},
										children: [/* @__PURE__ */ jsx("textarea", {
											value: cancelReason,
											onChange: (e) => setCancelReason(e.target.value),
											placeholder: "Reason for cancelling (optional)",
											className: "w-full rounded-xl border border-slate-200 p-2 text-xs",
											rows: 2,
											maxLength: 300
										}), /* @__PURE__ */ jsxs("div", {
											className: "flex gap-2",
											children: [/* @__PURE__ */ jsx("button", {
												type: "submit",
												disabled: cancelMutation.isPending,
												className: "rounded-full bg-red-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
												children: cancelMutation.isPending ? "Cancelling…" : "Confirm cancel"
											}), /* @__PURE__ */ jsx("button", {
												type: "button",
												className: "rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600",
												onClick: () => {
													setCancellingFor(null);
													setCancelReason("");
												},
												children: "Keep visit"
											})]
										})]
									}) : /* @__PURE__ */ jsx("button", {
										type: "button",
										className: "text-xs font-semibold text-red-600",
										onClick: () => setCancellingFor(v.id),
										children: "Cancel visit"
									})
								}) : null,
								v.status === "completed" ? /* @__PURE__ */ jsx("div", {
									className: "mt-3 border-t border-slate-100 pt-3",
									children: v.feedback && !editing ? /* @__PURE__ */ jsxs("div", {
										className: "flex items-center justify-between gap-2",
										children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ jsx(Stars, { value: v.feedback.rating }), /* @__PURE__ */ jsx("span", {
												className: "text-xs text-slate-500",
												children: "Your rating"
											})]
										}), v.feedback.comment ? /* @__PURE__ */ jsxs("p", {
											className: "mt-1 text-xs text-slate-600",
											children: [
												"“",
												v.feedback.comment,
												"”"
											]
										}) : null] }), /* @__PURE__ */ jsx("button", {
											type: "button",
											className: "text-xs font-semibold text-teal-700",
											onClick: () => {
												setFeedbackFor(v.id);
												setForm({
													rating: v.feedback.rating,
													punctuality: v.feedback.punctuality ?? 5,
													professionalism: v.feedback.professionalism ?? 5,
													wouldRebook: v.feedback.wouldRebook ?? true,
													comment: v.feedback.comment ?? ""
												});
											},
											children: "Edit"
										})]
									}) : editing ? /* @__PURE__ */ jsxs("form", {
										className: "space-y-2",
										onSubmit: (e) => {
											e.preventDefault();
											setNotice("");
											feedbackMutation.mutate({
												visitId: v.id,
												...form
											});
										},
										children: [
											/* @__PURE__ */ jsxs("label", {
												className: "flex items-center justify-between text-xs font-semibold",
												children: ["Overall", /* @__PURE__ */ jsx(Stars, {
													value: form.rating,
													onChange: (rating) => setForm((f) => ({
														...f,
														rating
													}))
												})]
											}),
											/* @__PURE__ */ jsxs("label", {
												className: "flex items-center justify-between text-xs font-semibold",
												children: ["Punctuality", /* @__PURE__ */ jsx(Stars, {
													value: form.punctuality,
													onChange: (punctuality) => setForm((f) => ({
														...f,
														punctuality
													}))
												})]
											}),
											/* @__PURE__ */ jsxs("label", {
												className: "flex items-center justify-between text-xs font-semibold",
												children: ["Professionalism", /* @__PURE__ */ jsx(Stars, {
													value: form.professionalism,
													onChange: (professionalism) => setForm((f) => ({
														...f,
														professionalism
													}))
												})]
											}),
											/* @__PURE__ */ jsxs("label", {
												className: "flex items-center gap-2 text-xs font-semibold",
												children: [/* @__PURE__ */ jsx("input", {
													type: "checkbox",
													checked: form.wouldRebook,
													onChange: (e) => setForm((f) => ({
														...f,
														wouldRebook: e.target.checked
													}))
												}), "I would book this therapist again"]
											}),
											/* @__PURE__ */ jsx("textarea", {
												value: form.comment,
												onChange: (e) => setForm((f) => ({
													...f,
													comment: e.target.value
												})),
												placeholder: "Anything you want the care team to know (optional)",
												className: "w-full rounded-xl border border-slate-200 p-2 text-xs",
												rows: 3
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "flex gap-2",
												children: [/* @__PURE__ */ jsx("button", {
													type: "submit",
													disabled: feedbackMutation.isPending,
													className: "rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white disabled:opacity-60",
													children: feedbackMutation.isPending ? "Saving…" : "Submit feedback"
												}), /* @__PURE__ */ jsx("button", {
													type: "button",
													className: "rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600",
													onClick: () => setFeedbackFor(null),
													children: "Cancel"
												})]
											})
										]
									}) : /* @__PURE__ */ jsx("button", {
										type: "button",
										className: "rounded-full bg-teal-600 px-4 py-1.5 text-xs font-bold text-white",
										onClick: () => {
											setFeedbackFor(v.id);
											setForm({
												rating: 5,
												punctuality: 5,
												professionalism: 5,
												wouldRebook: true,
												comment: ""
											});
										},
										children: "Rate this session"
									})
								}) : null
							]
						}, v.id);
					})
				})
			] })
		})]
	});
}
//#endregion
export { PatientPhysioVisits as component };
