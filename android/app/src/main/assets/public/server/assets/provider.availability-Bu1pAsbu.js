import { n as supabase } from "./client-BSmVQfT1.js";
import { r as ProviderHomeSettings } from "./HomeVisitPanel-oPTBOTPN.js";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/provider.availability.tsx?tsr-split=component
var DAYS = [
	["mon", "Monday"],
	["tue", "Tuesday"],
	["wed", "Wednesday"],
	["thu", "Thursday"],
	["fri", "Friday"],
	["sat", "Saturday"],
	["sun", "Sunday"]
];
var DEFAULT_SERVICES = [
	"General Physician",
	"Pediatrician",
	"Cardiologist",
	"Dermatologist",
	"Home Nurse",
	"Physiotherapist",
	"Lab Technician",
	"Scan Technician",
	"OT Technician",
	"Home Care"
];
var DUTY_PREF_OPTIONS = [
	{
		id: "all",
		label: "All"
	},
	{
		id: "ward",
		label: "Ward"
	},
	{
		id: "icu",
		label: "ICU"
	},
	{
		id: "emergency",
		label: "Emergency"
	},
	{
		id: "night",
		label: "Night shift"
	}
];
var DEFAULT_HOURS = {
	mon: [{
		start: "09:00",
		end: "17:00"
	}],
	tue: [{
		start: "09:00",
		end: "17:00"
	}],
	wed: [{
		start: "09:00",
		end: "17:00"
	}],
	thu: [{
		start: "09:00",
		end: "17:00"
	}],
	fri: [{
		start: "09:00",
		end: "17:00"
	}],
	sat: [{
		start: "10:00",
		end: "14:00"
	}],
	sun: []
};
function ProviderAvailability() {
	const [uid, setUid] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [msg, setMsg] = useState(null);
	const [isOnline, setIsOnline] = useState(true);
	const [timezone, setTimezone] = useState("Asia/Kolkata");
	const [hours, setHours] = useState(DEFAULT_HOURS);
	const [blocked, setBlocked] = useState([]);
	const [newBlock, setNewBlock] = useState("");
	const [serviceOnline, setServiceOnline] = useState({});
	const [customService, setCustomService] = useState("");
	const [dndWindows, setDndWindows] = useState([]);
	const [dndAllowEmergency, setDndAllowEmergency] = useState(true);
	const [isCarePhysician, setIsCarePhysician] = useState(false);
	const [cpDutyTypes, setCpDutyTypes] = useState(["all"]);
	useEffect(() => {
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const u = sess.session?.user?.id;
			if (!u) {
				window.location.href = "/auth";
				return;
			}
			setUid(u);
			const { data } = await supabase.from("provider_availability").select("*").eq("user_id", u).maybeSingle();
			if (data) {
				setIsOnline(!!data.is_online);
				setTimezone(data.timezone || "Asia/Kolkata");
				const wh = data.working_hours || {};
				setHours(Object.keys(wh).length ? {
					...DEFAULT_HOURS,
					...wh
				} : DEFAULT_HOURS);
				setBlocked(data.blocked_dates || []);
				setServiceOnline(data.service_online || {});
				setDndWindows(data.dnd_windows || []);
				setDndAllowEmergency(data.dnd_allow_emergency !== false);
			}
			const { data: cpData } = await supabase.from("care_physician_profiles").select("duty_types").eq("user_id", u).maybeSingle();
			if (cpData) {
				setIsCarePhysician(true);
				if (cpData.duty_types && cpData.duty_types.length) setCpDutyTypes(cpData.duty_types);
			} else {
				const { data: prof } = await supabase.from("profiles").select("view").eq("id", u).maybeSingle();
				if (prof?.view === "care_physician") setIsCarePhysician(true);
			}
			setLoading(false);
		})();
	}, []);
	function handleCpDutyToggle(id) {
		setCpDutyTypes((current) => {
			const active = current || ["all"];
			if (id === "all") return ["all"];
			const withoutAll = active.filter((x) => x !== "all");
			const next = withoutAll.includes(id) ? withoutAll.filter((x) => x !== id) : [...withoutAll, id];
			return next.length === 0 ? ["all"] : next;
		});
	}
	const allServices = useMemo(() => {
		const set = new Set(DEFAULT_SERVICES);
		Object.keys(serviceOnline).forEach((k) => set.add(k));
		return Array.from(set);
	}, [serviceOnline]);
	async function save() {
		if (!uid) return;
		setSaving(true);
		setMsg(null);
		const { error } = await supabase.from("provider_availability").upsert({
			user_id: uid,
			is_online: isOnline,
			timezone,
			working_hours: hours,
			blocked_dates: blocked,
			service_online: serviceOnline,
			dnd_windows: dndWindows,
			dnd_allow_emergency: dndAllowEmergency
		}, { onConflict: "user_id" });
		if (isCarePhysician) await supabase.from("care_physician_profiles").upsert({
			user_id: uid,
			duty_types: cpDutyTypes,
			qualification: "mbbs"
		}, { onConflict: "user_id" });
		setSaving(false);
		setMsg(error ? `Error: ${error.message}` : "Saved. Dispatch will respect these settings.");
		if (!error) setTimeout(() => setMsg(null), 3e3);
	}
	function addInterval(day) {
		setHours((h) => ({
			...h,
			[day]: [...h[day] || [], {
				start: "09:00",
				end: "17:00"
			}]
		}));
	}
	function updateInterval(day, i, patch) {
		setHours((h) => ({
			...h,
			[day]: h[day].map((iv, idx) => idx === i ? {
				...iv,
				...patch
			} : iv)
		}));
	}
	function removeInterval(day, i) {
		setHours((h) => ({
			...h,
			[day]: h[day].filter((_, idx) => idx !== i)
		}));
	}
	function closeDay(day) {
		setHours((h) => ({
			...h,
			[day]: []
		}));
	}
	if (loading) return /* @__PURE__ */ jsx("div", {
		style: S.page,
		children: /* @__PURE__ */ jsx("div", {
			style: S.card,
			children: "Loading…"
		})
	});
	return /* @__PURE__ */ jsx("div", {
		style: S.page,
		children: /* @__PURE__ */ jsxs("div", {
			style: {
				maxWidth: 780,
				margin: "0 auto",
				padding: "0 12px"
			},
			children: [
				/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "16px 0"
					},
					children: [/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(Link, {
							to: "/",
							style: {
								color: "#0D9488",
								textDecoration: "none",
								fontSize: 13,
								fontWeight: 700
							},
							children: "← Back"
						}),
						/* @__PURE__ */ jsx("h1", {
							style: {
								margin: "4px 0 0",
								fontSize: 22,
								fontWeight: 800,
								color: "#0F172A"
							},
							children: "Availability"
						}),
						/* @__PURE__ */ jsx("p", {
							style: {
								margin: "2px 0 0",
								fontSize: 13,
								color: "#64748B"
							},
							children: "Dispatch respects everything you set here."
						})
					] }), /* @__PURE__ */ jsx("button", {
						onClick: save,
						disabled: saving,
						style: S.saveBtn,
						children: saving ? "Saving…" : "Save"
					})]
				}),
				msg && /* @__PURE__ */ jsx("div", {
					style: {
						...S.card,
						background: msg.startsWith("Error") ? "#FEE2E2" : "#D1FAE5",
						color: msg.startsWith("Error") ? "#991B1B" : "#065F46",
						fontWeight: 700
					},
					children: msg
				}),
				/* @__PURE__ */ jsx("div", {
					className: "hv",
					children: /* @__PURE__ */ jsx(ProviderHomeSettings, {})
				}),
				isCarePhysician && /* @__PURE__ */ jsxs("div", {
					style: S.card,
					children: [
						/* @__PURE__ */ jsx("div", {
							style: S.h2,
							children: "Hospital Duty Preferences"
						}),
						/* @__PURE__ */ jsx("div", {
							style: S.hint,
							children: "Choose which types of hospital duties you want to receive. Multiple choice except All."
						}),
						/* @__PURE__ */ jsx("div", {
							style: {
								display: "flex",
								gap: 8,
								flexWrap: "wrap",
								marginTop: 14
							},
							children: DUTY_PREF_OPTIONS.map((opt) => {
								const isAll = opt.id === "all";
								const isAllActive = !cpDutyTypes || cpDutyTypes.length === 0 || cpDutyTypes.includes("all");
								const active = isAll ? isAllActive : !isAllActive && cpDutyTypes.includes(opt.id);
								return /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => handleCpDutyToggle(opt.id),
									style: {
										border: `2px solid ${active ? "#6D28D9" : "#E2E8F0"}`,
										background: active ? "#F5F3FF" : "#FFFFFF",
										color: "#0F172A",
										borderRadius: 14,
										padding: "10px 20px",
										fontWeight: 800,
										cursor: "pointer",
										fontFamily: "inherit",
										fontSize: 14,
										display: "inline-flex",
										alignItems: "center",
										justifyContent: "center",
										boxShadow: active ? "0 2px 5px rgba(109,40,217,0.15)" : "none",
										transition: "all 0.15s ease"
									},
									children: opt.label
								}, opt.id);
							})
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: S.card,
					children: [/* @__PURE__ */ jsxs("div", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between"
						},
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
							style: S.h2,
							children: isOnline ? "🟢 Online" : "🔴 Offline"
						}), /* @__PURE__ */ jsx("div", {
							style: S.hint,
							children: "Master switch. Off = no new dispatches at all."
						})] }), /* @__PURE__ */ jsx(Toggle, {
							on: isOnline,
							onChange: setIsOnline
						})]
					}), /* @__PURE__ */ jsxs("div", {
						style: {
							marginTop: 10,
							display: "flex",
							alignItems: "center",
							gap: 8
						},
						children: [/* @__PURE__ */ jsx("label", {
							style: S.label,
							children: "Timezone"
						}), /* @__PURE__ */ jsx("input", {
							value: timezone,
							onChange: (e) => setTimezone(e.target.value),
							style: S.input,
							placeholder: "Asia/Kolkata"
						})]
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: S.card,
					children: [
						/* @__PURE__ */ jsx("div", {
							style: S.h2,
							children: "Working hours"
						}),
						/* @__PURE__ */ jsx("div", {
							style: S.hint,
							children: "Add time windows per day. Empty = closed. Any windows = only accept during those windows."
						}),
						/* @__PURE__ */ jsx("div", {
							style: {
								marginTop: 10,
								display: "flex",
								flexDirection: "column",
								gap: 8
							},
							children: DAYS.map(([key, label]) => {
								const ivs = hours[key] || [];
								return /* @__PURE__ */ jsxs("div", {
									style: S.dayRow,
									children: [/* @__PURE__ */ jsx("div", {
										style: {
											width: 90,
											fontWeight: 700,
											color: "#0F172A"
										},
										children: label
									}), /* @__PURE__ */ jsxs("div", {
										style: {
											flex: 1,
											display: "flex",
											flexDirection: "column",
											gap: 6
										},
										children: [
											ivs.length === 0 && /* @__PURE__ */ jsx("div", {
												style: {
													fontSize: 12,
													color: "#94A3B8",
													fontStyle: "italic"
												},
												children: "Closed"
											}),
											ivs.map((iv, i) => /* @__PURE__ */ jsxs("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: 6
												},
												children: [
													/* @__PURE__ */ jsx("input", {
														type: "time",
														value: iv.start,
														onChange: (e) => updateInterval(key, i, { start: e.target.value }),
														style: S.time
													}),
													/* @__PURE__ */ jsx("span", {
														style: { color: "#94A3B8" },
														children: "–"
													}),
													/* @__PURE__ */ jsx("input", {
														type: "time",
														value: iv.end,
														onChange: (e) => updateInterval(key, i, { end: e.target.value }),
														style: S.time
													}),
													/* @__PURE__ */ jsx("button", {
														onClick: () => removeInterval(key, i),
														style: S.iconBtn,
														"aria-label": "Remove",
														children: "✕"
													})
												]
											}, i)),
											/* @__PURE__ */ jsxs("div", {
												style: {
													display: "flex",
													gap: 6
												},
												children: [/* @__PURE__ */ jsx("button", {
													onClick: () => addInterval(key),
													style: S.smBtn,
													children: "+ Add window"
												}), ivs.length > 0 && /* @__PURE__ */ jsx("button", {
													onClick: () => closeDay(key),
													style: {
														...S.smBtn,
														color: "#DC2626"
													},
													children: "Close day"
												})]
											})
										]
									})]
								}, key);
							})
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: S.card,
					children: [
						/* @__PURE__ */ jsx("div", {
							style: S.h2,
							children: "Blocked dates"
						}),
						/* @__PURE__ */ jsx("div", {
							style: S.hint,
							children: "Holidays, leave, personal days. You won't receive any dispatch these days."
						}),
						/* @__PURE__ */ jsxs("div", {
							style: {
								marginTop: 10,
								display: "flex",
								gap: 6,
								alignItems: "center"
							},
							children: [/* @__PURE__ */ jsx("input", {
								type: "date",
								value: newBlock,
								onChange: (e) => setNewBlock(e.target.value),
								style: S.input
							}), /* @__PURE__ */ jsx("button", {
								onClick: () => {
									if (newBlock && !blocked.includes(newBlock)) {
										setBlocked([...blocked, newBlock].sort());
										setNewBlock("");
									}
								},
								style: S.smBtn,
								children: "Add"
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							style: {
								marginTop: 10,
								display: "flex",
								flexWrap: "wrap",
								gap: 6
							},
							children: [blocked.length === 0 && /* @__PURE__ */ jsx("div", {
								style: {
									fontSize: 12,
									color: "#94A3B8"
								},
								children: "None"
							}), blocked.map((d) => /* @__PURE__ */ jsxs("span", {
								style: S.chip,
								children: [d, /* @__PURE__ */ jsx("button", {
									onClick: () => setBlocked(blocked.filter((x) => x !== d)),
									style: {
										marginLeft: 6,
										background: "transparent",
										border: "none",
										cursor: "pointer",
										color: "#64748B"
									},
									children: "✕"
								})]
							}, d))]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: S.card,
					children: [
						/* @__PURE__ */ jsx("div", {
							style: S.h2,
							children: "Services"
						}),
						/* @__PURE__ */ jsx("div", {
							style: S.hint,
							children: "Turn specific service types on or off. Anything left \"On\" (default) receives dispatch."
						}),
						/* @__PURE__ */ jsx("div", {
							style: {
								marginTop: 10,
								display: "flex",
								flexDirection: "column",
								gap: 6
							},
							children: allServices.map((svc) => {
								const on = serviceOnline[svc] !== false;
								return /* @__PURE__ */ jsxs("div", {
									style: {
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										padding: "6px 4px",
										borderBottom: "1px solid #F1F5F9"
									},
									children: [/* @__PURE__ */ jsx("div", {
										style: {
											fontSize: 14,
											color: "#0F172A"
										},
										children: svc
									}), /* @__PURE__ */ jsx(Toggle, {
										on,
										onChange: (v) => setServiceOnline({
											...serviceOnline,
											[svc]: v
										})
									})]
								}, svc);
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							style: {
								marginTop: 10,
								display: "flex",
								gap: 6
							},
							children: [/* @__PURE__ */ jsx("input", {
								value: customService,
								onChange: (e) => setCustomService(e.target.value),
								placeholder: "Add custom service",
								style: S.input
							}), /* @__PURE__ */ jsx("button", {
								onClick: () => {
									const s = customService.trim();
									if (s) {
										setServiceOnline({
											...serviceOnline,
											[s]: true
										});
										setCustomService("");
									}
								},
								style: S.smBtn,
								children: "Add"
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: S.card,
					children: [
						/* @__PURE__ */ jsx("div", {
							style: {
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between"
							},
							children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
								style: S.h2,
								children: "🌙 Do-Not-Disturb windows"
							}), /* @__PURE__ */ jsx("div", {
								style: S.hint,
								children: "Separate from working hours. Non-emergency requests are auto-declined during these windows."
							})] })
						}),
						/* @__PURE__ */ jsxs("div", {
							style: {
								marginTop: 10,
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								padding: "8px 10px",
								background: "#FEF3C7",
								borderRadius: 8
							},
							children: [/* @__PURE__ */ jsx("div", {
								style: {
									fontSize: 13,
									fontWeight: 700,
									color: "#92400E"
								},
								children: "Let emergencies ring through"
							}), /* @__PURE__ */ jsx(Toggle, {
								on: dndAllowEmergency,
								onChange: setDndAllowEmergency
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							style: {
								marginTop: 10,
								display: "flex",
								flexDirection: "column",
								gap: 8
							},
							children: [
								dndWindows.length === 0 && /* @__PURE__ */ jsx("div", {
									style: {
										fontSize: 12,
										color: "#94A3B8",
										fontStyle: "italic"
									},
									children: "No DND windows. Add one below (e.g. sleep 22:00 – 07:00)."
								}),
								dndWindows.map((w, i) => /* @__PURE__ */ jsxs("div", {
									style: {
										border: "1px solid #E2E8F0",
										borderRadius: 10,
										padding: 10
									},
									children: [
										/* @__PURE__ */ jsxs("div", {
											style: {
												display: "flex",
												alignItems: "center",
												gap: 6,
												marginBottom: 8
											},
											children: [
												/* @__PURE__ */ jsx("input", {
													placeholder: "Label (e.g. Sleep)",
													value: w.label || "",
													onChange: (e) => setDndWindows((ws) => ws.map((x, idx) => idx === i ? {
														...x,
														label: e.target.value
													} : x)),
													style: {
														...S.input,
														flex: 1
													}
												}),
												/* @__PURE__ */ jsx("input", {
													type: "time",
													value: w.start,
													onChange: (e) => setDndWindows((ws) => ws.map((x, idx) => idx === i ? {
														...x,
														start: e.target.value
													} : x)),
													style: S.time
												}),
												/* @__PURE__ */ jsx("span", {
													style: { color: "#94A3B8" },
													children: "–"
												}),
												/* @__PURE__ */ jsx("input", {
													type: "time",
													value: w.end,
													onChange: (e) => setDndWindows((ws) => ws.map((x, idx) => idx === i ? {
														...x,
														end: e.target.value
													} : x)),
													style: S.time
												}),
												/* @__PURE__ */ jsx("button", {
													onClick: () => setDndWindows((ws) => ws.filter((_, idx) => idx !== i)),
													style: S.iconBtn,
													"aria-label": "Remove",
													children: "✕"
												})
											]
										}),
										/* @__PURE__ */ jsxs("div", {
											style: {
												display: "flex",
												flexWrap: "wrap",
												gap: 4
											},
											children: [DAYS.map(([key, label]) => {
												const active = (w.days || []).includes(key);
												return /* @__PURE__ */ jsx("button", {
													onClick: () => setDndWindows((ws) => ws.map((x, idx) => {
														if (idx !== i) return x;
														const days = x.days || [];
														return {
															...x,
															days: active ? days.filter((d) => d !== key) : [...days, key]
														};
													})),
													style: {
														padding: "4px 10px",
														fontSize: 11,
														fontWeight: 700,
														borderRadius: 99,
														border: active ? "1px solid #6366F1" : "1px solid #E2E8F0",
														background: active ? "#EEF2FF" : "#fff",
														color: active ? "#4338CA" : "#64748B",
														cursor: "pointer"
													},
													children: label.slice(0, 3)
												}, key);
											}), (w.days || []).length === 0 && /* @__PURE__ */ jsx("span", {
												style: {
													fontSize: 10,
													color: "#94A3B8",
													alignSelf: "center",
													marginLeft: 4
												},
												children: "every day"
											})]
										}),
										w.start && w.end && w.start > w.end && /* @__PURE__ */ jsx("div", {
											style: {
												marginTop: 6,
												fontSize: 10,
												color: "#6366F1"
											},
											children: "Overnight window (crosses midnight)"
										})
									]
								}, i)),
								/* @__PURE__ */ jsx("button", {
									onClick: () => setDndWindows((ws) => [...ws, {
										start: "22:00",
										end: "07:00",
										days: [],
										label: "Sleep"
									}]),
									style: S.smBtn,
									children: "+ Add DND window"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ jsx("div", { style: { height: 40 } })
			]
		})
	});
}
function Toggle({ on, onChange }) {
	return /* @__PURE__ */ jsx("button", {
		onClick: () => onChange(!on),
		"aria-pressed": on,
		style: {
			width: 46,
			height: 26,
			borderRadius: 99,
			border: "none",
			cursor: "pointer",
			background: on ? "#10B981" : "#CBD5E1",
			position: "relative",
			transition: "background .15s"
		},
		children: /* @__PURE__ */ jsx("span", { style: {
			position: "absolute",
			top: 3,
			left: on ? 23 : 3,
			width: 20,
			height: 20,
			borderRadius: "50%",
			background: "#fff",
			boxShadow: "0 1px 3px rgba(0,0,0,.2)",
			transition: "left .15s"
		} })
	});
}
var S = {
	page: {
		minHeight: "100vh",
		background: "#F8FAFC",
		fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
		paddingBottom: 40
	},
	card: {
		background: "#fff",
		border: "1px solid #E2E8F0",
		borderRadius: 14,
		padding: 14,
		marginBottom: 12,
		boxShadow: "0 1px 3px rgba(15,23,42,.04)"
	},
	h2: {
		fontSize: 15,
		fontWeight: 800,
		color: "#0F172A",
		marginBottom: 2
	},
	hint: {
		fontSize: 12,
		color: "#64748B"
	},
	label: {
		fontSize: 12,
		fontWeight: 700,
		color: "#475569"
	},
	input: {
		flex: 1,
		padding: "8px 10px",
		fontSize: 13,
		border: "1px solid #CBD5E1",
		borderRadius: 8,
		background: "#fff",
		color: "#0F172A"
	},
	time: {
		padding: "6px 8px",
		fontSize: 13,
		border: "1px solid #CBD5E1",
		borderRadius: 8,
		background: "#fff",
		color: "#0F172A"
	},
	smBtn: {
		padding: "6px 10px",
		fontSize: 12,
		fontWeight: 700,
		background: "#F1F5F9",
		border: "1px solid #E2E8F0",
		borderRadius: 8,
		cursor: "pointer",
		color: "#0F172A"
	},
	iconBtn: {
		padding: "4px 8px",
		fontSize: 12,
		background: "transparent",
		border: "1px solid #E2E8F0",
		borderRadius: 6,
		cursor: "pointer",
		color: "#64748B"
	},
	saveBtn: {
		padding: "9px 18px",
		fontSize: 14,
		fontWeight: 800,
		background: "linear-gradient(135deg,#0D9488,#14B8A6)",
		color: "#fff",
		border: "none",
		borderRadius: 10,
		cursor: "pointer",
		boxShadow: "0 2px 6px -2px rgba(13,148,136,.5)"
	},
	dayRow: {
		display: "flex",
		alignItems: "flex-start",
		gap: 10,
		padding: "8px 0",
		borderBottom: "1px solid #F1F5F9"
	},
	chip: {
		display: "inline-flex",
		alignItems: "center",
		padding: "4px 8px",
		fontSize: 12,
		fontWeight: 700,
		background: "#FEF3C7",
		color: "#92400E",
		borderRadius: 99
	}
};
//#endregion
export { ProviderAvailability as component };
