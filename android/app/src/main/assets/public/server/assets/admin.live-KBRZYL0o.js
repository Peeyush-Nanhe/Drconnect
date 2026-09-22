import { A as useAdminStats, M as useLiveCareRequests, N as useLiveCommunityRequests, j as useLiveCareProgramBookings } from "./backend-eXdx240h.js";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/admin.live.tsx?tsr-split=component
var PROGRAM_LABEL = {
	assistive_living: "Assistive Living",
	rehab: "Rehab",
	ivf_fertility: "IVF / Fertility",
	weight_management: "Weight Mgmt"
};
var COMMUNITY_LABEL = {
	society_shield: "Society Shield",
	insurance_benefit: "Insurance Benefit",
	corporate_health: "Corporate Health"
};
function Stat({ label, value, color }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-2xl border border-slate-200 bg-white p-4",
		children: [/* @__PURE__ */ jsx("div", {
			className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
			children: label
		}), /* @__PURE__ */ jsx("div", {
			className: "mt-1 text-2xl font-extrabold",
			style: { color: color ?? "#0f172a" },
			children: value
		})]
	});
}
function LiveAdmin() {
	const { stats, loading } = useAdminStats();
	const { rows } = useLiveCareRequests();
	const { rows: programRows } = useLiveCareProgramBookings(25);
	const { rows: communityRows } = useLiveCommunityRequests(25);
	const programCounts = programRows.reduce((acc, r) => {
		acc[r.program] = (acc[r.program] ?? 0) + 1;
		return acc;
	}, {});
	const communityCounts = communityRows.reduce((acc, r) => {
		acc[r.type] = (acc[r.type] ?? 0) + 1;
		return acc;
	}, {});
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
					className: "mb-6 flex items-center justify-between",
					children: [/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(Link, {
							to: "/admin",
							className: "text-xs font-semibold text-teal-700 hover:underline",
							children: "← Admin console"
						}),
						/* @__PURE__ */ jsx("h1", {
							className: "text-2xl font-extrabold text-slate-900",
							children: "Live Admin"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-slate-600",
							children: "Real numbers, straight from the database, updating in real time."
						})
					] }), /* @__PURE__ */ jsxs("div", {
						className: "flex gap-3",
						children: [
							/* @__PURE__ */ jsx(Link, {
								to: "/admin/wellness",
								className: "inline-flex items-center rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700",
								children: "Wellness console →"
							}),
							/* @__PURE__ */ jsx(Link, {
								to: "/admin/users",
								className: "inline-flex items-center rounded-full bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-800",
								children: "Manage users →"
							}),
							/* @__PURE__ */ jsx(Link, {
								to: "/",
								className: "text-sm font-semibold text-teal-700 hover:underline",
								children: "← Back to app"
							})
						]
					})]
				}),
				loading || !stats ? /* @__PURE__ */ jsx("div", {
					className: "rounded-2xl bg-white p-8 text-center text-sm text-slate-500",
					children: "Loading…"
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-6",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
							children: "Users"
						}), /* @__PURE__ */ jsxs("div", {
							className: "grid grid-cols-2 gap-3 sm:grid-cols-5",
							children: [
								/* @__PURE__ */ jsx(Stat, {
									label: "Total",
									value: stats.users.total
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Patients",
									value: stats.users.patient,
									color: "#0D9488"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Providers",
									value: stats.users.provider,
									color: "#4F46E5"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Facilities",
									value: stats.users.facility,
									color: "#B45309"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Admins",
									value: stats.users.admin,
									color: "#DC2626"
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mb-6",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
							children: "Care Requests"
						}), /* @__PURE__ */ jsxs("div", {
							className: "grid grid-cols-2 gap-3 sm:grid-cols-5",
							children: [
								/* @__PURE__ */ jsx(Stat, {
									label: "Total",
									value: stats.requests.total
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Open",
									value: stats.requests.open,
									color: "#0D9488"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Accepted",
									value: stats.requests.accepted,
									color: "#4F46E5"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Completed",
									value: stats.requests.completed,
									color: "#059669"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Cancelled",
									value: stats.requests.cancelled,
									color: "#94a3b8"
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mb-6",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
							children: "Facilities"
						}), /* @__PURE__ */ jsx("div", {
							className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
							children: /* @__PURE__ */ jsx(Stat, {
								label: "Hubs",
								value: stats.hubs,
								color: "#0891B2"
							})
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mb-6",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
							children: "Care Programs"
						}), /* @__PURE__ */ jsxs("div", {
							className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
							children: [
								/* @__PURE__ */ jsx(Stat, {
									label: "Assistive Living",
									value: programCounts.assistive_living ?? 0,
									color: "#EA580C"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Rehab",
									value: programCounts.rehab ?? 0,
									color: "#4F46E5"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "IVF / Fertility",
									value: programCounts.ivf_fertility ?? 0,
									color: "#DB2777"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Weight Mgmt",
									value: programCounts.weight_management ?? 0,
									color: "#16A34A"
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mb-6",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
							children: "Community"
						}), /* @__PURE__ */ jsxs("div", {
							className: "grid grid-cols-2 gap-3 sm:grid-cols-3",
							children: [
								/* @__PURE__ */ jsx(Stat, {
									label: "Society Shield",
									value: communityCounts.society_shield ?? 0,
									color: "#0D9488"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Insurance Benefit",
									value: communityCounts.insurance_benefit ?? 0,
									color: "#B45309"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Corporate Health",
									value: communityCounts.corporate_health ?? 0,
									color: "#0891B2"
								})
							]
						})]
					})
				] }),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Latest Care Program Bookings"
					}), /* @__PURE__ */ jsx("div", {
						className: "overflow-hidden rounded-2xl border border-slate-200 bg-white",
						children: /* @__PURE__ */ jsxs("table", {
							className: "min-w-full text-sm",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "When"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Program"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Tier / Summary"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Fee"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Status"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", {
								className: "divide-y divide-slate-100",
								children: programRows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
									colSpan: 5,
									className: "px-3 py-6 text-center text-slate-500",
									children: "No program bookings yet."
								}) }) : programRows.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-500",
										children: new Date(r.created_at).toLocaleTimeString()
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: PROGRAM_LABEL[r.program] ?? r.program
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: r.summary || r.tier || "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: r.fee != null ? `₹${r.fee}` : "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-xs text-slate-500",
										children: r.status
									})
								] }, r.id))
							})]
						})
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Latest Community Requests"
					}), /* @__PURE__ */ jsx("div", {
						className: "overflow-hidden rounded-2xl border border-slate-200 bg-white",
						children: /* @__PURE__ */ jsxs("table", {
							className: "min-w-full text-sm",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "When"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Type"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Contact"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Status"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", {
								className: "divide-y divide-slate-100",
								children: communityRows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
									colSpan: 4,
									className: "px-3 py-6 text-center text-slate-500",
									children: "No community requests yet."
								}) }) : communityRows.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-500",
										children: new Date(r.created_at).toLocaleTimeString()
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold text-slate-800",
										children: COMMUNITY_LABEL[r.type] ?? r.type
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: r.contact_name || r.contact_phone || "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-xs text-slate-500",
										children: r.status
									})
								] }, r.id))
							})]
						})
					})]
				}),
				/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
					children: "Live Request Feed"
				}), /* @__PURE__ */ jsx("div", {
					className: "overflow-hidden rounded-2xl border border-slate-200 bg-white",
					children: /* @__PURE__ */ jsxs("table", {
						className: "min-w-full text-sm",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 text-left",
									children: "When"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 text-left",
									children: "Specialty"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 text-left",
									children: "Emergency"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 text-left",
									children: "Status"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "px-3 py-2 text-left",
									children: "Accepted by"
								})
							] })
						}), /* @__PURE__ */ jsx("tbody", {
							className: "divide-y divide-slate-100",
							children: rows.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								colSpan: 5,
								className: "px-3 py-6 text-center text-slate-500",
								children: "No requests yet. Create one from the Patient view — it will show up here instantly."
							}) }) : rows.map((r) => /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-slate-500",
									children: new Date(r.created_at).toLocaleTimeString()
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 font-semibold text-slate-800",
									children: r.specialty
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: r.emergency ? /* @__PURE__ */ jsx("span", {
										className: "rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700",
										children: "EMERGENCY"
									}) : /* @__PURE__ */ jsx("span", {
										className: "text-slate-400",
										children: "—"
									})
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2",
									children: /* @__PURE__ */ jsx("span", {
										className: "rounded-full px-2 py-0.5 text-[11px] font-bold",
										style: {
											background: r.status === "open" ? "#ccfbf1" : r.status === "accepted" ? "#e0e7ff" : r.status === "completed" ? "#d1fae5" : "#f1f5f9",
											color: r.status === "open" ? "#0f766e" : r.status === "accepted" ? "#3730a3" : r.status === "completed" ? "#065f46" : "#64748b"
										},
										children: r.status
									})
								}),
								/* @__PURE__ */ jsx("td", {
									className: "px-3 py-2 text-xs text-slate-500",
									children: r.accepted_by ? r.accepted_by.slice(0, 8) + "…" : "—"
								})
							] }, r.id))
						})]
					})
				})] })
			]
		})]
	});
}
//#endregion
export { LiveAdmin as component };
