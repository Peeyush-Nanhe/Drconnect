import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from "@tanstack/react-query";
//#region src/lib/technician-admin.functions.ts
var getTechnicianAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 30), 1), 365) })).handler(createSsrRpc("cb537fd82069b611565ddcb735a127499454b8bda02e0f6414471970004d8435"));
/** Admin: assign (or reassign) a technician to a test booking. */
var assignTechnicianToTest = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({
	testId: String(d.testId),
	technicianId: d.technicianId ? String(d.technicianId) : null
})).handler(createSsrRpc("a1a96fc69d854c19ccd23a86b67406fd3065d027359ca389db2e30f11bf57801"));
/** Admin or the assigned technician: move a test along its lifecycle. */
var setTechnicianTestStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({
	testId: String(d.testId),
	status: String(d.status),
	findings: d.findings == null ? null : String(d.findings)
})).handler(createSsrRpc("eca671366d100f20100e0f9432c018f15e96ca57997e71cb2a355ee94958b0b6"));
//#endregion
//#region src/routes/admin.technician.tsx?tsr-split=component
var STATE_META = {
	in_progress: {
		label: "Test in progress",
		color: "#059669"
	},
	en_route: {
		label: "Technician on the way",
		color: "#0284C7"
	},
	scheduled: {
		label: "Scheduled",
		color: "#64748B"
	},
	late: {
		label: "Late",
		color: "#DC2626"
	},
	unassigned: {
		label: "Needs a technician",
		color: "#C2410C"
	},
	absent: {
		label: "Patient absent / no-show",
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
function TechnicianControlRoom() {
	const [days, setDays] = useState(30);
	const fetchOverview = useServerFn(getTechnicianAdminOverview);
	const assign = useServerFn(assignTechnicianToTest);
	const setStatus = useServerFn(setTechnicianTestStatus);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["technician-admin-overview", days],
		queryFn: () => fetchOverview({ data: { days } }),
		retry: false,
		refetchInterval: 6e4
	});
	const assignM = useMutation({
		mutationFn: (v) => assign({ data: v }),
		onSuccess: () => void refetch()
	});
	const statusM = useMutation({
		mutationFn: (v) => setStatus({ data: v }),
		onSuccess: () => void refetch()
	});
	const label = (t) => data?.testLabels[t] ?? t;
	const mixTotal = data ? Object.values(data.totals.testMix).reduce((a, b) => a + b, 0) : 0;
	const maxHotspot = data ? Math.max(1, ...data.hotspots.map((h) => h.tests)) : 1;
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
						children: "Technician Testing Control Room"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "Every technician-led test — ECG, Holter, EEG, VNG, audiometry, spirometry, OT assist — monitored together."
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
				children: error.message.includes("Forbidden") ? "This console is restricted to administrators and active technicians." : `Could not load: ${error.message}`
			}) : isLoading || !data ? /* @__PURE__ */ jsx(Card, {
				className: "p-8 text-center text-sm text-slate-500",
				children: "Loading…"
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs(Card, {
					className: "mb-5 flex flex-wrap items-center justify-between gap-2 bg-white/80",
					children: [/* @__PURE__ */ jsx("div", {
						className: "text-xs text-slate-600",
						children: data.scope.isAdmin ? "Admin view — all technicians and all test bookings." : `Technician view — ${data.scope.technicianName}`
					}), /* @__PURE__ */ jsxs("div", {
						className: "text-[11px] text-slate-500",
						children: ["Updated ", when(data.generatedAt)]
					})]
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Today",
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Tests today",
								value: data.today.total
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "In progress",
								value: data.today.inProgress,
								color: "#059669"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Needs a technician",
								value: data.today.unassigned,
								color: "#C2410C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Late",
								value: data.today.late,
								color: "#DC2626"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Completed today",
								value: data.today.completed,
								color: "#15803D"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "No-shows today",
								value: data.today.absent,
								color: "#B91C1C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "On the way",
								value: data.today.enRoute,
								color: "#0284C7"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Cancelled today",
								value: data.today.cancelled,
								color: "#94A3B8"
							})
						]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: `Last ${data.windowDays} days`,
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Total tests",
								value: data.totals.tests
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Completion rate",
								value: `${data.totals.completionRate}%`,
								color: "#15803D"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "No-show rate",
								value: `${data.totals.noShowRate}%`,
								color: "#B91C1C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Collected",
								value: `₹${data.totals.revenue.toLocaleString("en-IN")}`,
								color: "#0F766E"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Payment pending",
								value: `₹${data.totals.pendingPayments.toLocaleString("en-IN")}`,
								color: "#C2410C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Reports missing",
								value: data.totals.missingReports,
								color: "#DC2626",
								sub: "completed tests without findings"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Home visits",
								value: data.totals.homeVisits,
								sub: `${data.totals.urgent} urgent`
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Technicians",
								value: `${data.totals.activeTechnicians}/${data.totals.technicians}`,
								sub: "active / total"
							})
						]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Test mix",
					children: /* @__PURE__ */ jsxs(Card, { children: [Object.entries(data.totals.testMix).sort((a, b) => b[1] - a[1]).map(([k, v]) => /* @__PURE__ */ jsxs("div", {
						className: "mb-2",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "mb-1 flex justify-between text-xs font-semibold text-slate-700",
							children: [/* @__PURE__ */ jsx("span", { children: label(k) }), /* @__PURE__ */ jsx("span", { children: v })]
						}), /* @__PURE__ */ jsx(Bar, {
							value: v,
							total: mixTotal,
							color: "#7C3AED"
						})]
					}, k)), mixTotal === 0 ? /* @__PURE__ */ jsx("div", {
						className: "text-xs text-slate-500",
						children: "No tests in this window."
					}) : null] })
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Live test board",
					note: "Today's tests plus anything late, running or waiting for a technician.",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
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
										children: "Scheduled"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Technician"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Status"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Action"
									})
								] })
							}), /* @__PURE__ */ jsxs("tbody", { children: [data.board.map((b) => {
								const meta = STATE_META[b.state] ?? {
									label: b.state,
									color: "#64748B"
								};
								return /* @__PURE__ */ jsxs("tr", {
									className: "border-t border-slate-100",
									children: [
										/* @__PURE__ */ jsxs("td", {
											className: "px-3 py-2 font-semibold text-slate-800",
											children: [
												b.patient,
												b.urgency === "urgent" ? /* @__PURE__ */ jsx("span", {
													className: "ml-1 rounded bg-rose-100 px-1 text-[10px] font-bold text-rose-700",
													children: "URGENT"
												}) : null,
												b.referredBy ? /* @__PURE__ */ jsxs("div", {
													className: "text-[10px] text-slate-500",
													children: ["via ", b.referredBy]
												}) : null
											]
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2 text-slate-700",
											children: b.testLabel
										}),
										/* @__PURE__ */ jsxs("td", {
											className: "px-3 py-2 text-slate-600",
											children: [b.homeVisit ? "Home" : "Centre", b.area ? ` · ${b.area}` : ""]
										}),
										/* @__PURE__ */ jsxs("td", {
											className: "px-3 py-2 text-slate-600",
											children: [when(b.scheduledAt), b.minutesLate ? /* @__PURE__ */ jsxs("div", {
												className: "text-[10px] text-rose-600",
												children: [b.minutesLate, " min late"]
											}) : null]
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2",
											children: data.scope.isAdmin ? /* @__PURE__ */ jsxs("select", {
												value: b.technicianId ?? "",
												onChange: (e) => assignM.mutate({
													testId: b.id,
													technicianId: e.target.value || null
												}),
												className: "rounded border border-slate-300 px-1.5 py-1 text-[11px]",
												children: [/* @__PURE__ */ jsx("option", {
													value: "",
													children: "Unassigned"
												}), data.roster.map((r) => /* @__PURE__ */ jsx("option", {
													value: r.id,
													children: r.name
												}, r.id))]
											}) : b.technician ?? "—"
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2",
											children: /* @__PURE__ */ jsx("span", {
												className: "rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
												style: { background: meta.color },
												children: meta.label
											})
										}),
										/* @__PURE__ */ jsx("td", {
											className: "px-3 py-2",
											children: /* @__PURE__ */ jsxs("select", {
												value: "",
												onChange: (e) => e.target.value && statusM.mutate({
													testId: b.id,
													status: e.target.value
												}),
												className: "rounded border border-slate-300 px-1.5 py-1 text-[11px]",
												children: [
													/* @__PURE__ */ jsx("option", {
														value: "",
														children: "Update…"
													}),
													/* @__PURE__ */ jsx("option", {
														value: "en_route",
														children: "On the way"
													}),
													/* @__PURE__ */ jsx("option", {
														value: "in_progress",
														children: "Start test"
													}),
													/* @__PURE__ */ jsx("option", {
														value: "completed",
														children: "Completed"
													}),
													/* @__PURE__ */ jsx("option", {
														value: "no_show",
														children: "Patient absent"
													}),
													/* @__PURE__ */ jsx("option", {
														value: "cancelled",
														children: "Cancelled"
													})
												]
											})
										})
									]
								}, b.id);
							}), data.board.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 7,
								className: "px-3 py-6 text-center text-slate-500",
								children: "Nothing on the board right now."
							}) }) : null] })]
						})
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Area demand",
					note: "Where tests are being requested, and how many finish.",
					children: /* @__PURE__ */ jsxs(Card, { children: [data.hotspots.map((h) => /* @__PURE__ */ jsxs("div", {
						className: "mb-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "mb-1 flex justify-between text-xs font-semibold text-slate-700",
							children: [/* @__PURE__ */ jsxs("span", { children: [
								h.area,
								" · ",
								h.tests,
								" tests · ",
								h.completionRate,
								"% done"
							] }), /* @__PURE__ */ jsxs("span", {
								className: "text-slate-500",
								children: [
									h.perDay,
									"/day · ₹",
									h.revenue.toLocaleString("en-IN")
								]
							})]
						}), /* @__PURE__ */ jsx(Bar, {
							value: h.tests,
							total: maxHotspot,
							color: "#0D9488"
						})]
					}, h.area)), data.hotspots.length === 0 ? /* @__PURE__ */ jsx("div", {
						className: "text-xs text-slate-500",
						children: "No area data yet."
					}) : null] })
				}),
				/* @__PURE__ */ jsxs(Section, {
					title: "Technician performance",
					children: [/* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Technician"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Tests"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Done"
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
										children: "Reports filed"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Avg time"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Rating"
									})
								] })
							}), /* @__PURE__ */ jsxs("tbody", { children: [data.technicians.map((t) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsxs("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: [t.name, /* @__PURE__ */ jsx("div", {
											className: "text-[10px] text-slate-500",
											children: [
												t.org,
												t.area,
												t.topTest ? label(t.topTest) : null
											].filter(Boolean).join(" · ")
										})]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.tests
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
										className: "px-3 py-2",
										children: t.lateArrivals
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.reliability == null ? "—" : `${t.reliability}%`
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.reportRate == null ? "—" : `${t.reportRate}%`
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: t.avgTurnaroundMin == null ? "—" : `${t.avgTurnaroundMin} min`
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "px-3 py-2",
										children: [t.avgRating == null ? "—" : `★ ${t.avgRating}`, t.reviews ? /* @__PURE__ */ jsxs("span", {
											className: "text-[10px] text-slate-500",
											children: [
												" (",
												t.reviews,
												")"
											]
										}) : null]
									})
								]
							}, t.id)), data.technicians.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 9,
								className: "px-3 py-6 text-center text-slate-500",
								children: "No technician activity in this window."
							}) }) : null] })]
						})
					}), data.idleTechnicians.length ? /* @__PURE__ */ jsxs(Card, {
						className: "mt-3",
						children: [/* @__PURE__ */ jsx("div", {
							className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
							children: "No tests in this window"
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-1 text-xs text-slate-600",
							children: data.idleTechnicians.map((t) => `${t.name}${t.area ? ` (${t.area})` : ""}${t.active ? "" : " — inactive"}`).join(" · ")
						})]
					}) : null]
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Patient feedback",
					children: /* @__PURE__ */ jsxs(Card, { children: [
						/* @__PURE__ */ jsxs("div", {
							className: "mb-2 text-xs font-semibold text-slate-700",
							children: [
								data.feedback.count,
								" reviews · average ",
								data.feedback.avgRating == null ? "—" : `★ ${data.feedback.avgRating}`
							]
						}),
						data.feedback.recent.map((f) => /* @__PURE__ */ jsxs("div", {
							className: "border-t border-slate-100 py-2 text-xs",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "font-semibold text-slate-800",
								children: [
									f.technician,
									" · ★ ",
									f.rating,
									/* @__PURE__ */ jsx("span", {
										className: "ml-2 font-normal text-slate-500",
										children: when(f.createdAt)
									})
								]
							}), f.comment ? /* @__PURE__ */ jsx("div", {
								className: "text-slate-600",
								children: f.comment
							}) : null]
						}, f.id)),
						data.feedback.count === 0 ? /* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-500",
							children: "No reviews yet."
						}) : null
					] })
				})
			] })]
		})
	});
}
//#endregion
export { TechnicianControlRoom as component };
