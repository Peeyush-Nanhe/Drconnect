import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
//#region src/lib/homecare-admin.functions.ts
/** Admins and technicians may monitor the home-care board. */
/**
* Combined monitoring board: home physiotherapy positions/visits and
* home care (visiting) doctors — bookings plus who is available.
*/
var getHomeCareBoard = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).inputValidator((d) => ({ days: Math.min(Math.max(Number(d?.days ?? 30), 1), 365) })).handler(createSsrRpc("1962e4c6b9fcbdda78d80acb09be63968fa7628913fc8aa90a2be99d11be7c67"));
//#endregion
//#region src/routes/admin.homecare.tsx?tsr-split=component
function Card({ children, className = "" }) {
	return /* @__PURE__ */ jsx("div", {
		className: `rounded-2xl border border-slate-200 bg-white p-4 ${className}`,
		children
	});
}
function Stat({ label, value, color }) {
	return /* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("div", {
		className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
		children: label
	}), /* @__PURE__ */ jsx("div", {
		className: "mt-1 text-2xl font-extrabold",
		style: { color: color ?? "#0f172a" },
		children: value
	})] });
}
function fmt(iso) {
	if (!iso) return "—";
	return new Date(iso).toLocaleString("en-IN", {
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
		hour12: true
	});
}
function Dot({ on }) {
	return /* @__PURE__ */ jsx("span", { style: {
		display: "inline-block",
		width: 8,
		height: 8,
		borderRadius: 99,
		background: on === null ? "#CBD5E1" : on ? "#16A34A" : "#94A3B8",
		marginRight: 6
	} });
}
function HomeCareBoardPage() {
	const fetchData = useServerFn(getHomeCareBoard);
	const { data, isLoading, error, refetch, isFetching } = useQuery({
		queryKey: ["homecare-board"],
		queryFn: () => fetchData({ data: { days: 30 } }),
		refetchInterval: 15e3
	});
	return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen px-4 py-8",
		style: {
			background: "#EDE9FE",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-6xl",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-5 flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx(Link, {
						to: "/admin",
						className: "text-xs font-semibold text-violet-700 hover:underline",
						children: "← Admin console"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "text-2xl font-extrabold text-slate-900",
						children: "Home Care Board"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "Physiotherapy positions and visiting doctors: bookings, attendance and availability."
					})
				] }), /* @__PURE__ */ jsx("button", {
					onClick: () => refetch(),
					className: "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm",
					children: isFetching ? "Refreshing…" : "Refresh"
				})]
			}), error ? /* @__PURE__ */ jsx(Card, {
				className: "text-sm text-rose-700",
				children: error.message.includes("Forbidden") ? "This board is open to administrators and technicians only." : `Could not load: ${error.message}`
			}) : isLoading || !data ? /* @__PURE__ */ jsx(Card, {
				className: "p-8 text-center text-sm text-slate-500",
				children: "Loading…"
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4",
					children: [
						/* @__PURE__ */ jsx(Stat, {
							label: "Physio visits (30d)",
							value: data.totals.physioVisits,
							color: "#7C3AED"
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Physio upcoming",
							value: data.totals.physioUpcoming,
							color: "#2563EB"
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Therapists active",
							value: data.totals.therapistsActive,
							color: "#0D9488"
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Doctor bookings",
							value: data.totals.doctorBookings
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Doctor upcoming",
							value: data.totals.doctorUpcoming,
							color: "#2563EB"
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Doctors on duty",
							value: data.totals.doctorsOnDuty,
							color: "#16A34A"
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Home care plans",
							value: data.totals.homeCarePlans,
							color: "#BE185D"
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Physio completed",
							value: data.totals.physioCompleted,
							color: "#16A34A"
						})
					]
				}),
				/* @__PURE__ */ jsxs(Card, {
					className: "mb-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Physiotherapy positions & visits"
					}), /* @__PURE__ */ jsx("div", {
						className: "overflow-x-auto",
						children: /* @__PURE__ */ jsxs("table", {
							className: "w-full text-left text-xs",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "When"
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
										children: "Patient"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Therapist"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Status"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2",
										children: "Attendance"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", { children: data.physioVisits.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 7,
								className: "px-3 py-6 text-center text-slate-400",
								children: "No physiotherapy visits in this period."
							}) }) : data.physioVisits.map((v) => /* @__PURE__ */ jsxs("tr", {
								className: "border-t border-slate-100",
								children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: fmt(v.scheduledAt ?? v.createdAt)
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: v.therapyType
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: [v.area, v.city].filter(Boolean).join(", ")
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: v.patientName ?? "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: v.therapistName ?? /* @__PURE__ */ jsx("span", {
											className: "text-amber-600 font-semibold",
											children: "Unassigned"
										})
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: v.status
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: v.noShow ? /* @__PURE__ */ jsx("span", {
											className: "font-bold text-rose-600",
											children: "No show"
										}) : v.checkedOut ? "Finished" : v.checkedIn ? "In progress" : "—"
									})
								]
							}, v.id)) })]
						})
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2",
					children: [/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Therapist availability"
					}), /* @__PURE__ */ jsx("div", {
						className: "space-y-2",
						children: data.therapists.length === 0 ? /* @__PURE__ */ jsx("p", {
							className: "py-4 text-center text-sm text-slate-400",
							children: "No therapists on record."
						}) : data.therapists.map((t) => /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-0",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
								className: "font-bold text-slate-800",
								children: [/* @__PURE__ */ jsx(Dot, { on: t.online }), t.name]
							}), /* @__PURE__ */ jsxs("div", {
								className: "text-slate-500",
								children: [
									[t.area, t.city].filter(Boolean).join(", "),
									t.partnerName ? ` · ${t.partnerName}` : "",
									t.verified ? " · verified" : " · unverified"
								]
							})] }), /* @__PURE__ */ jsxs("div", {
								className: "text-right text-slate-600",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "font-bold",
									children: [t.upcoming, " upcoming"]
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-slate-400",
									children: [t.completed, " done"]
								})]
							})]
						}, t.id))
					})] }), /* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Home care doctors on duty"
					}), /* @__PURE__ */ jsx("div", {
						className: "space-y-2",
						children: data.doctorRoster.length === 0 ? /* @__PURE__ */ jsx("p", {
							className: "py-4 text-center text-sm text-slate-400",
							children: "No visiting doctors with bookings yet."
						}) : data.doctorRoster.map((d) => /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between border-b border-slate-100 pb-2 text-xs last:border-0",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
								className: "font-bold text-slate-800",
								children: [/* @__PURE__ */ jsx(Dot, { on: d.online }), d.name]
							}), /* @__PURE__ */ jsx("div", {
								className: "text-slate-500",
								children: d.acceptingHomeVisits === false ? "Not accepting visits" : "Accepting visits"
							})] }), /* @__PURE__ */ jsxs("div", {
								className: "text-right text-slate-600",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "font-bold",
									children: [d.upcoming, " upcoming"]
								}), /* @__PURE__ */ jsxs("div", {
									className: "text-slate-400",
									children: [d.completed, " done"]
								})]
							})]
						}, d.id))
					})] })]
				}),
				/* @__PURE__ */ jsxs(Card, { children: [/* @__PURE__ */ jsx("h2", {
					className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
					children: "Home care doctor bookings"
				}), /* @__PURE__ */ jsx("div", {
					className: "overflow-x-auto",
					children: /* @__PURE__ */ jsxs("table", {
						className: "w-full text-left text-xs",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "When"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Speciality"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Patient"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Doctor"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Status"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2",
									children: "Amount"
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", { children: data.doctorBookings.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
							colSpan: 6,
							className: "px-3 py-6 text-center text-slate-400",
							children: "No doctor bookings in this period."
						}) }) : data.doctorBookings.map((b) => /* @__PURE__ */ jsxs("tr", {
							className: "border-t border-slate-100",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-slate-600",
									children: fmt(b.scheduledFor ?? b.createdAt)
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 font-semibold text-slate-800",
									children: b.specialty
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-slate-600",
									children: b.patientName ?? "—"
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-slate-600",
									children: b.doctorName ?? "—"
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-slate-600",
									children: b.status
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-slate-600",
									children: b.amount != null ? `₹${b.amount}` : "—"
								})
							]
						}, b.id)) })]
					})
				})] })
			] })]
		})
	});
}
//#endregion
export { HomeCareBoardPage as component };
