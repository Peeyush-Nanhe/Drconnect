import { n as supabase } from "./client-BSmVQfT1.js";
import { B as useSession } from "./backend-eXdx240h.js";
import { n as HomeVisitPanel, o as TwoWayChatModal } from "./HomeVisitPanel-oPTBOTPN.js";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/bookings.tsx?tsr-split=component
var BG = "#DCE6E1";
var TEAL = "#0D9488";
var INK = "#0F172A";
var STATUS_COLORS = {
	open: {
		bg: "#DBEAFE",
		fg: "#1E40AF"
	},
	pending: {
		bg: "#FEF3C7",
		fg: "#92400E"
	},
	broadcasting: {
		bg: "#EDE9FE",
		fg: "#5B21B6"
	},
	accepted: {
		bg: "#D1FAE5",
		fg: "#065F46"
	},
	confirmed: {
		bg: "#D1FAE5",
		fg: "#065F46"
	},
	in_progress: {
		bg: "#DBEAFE",
		fg: "#1E3A8A"
	},
	booked: {
		bg: "#CCFBF1",
		fg: "#134E4A"
	},
	completed: {
		bg: "#E5E7EB",
		fg: "#374151"
	},
	cancelled: {
		bg: "#FEE2E2",
		fg: "#991B1B"
	},
	declined: {
		bg: "#FEE2E2",
		fg: "#991B1B"
	}
};
function CompletedConsultationChat({ item }) {
	const [open, setOpen] = useState(false);
	const sourceId = item.id.split(":")[1];
	const reference = item.status !== "completed" || !sourceId ? void 0 : item.id.startsWith("cr:") ? {
		source: "care_request",
		sourceId
	} : item.id.startsWith("da:") ? {
		source: "doctor_appointment",
		sourceId
	} : void 0;
	if (!reference) return null;
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
		type: "button",
		onClick: () => setOpen(true),
		"aria-label": "Chat about this completed consultation",
		style: {
			background: "#10B981",
			color: "#fff",
			border: "none",
			borderRadius: 999,
			padding: "5px 12px",
			fontSize: 12,
			fontWeight: 700,
			cursor: "pointer"
		},
		children: "Chat"
	}), open && /* @__PURE__ */ jsx(TwoWayChatModal, {
		reference,
		specialty: item.title,
		onClose: () => setOpen(false)
	})] });
}
function StatusChip({ status }) {
	const s = STATUS_COLORS[status] ?? {
		bg: "#E5E7EB",
		fg: "#374151"
	};
	return /* @__PURE__ */ jsx("span", {
		style: {
			background: s.bg,
			color: s.fg,
			padding: "2px 10px",
			borderRadius: 999,
			fontSize: 11,
			fontWeight: 600,
			textTransform: "capitalize",
			whiteSpace: "nowrap"
		},
		children: status.replace(/_/g, " ")
	});
}
var MODULE_ICON = {
	"Doctor / Nurse": "🩺",
	"Lab / Scan": "🧪",
	"Home Care": "🏠",
	"Care Program": "💚",
	Dialysis: "💧",
	"Medical Tourism": "✈️",
	Prosthetics: "🦿",
	"Special Needs": "🤝",
	"Blood Bank": "🩸",
	Surgery: "🏥",
	Physiotherapy: "🧘"
};
function classifyCareRequest(specialty) {
	const s = specialty.toLowerCase();
	if (/(physio|therap)/.test(s)) return "Physiotherapy";
	if (/(lab|scan|xray|mri|ct|ultrasound|blood test)/.test(s)) return "Lab / Scan";
	if (/(home|nurse|caretaker)/.test(s)) return "Home Care";
	return "Doctor / Nurse";
}
function BookingsPage() {
	const { session, loading: sessionLoading } = useSession();
	const uid = session?.user?.id ?? null;
	const ready = !sessionLoading;
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState("All");
	const [tab, setTab] = useState("upcoming");
	useEffect(() => {
		if (!ready) return;
		if (!uid) {
			setLoading(false);
			return;
		}
		let mounted = true;
		(async () => {
			setLoading(true);
			const [cr, cp, pr, sn, bb, sb, pv] = await Promise.all([
				supabase.from("care_requests").select("id, specialty, status, notes, created_at, visit_type").eq("patient_id", uid).order("created_at", { ascending: false }).limit(200),
				supabase.from("care_program_bookings").select("id, program, tier, summary, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
				supabase.from("prosthetics_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
				supabase.from("special_needs_bookings").select("id, category, subtype, provider_name, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
				supabase.from("blood_bank_activity").select("id, activity_type, blood_group, units, hospital, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100),
				supabase.from("surgery_bookings").select("id, procedure, patient_name, mode, status, created_at").eq("facility_id", uid).order("created_at", { ascending: false }).limit(100),
				supabase.from("physio_visits").select("id, therapy_type, area, city, scheduled_at, session_number, status, created_at").eq("patient_id", uid).order("created_at", { ascending: false }).limit(100)
			]);
			const rows = [];
			for (const r of cr.data ?? []) rows.push({
				id: `cr:${r.id}`,
				module: classifyCareRequest(r.specialty),
				title: r.specialty,
				subtitle: `${r.visit_type} visit${r.notes ? ` · ${r.notes.slice(0, 60)}` : ""}`,
				status: r.status,
				createdAt: r.created_at
			});
			for (const r of cp.data ?? []) rows.push({
				id: `cp:${r.id}`,
				module: r.program === "dialysis" ? "Dialysis" : r.program === "medical_tourism" ? "Medical Tourism" : "Care Program",
				title: r.program.replace(/_/g, " "),
				subtitle: [r.tier, r.summary].filter(Boolean).join(" · ") || void 0,
				status: r.status,
				createdAt: r.created_at
			});
			for (const r of pr.data ?? []) rows.push({
				id: `pr:${r.id}`,
				module: "Prosthetics",
				title: `${r.category} — ${r.subtype}`,
				subtitle: r.provider_name,
				status: r.status,
				createdAt: r.created_at
			});
			for (const r of sn.data ?? []) rows.push({
				id: `sn:${r.id}`,
				module: "Special Needs",
				title: `${r.category} — ${r.subtype}`,
				subtitle: r.provider_name,
				status: r.status,
				createdAt: r.created_at
			});
			for (const r of bb.data ?? []) rows.push({
				id: `bb:${r.id}`,
				module: "Blood Bank",
				title: `${r.activity_type}${r.blood_group ? ` · ${r.blood_group}` : ""}${r.units ? ` · ${r.units}u` : ""}`,
				subtitle: r.hospital ?? void 0,
				status: r.status,
				createdAt: r.created_at
			});
			for (const r of sb.data ?? []) rows.push({
				id: `sb:${r.id}`,
				module: "Surgery",
				title: r.procedure,
				subtitle: `${r.patient_name} · ${r.mode}`,
				status: r.status,
				createdAt: r.created_at
			});
			for (const r of pv.data ?? []) rows.push({
				id: `pv:${r.id}`,
				module: "Physiotherapy",
				title: `${r.therapy_type.replace(/_/g, " ")} — session ${r.session_number}`,
				subtitle: `${r.area}, ${r.city}${r.scheduled_at ? ` · ${new Date(r.scheduled_at).toLocaleString()}` : ""}`,
				status: r.status,
				createdAt: r.created_at
			});
			rows.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
			if (mounted) {
				setItems(rows);
				setLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [uid, ready]);
	const modules = useMemo(() => {
		const set = /* @__PURE__ */ new Set();
		items.forEach((i) => set.add(i.module));
		return ["All", ...Array.from(set)];
	}, [items]);
	const UPCOMING = /* @__PURE__ */ new Set([
		"open",
		"pending",
		"broadcasting",
		"accepted",
		"confirmed",
		"in_progress",
		"booked",
		"requested",
		"assigned",
		"en_route"
	]);
	const byTab = items.filter((i) => tab === "upcoming" ? UPCOMING.has(i.status) : !UPCOMING.has(i.status));
	const visible = filter === "All" ? byTab : byTab.filter((i) => i.module === filter);
	const upcomingCount = items.filter((i) => UPCOMING.has(i.status)).length;
	const previousCount = items.length - upcomingCount;
	const grouped = useMemo(() => {
		const map = /* @__PURE__ */ new Map();
		const sorted = [...visible].sort((a, b) => tab === "upcoming" ? a.createdAt < b.createdAt ? 1 : -1 : a.createdAt < b.createdAt ? 1 : -1);
		for (const it of sorted) {
			const key = new Date(it.createdAt).toLocaleDateString([], {
				weekday: "short",
				day: "numeric",
				month: "short",
				year: "numeric"
			});
			if (!map.has(key)) map.set(key, []);
			map.get(key).push(it);
		}
		return Array.from(map.entries());
	}, [visible, tab]);
	return /* @__PURE__ */ jsxs("div", {
		style: {
			minHeight: "100dvh",
			background: BG,
			color: INK
		},
		children: [/* @__PURE__ */ jsxs("header", {
			style: {
				position: "sticky",
				top: 0,
				zIndex: 10,
				background: "rgba(255,255,255,0.9)",
				backdropFilter: "blur(8px)",
				borderBottom: "1px solid rgba(15,23,42,0.06)",
				padding: "14px 16px"
			},
			children: [
				/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "center",
						gap: 12,
						maxWidth: 900,
						margin: "0 auto"
					},
					children: [
						/* @__PURE__ */ jsx(Link, {
							to: "/",
							style: {
								color: TEAL,
								textDecoration: "none",
								fontWeight: 600
							},
							children: "← Home"
						}),
						/* @__PURE__ */ jsx("h1", {
							style: {
								margin: 0,
								fontSize: 18,
								fontWeight: 700
							},
							children: "My Bookings"
						}),
						/* @__PURE__ */ jsx(Link, {
							to: "/physio/visits",
							style: {
								color: TEAL,
								textDecoration: "none",
								fontWeight: 600,
								fontSize: 12
							},
							children: "Physio visits →"
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								marginLeft: "auto",
								fontSize: 12,
								color: "#64748B"
							},
							children: loading ? "Loading…" : `${visible.length} of ${items.length}`
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					style: {
						display: "flex",
						gap: 8,
						overflowX: "auto",
						maxWidth: 900,
						margin: "10px auto 0",
						paddingBottom: 4
					},
					children: modules.map((m) => /* @__PURE__ */ jsx("button", {
						onClick: () => setFilter(m),
						style: {
							border: "none",
							padding: "6px 12px",
							borderRadius: 999,
							fontSize: 12,
							fontWeight: 600,
							cursor: "pointer",
							background: filter === m ? TEAL : "#fff",
							color: filter === m ? "#fff" : INK,
							whiteSpace: "nowrap",
							boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
						},
						children: m === "All" ? "All" : `${MODULE_ICON[m]} ${m}`
					}, m))
				}),
				/* @__PURE__ */ jsx("div", {
					style: {
						display: "flex",
						gap: 6,
						maxWidth: 900,
						margin: "10px auto 0",
						background: "#EEF2F0",
						borderRadius: 999,
						padding: 4
					},
					children: ["upcoming", "previous"].map((t) => /* @__PURE__ */ jsxs("button", {
						onClick: () => setTab(t),
						style: {
							flex: 1,
							border: "none",
							padding: "8px 12px",
							borderRadius: 999,
							fontSize: 13,
							fontWeight: 700,
							cursor: "pointer",
							background: tab === t ? "#fff" : "transparent",
							color: tab === t ? INK : "#64748B",
							boxShadow: tab === t ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
							textTransform: "capitalize"
						},
						children: [
							t,
							" ",
							t === "upcoming" ? `(${upcomingCount})` : `(${previousCount})`
						]
					}, t))
				})
			]
		}), /* @__PURE__ */ jsxs("main", {
			style: {
				maxWidth: 900,
				margin: "0 auto",
				padding: "16px"
			},
			children: [/* @__PURE__ */ jsx(HomeVisitPanel, {
				audience: "patient",
				completedOnly: tab === "previous"
			}), !ready ? null : !uid ? /* @__PURE__ */ jsx(EmptyMsg, { text: "Sign in to see your bookings." }) : loading ? /* @__PURE__ */ jsx(EmptyMsg, { text: "Loading your bookings…" }) : visible.length === 0 ? /* @__PURE__ */ jsx(EmptyMsg, { text: tab === "upcoming" ? "No upcoming bookings. New bookings appear here until they're completed or cancelled." : "No previous bookings yet." }) : /* @__PURE__ */ jsx("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 18
				},
				children: grouped.map(([date, rows]) => /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
					style: {
						margin: "0 0 8px 4px",
						fontSize: 12,
						fontWeight: 700,
						color: "#475569",
						textTransform: "uppercase",
						letterSpacing: .5
					},
					children: date
				}), /* @__PURE__ */ jsx("ul", {
					style: {
						listStyle: "none",
						padding: 0,
						margin: 0,
						display: "flex",
						flexDirection: "column",
						gap: 10
					},
					children: rows.map((it) => /* @__PURE__ */ jsxs("li", {
						style: {
							background: "#fff",
							borderRadius: 14,
							padding: "12px 14px",
							boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
							display: "flex",
							alignItems: "flex-start",
							gap: 12
						},
						children: [/* @__PURE__ */ jsx("div", {
							style: {
								fontSize: 22,
								lineHeight: 1
							},
							children: MODULE_ICON[it.module]
						}), /* @__PURE__ */ jsxs("div", {
							style: {
								flex: 1,
								minWidth: 0
							},
							children: [
								/* @__PURE__ */ jsxs("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: 8,
										flexWrap: "wrap"
									},
									children: [
										/* @__PURE__ */ jsx("span", {
											style: {
												fontWeight: 700,
												fontSize: 14,
												textTransform: "capitalize"
											},
											children: it.title
										}),
										/* @__PURE__ */ jsx(StatusChip, { status: it.status }),
										/* @__PURE__ */ jsx(CompletedConsultationChat, { item: it })
									]
								}),
								it.subtitle && /* @__PURE__ */ jsx("div", {
									style: {
										color: "#475569",
										fontSize: 12,
										marginTop: 2
									},
									children: it.subtitle
								}),
								/* @__PURE__ */ jsxs("div", {
									style: {
										color: "#94A3B8",
										fontSize: 11,
										marginTop: 4
									},
									children: [
										it.module,
										" · ",
										new Date(it.createdAt).toLocaleTimeString([], {
											hour: "2-digit",
											minute: "2-digit"
										})
									]
								})
							]
						})]
					}, it.id))
				})] }, date))
			})]
		})]
	});
}
function EmptyMsg({ text }) {
	return /* @__PURE__ */ jsx("div", {
		style: {
			background: "#fff",
			borderRadius: 14,
			padding: 24,
			textAlign: "center",
			color: "#64748B",
			fontSize: 14
		},
		children: text
	});
}
//#endregion
export { BookingsPage as component };
