import { n as supabase } from "./client-BSmVQfT1.js";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/provider.earnings.tsx?tsr-split=component
var startOfDay = () => {
	const d = /* @__PURE__ */ new Date();
	d.setHours(0, 0, 0, 0);
	return d;
};
var startOfWeek = () => {
	const d = startOfDay();
	d.setDate(d.getDate() - d.getDay());
	return d;
};
var startOfMonth = () => {
	const d = startOfDay();
	d.setDate(1);
	return d;
};
function money(n) {
	return `₹${n.toLocaleString("en-IN")}`;
}
function Stat({ label, value, sub, color }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
				children: label
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-1 text-2xl font-extrabold",
				style: { color: color ?? "#0f172a" },
				children: value
			}),
			sub && /* @__PURE__ */ jsx("div", {
				className: "mt-0.5 text-[11px] text-slate-500",
				children: sub
			})
		]
	});
}
function ProviderEarnings() {
	const [uid, setUid] = useState(null);
	const [ready, setReady] = useState(false);
	const [care, setCare] = useState([]);
	const [surgery, setSurgery] = useState([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		supabase.auth.getUser().then(({ data }) => {
			setUid(data.user?.id ?? null);
			setReady(true);
		});
	}, []);
	useEffect(() => {
		if (!ready || !uid) {
			setLoading(false);
			return;
		}
		let mounted = true;
		(async () => {
			setLoading(true);
			const [cr, sr] = await Promise.all([supabase.from("care_requests").select("id,status,amount,fare,completed_at,cancelled_at,accepted_at,rating_patient,specialty").eq("accepted_by", uid).order("accepted_at", { ascending: false }).limit(500), supabase.from("surgery_booking_roles").select("id,status,role,completed_at,accepted_at,rating_hub").eq("assigned_to", uid).order("accepted_at", { ascending: false }).limit(500)]);
			if (!mounted) return;
			setCare(cr.data ?? []);
			setSurgery(sr.data ?? []);
			setLoading(false);
		})();
		return () => {
			mounted = false;
		};
	}, [uid, ready]);
	const metrics = useMemo(() => {
		const now = /* @__PURE__ */ new Date();
		const day = startOfDay(), week = startOfWeek(), month = startOfMonth();
		const completed = care.filter((r) => r.status === "completed" && r.completed_at);
		const surgeryCompleted = surgery.filter((r) => r.status === "accepted" && r.completed_at);
		const priceOf = (r) => Number(r.amount ?? r.fare ?? 0);
		const earnIn = (from) => completed.filter((r) => r.completed_at && new Date(r.completed_at) >= from).reduce((s, r) => s + priceOf(r), 0);
		const today = earnIn(day);
		const weekE = earnIn(week);
		const monthE = earnIn(month);
		const total = completed.reduce((s, r) => s + priceOf(r), 0);
		const jobsToday = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= day).length;
		const jobsWeek = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= week).length;
		const jobsMonth = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= month).length;
		const jobsTotal = completed.length + surgeryCompleted.length;
		const cancelledAfterAccept = care.filter((r) => r.status === "cancelled" && r.accepted_at).length;
		const acceptedTotal = care.filter((r) => r.accepted_at).length;
		const completionRate = acceptedTotal ? Math.round(completed.length / acceptedTotal * 100) : 0;
		const ratings = [...care.map((r) => r.rating_patient).filter((v) => typeof v === "number"), ...surgery.map((r) => r.rating_hub).filter((v) => typeof v === "number")];
		const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
		const pending = completed.filter((r) => r.completed_at && new Date(r.completed_at) >= week).reduce((s, r) => s + priceOf(r), 0);
		const recentRatings = [...ratings].slice(-20);
		return {
			today,
			weekE,
			monthE,
			total,
			jobsToday,
			jobsWeek,
			jobsMonth,
			jobsTotal,
			completionRate,
			acceptedTotal,
			cancelledAfterAccept,
			avgRating,
			ratingCount: ratings.length,
			recentRatings,
			pending,
			now
		};
	}, [care, surgery]);
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
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-6 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-2xl font-extrabold text-slate-900",
					children: "Provider Earnings"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-slate-600",
					children: "Your jobs, ratings and payout status at a glance."
				})] }), /* @__PURE__ */ jsx(Link, {
					to: "/",
					className: "text-sm font-semibold text-teal-700 hover:underline",
					children: "← Back to app"
				})]
			}), !ready ? null : !uid ? /* @__PURE__ */ jsx("div", {
				className: "rounded-2xl bg-white p-8 text-center text-sm text-slate-500",
				children: "Sign in as a provider to view earnings."
			}) : loading ? /* @__PURE__ */ jsx("div", {
				className: "rounded-2xl bg-white p-8 text-center text-sm text-slate-500",
				children: "Loading…"
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Earnings"
					}), /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Today",
								value: money(metrics.today),
								sub: `${metrics.jobsToday} job${metrics.jobsToday === 1 ? "" : "s"}`,
								color: "#059669"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "This week",
								value: money(metrics.weekE),
								sub: `${metrics.jobsWeek} job${metrics.jobsWeek === 1 ? "" : "s"}`,
								color: "#0D9488"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "This month",
								value: money(metrics.monthE),
								sub: `${metrics.jobsMonth} job${metrics.jobsMonth === 1 ? "" : "s"}`,
								color: "#4F46E5"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Lifetime",
								value: money(metrics.total),
								sub: `${metrics.jobsTotal} completed`,
								color: "#0f172a"
							})
						]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Performance"
					}), /* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
						children: [
							/* @__PURE__ */ jsx(Stat, {
								label: "Completed jobs",
								value: metrics.jobsTotal,
								sub: `${care.filter((r) => r.status === "completed").length} care + ${surgery.filter((r) => r.status === "accepted" && r.completed_at).length} surgery`,
								color: "#059669"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Acceptance rate",
								value: `${metrics.completionRate}%`,
								sub: `${metrics.acceptedTotal} accepted · ${metrics.cancelledAfterAccept} cancelled`,
								color: "#4F46E5"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Average rating",
								value: metrics.ratingCount ? `${metrics.avgRating.toFixed(1)} ★` : "—",
								sub: `${metrics.ratingCount} rating${metrics.ratingCount === 1 ? "" : "s"}`,
								color: "#B45309"
							}),
							/* @__PURE__ */ jsx(Stat, {
								label: "Pending payout",
								value: money(metrics.pending),
								sub: "Settles at end of week",
								color: "#DC2626"
							})
						]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "mb-2 text-sm font-bold uppercase tracking-wide text-slate-600",
						children: "Recent completed jobs"
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
										children: "Amount"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "px-3 py-2 text-left",
										children: "Rating"
									})
								] })
							}), /* @__PURE__ */ jsx("tbody", {
								className: "divide-y divide-slate-100",
								children: care.filter((r) => r.status === "completed").slice(0, 15).length === 0 && surgery.filter((r) => r.completed_at).slice(0, 15).length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
									colSpan: 4,
									className: "px-3 py-6 text-center text-slate-500",
									children: "No completed jobs yet."
								}) }) : [...care.filter((r) => r.status === "completed").map((r) => ({
									id: `c:${r.id}`,
									when: r.completed_at,
									label: r.specialty,
									amount: Number(r.amount ?? r.fare ?? 0),
									rating: r.rating_patient
								})), ...surgery.filter((r) => r.status === "accepted" && r.completed_at).map((r) => ({
									id: `s:${r.id}`,
									when: r.completed_at,
									label: `Surgery · ${r.role}`,
									amount: 0,
									rating: r.rating_hub
								}))].sort((a, b) => (a.when ?? "") < (b.when ?? "") ? 1 : -1).slice(0, 20).map((r) => /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-500",
										children: r.when ? new Date(r.when).toLocaleString([], {
											day: "2-digit",
											month: "short",
											hour: "2-digit",
											minute: "2-digit"
										}) : "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 font-semibold text-slate-800 capitalize",
										children: r.label
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-700",
										children: r.amount ? money(r.amount) : "—"
									}),
									/* @__PURE__ */ jsx("td", {
										className: "px-3 py-2 text-slate-600",
										children: r.rating ? `${r.rating} ★` : "—"
									})
								] }, r.id))
							})]
						})
					})]
				})
			] })]
		})]
	});
}
//#endregion
export { ProviderEarnings as component };
