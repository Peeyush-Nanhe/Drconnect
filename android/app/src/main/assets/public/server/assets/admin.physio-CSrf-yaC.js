import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from "@tanstack/react-query";
//#region src/lib/physio-admin.functions.ts
var getPhysioAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 30), 1), 365) })).handler(createSsrRpc("d66196e314dcb0921b8d6e94d9ec7b5a430af1532ed7cf4a9714895bbce7dc95"));
var assignPhysioVisitTherapist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId || !input?.therapistId) throw new Error("visitId and therapistId are required");
	return {
		visitId: String(input.visitId),
		therapistId: String(input.therapistId)
	};
}).handler(createSsrRpc("a3e38f0f3330c5e5766ab18f217561c747d2e26fa1877813f3f68facef2ff20c"));
var updatePhysioVisitStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.visitId) throw new Error("visitId is required");
	const action = String(input.action ?? "");
	if (![
		"en_route",
		"in_progress",
		"completed",
		"no_show",
		"cancelled"
	].includes(action)) throw new Error("Unknown action");
	if (action === "cancelled" && !input.reason?.trim()) throw new Error("A cancellation reason is required");
	return {
		visitId: String(input.visitId),
		action,
		reason: input.reason?.trim() || null
	};
}).handler(createSsrRpc("b5e95878869b4154f8028652fe736e0199514b3e7f6256f6f9ea48cb5395abe8"));
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({
	partnerId: String(d.partnerId),
	email: String(d.email).trim().toLowerCase()
})).handler(createSsrRpc("7d2eafda439d3b917f904844f5b8ee36deeb0d533c46a5cd543cf5033904b73f"));
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({
	therapistId: String(d.therapistId),
	email: String(d.email).trim().toLowerCase()
})).handler(createSsrRpc("82a26d45a830a68c6a23d1d8eaa57338318486c87a0d858b4c13628e9cfc7292"));
//#endregion
//#region src/routes/admin.physio.tsx?tsr-split=component
var STATE_META = {
	on_visit: {
		label: "In session",
		color: "#059669"
	},
	en_route: {
		label: "Going for visit",
		color: "#0284C7"
	},
	scheduled: {
		label: "Scheduled",
		color: "#64748B"
	},
	late: {
		label: "Late for duty",
		color: "#DC2626"
	},
	unassigned: {
		label: "Unassigned",
		color: "#C2410C"
	},
	absent: {
		label: "Absent / no-show",
		color: "#B91C1C"
	},
	completed: {
		label: "Completed",
		color: "#15803D"
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
function Bar({ value, total, color }) {
	const pct = total ? Math.round(value / total * 100) : 0;
	return /* @__PURE__ */ jsx("div", {
		className: "h-2 w-full overflow-hidden rounded-full bg-slate-100",
		children: /* @__PURE__ */ jsx("div", {
			className: "h-full rounded-full",
			style: {
				width: `${pct}%`,
				background: color
			}
		})
	});
}
function Section({ title, note, children }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "mb-6",
		children: [
			/* @__PURE__ */ jsx("h2", {
				className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
				children: title
			}),
			note ? /* @__PURE__ */ jsx("p", {
				className: "mb-2 text-xs text-slate-500",
				children: note
			}) : null,
			children
		]
	});
}
function when(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleString("en-IN", {
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
function PhysioControlRoom() {
	const [days, setDays] = useState(30);
	const fetchOverview = useServerFn(getPhysioAdminOverview);
	const assignFn = useServerFn(assignPhysioVisitTherapist);
	const statusFn = useServerFn(updatePhysioVisitStatus);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["physio-admin-overview", days],
		queryFn: () => fetchOverview({ data: { days } }),
		retry: false,
		refetchInterval: 6e4
	});
	const [assignChoice, setAssignChoice] = useState({});
	const [cancelingRow, setCancelingRow] = useState(null);
	const [cancelReasonInput, setCancelReasonInput] = useState("");
	const [rowError, setRowError] = useState(null);
	const assignMutation = useMutation({
		mutationFn: (vars) => assignFn({ data: vars }),
		onSuccess: () => {
			setRowError(null);
			refetch();
		},
		onError: (e, vars) => setRowError({
			id: vars.visitId,
			message: e instanceof Error ? e.message : "Could not assign therapist"
		})
	});
	const statusMutation = useMutation({
		mutationFn: (vars) => statusFn({ data: vars }),
		onSuccess: () => {
			setRowError(null);
			setCancelingRow(null);
			setCancelReasonInput("");
			refetch();
		},
		onError: (e, vars) => setRowError({
			id: vars.visitId,
			message: e instanceof Error ? e.message : "Could not update visit"
		})
	});
	const mixTotal = data ? Object.values(data.totals.therapyMix).reduce((a, b) => a + b, 0) : 0;
	const todayMixTotal = data ? Object.values(data.today.therapyMix).reduce((a, b) => a + b, 0) : 0;
	const maxHotspot = data ? Math.max(1, ...data.hotspots.map((h) => h.visits)) : 1;
	return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen px-4 py-8",
		style: {
			background: "#DCE6E1",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-6xl",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-6 flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx(Link, {
						to: "/admin",
						className: "text-xs font-semibold text-teal-700 hover:underline",
						children: "← Admin console"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "text-2xl font-extrabold text-slate-900",
						children: "Home Physiotherapy Control Room"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "Home visits by area and therapy type, therapist attendance, demand hotspots and service quality."
					})
				] }), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ jsx("div", {
						className: "flex overflow-hidden rounded-full border border-slate-300 bg-white",
						children: [
							7,
							30,
							90
						].map((d) => /* @__PURE__ */ jsxs("button", {
							onClick: () => setDays(d),
							className: `px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-teal-700 text-white" : "text-slate-600"}`,
							children: [d, " days"]
						}, d))
					}), /* @__PURE__ */ jsx("button", {
						onClick: () => refetch(),
						className: "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm",
						children: isFetching ? "Refreshing…" : "Refresh"
					})]
				})]
			}), error ? /* @__PURE__ */ jsx(Card, {
				className: "text-sm text-rose-700",
				children: error.message.includes("Forbidden") ? "This console is restricted to administrators and approved home-physiotherapy partners." : `Could not load: ${error.message}`
			}) : isLoading || !data ? /* @__PURE__ */ jsx(Card, {
				className: "p-8 text-center text-sm text-slate-500",
				children: "Loading…"
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs(Card, {
					className: "mb-5 flex flex-wrap items-center justify-between gap-2 bg-white/80",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "text-xs text-slate-600",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "font-bold text-slate-800",
								children: data.scope.isAdmin ? "MyDox operations view" : data.scope.partnerName
							}),
							" ",
							"· ",
							data.scope.isAdmin ? "all partners and areas" : "partner view"
						]
					}), /* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-1",
						children: data.scope.areas.slice(0, 12).map((a) => /* @__PURE__ */ jsx("span", {
							className: "rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800",
							children: a
						}, a))
					})]
				}),
				/* @__PURE__ */ jsxs(Section, {
					title: "Today",
					note: "Home visits scheduled for today across your areas.",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Visits today",
								value: data.today.total
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "In session",
								value: data.today.onVisit,
								color: "#059669"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Going for visit",
								value: data.today.enRoute,
								color: "#0284C7",
								sub: "Within 3h"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Late for duty",
								value: data.today.lateForDuty,
								color: "#DC2626"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Absent / no-show",
								value: data.today.absentToday,
								color: "#B91C1C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Unassigned",
								value: data.today.unassignedToday,
								color: "#C2410C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Completed",
								value: data.today.completedToday,
								color: "#15803D"
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
							className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
							children: "Today by therapy type"
						}), todayMixTotal === 0 ? /* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-500",
							children: "No visits scheduled today."
						}) : Object.entries(data.today.therapyMix).sort((a, b) => b[1] - a[1]).map(([k, n]) => /* @__PURE__ */ jsxs("div", {
							className: "mb-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "mb-1 flex justify-between text-xs font-semibold text-slate-700",
								children: [/* @__PURE__ */ jsx("span", { children: data.therapyLabels[k] ?? k }), /* @__PURE__ */ jsx("span", { children: n })]
							}), /* @__PURE__ */ jsx(Bar, {
								value: n,
								total: todayMixTotal,
								color: "#4F46E5"
							})]
						}, k))] }), /* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
							className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
							children: "Today by area"
						}), Object.keys(data.today.areaMix).length === 0 ? /* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-500",
							children: "No visits scheduled today."
						}) : Object.entries(data.today.areaMix).sort((a, b) => b[1] - a[1]).map(([k, n]) => /* @__PURE__ */ jsxs("div", {
							className: "mb-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "mb-1 flex justify-between text-xs font-semibold text-slate-700",
								children: [/* @__PURE__ */ jsx("span", { children: k }), /* @__PURE__ */ jsx("span", { children: n })]
							}), /* @__PURE__ */ jsx(Bar, {
								value: n,
								total: data.today.total || 1,
								color: "#0D9488"
							})]
						}, k))] })]
					})]
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Visit board",
					note: "Late and unassigned visits float to the top.",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full min-w-[980px] text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Status"
									}),
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
										children: "Area"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Therapist"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Scheduled"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Partner"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Actions"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.board.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 8,
								className: "px-3 py-6 text-center text-slate-500",
								children: "Nothing on the board right now."
							}) }) : data.board.map((b) => {
								const meta = STATE_META[b.state] ?? {
									label: b.state,
									color: "#64748B"
								};
								const cancellable = [
									"requested",
									"assigned",
									"en_route"
								].includes(b.status);
								const rowBusy = assignMutation.isPending && assignMutation.variables?.visitId === b.id || statusMutation.isPending && statusMutation.variables?.visitId === b.id;
								return /* @__PURE__ */ jsxs("tr", {
									className: "border-t border-slate-100",
									children: [
										/* @__PURE__ */ jsxs("td", {
											className: "px-3 py-2",
											children: [/* @__PURE__ */ jsx("span", {
												className: "rounded-full px-2 py-0.5 text-[11px] font-bold text-white",
												style: { background: meta.color },
												children: meta.label
											}), b.minutesLate ? /* @__PURE__ */ jsxs("div", {
												className: "mt-0.5 text-[10px] font-semibold text-rose-600",
												children: [b.minutesLate, " min late"]
											}) : null]
										}),
										/* @__PURE__ */ jsxs("td", {
											className: "px-3 py-2 font-semibold text-slate-800",
											children: [b.patient, b.urgency === "urgent" ? /* @__PURE__ */ jsx("span", {
												className: "ml-1 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700",
												children: "URGENT"
											}) : null]
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2 text-slate-700",
											children: b.therapyLabel
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2 text-slate-700",
											children: b.area
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2 text-slate-700",
											children: b.therapist ?? "— not assigned —"
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2 text-slate-500",
											children: when(b.scheduledAt)
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2 text-slate-500",
											children: b.partner ?? "—"
										}),
										/* @__PURE__ */ jsxs("td", {
											className: "px-3 py-2",
											children: [cancelingRow === b.id ? /* @__PURE__ */ jsxs("div", {
												className: "flex flex-col gap-1",
												children: [/* @__PURE__ */ jsx("input", {
													autoFocus: true,
													value: cancelReasonInput,
													onChange: (e) => setCancelReasonInput(e.target.value),
													placeholder: "Cancellation reason",
													maxLength: 300,
													className: "w-40 rounded-lg border border-slate-200 px-2 py-1 text-[11px]"
												}), /* @__PURE__ */ jsxs("div", {
													className: "flex gap-1",
													children: [/* @__PURE__ */ jsx("button", {
														type: "button",
														disabled: !cancelReasonInput.trim() || rowBusy,
														onClick: () => statusMutation.mutate({
															visitId: b.id,
															action: "cancelled",
															reason: cancelReasonInput
														}),
														className: "rounded-full bg-rose-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50",
														children: "Confirm"
													}), /* @__PURE__ */ jsx("button", {
														type: "button",
														onClick: () => {
															setCancelingRow(null);
															setCancelReasonInput("");
														},
														className: "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600",
														children: "Back"
													})]
												})]
											}) : /* @__PURE__ */ jsxs("div", {
												className: "flex flex-wrap items-center gap-1",
												children: [b.status === "requested" ? /* @__PURE__ */ jsx(Fragment, { children: (() => {
													const availableRoster = data.roster.filter((t) => t.verified && t.active);
													const preferred = b.preferredTherapistId ? availableRoster.find((t) => t.id === b.preferredTherapistId) : null;
													const chosen = assignChoice[b.id] ?? (preferred ? preferred.id : "");
													return /* @__PURE__ */ jsxs("div", {
														className: "flex flex-col gap-1",
														children: [preferred ? /* @__PURE__ */ jsxs("div", {
															className: "text-[10px] font-semibold text-teal-700",
															children: ["Requested: ", preferred.name]
														}) : null, /* @__PURE__ */ jsxs("div", {
															className: "flex items-center gap-1",
															children: [/* @__PURE__ */ jsxs("select", {
																value: chosen,
																onChange: (e) => setAssignChoice((m) => ({
																	...m,
																	[b.id]: e.target.value
																})),
																className: "rounded-lg border border-slate-200 px-1.5 py-1 text-[11px]",
																children: [/* @__PURE__ */ jsx("option", {
																	value: "",
																	children: "Pick therapist…"
																}), availableRoster.map((t) => /* @__PURE__ */ jsxs("option", {
																	value: t.id,
																	children: [t.name, t.area ? ` (${t.area})` : ""]
																}, t.id))]
															}), /* @__PURE__ */ jsx("button", {
																type: "button",
																disabled: !chosen || rowBusy,
																onClick: () => assignMutation.mutate({
																	visitId: b.id,
																	therapistId: chosen
																}),
																className: "rounded-full bg-teal-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50",
																children: "Assign"
															})]
														})]
													});
												})() }) : b.status === "assigned" ? /* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: rowBusy,
													onClick: () => statusMutation.mutate({
														visitId: b.id,
														action: "en_route"
													}),
													className: "rounded-full bg-sky-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50",
													children: "Send en route"
												}) : b.status === "en_route" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: rowBusy,
													onClick: () => statusMutation.mutate({
														visitId: b.id,
														action: "in_progress"
													}),
													className: "rounded-full bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50",
													children: "Check in"
												}), /* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: rowBusy,
													onClick: () => statusMutation.mutate({
														visitId: b.id,
														action: "no_show"
													}),
													className: "rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-50",
													children: "No-show"
												})] }) : b.status === "in_progress" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: rowBusy,
													onClick: () => statusMutation.mutate({
														visitId: b.id,
														action: "completed"
													}),
													className: "rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-50",
													children: "Complete"
												}), /* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: rowBusy,
													onClick: () => statusMutation.mutate({
														visitId: b.id,
														action: "no_show"
													}),
													className: "rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700 disabled:opacity-50",
													children: "No-show"
												})] }) : /* @__PURE__ */ jsx("span", {
													className: "text-slate-400",
													children: "—"
												}), cancellable ? /* @__PURE__ */ jsx("button", {
													type: "button",
													onClick: () => {
														setCancelingRow(b.id);
														setCancelReasonInput("");
													},
													className: "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600",
													children: "Cancel"
												}) : null]
											}), rowError && rowError.id === b.id ? /* @__PURE__ */ jsx("div", {
												className: "mt-1 max-w-[200px] text-[10px] font-semibold text-rose-600",
												children: rowError.message
											}) : null]
										})
									]
								}, b.id);
							}) })]
						})
					})
				}),
				/* @__PURE__ */ jsxs(Section, {
					title: `Demand · last ${data.windowDays} days`,
					children: [/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-6",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Visits",
								value: data.totals.visits
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Completed",
								value: `${data.totals.completionRate}%`,
								color: "#15803D"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "No-show rate",
								value: `${data.totals.noShowRate}%`,
								color: "#B91C1C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Cancelled",
								value: data.totals.cancelled,
								color: "#94A3B8"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Therapists",
								value: `${data.totals.activeTherapists}/${data.totals.therapists}`,
								sub: "Active / on roster"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Service value",
								value: `₹${data.totals.revenue.toLocaleString("en-IN")}`,
								color: "#0D9488"
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
							className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
							children: "Therapy mix"
						}), Object.entries(data.totals.therapyMix).sort((a, b) => b[1] - a[1]).map(([k, n]) => /* @__PURE__ */ jsxs("div", {
							className: "mb-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "mb-1 flex justify-between text-xs font-semibold text-slate-700",
								children: [/* @__PURE__ */ jsx("span", { children: data.therapyLabels[k] ?? k }), /* @__PURE__ */ jsxs("span", { children: [
									n,
									" · ",
									mixTotal ? Math.round(n / mixTotal * 100) : 0,
									"%"
								] })]
							}), /* @__PURE__ */ jsx(Bar, {
								value: n,
								total: mixTotal,
								color: "#7C3AED"
							})]
						}, k))] }), /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsx("div", {
								className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
								children: "High-demand areas"
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "relative h-48 overflow-hidden rounded-xl bg-slate-50",
								children: [data.hotspots.filter((h) => h.lat != null && h.lng != null).slice(0, 24).map((h) => {
									const size = 14 + h.visits / maxHotspot * 42;
									const lats = data.hotspots.filter((x) => x.lat != null).map((x) => x.lat);
									const lngs = data.hotspots.filter((x) => x.lng != null).map((x) => x.lng);
									const minLat = Math.min(...lats), maxLat = Math.max(...lats);
									const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
									const top = maxLat === minLat ? 50 : (maxLat - h.lat) / (maxLat - minLat) * 80 + 10;
									const left = maxLng === minLng ? 50 : (h.lng - minLng) / (maxLng - minLng) * 80 + 10;
									return /* @__PURE__ */ jsx("div", {
										title: `${h.area}: ${h.visits} visits`,
										className: "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
										style: {
											top: `${top}%`,
											left: `${left}%`,
											width: size,
											height: size,
											background: "rgba(13,148,136,0.35)",
											border: "1px solid #0D9488"
										}
									}, h.area);
								}), data.hotspots.every((h) => h.lat == null) ? /* @__PURE__ */ jsx("div", {
									className: "flex h-full items-center justify-center text-xs text-slate-500",
									children: "No map coordinates on these visits yet."
								}) : null]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-2 space-y-1",
								children: data.hotspots.slice(0, 6).map((h) => /* @__PURE__ */ jsxs("div", {
									className: "flex justify-between text-xs text-slate-700",
									children: [/* @__PURE__ */ jsx("span", {
										className: "font-semibold",
										children: h.area
									}), /* @__PURE__ */ jsxs("span", { children: [
										h.visits,
										" visits · ",
										h.perDay,
										"/day · ",
										h.fillRate,
										"% completed"
									] })]
								}, h.area))
							})
						] })]
					})]
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Area performance",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full min-w-[760px] text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Area"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Visits"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Per day"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Completed"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "No-shows"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Cancelled"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Urgent"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Value"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.hotspots.map((h) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: h.area
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: h.visits
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: h.perDay
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-emerald-700",
										children: h.completed
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-rose-700",
										children: h.noShows
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-500",
										children: h.cancelled
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-amber-700",
										children: h.urgent
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "px-3 py-2",
										children: ["₹", Math.round(h.revenue).toLocaleString("en-IN")]
									})
								]
							}, h.area)) })]
						})
					})
				}),
				/* @__PURE__ */ jsxs(Section, {
					title: "Therapist performance",
					note: "Reliability = visits kept after removing no-shows and cancellations.",
					children: [/* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full min-w-[900px] text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Therapist"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Base area"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Main therapy"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Visits"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Completed"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "No-show"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Late"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Reliability"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Rating"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Rebook"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.therapists.map((t) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsxs("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: [t.name, t.partner ? /* @__PURE__ */ jsx("div", {
											className: "text-[10px] text-slate-500",
											children: t.partner
										}) : null]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.area ?? "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.topTherapy ? data.therapyLabels[t.topTherapy] ?? t.topTherapy : "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.visits
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-emerald-700",
										children: t.completed
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-rose-700",
										children: t.noShows
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-amber-700",
										children: t.lateArrivals
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.reliability == null ? "—" : `${t.reliability}%`
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "px-3 py-2",
										children: [t.avgRating == null ? "—" : `${t.avgRating}★`, t.reviews ? /* @__PURE__ */ jsxs("span", {
											className: "text-slate-400",
											children: [
												" (",
												t.reviews,
												")"
											]
										}) : null]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.rebookRate == null ? "—" : `${t.rebookRate}%`
									})
								]
							}, t.id)) })]
						})
					}), data.idleTherapists.length ? /* @__PURE__ */ jsxs("div", {
						className: "mt-2 text-xs text-slate-600",
						children: ["Idle in this window: ", data.idleTherapists.map((t) => t.name).join(", ")]
					}) : null]
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Outsourcing partners",
					note: "Third-party companies running home physiotherapy in assigned areas.",
					children: /* @__PURE__ */ jsx("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: data.partners.map((p) => /* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
								className: "text-sm font-extrabold text-slate-900",
								children: p.name
							}), /* @__PURE__ */ jsx("div", {
								className: "mt-1 flex flex-wrap gap-1",
								children: p.areas.map((a) => /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600",
									children: a
								}, a))
							})] }), /* @__PURE__ */ jsxs("div", {
								className: "text-right",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "text-lg font-extrabold text-teal-700",
									children: [p.completionRate, "%"]
								}), /* @__PURE__ */ jsx("div", {
									className: "text-[10px] text-slate-500",
									children: "completed"
								})]
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "mt-3 grid grid-cols-4 gap-2 text-center text-xs",
							children: [
								/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
									className: "font-extrabold text-slate-900",
									children: p.visits
								}), /* @__PURE__ */ jsx("div", {
									className: "text-slate-500",
									children: "Visits"
								})] }),
								/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
									className: "font-extrabold text-rose-700",
									children: p.noShows
								}), /* @__PURE__ */ jsx("div", {
									className: "text-slate-500",
									children: "No-show"
								})] }),
								/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
									className: "font-extrabold text-slate-900",
									children: p.avgRating ?? "—"
								}), /* @__PURE__ */ jsx("div", {
									className: "text-slate-500",
									children: "Rating"
								})] }),
								/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
									className: "font-extrabold text-slate-900",
									children: ["₹", p.revenue.toLocaleString("en-IN")]
								}), /* @__PURE__ */ jsx("div", {
									className: "text-slate-500",
									children: "Value"
								})] })
							]
						})] }, p.id))
					})
				}),
				/* @__PURE__ */ jsxs(Section, {
					title: "Patient feedback",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Reviews",
								value: data.feedback.count
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Avg rating",
								value: data.feedback.avgRating ?? "—",
								color: "#0D9488"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Punctuality",
								value: data.feedback.avgPunctuality ?? "—"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Would rebook",
								value: data.feedback.rebookRate == null ? "—" : `${data.feedback.rebookRate}%`
							})
						]
					}), /* @__PURE__ */ jsx("div", {
						className: "grid gap-2 sm:grid-cols-2",
						children: data.feedback.recent.map((f) => /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between text-xs font-semibold text-slate-800",
								children: [/* @__PURE__ */ jsx("span", { children: f.therapist }), /* @__PURE__ */ jsxs("span", {
									className: "text-amber-600",
									children: [f.rating, "★"]
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "text-[11px] text-slate-500",
								children: [f.partner ? `${f.partner} · ` : "", when(f.createdAt)]
							}),
							f.comment ? /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-xs text-slate-700",
								children: f.comment
							}) : null
						] }, f.id))
					})]
				})
			] })]
		})
	});
}
//#endregion
export { PhysioControlRoom as component };
