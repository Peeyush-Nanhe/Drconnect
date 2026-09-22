import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as MW_TRACKS } from "./mw-tracks-C37nJNdv.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
//#region src/lib/mw-admin.functions.ts
var getWellnessAdminOverview = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 90), 1), 365) })).handler(createSsrRpc("756c92b328e42c607c90caedc35d7e819b0846f0bca867a4775dfc7c0439a977"));
//#endregion
//#region src/routes/admin.wellness.tsx?tsr-split=component
var TRACK_LABEL = Object.fromEntries(MW_TRACKS.map((t) => [t.id, t.label]));
var BAND_TONE = {
	Minimal: "#16A34A",
	Mild: "#65A30D",
	Moderate: "#D97706",
	"Moderately severe": "#EA580C",
	Severe: "#DC2626"
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
function WellnessAdminPage() {
	const [days, setDays] = useState(90);
	const fetchOverview = useServerFn(getWellnessAdminOverview);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["mw-admin-overview", days],
		queryFn: () => fetchOverview({ data: { days } }),
		retry: false
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
						children: "Wellness Console"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "Screening scores, provider performance, care-team SLA and patient trends."
					})
				] }), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [
						/* @__PURE__ */ jsx("div", {
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
						}),
						/* @__PURE__ */ jsx("button", {
							onClick: () => refetch(),
							className: "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm",
							children: isFetching ? "Refreshing…" : "Refresh"
						}),
						/* @__PURE__ */ jsx(Link, {
							to: "/admin/live",
							className: "text-sm font-semibold text-teal-700 hover:underline",
							children: "Live admin"
						}),
						/* @__PURE__ */ jsx(Link, {
							to: "/",
							className: "text-sm font-semibold text-teal-700 hover:underline",
							children: "← App"
						})
					]
				})]
			}), error ? /* @__PURE__ */ jsx(Card, {
				className: "text-sm text-rose-700",
				children: error.message.includes("Forbidden") ? "This console is restricted to administrators." : `Could not load: ${error.message}`
			}) : isLoading || !data ? /* @__PURE__ */ jsx(Card, {
				className: "p-8 text-center text-sm text-slate-500",
				children: "Loading…"
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx(Section, {
					title: "Overview",
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-6",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Care teams",
								value: data.totals.teams
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Urgent",
								value: data.totals.urgent,
								color: "#DC2626"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Safety flags",
								value: data.totals.redFlag,
								color: "#EA580C"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Review flags",
								value: data.totals.reviewFlag,
								color: "#D97706"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "No coordinator",
								value: data.totals.unassigned,
								color: "#4F46E5"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Measurements",
								value: data.totals.measurements,
								color: "#0D9488"
							})
						]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Tracks & status",
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid gap-3 md:grid-cols-3",
						children: [
							/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
								className: "mb-2 text-xs font-bold text-slate-700",
								children: "By track"
							}), Object.entries(data.totals.byTrack).length === 0 ? /* @__PURE__ */ jsx("div", {
								className: "text-xs text-slate-400",
								children: "No teams yet."
							}) : Object.entries(data.totals.byTrack).map(([k, v]) => /* @__PURE__ */ jsxs("div", {
								className: "mb-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex justify-between text-xs text-slate-600",
									children: [/* @__PURE__ */ jsx("span", { children: TRACK_LABEL[k] ?? k }), /* @__PURE__ */ jsx("span", {
										className: "font-semibold",
										children: v
									})]
								}), /* @__PURE__ */ jsx(Bar, {
									value: v,
									total: data.totals.teams,
									color: "#4F46E5"
								})]
							}, k))] }),
							/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
								className: "mb-2 text-xs font-bold text-slate-700",
								children: "By status"
							}), Object.entries(data.totals.byStatus).map(([k, v]) => /* @__PURE__ */ jsxs("div", {
								className: "mb-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex justify-between text-xs text-slate-600",
									children: [/* @__PURE__ */ jsx("span", {
										className: "capitalize",
										children: k.replace(/_/g, " ")
									}), /* @__PURE__ */ jsx("span", {
										className: "font-semibold",
										children: v
									})]
								}), /* @__PURE__ */ jsx(Bar, {
									value: v,
									total: data.totals.teams,
									color: "#0D9488"
								})]
							}, k))] }),
							/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
								className: "mb-2 text-xs font-bold text-slate-700",
								children: "First appointment modality"
							}), Object.entries(data.totals.byModality).map(([k, v]) => /* @__PURE__ */ jsxs("div", {
								className: "mb-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex justify-between text-xs text-slate-600",
									children: [/* @__PURE__ */ jsx("span", {
										className: "capitalize",
										children: k.replace(/_/g, " ")
									}), /* @__PURE__ */ jsx("span", {
										className: "font-semibold",
										children: v
									})]
								}), /* @__PURE__ */ jsx(Bar, {
									value: v,
									total: data.totals.teams,
									color: "#DB2777"
								})]
							}, k))] })
						]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "SLA compliance",
					note: "First contact target: 4 working hours. Full team assembly target: 48 hours.",
					children: /* @__PURE__ */ jsx("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [{
							label: "First contact",
							s: data.sla.firstContact
						}, {
							label: "Team assembly",
							s: data.sla.assembly
						}].map(({ label, s }) => {
							const total = s.met + s.breached + s.pending || 1;
							return /* @__PURE__ */ jsxs(Card, { children: [
								/* @__PURE__ */ jsxs("div", {
									className: "mb-2 flex items-baseline justify-between",
									children: [/* @__PURE__ */ jsx("div", {
										className: "text-xs font-bold text-slate-700",
										children: label
									}), /* @__PURE__ */ jsxs("div", {
										className: "text-xs text-slate-500",
										children: [Math.round(s.met / total * 100), "% on time"]
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "flex h-2 overflow-hidden rounded-full bg-slate-100",
									children: [
										/* @__PURE__ */ jsx("div", { style: {
											width: `${s.met / total * 100}%`,
											background: "#16A34A"
										} }),
										/* @__PURE__ */ jsx("div", { style: {
											width: `${s.breached / total * 100}%`,
											background: "#DC2626"
										} }),
										/* @__PURE__ */ jsx("div", { style: {
											width: `${s.pending / total * 100}%`,
											background: "#CBD5E1"
										} })
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-2 grid grid-cols-3 gap-2 text-center text-[11px]",
									children: [
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
											className: "font-bold text-emerald-600",
											children: s.met
										}), "on time"] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
											className: "font-bold text-rose-600",
											children: s.breached
										}), "breached"] }),
										/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
											className: "font-bold text-slate-500",
											children: s.pending
										}), "in window"] })
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-2 text-[11px] text-slate-500",
									children: [
										"Average time taken: ",
										s.avgHours != null ? `${s.avgHours} h` : "—",
										"avgLateHours" in s && s.avgLateHours != null ? ` · average overrun ${s.avgLateHours} h` : ""
									]
								})
							] }, label);
						})
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Screening scores",
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid gap-3 md:grid-cols-3",
						children: [data.scores.instrumentStats.map((i) => /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-baseline justify-between",
								children: [/* @__PURE__ */ jsx("div", {
									className: "text-xs font-bold text-slate-700",
									children: i.instrument
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-[11px] text-slate-500",
									children: [i.measurements, " recorded"]
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-1 text-2xl font-extrabold text-slate-900",
								children: [i.avgScore ?? "—", /* @__PURE__ */ jsx("span", {
									className: "ml-1 text-xs font-semibold text-slate-500",
									children: "avg score"
								})]
							}),
							i.redFlags > 0 && /* @__PURE__ */ jsxs("div", {
								className: "mt-1 text-[11px] font-semibold text-rose-600",
								children: [
									i.redFlags,
									" safety-item endorsement",
									i.redFlags > 1 ? "s" : ""
								]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-2 space-y-1",
								children: Object.entries(i.bands).map(([band, n]) => /* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-2 text-[11px]",
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "w-32 shrink-0 text-slate-600",
											children: band
										}),
										/* @__PURE__ */ jsx(Bar, {
											value: n,
											total: i.measurements,
											color: BAND_TONE[band] ?? "#64748B"
										}),
										/* @__PURE__ */ jsx("span", {
											className: "w-6 text-right font-semibold text-slate-700",
											children: n
										})
									]
								}, band))
							})
						] }, i.instrument)), /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsx("div", {
								className: "text-xs font-bold text-slate-700",
								children: "Outcome direction"
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-1 text-[11px] text-slate-500",
								children: "Teams with two or more measurements, comparing the latest score with the first."
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-3 space-y-2 text-xs",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-emerald-700",
											children: "Improved"
										}), /* @__PURE__ */ jsx("span", {
											className: "font-bold",
											children: data.scores.improved
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-slate-600",
											children: "No change"
										}), /* @__PURE__ */ jsx("span", {
											className: "font-bold",
											children: data.scores.unchanged
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-rose-600",
											children: "Worsened"
										}), /* @__PURE__ */ jsx("span", {
											className: "font-bold",
											children: data.scores.worsened
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "flex justify-between",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-slate-500",
											children: "Only one score so far"
										}), /* @__PURE__ */ jsx("span", {
											className: "font-bold",
											children: data.scores.singleOnly
										})]
									})
								]
							})
						] })]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Patient trends",
					note: "Worst movement first. Patients are shown by case reference only.",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Case"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Track"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Instrument"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "First"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Latest"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Change"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Band"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Scores"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Last taken"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.scores.deltas.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 9,
								className: "px-3 py-6 text-center text-slate-400",
								children: "No measurements recorded yet."
							}) }) : data.scores.deltas.map((d) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsxs("td", {
										className: "px-3 py-2 font-mono text-[11px] text-slate-500",
										children: [d.teamId.slice(0, 8), d.urgent && /* @__PURE__ */ jsx("span", {
											className: "ml-1 text-rose-600",
											children: "●"
										})]
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: TRACK_LABEL[d.track] ?? d.track
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: d.instrument
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: d.first
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold",
										children: d.latest
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-bold",
										style: { color: d.delta > 0 ? "#DC2626" : d.delta < 0 ? "#16A34A" : "#64748B" },
										children: d.delta > 0 ? `+${d.delta}` : d.delta
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										style: { color: BAND_TONE[d.band] ?? "#334155" },
										children: d.band
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: d.points
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-500",
										children: new Date(d.lastAt).toLocaleDateString()
									})
								]
							}, d.teamId)) })]
						})
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Provider performance",
					children: /* @__PURE__ */ jsx(Card, {
						className: "overflow-x-auto p-0",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Provider"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Specialty"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Roles covered"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Assignments"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Confirmed"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Confirm rate"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Avg time to confirm"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Registration"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.providerPerformance.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 8,
								className: "px-3 py-6 text-center text-slate-400",
								children: "No providers assigned to wellness teams yet."
							}) }) : data.providerPerformance.map((p) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: p.name
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: p.specialty ?? "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: p.roles.join(", ")
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: p.assignments
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: p.confirmed
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: /* @__PURE__ */ jsxs("div", {
											className: "flex items-center gap-2",
											children: [/* @__PURE__ */ jsx(Bar, {
												value: p.confirmRate,
												total: 100,
												color: "#0D9488"
											}), /* @__PURE__ */ jsxs("span", {
												className: "w-9 text-right font-semibold",
												children: [p.confirmRate, "%"]
											})]
										})
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: p.avgFillHours != null ? `${p.avgFillHours} h` : "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2",
										children: p.verified ? /* @__PURE__ */ jsx("span", {
											className: "font-semibold text-emerald-600",
											children: "Verified"
										}) : /* @__PURE__ */ jsx("span", {
											className: "font-semibold text-rose-600",
											children: "Unverified"
										})
									})
								]
							}, p.providerId)) })]
						})
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Role coverage",
					note: "Lowest fill rate first — these roles are the assembly bottleneck.",
					children: /* @__PURE__ */ jsxs("div", {
						className: "grid gap-3 md:grid-cols-2",
						children: [/* @__PURE__ */ jsx(Card, { children: data.roleCoverage.length === 0 ? /* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-400",
							children: "No team roles yet."
						}) : data.roleCoverage.map((r) => /* @__PURE__ */ jsxs("div", {
							className: "mb-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between text-xs text-slate-600",
								children: [/* @__PURE__ */ jsxs("span", { children: [r.label, r.required === r.total ? " · required" : ""] }), /* @__PURE__ */ jsxs("span", {
									className: "font-semibold",
									children: [
										r.filled,
										"/",
										r.total
									]
								})]
							}), /* @__PURE__ */ jsx(Bar, {
								value: r.filled,
								total: r.total,
								color: r.fillRate < 50 ? "#DC2626" : "#16A34A"
							})]
						}, r.role)) }), /* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
							className: "mb-2 text-xs font-bold text-slate-700",
							children: "Coordinator load"
						}), data.coordinators.length === 0 ? /* @__PURE__ */ jsx("div", {
							className: "text-xs text-slate-400",
							children: "No cases claimed yet."
						}) : data.coordinators.map((c) => /* @__PURE__ */ jsxs("div", {
							className: "flex justify-between border-b border-slate-100 py-1.5 text-xs last:border-0",
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-slate-700",
								children: c.name
							}), /* @__PURE__ */ jsxs("span", {
								className: "text-slate-500",
								children: [
									c.teams,
									" cases · ",
									c.open,
									" open",
									c.breaches > 0 && /* @__PURE__ */ jsxs("span", {
										className: "ml-1 font-semibold text-rose-600",
										children: [c.breaches, " overdue"]
									})
								]
							})]
						}, c.id))] })]
					})
				}),
				/* @__PURE__ */ jsx(Section, {
					title: "Needs attention",
					children: /* @__PURE__ */ jsx(Card, {
						className: "p-0",
						children: data.attention.length === 0 ? /* @__PURE__ */ jsx("div", {
							className: "p-6 text-center text-xs text-slate-400",
							children: "No overdue, flagged or urgent cases. 🎉"
						}) : data.attention.map((t) => /* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "font-mono text-[11px] text-slate-500",
									children: t.id.slice(0, 8)
								}),
								/* @__PURE__ */ jsx("span", {
									className: "font-semibold text-slate-800",
									children: TRACK_LABEL[t.track] ?? t.track
								}),
								/* @__PURE__ */ jsx("span", {
									className: "text-slate-500",
									children: t.coordinator ?? "unassigned"
								}),
								t.urgent && /* @__PURE__ */ jsx(Chip, {
									tone: "#DC2626",
									children: "Urgent"
								}),
								t.redFlag && /* @__PURE__ */ jsx(Chip, {
									tone: "#EA580C",
									children: "Safety flag"
								}),
								t.reviewFlag && /* @__PURE__ */ jsx(Chip, {
									tone: "#D97706",
									children: "Review"
								}),
								t.firstContactOverdue && /* @__PURE__ */ jsx(Chip, {
									tone: "#DC2626",
									children: "First call overdue"
								}),
								t.assemblyOverdue && /* @__PURE__ */ jsx(Chip, {
									tone: "#B91C1C",
									children: "Assembly overdue"
								}),
								/* @__PURE__ */ jsx("span", {
									className: "ml-auto text-slate-400",
									children: new Date(t.createdAt).toLocaleDateString()
								})
							]
						}, t.id))
					})
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "pb-6 text-[11px] text-slate-500",
					children: [
						"Window: last ",
						data.windowDays,
						" days · generated ",
						new Date(data.generatedAt).toLocaleString()
					]
				})
			] })]
		})
	});
}
function Chip({ children, tone }) {
	return /* @__PURE__ */ jsx("span", {
		className: "rounded-full px-2 py-0.5 text-[10px] font-bold",
		style: {
			background: `${tone}18`,
			color: tone
		},
		children
	});
}
//#endregion
export { WellnessAdminPage as component };
