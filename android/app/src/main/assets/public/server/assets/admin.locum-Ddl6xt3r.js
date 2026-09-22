import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
//#region src/lib/locum-admin.functions.ts
var getLocumAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 90), 1), 365) })).handler(createSsrRpc("1f1630e756fb283827dd4a53f2dc8dad4af1e9f9b43d0508457c74493ab3441c"));
//#endregion
//#region src/routes/admin.locum.tsx?tsr-split=component
var STATE_META = {
	on_duty: {
		label: "On duty",
		color: "#059669"
	},
	en_route: {
		label: "About to go",
		color: "#0284C7"
	},
	scheduled: {
		label: "Scheduled",
		color: "#64748B"
	},
	overdue: {
		label: "Not reported",
		color: "#DC2626"
	},
	absent: {
		label: "Absent",
		color: "#B91C1C"
	},
	completed: {
		label: "Completed",
		color: "#15803D"
	},
	cancelled: {
		label: "Cancelled",
		color: "#94A3B8"
	},
	applied: {
		label: "Applied",
		color: "#7C3AED"
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
function LocumControlRoom() {
	const [days, setDays] = useState(90);
	const fetchOverview = useServerFn(getLocumAdminOverview);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["locum-admin-overview", days],
		queryFn: () => fetchOverview({ data: { days } }),
		retry: false,
		refetchInterval: 6e4
	});
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
						children: "Locum Control Room"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "Care physician duty cover, attendance, hospital demand and feedback."
					})
				] }), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ jsx("div", {
						className: "flex overflow-hidden rounded-full border border-slate-300 bg-white",
						children: [
							30,
							90,
							365
						].map((d) => /* @__PURE__ */ jsx("button", {
							onClick: () => setDays(d),
							className: `px-3 py-1.5 text-xs font-semibold ${days === d ? "bg-teal-700 text-white" : "text-slate-600"}`,
							children: d === 365 ? "1 year" : `${d} days`
						}, d))
					}), /* @__PURE__ */ jsx("button", {
						onClick: () => refetch(),
						className: "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm",
						children: isFetching ? "Refreshing…" : "Refresh"
					})]
				})]
			}), error ? /* @__PURE__ */ jsx(Card, {
				className: "text-sm text-rose-700",
				children: error.message.includes("Forbidden") ? "This console is restricted to administrators." : `Could not load: ${error.message}`
			}) : isLoading || !data ? /* @__PURE__ */ jsx(Card, {
				className: "p-8 text-center text-sm text-slate-500",
				children: "Loading…"
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs(Section, {
					title: "Live duty status",
					note: "Right now, across every hospital using locum cover.",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-6",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "On duty now",
								value: data.live.onDuty,
								color: "#059669"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "About to go",
								value: data.live.enRoute,
								color: "#0284C7",
								sub: "Starting within 6h"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Not reported",
								value: data.live.notCommitted,
								color: "#DC2626",
								sub: "Commitment missed"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Absent today",
								value: data.live.absentToday,
								color: "#B91C1C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Committed today",
								value: data.live.committedToday
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Completed today",
								value: data.live.completedToday,
								color: "#15803D"
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "mt-3 grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
							className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
							children: "Duty mix (committed)"
						}), Object.keys(data.live.dutyMix).length === 0 ? /* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-500",
							children: "No committed duties in this window."
						}) : Object.entries(data.live.dutyMix).sort((a, b) => b[1] - a[1]).map(([duty, n]) => /* @__PURE__ */ jsxs("div", {
							className: "mb-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "mb-1 flex justify-between text-xs font-semibold text-slate-700",
								children: [/* @__PURE__ */ jsx("span", { children: data.dutyLabels[duty] ?? duty }), /* @__PURE__ */ jsx("span", { children: n })]
							}), /* @__PURE__ */ jsx(Bar, {
								value: n,
								total: Object.values(data.live.dutyMix).reduce((a, b) => a + b, 0),
								color: "#4F46E5"
							})]
						}, duty))] }), /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsx("div", {
								className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
								children: "Demand fulfilment"
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "text-3xl font-extrabold text-slate-900",
								children: [data.demand.fillRate, "%"]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-1 text-xs text-slate-500",
								children: [
									data.demand.filled,
									" of ",
									data.demand.slots,
									" requested slots filled ·",
									" ",
									data.demand.hospitalsEnquired,
									" hospitals enquired"
								]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-2",
								children: /* @__PURE__ */ jsx(Bar, {
									value: data.demand.filled,
									total: data.demand.slots,
									color: "#0D9488"
								})
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-3 grid grid-cols-3 gap-2 text-center text-xs",
								children: [
									/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
										className: "text-lg font-extrabold text-slate-900",
										children: data.demand.jobs
									}), /* @__PURE__ */ jsx("div", {
										className: "text-slate-500",
										children: "Requests"
									})] }),
									/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
										className: "text-lg font-extrabold text-amber-600",
										children: data.demand.unfilled
									}), /* @__PURE__ */ jsx("div", {
										className: "text-slate-500",
										children: "Unfilled"
									})] }),
									/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
										className: "text-lg font-extrabold text-rose-600",
										children: data.demand.unfilledUrgent
									}), /* @__PURE__ */ jsx("div", {
										className: "text-slate-500",
										children: "Urgent gaps"
									})] })
								]
							})
						] })]
					})]
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Duty board",
					note: "Sorted by what needs attention first.",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Status"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Care physician"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Hospital"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Duty"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Shift start"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Note"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.board.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								className: "p-4 text-slate-500",
								colSpan: 6,
								children: "No locum assignments in this window."
							}) }) : data.board.map((row) => {
								const meta = STATE_META[row.state] ?? {
									label: row.state,
									color: "#64748B"
								};
								return /* @__PURE__ */ jsxs("tr", {
									className: "border-t border-slate-100",
									children: [
										/* @__PURE__ */ jsx("td", {
											className: "p-3",
											children: /* @__PURE__ */ jsx("span", {
												className: "rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
												style: { background: meta.color },
												children: meta.label
											})
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 font-semibold text-slate-800",
											children: row.provider
										}),
										/* @__PURE__ */ jsxs("td", {
											className: "p-3 text-slate-600",
											children: [row.hospital, row.area ? /* @__PURE__ */ jsxs("span", {
												className: "text-slate-400",
												children: [" · ", row.area]
											}) : null]
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 text-slate-600",
											children: row.dutyLabel
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 text-slate-600",
											children: when(row.startsAt)
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 text-slate-500",
											children: row.minutesLate != null ? `${row.minutesLate} min past start` : row.endsInMinutes != null ? `${row.endsInMinutes} min left` : row.shift || "—"
										})
									]
								}, row.assignmentId);
							}) })]
						})
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Demand hotspots",
					note: "Areas where locum cover is requested most and hardest to fill.",
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsx(Card, {
							className: "overflow-x-auto p-0",
							children: /* @__PURE__ */ jsxs("table", {
								className: "w-full text-left text-xs",
								children: [/* @__PURE__ */ jsx("thead", {
									className: "bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500",
									children: /* @__PURE__ */ jsxs("tr", { children: [
										/* @__PURE__ */ jsx("th", {
											className: "p-3",
											children: "Area"
										}),
										/* @__PURE__ */ jsx("th", {
											className: "p-3",
											children: "Requests"
										}),
										/* @__PURE__ */ jsx("th", {
											className: "p-3",
											children: "Unfilled"
										}),
										/* @__PURE__ */ jsx("th", {
											className: "p-3",
											children: "Fill rate"
										})
									] })
								}), /* @__PURE__ */ jsx("tbody", { children: data.hotspots.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
									className: "p-4 text-slate-500",
									colSpan: 4,
									children: "No demand recorded yet."
								}) }) : data.hotspots.slice(0, 12).map((h) => /* @__PURE__ */ jsxs("tr", {
									className: "border-t border-slate-100",
									children: [
										/* @__PURE__ */ jsxs("td", {
											className: "p-3 font-semibold text-slate-800",
											children: [h.area, h.city ? /* @__PURE__ */ jsxs("span", {
												className: "text-slate-400",
												children: [" · ", h.city]
											}) : null]
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 text-slate-600",
											children: h.jobs
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 font-semibold",
											style: { color: h.unfilled ? "#DC2626" : "#64748B" },
											children: h.unfilled
										}),
										/* @__PURE__ */ jsxs("td", {
											className: "p-3 text-slate-600",
											children: [h.fillRate, "%"]
										})
									]
								}, h.area)) })]
							})
						}), /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsx("div", {
								className: "mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500",
								children: "Hotspot map"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "relative h-64 overflow-hidden rounded-xl bg-slate-100",
								children: (() => {
									const pts = data.hotspots.filter((h) => h.lat != null && h.lng != null);
									if (pts.length === 0) return /* @__PURE__ */ jsx("div", {
										className: "grid h-full place-items-center px-6 text-center text-xs text-slate-500",
										children: "Add hospital locations to plot demand hotspots on the map."
									});
									const lats = pts.map((p) => p.lat);
									const lngs = pts.map((p) => p.lng);
									const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
									const span = (a, b) => b - a || .02;
									const maxUnfilled = Math.max(...pts.map((p) => p.unfilled), 1);
									return pts.map((p) => {
										const x = (p.lng - minLng) / span(minLng, maxLng) * 80 + 10;
										const y = 90 - (p.lat - minLat) / span(minLat, maxLat) * 80;
										const size = 14 + p.unfilled / maxUnfilled * 26;
										return /* @__PURE__ */ jsx("div", {
											title: `${p.area}: ${p.unfilled} unfilled of ${p.slots}`,
											className: "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
											style: {
												left: `${x}%`,
												top: `${y}%`,
												width: size,
												height: size,
												background: p.unfilled ? "rgba(220,38,38,.55)" : "rgba(13,148,136,.5)",
												border: "2px solid #fff"
											}
										}, p.area);
									});
								})()
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-2 text-[11px] text-slate-500",
								children: "Bubble size shows unfilled slots; red means demand is going uncovered."
							})
						] })]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Hospitals enquiring",
					note: "Who is asking for locum cover and how well we serve them.",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Hospital"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Requests"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Slots"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Filled"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Fill rate"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Urgent"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Rating given"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.hospitalDemand.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								className: "p-4 text-slate-500",
								colSpan: 7,
								children: "No hospital enquiries yet."
							}) }) : data.hospitalDemand.map((h) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsx("td", {
										className: "p-3 font-semibold text-slate-800",
										children: h.hospital
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: h.jobs
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: h.slots
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: h.filled
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "p-3",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "mb-1 font-semibold text-slate-700",
											children: [h.fillRate, "%"]
										}), /* @__PURE__ */ jsx(Bar, {
											value: h.filled,
											total: h.slots,
											color: h.fillRate >= 80 ? "#0D9488" : "#F59E0B"
										})]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: h.urgent
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: h.avgRatingGiven ?? "—"
									})
								]
							}, h.facilityId)) })]
						})
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Care physician performance",
					note: "Commitment reliability, hospital ratings and which hospital each doctor prefers.",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Care physician"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Accepted"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Completed"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "No-shows"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Reliability"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Hospital rating"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Rehire"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Prefers"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.providers.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								className: "p-4 text-slate-500",
								colSpan: 8,
								children: "No care physician activity yet."
							}) }) : data.providers.map((p) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsxs("td", {
										className: "p-3 font-semibold text-slate-800",
										children: [p.name, p.topDuty ? /* @__PURE__ */ jsx("div", {
											className: "text-[10px] text-slate-400",
											children: data.dutyLabels[p.topDuty] ?? p.topDuty
										}) : null]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: p.accepted
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: p.completed
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3",
										style: { color: p.noShows ? "#DC2626" : "#64748B" },
										children: p.noShows
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: p.reliability == null ? "—" : `${p.reliability}%`
									}),
									/* @__PURE__ */ jsxs("td", {
										className: "p-3 text-slate-600",
										children: [
											p.avgRating == null ? "—" : `★ ${p.avgRating}`,
											" ",
											/* @__PURE__ */ jsxs("span", {
												className: "text-slate-400",
												children: [
													"(",
													p.reviews,
													")"
												]
											})
										]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: p.rehireRate == null ? "—" : `${p.rehireRate}%`
									}),
									/* @__PURE__ */ jsx("td", {
										className: "p-3 text-slate-600",
										children: p.preferredHospital ?? "—"
									})
								]
							}, p.providerId)) })]
						})
					})
				}),
				/* @__PURE__ */ jsxs(Section, {
					title: "Hospital feedback",
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
								label: "Avg punctuality",
								value: data.feedback.avgPunctuality ?? "—"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Would rehire",
								value: data.feedback.rehireRate == null ? "—" : `${data.feedback.rehireRate}%`,
								color: "#4F46E5"
							})
						]
					}), data.feedback.recent.length === 0 ? /* @__PURE__ */ jsx(Card, {
						className: "text-xs text-slate-500",
						children: "No hospital feedback recorded yet."
					}) : /* @__PURE__ */ jsx("div", {
						className: "grid gap-3 sm:grid-cols-2",
						children: data.feedback.recent.map((f) => /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between text-xs font-semibold text-slate-800",
								children: [/* @__PURE__ */ jsx("span", { children: f.provider }), /* @__PURE__ */ jsxs("span", {
									className: "text-amber-600",
									children: ["★ ", f.rating]
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "text-[11px] text-slate-500",
								children: [
									f.hospital,
									" · ",
									when(f.createdAt)
								]
							}),
							f.comment ? /* @__PURE__ */ jsx("p", {
								className: "mt-2 text-xs text-slate-600",
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
export { LocumControlRoom as component };
