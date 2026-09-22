import { B as useSession } from "./backend-eXdx240h.js";
import { _ as useSurgeryBookingAuditLog, a as acceptSurgeryRole, c as confirmSurgeryOtpExchanged, d as failSurgeryRole, f as hubConfirmSurgeryRole, g as useProviderSurgeryInvites, h as useMyFacilitySurgeries, l as createSurgeryBooking, m as rateSurgeryRole, n as PROCEDURE_PRESETS, o as cancelSurgeryBooking, p as providerVerifySurgeryOtp, r as SURGERY_ROLE_LABELS, s as completeSurgeryRole, t as BLOOD_GROUPS, u as declineSurgeryRole, v as useSurgeryRoleChat } from "./surgery-DfW8MR9P.js";
import { n as SlotPickerCalendarStandalone } from "./SlotPickerCalendar-bFLJDs2V.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/surgery.tsx?tsr-split=component
var BG = "#DCE6E1";
var TEAL = "#0D9488";
var INK = "#0F172A";
var ALL_ROLES = [
	"surgeon",
	"anaesthetist",
	"obstetrician",
	"paediatrician",
	"ot_technician",
	"scrub_nurse",
	"other"
];
function Shell({ children, title, subtitle }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen px-4 py-6",
		style: {
			background: BG,
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: [/* @__PURE__ */ jsx("link", {
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
		}), /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-4xl",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-4 flex items-center justify-between",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-2xl font-extrabold",
					style: { color: INK },
					children: title
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-slate-600",
					children: subtitle
				})] }), /* @__PURE__ */ jsx(Link, {
					to: "/",
					className: "text-sm font-semibold",
					style: { color: TEAL },
					children: "← Back to app"
				})]
			}), children]
		})]
	});
}
function SurgeryPage() {
	const { user, role, loading } = useSession();
	if (loading) return /* @__PURE__ */ jsx(Shell, {
		title: "Surgery Planning",
		subtitle: "Loading…",
		children: /* @__PURE__ */ jsx("div", {})
	});
	if (!user) return /* @__PURE__ */ jsx(Shell, {
		title: "Surgery Planning",
		subtitle: "Sign in required",
		children: /* @__PURE__ */ jsxs("div", {
			className: "rounded-2xl bg-white p-6 text-sm text-slate-600",
			children: [/* @__PURE__ */ jsx(Link, {
				to: "/auth",
				search: {
					admin: void 0,
					next: void 0
				},
				className: "font-semibold",
				style: { color: TEAL },
				children: "Sign in"
			}), " to plan or accept surgery bookings."]
		})
	});
	if (role === "facility" || role === "admin" || role === "super_admin") return /* @__PURE__ */ jsx(Shell, {
		title: "Surgery Planning",
		subtitle: "Book a full surgical team in one broadcast.",
		children: /* @__PURE__ */ jsx(FacilityPlanner, {})
	});
	if (role === "provider") return /* @__PURE__ */ jsx(Shell, {
		title: "Surgery Invitations",
		subtitle: "Open surgeries needing a team member.",
		children: /* @__PURE__ */ jsx(ProviderInvites, {})
	});
	return /* @__PURE__ */ jsx(Shell, {
		title: "Surgery Planning",
		subtitle: "Not available for this account",
		children: /* @__PURE__ */ jsx("div", {
			className: "rounded-2xl bg-white p-6 text-sm text-slate-600",
			children: "Surgery planning is for hospitals, hubs, and providers only."
		})
	});
}
function FacilityPlanner() {
	const { bookings, roles, loading, refresh } = useMyFacilitySurgeries();
	const [showNew, setShowNew] = useState(false);
	const rolesByBooking = useMemo(() => {
		const m = {};
		for (const r of roles) (m[r.booking_id] ||= []).push(r);
		return m;
	}, [roles]);
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ jsx("button", {
				onClick: () => setShowNew(true),
				className: "w-full rounded-2xl py-3 text-sm font-bold text-white",
				style: { background: `linear-gradient(135deg,${TEAL},#14B8A6)` },
				children: "+ New surgery booking"
			}),
			showNew && /* @__PURE__ */ jsx(NewBookingDialog, { onClose: () => {
				setShowNew(false);
				refresh();
			} }),
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-2xl bg-white p-4",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "text-sm font-bold",
					style: { color: INK },
					children: "Your bookings"
				}), loading ? /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-xs text-slate-500",
					children: "Loading…"
				}) : bookings.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-xs text-slate-500",
					children: "No surgeries yet. Create your first booking above."
				}) : /* @__PURE__ */ jsx("div", {
					className: "mt-3 space-y-3",
					children: bookings.map((b) => {
						const rs = rolesByBooking[b.id] ?? [];
						const done = rs.filter((r) => r.status === "accepted").length;
						return /* @__PURE__ */ jsxs("div", {
							className: "rounded-xl border border-slate-100 p-3",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-start justify-between gap-2",
									children: [/* @__PURE__ */ jsxs("div", { children: [
										/* @__PURE__ */ jsxs("div", {
											className: "text-sm font-bold",
											style: { color: INK },
											children: [b.mode === "emergency" ? "🚨 " : "", b.procedure]
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "text-[11px] text-slate-500",
											children: [
												"Patient: ",
												b.patient_name,
												b.patient_phone ? ` · ${b.patient_phone}` : ""
											]
										}),
										/* @__PURE__ */ jsx("div", {
											className: "text-[11px] text-slate-500",
											children: b.mode === "planned" && b.scheduled_at ? `Planned · ${new Date(b.scheduled_at).toLocaleString()}` : b.mode === "emergency" ? "Emergency · ASAP" : "Planned · time TBD"
										}),
										(b.ot_room || b.blood_units || b.blood_group) && /* @__PURE__ */ jsxs("div", {
											className: "mt-1 flex flex-wrap gap-1",
											children: [b.ot_room && /* @__PURE__ */ jsxs("span", {
												className: "rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700",
												children: ["OT: ", b.ot_room]
											}), b.blood_units ? /* @__PURE__ */ jsxs("span", {
												className: "rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700",
												children: [
													"🩸 ",
													b.blood_units,
													" unit",
													b.blood_units > 1 ? "s" : "",
													b.blood_group ? ` · ${b.blood_group}` : ""
												]
											}) : b.blood_group ? /* @__PURE__ */ jsxs("span", {
												className: "rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700",
												children: ["🩸 ", b.blood_group]
											}) : null]
										})
									] }), /* @__PURE__ */ jsx(StatusPill, { status: b.status })]
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mt-2 flex flex-wrap gap-1.5",
									children: rs.map((r) => /* @__PURE__ */ jsxs("span", {
										className: "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
										style: {
											background: r.status === "accepted" ? "#D1FAE5" : r.status === "declined" ? "#FEE2E2" : "#F1F5F9",
											color: r.status === "accepted" ? "#065F46" : r.status === "declined" ? "#991B1B" : "#334155"
										},
										children: [
											SURGERY_ROLE_LABELS[r.role],
											r.fee ? ` · ₹${r.fee}` : "",
											" ",
											r.status === "accepted" ? "✓" : r.status === "declined" ? "✗" : "…"
										]
									}, r.id))
								}),
								rs.filter((r) => r.status === "accepted").map((r) => /* @__PURE__ */ jsx(RoleLifecyclePanel, {
									role: r,
									booking: b,
									side: "hub",
									onChange: refresh
								}, `life-${r.id}`)),
								/* @__PURE__ */ jsx(BookingAuditTimeline, { bookingId: b.id }),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-2 flex items-center justify-between text-[10.5px] text-slate-500",
									children: [/* @__PURE__ */ jsxs("span", { children: [
										done,
										"/",
										rs.length,
										" team members accepted"
									] }), b.status !== "cancelled" && b.status !== "completed" && /* @__PURE__ */ jsx("button", {
										onClick: async () => {
											if (!confirm("Cancel this surgery booking?")) return;
											await cancelSurgeryBooking(b.id);
											refresh();
										},
										className: "font-semibold text-red-600",
										children: "Cancel"
									})]
								})
							]
						}, b.id);
					})
				})]
			})
		]
	});
}
function StatusPill({ status }) {
	const map = {
		broadcasting: {
			bg: "#DBEAFE",
			c: "#1E40AF",
			label: "Broadcasting"
		},
		confirmed: {
			bg: "#D1FAE5",
			c: "#065F46",
			label: "Confirmed"
		},
		in_progress: {
			bg: "#FEF3C7",
			c: "#92400E",
			label: "In progress"
		},
		completed: {
			bg: "#E5E7EB",
			c: "#374151",
			label: "Completed"
		},
		cancelled: {
			bg: "#FEE2E2",
			c: "#991B1B",
			label: "Cancelled"
		},
		draft: {
			bg: "#F1F5F9",
			c: "#334155",
			label: "Draft"
		}
	};
	const s = map[status] ?? map.draft;
	return /* @__PURE__ */ jsx("span", {
		className: "rounded-full px-2 py-0.5 text-[10.5px] font-bold",
		style: {
			background: s.bg,
			color: s.c
		},
		children: s.label
	});
}
function NewBookingDialog({ onClose }) {
	const [patientName, setPatientName] = useState("");
	const [patientPhone, setPatientPhone] = useState("");
	const [procedure, setProcedure] = useState("");
	const [mode, setMode] = useState("planned");
	const [scheduledAt, setScheduledAt] = useState("");
	const [notes, setNotes] = useState("");
	const [selectedRoles, setSelectedRoles] = useState([]);
	const [roleFees, setRoleFees] = useState({});
	const [otRoom, setOtRoom] = useState("");
	const [bloodUnits, setBloodUnits] = useState("");
	const [bloodGroup, setBloodGroup] = useState("");
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState(null);
	function applyPreset(p) {
		setProcedure(p.name);
		setSelectedRoles(p.roles);
	}
	function toggleRole(r) {
		setSelectedRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
	}
	async function submit() {
		setErr(null);
		if (!patientName.trim() || !procedure.trim() || selectedRoles.length === 0) {
			setErr("Patient name, procedure, and at least one team role are required.");
			return;
		}
		setBusy(true);
		try {
			const fees = {};
			for (const r of selectedRoles) {
				const raw = roleFees[r];
				const num = raw != null && raw !== "" ? Number(raw) : NaN;
				fees[r] = Number.isFinite(num) ? num : null;
			}
			await createSurgeryBooking({
				patient_name: patientName.trim(),
				patient_phone: patientPhone.trim() || null,
				procedure: procedure.trim(),
				mode,
				scheduled_at: mode === "planned" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
				notes: notes.trim() || null,
				roles: selectedRoles,
				ot_room: otRoom.trim() || null,
				blood_units: bloodUnits ? Math.max(0, parseInt(bloodUnits, 10) || 0) : null,
				blood_group: bloodGroup || null,
				role_fees: fees
			});
			onClose();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Failed to create booking");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center",
		children: /* @__PURE__ */ jsxs("div", {
			className: "w-full max-w-lg rounded-2xl bg-white p-4",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-3 flex items-center justify-between",
					children: [/* @__PURE__ */ jsx("h3", {
						className: "text-base font-extrabold",
						style: { color: INK },
						children: "New surgery booking"
					}), /* @__PURE__ */ jsx("button", {
						onClick: onClose,
						className: "text-slate-400",
						children: "✕"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "space-y-3 max-h-[70vh] overflow-y-auto",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "grid grid-cols-2 gap-2",
							children: [/* @__PURE__ */ jsx("input", {
								value: patientName,
								onChange: (e) => setPatientName(e.target.value),
								placeholder: "Patient name",
								className: "rounded-lg border border-slate-200 px-3 py-2 text-sm"
							}), /* @__PURE__ */ jsx("input", {
								value: patientPhone,
								onChange: (e) => setPatientPhone(e.target.value),
								placeholder: "Phone (optional)",
								className: "rounded-lg border border-slate-200 px-3 py-2 text-sm"
							})]
						}),
						/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("label", {
								className: "text-[11px] font-bold text-slate-600",
								children: "Procedure"
							}),
							/* @__PURE__ */ jsx("input", {
								value: procedure,
								onChange: (e) => setProcedure(e.target.value),
								placeholder: "e.g. C-section, Appendectomy…",
								className: "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-2 flex flex-wrap gap-1.5",
								children: PROCEDURE_PRESETS.map((p) => /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => applyPreset(p),
									className: "rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50",
									children: p.name
								}, p.name))
							})
						] }),
						/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("label", {
								className: "text-[11px] font-bold text-slate-600",
								children: "Mode"
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-1 grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setMode("planned"),
									className: "rounded-lg border py-2 text-sm font-bold",
									style: {
										borderColor: mode === "planned" ? TEAL : "#E5E7EB",
										color: mode === "planned" ? TEAL : "#334155",
										background: mode === "planned" ? "#F0FDFA" : "#fff"
									},
									children: "Planned"
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setMode("emergency"),
									className: "rounded-lg border py-2 text-sm font-bold",
									style: {
										borderColor: mode === "emergency" ? "#EF4444" : "#E5E7EB",
										color: mode === "emergency" ? "#EF4444" : "#334155",
										background: mode === "emergency" ? "#FEF2F2" : "#fff"
									},
									children: "🚨 Emergency"
								})]
							}),
							mode === "planned" && /* @__PURE__ */ jsxs("div", {
								className: "mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500",
										children: "Pick OT slot"
									}),
									/* @__PURE__ */ jsx(SlotPickerCalendarStandalone, {
										days: 14,
										seed: `ot|${procedure || "custom"}`,
										accent: TEAL,
										value: scheduledAt,
										onChange: setScheduledAt,
										size: "md"
									}),
									scheduledAt && /* @__PURE__ */ jsxs("p", {
										className: "mt-2 text-[11.5px] font-semibold text-teal-700",
										children: ["✓ Scheduled for ", new Date(scheduledAt).toLocaleString("en-US", {
											weekday: "short",
											day: "numeric",
											month: "short",
											hour: "numeric",
											minute: "2-digit"
										})]
									})
								]
							})
						] }),
						/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("label", {
								className: "text-[11px] font-bold text-slate-600",
								children: "Required team + per-role fee (₹)"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-1 grid grid-cols-2 gap-1.5",
								children: ALL_ROLES.map((r) => {
									const on = selectedRoles.includes(r);
									return /* @__PURE__ */ jsxs("button", {
										type: "button",
										onClick: () => toggleRole(r),
										className: "rounded-lg border py-2 text-[12px] font-semibold",
										style: {
											borderColor: on ? TEAL : "#E5E7EB",
											background: on ? "#F0FDFA" : "#fff",
											color: on ? TEAL : "#334155"
										},
										children: [on ? "✓ " : "", SURGERY_ROLE_LABELS[r]]
									}, r);
								})
							}),
							selectedRoles.length > 0 && /* @__PURE__ */ jsx("div", {
								className: "mt-2 space-y-1.5",
								children: selectedRoles.map((r) => /* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-2",
									children: [/* @__PURE__ */ jsx("span", {
										className: "w-32 text-[11.5px] font-semibold text-slate-600",
										children: SURGERY_ROLE_LABELS[r]
									}), /* @__PURE__ */ jsx("input", {
										type: "number",
										inputMode: "numeric",
										min: 0,
										value: roleFees[r] ?? "",
										onChange: (e) => setRoleFees((prev) => ({
											...prev,
											[r]: e.target.value
										})),
										placeholder: "Fee (₹)",
										className: "flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-[12px]"
									})]
								}, r))
							})
						] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							className: "text-[11px] font-bold text-slate-600",
							children: "OT / Blood requirements"
						}), /* @__PURE__ */ jsxs("div", {
							className: "mt-1 grid grid-cols-3 gap-2",
							children: [
								/* @__PURE__ */ jsx("input", {
									value: otRoom,
									onChange: (e) => setOtRoom(e.target.value),
									placeholder: "OT room",
									className: "rounded-lg border border-slate-200 px-2 py-2 text-sm"
								}),
								/* @__PURE__ */ jsx("input", {
									type: "number",
									inputMode: "numeric",
									min: 0,
									value: bloodUnits,
									onChange: (e) => setBloodUnits(e.target.value),
									placeholder: "Blood units",
									className: "rounded-lg border border-slate-200 px-2 py-2 text-sm"
								}),
								/* @__PURE__ */ jsxs("select", {
									value: bloodGroup,
									onChange: (e) => setBloodGroup(e.target.value),
									className: "rounded-lg border border-slate-200 px-2 py-2 text-sm",
									children: [/* @__PURE__ */ jsx("option", {
										value: "",
										children: "Group…"
									}), BLOOD_GROUPS.map((g) => /* @__PURE__ */ jsx("option", {
										value: g,
										children: g
									}, g))]
								})
							]
						})] }),
						/* @__PURE__ */ jsx("textarea", {
							value: notes,
							onChange: (e) => setNotes(e.target.value),
							placeholder: "Notes for the team (optional)",
							rows: 2,
							className: "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
						}),
						err && /* @__PURE__ */ jsx("p", {
							className: "text-xs text-red-600",
							children: err
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-4 flex gap-2",
					children: [/* @__PURE__ */ jsx("button", {
						onClick: onClose,
						className: "flex-1 rounded-lg border border-slate-200 py-2 text-sm font-bold text-slate-700",
						children: "Cancel"
					}), /* @__PURE__ */ jsx("button", {
						onClick: submit,
						disabled: busy,
						className: "flex-1 rounded-lg py-2 text-sm font-bold text-white disabled:opacity-60",
						style: { background: `linear-gradient(135deg,${TEAL},#14B8A6)` },
						children: busy ? "Broadcasting…" : "Broadcast to team"
					})]
				})
			]
		})
	});
}
function ProviderInvites() {
	const { roles, bookings, loading, refresh } = useProviderSurgeryInvites();
	const bookingById = useMemo(() => {
		const m = {};
		for (const b of bookings) m[b.id] = b;
		return m;
	}, [bookings]);
	const [busy, setBusy] = useState(null);
	async function accept(id) {
		setBusy(id);
		try {
			await acceptSurgeryRole(id);
			await refresh();
		} finally {
			setBusy(null);
		}
	}
	async function decline(id) {
		setBusy(id);
		try {
			await declineSurgeryRole(id);
			await refresh();
		} finally {
			setBusy(null);
		}
	}
	const pending = roles.filter((r) => r.status === "pending");
	const mine = roles.filter((r) => r.status === "accepted");
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [/* @__PURE__ */ jsx(Section, {
			title: "Open invitations",
			children: loading ? /* @__PURE__ */ jsx(Muted, { children: "Loading…" }) : pending.length === 0 ? /* @__PURE__ */ jsx(Muted, { children: "No open surgery invitations right now." }) : pending.map((r) => {
				const b = bookingById[r.booking_id];
				if (!b) return null;
				return /* @__PURE__ */ jsxs(InviteRow, {
					role: SURGERY_ROLE_LABELS[r.role],
					booking: b,
					fee: r.fee,
					otRoom: b.ot_room,
					bloodUnits: b.blood_units,
					bloodGroup: b.blood_group,
					children: [/* @__PURE__ */ jsx("button", {
						onClick: () => accept(r.id),
						disabled: busy === r.id,
						className: "rounded-full px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50",
						style: { background: TEAL },
						children: "Accept"
					}), /* @__PURE__ */ jsx("button", {
						onClick: () => decline(r.id),
						disabled: busy === r.id,
						className: "rounded-full border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600 disabled:opacity-50",
						children: "Decline"
					})]
				}, r.id);
			})
		}), /* @__PURE__ */ jsx(Section, {
			title: "My surgeries",
			children: mine.length === 0 ? /* @__PURE__ */ jsx(Muted, { children: "You haven't accepted any surgeries yet." }) : mine.map((r) => {
				const b = bookingById[r.booking_id];
				if (!b) return null;
				return /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-slate-100 p-2",
					children: [/* @__PURE__ */ jsx(InviteRow, {
						role: SURGERY_ROLE_LABELS[r.role],
						booking: b,
						fee: r.fee,
						otRoom: b.ot_room,
						bloodUnits: b.blood_units,
						bloodGroup: b.blood_group,
						children: /* @__PURE__ */ jsx(StatusPill, { status: b.status })
					}), /* @__PURE__ */ jsx(RoleLifecyclePanel, {
						role: r,
						booking: b,
						side: "provider",
						onChange: refresh
					})]
				}, r.id);
			})
		})]
	});
}
function Section({ title, children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-2xl bg-white p-4",
		children: [/* @__PURE__ */ jsx("h3", {
			className: "text-sm font-bold",
			style: { color: INK },
			children: title
		}), /* @__PURE__ */ jsx("div", {
			className: "mt-2 space-y-2",
			children
		})]
	});
}
function Muted({ children }) {
	return /* @__PURE__ */ jsx("p", {
		className: "text-xs text-slate-500",
		children
	});
}
function InviteRow({ role, booking, children, fee, otRoom, bloodUnits, bloodGroup }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "min-w-0",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "text-sm font-bold",
					style: { color: INK },
					children: [
						booking.mode === "emergency" ? "🚨 " : "",
						booking.procedure,
						" · ",
						/* @__PURE__ */ jsx("span", {
							style: { color: TEAL },
							children: role
						}),
						fee ? /* @__PURE__ */ jsxs("span", {
							className: "ml-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700",
							children: ["₹", fee]
						}) : null
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "text-[11px] text-slate-500 truncate",
					children: [
						"Patient: ",
						booking.patient_name,
						" ·",
						" ",
						booking.mode === "planned" && booking.scheduled_at ? new Date(booking.scheduled_at).toLocaleString() : "ASAP"
					]
				}),
				(otRoom || bloodUnits || bloodGroup) && /* @__PURE__ */ jsxs("div", {
					className: "mt-1 flex flex-wrap gap-1",
					children: [otRoom && /* @__PURE__ */ jsxs("span", {
						className: "rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700",
						children: ["OT: ", otRoom]
					}), (bloodUnits || bloodGroup) && /* @__PURE__ */ jsxs("span", {
						className: "rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700",
						children: [
							"🩸 ",
							bloodUnits ? `${bloodUnits} unit${bloodUnits > 1 ? "s" : ""}` : "",
							bloodUnits && bloodGroup ? " · " : "",
							bloodGroup ?? ""
						]
					})]
				})
			]
		}), /* @__PURE__ */ jsx("div", {
			className: "flex items-center gap-2 flex-shrink-0",
			children
		})]
	});
}
function RoleLifecyclePanel({ role, booking, side, onChange }) {
	const [busy, setBusy] = useState(false);
	const [otpInput, setOtpInput] = useState("");
	const [otpErr, setOtpErr] = useState(null);
	const [showChat, setShowChat] = useState(false);
	const counterpartId = side === "hub" ? role.assigned_to : booking.facility_id;
	const verified = !!role.otp_verified_at;
	const completed = role.status === "accepted" && !!role.completed_at;
	const chatExpired = !!role.chat_expires_at && new Date(role.chat_expires_at).getTime() < Date.now();
	async function runHubConfirm() {
		setBusy(true);
		try {
			await hubConfirmSurgeryRole(role.id);
			await onChange();
		} catch (e) {
			alert(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}
	async function runOtpExchanged() {
		setBusy(true);
		try {
			await confirmSurgeryOtpExchanged(role.id);
			await onChange();
		} catch (e) {
			alert(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}
	async function runVerifyOtp() {
		setOtpErr(null);
		setBusy(true);
		try {
			if (!await providerVerifySurgeryOtp(role.id, otpInput.trim())) {
				setOtpErr("Wrong OTP");
				return;
			}
			setOtpInput("");
			await onChange();
		} finally {
			setBusy(false);
		}
	}
	async function runComplete() {
		setBusy(true);
		try {
			await completeSurgeryRole(role.id);
			await onChange();
		} finally {
			setBusy(false);
		}
	}
	const myRating = side === "hub" ? role.rating_hub : role.rating_provider;
	const overdue = !!role.arrival_deadline && !verified && new Date(role.arrival_deadline).getTime() < Date.now();
	async function runFail() {
		if (!confirm("Mark this team member as no-show?")) return;
		setBusy(true);
		try {
			await failSurgeryRole(role.id);
			await onChange();
		} catch (e) {
			alert(e instanceof Error ? e.message : "Failed");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-2 rounded-lg bg-slate-50 p-2.5 space-y-2",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "text-[11px] font-bold",
					style: { color: INK },
					children: [SURGERY_ROLE_LABELS[role.role], " · lifecycle"]
				}), role.arrival_deadline && !completed && /* @__PURE__ */ jsxs("span", {
					className: "rounded-full px-2 py-0.5 text-[10px] font-bold",
					style: {
						background: overdue ? "#FEE2E2" : "#EEF2FF",
						color: overdue ? "#B91C1C" : "#3730A3"
					},
					children: [
						overdue ? "⏱ Overdue" : "⏱",
						" ",
						new Date(role.arrival_deadline).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit"
						})
					]
				})]
			}),
			side === "hub" && overdue && !completed && /* @__PURE__ */ jsx("button", {
				onClick: runFail,
				disabled: busy,
				className: "w-full rounded-lg border border-red-200 bg-red-50 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-50",
				children: "Mark no-show"
			}),
			!role.paid_at && side === "hub" && /* @__PURE__ */ jsx("button", {
				onClick: runHubConfirm,
				disabled: busy,
				className: "w-full rounded-lg py-2 text-xs font-bold text-white disabled:opacity-50",
				style: { background: TEAL },
				children: "Confirm engagement & generate OTP"
			}),
			!role.paid_at && side === "provider" && /* @__PURE__ */ jsx("p", {
				className: "text-[11px] text-slate-500",
				children: "Waiting for hub to confirm engagement…"
			}),
			role.paid_at && !verified && /* @__PURE__ */ jsx("div", {
				className: "rounded-md bg-white p-2",
				children: side === "hub" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("p", {
						className: "text-[11px] font-semibold text-slate-600",
						children: ["Share OTP with ", SURGERY_ROLE_LABELS[role.role]]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "my-1 text-center text-2xl font-black tracking-[6px]",
						style: { color: TEAL },
						children: role.otp ?? "0000"
					}),
					/* @__PURE__ */ jsx("button", {
						onClick: runOtpExchanged,
						disabled: busy,
						className: "w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50",
						children: "Mark OTP exchanged"
					})
				] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] font-semibold text-slate-600",
						children: "Enter OTP from hub"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-1 flex gap-1.5",
						children: [/* @__PURE__ */ jsx("input", {
							value: otpInput,
							onChange: (e) => setOtpInput(e.target.value),
							inputMode: "numeric",
							maxLength: 6,
							placeholder: "0000",
							className: "flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-center text-sm tracking-[4px]"
						}), /* @__PURE__ */ jsx("button", {
							onClick: runVerifyOtp,
							disabled: busy || !otpInput.trim(),
							className: "rounded-md px-3 text-[11px] font-bold text-white disabled:opacity-50",
							style: { background: TEAL },
							children: "Verify"
						})]
					}),
					otpErr && /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-[10.5px] text-red-600",
						children: otpErr
					}),
					/* @__PURE__ */ jsx("button", {
						onClick: runOtpExchanged,
						disabled: busy,
						className: "mt-1.5 w-full rounded-lg border border-slate-200 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50",
						children: "Or tap: OTP exchanged in person"
					})
				] })
			}),
			verified && /* @__PURE__ */ jsxs("div", {
				className: "space-y-1.5",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("span", {
							className: "rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700",
							children: "✓ OTP exchanged"
						}), role.chat_expires_at && /* @__PURE__ */ jsxs("span", {
							className: "text-[10px] text-slate-500",
							children: ["Chat ", chatExpired ? "closed" : `open · until ${new Date(role.chat_expires_at).toLocaleString()}`]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex gap-1.5",
						children: [/* @__PURE__ */ jsxs("button", {
							onClick: () => setShowChat((s) => !s),
							disabled: chatExpired && !showChat,
							className: "flex-1 rounded-lg border border-slate-200 py-1.5 text-[11px] font-bold text-slate-700 disabled:opacity-50",
							children: ["💬 ", showChat ? "Hide chat" : chatExpired ? "Chat closed" : "Open chat"]
						}), !completed && /* @__PURE__ */ jsx("button", {
							onClick: runComplete,
							disabled: busy,
							className: "flex-1 rounded-lg py-1.5 text-[11px] font-bold text-white disabled:opacity-50",
							style: { background: TEAL },
							children: "Mark completed"
						})]
					}),
					showChat && /* @__PURE__ */ jsx(SurgeryChat, {
						roleId: role.id,
						counterpartId: counterpartId ?? null,
						chatExpiresAt: role.chat_expires_at
					})
				]
			}),
			completed && /* @__PURE__ */ jsxs("div", {
				className: "rounded-md bg-white p-2",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "text-[11px] font-semibold text-slate-600",
						children: side === "hub" ? "Rate the team member" : "Rate the hub"
					}),
					/* @__PURE__ */ jsx(StarRow, {
						value: myRating ?? 0,
						disabled: busy || !!myRating,
						onPick: async (v) => {
							setBusy(true);
							try {
								await rateSurgeryRole(role.id, side, v);
								await onChange();
							} finally {
								setBusy(false);
							}
						}
					}),
					myRating ? /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-[10.5px] text-slate-500",
						children: "Thanks — your rating is saved."
					}) : null
				]
			})
		]
	});
}
function StarRow({ value, disabled, onPick }) {
	return /* @__PURE__ */ jsx("div", {
		className: "mt-1 flex gap-1",
		children: [
			1,
			2,
			3,
			4,
			5
		].map((n) => /* @__PURE__ */ jsx("button", {
			disabled,
			onClick: () => onPick(n),
			className: "text-2xl leading-none disabled:cursor-not-allowed",
			style: { color: n <= value ? "#F59E0B" : "#CBD5E1" },
			"aria-label": `${n} star`,
			children: "★"
		}, n))
	});
}
function SurgeryChat({ roleId, counterpartId, chatExpiresAt }) {
	const { messages, send, meId, ready, expired } = useSurgeryRoleChat(roleId, counterpartId, chatExpiresAt);
	const [text, setText] = useState("");
	const scrollRef = useRef(null);
	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, [messages.length]);
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-md border border-slate-200 bg-white",
		children: [/* @__PURE__ */ jsx("div", {
			ref: scrollRef,
			className: "max-h-56 overflow-y-auto p-2 space-y-1.5",
			children: !ready ? /* @__PURE__ */ jsx("p", {
				className: "text-[11px] text-slate-400",
				children: "Loading chat…"
			}) : messages.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "text-[11px] text-slate-400",
				children: "No messages yet — say hello."
			}) : messages.map((m) => {
				const mine = m.sender_id === meId;
				return /* @__PURE__ */ jsx("div", {
					className: `flex ${mine ? "justify-end" : "justify-start"}`,
					children: /* @__PURE__ */ jsx("div", {
						className: "max-w-[80%] rounded-2xl px-3 py-1.5 text-[12px]",
						style: {
							background: mine ? TEAL : "#F1F5F9",
							color: mine ? "#fff" : INK
						},
						children: m.body
					})
				}, m.id);
			})
		}), /* @__PURE__ */ jsxs("form", {
			onSubmit: async (e) => {
				e.preventDefault();
				if (!text.trim() || expired) return;
				if (await send(text)) setText("");
			},
			className: "flex gap-1.5 border-t border-slate-100 p-1.5",
			children: [/* @__PURE__ */ jsx("input", {
				value: text,
				onChange: (e) => setText(e.target.value),
				disabled: expired,
				placeholder: expired ? "Chat window closed" : "Message…",
				className: "flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-[12px] disabled:bg-slate-50"
			}), /* @__PURE__ */ jsx("button", {
				type: "submit",
				disabled: expired || !text.trim(),
				className: "rounded-md px-3 text-[11px] font-bold text-white disabled:opacity-40",
				style: { background: TEAL },
				children: "Send"
			})]
		})]
	});
}
function BookingAuditTimeline({ bookingId }) {
	const { events, loading } = useSurgeryBookingAuditLog(bookingId);
	const [open, setOpen] = useState(false);
	if (loading || events.length === 0) return null;
	return /* @__PURE__ */ jsxs("details", {
		open,
		onToggle: (e) => setOpen(e.target.open),
		className: "mt-2 rounded-lg bg-slate-50 p-2",
		children: [/* @__PURE__ */ jsxs("summary", {
			className: "cursor-pointer text-[11px] font-bold text-slate-600",
			children: [
				"Timeline · ",
				events.length,
				" events"
			]
		}), /* @__PURE__ */ jsx("ul", {
			className: "mt-2 space-y-1",
			children: events.slice().reverse().map((e) => /* @__PURE__ */ jsxs("li", {
				className: "flex items-start gap-2 text-[10.5px] text-slate-600",
				children: [/* @__PURE__ */ jsx("span", {
					className: "mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full",
					style: { background: TEAL }
				}), /* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsx("div", {
						className: "font-semibold",
						children: e.note ?? e.event_type
					}), /* @__PURE__ */ jsxs("div", {
						className: "text-slate-400",
						children: [new Date(e.created_at).toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit"
						}), e.actor_role ? ` · ${e.actor_role}` : ""]
					})]
				})]
			}, e.id))
		})]
	});
}
//#endregion
export { SurgeryPage as component };
