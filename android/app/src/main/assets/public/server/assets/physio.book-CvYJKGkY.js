import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { n as SlotPickerCalendarStandalone } from "./SlotPickerCalendar-bFLJDs2V.js";
import { l as togglePhysioFavoriteTherapist, n as bookPhysioVisit, o as getPhysioTherapistRoster, r as bookPhysioVisitWithTherapist, s as getPhysioTherapistSlots, t as THERAPY_LABEL } from "./physio-patient.functions-CymDwMqO.js";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/routes/physio.book.tsx?tsr-split=component
var THERAPY_FEE = {
	neuro: 1200,
	orthopaedic: 900,
	sports: 1e3,
	paediatric: 900,
	geriatric: 800,
	cardio_respiratory: 1e3,
	post_surgical: 1100,
	pelvic_floor: 1e3,
	general: 700
};
function toLocalInputValue(d) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function BookPhysioVisit() {
	const book = useServerFn(bookPhysioVisit);
	const bookWithTherapist = useServerFn(bookPhysioVisitWithTherapist);
	const fetchRoster = useServerFn(getPhysioTherapistRoster);
	const fetchSlots = useServerFn(getPhysioTherapistSlots);
	const toggleFavorite = useServerFn(togglePhysioFavoriteTherapist);
	const navigate = useNavigate();
	const qc = useQueryClient();
	const [form, setForm] = useState({
		therapyType: "general",
		area: "",
		city: "Pune",
		address: "",
		scheduledAt: toLocalInputValue(new Date(Date.now() + 936e5)),
		durationMin: 45,
		urgency: "planned",
		notes: ""
	});
	const [error, setError] = useState("");
	const [selectedTherapistId, setSelectedTherapistId] = useState(null);
	const [slotIso, setSlotIso] = useState("");
	const rosterQuery = useQuery({
		queryKey: ["physio-therapist-roster"],
		queryFn: () => fetchRoster({})
	});
	const roster = rosterQuery.data ?? [];
	const selectedTherapist = roster.find((t) => t.therapistId === selectedTherapistId) ?? null;
	const slotsQuery = useQuery({
		queryKey: [
			"physio-therapist-slots",
			selectedTherapistId,
			form.durationMin
		],
		queryFn: () => fetchSlots({ data: {
			therapistId: selectedTherapistId,
			durationMin: form.durationMin,
			startDate: toLocalInputValue(/* @__PURE__ */ new Date()).slice(0, 10),
			endDate: toLocalInputValue(new Date(Date.now() + 12096e5)).slice(0, 10)
		} }),
		enabled: !!selectedTherapistId
	});
	const openSlotCount = (slotsQuery.data ?? []).filter((s) => s.isAvailable).length;
	const favoriteMutation = useMutation({
		mutationFn: (therapistId) => toggleFavorite({ data: { therapistId } }),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["physio-therapist-roster"] }),
		onError: (e) => setError(e instanceof Error ? e.message : "Could not update favourite")
	});
	const anyAvailableMutation = useMutation({
		mutationFn: () => book({ data: {
			therapyType: form.therapyType,
			area: form.area,
			city: form.city,
			address: form.address || null,
			scheduledAt: new Date(form.scheduledAt).toISOString(),
			durationMin: form.durationMin,
			urgency: form.urgency,
			fee: THERAPY_FEE[form.therapyType] ?? null,
			notes: form.notes || null
		} }),
		onSuccess: () => navigate({ to: "/physio/visits" }),
		onError: (e) => setError(e instanceof Error ? e.message : "Could not book the session")
	});
	const withTherapistMutation = useMutation({
		mutationFn: () => bookWithTherapist({ data: {
			therapistId: selectedTherapistId,
			therapyType: form.therapyType,
			area: form.area,
			city: form.city,
			address: form.address || null,
			startTime: slotIso,
			durationMin: form.durationMin,
			urgency: form.urgency,
			notes: form.notes || null
		} }),
		onSuccess: () => navigate({ to: "/physio/visits" }),
		onError: (e) => setError(e instanceof Error ? e.message : "Could not book that slot")
	});
	const pending = anyAvailableMutation.isPending || withTherapistMutation.isPending;
	const fee = THERAPY_FEE[form.therapyType];
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-[100dvh] bg-[#DCE6E1] text-slate-900",
		children: [/* @__PURE__ */ jsx("header", {
			className: "border-b border-slate-200 bg-white px-4 py-4",
			children: /* @__PURE__ */ jsxs("div", {
				className: "mx-auto flex max-w-3xl items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-lg font-extrabold",
					children: "Book home physiotherapy"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-xs text-slate-500",
					children: "A verified therapist visits you at home"
				})] }), /* @__PURE__ */ jsx(Link, {
					to: "/physio/visits",
					className: "text-xs font-semibold text-teal-700",
					children: "My visits →"
				})]
			})
		}), /* @__PURE__ */ jsx("main", {
			className: "mx-auto max-w-3xl px-4 py-4",
			children: /* @__PURE__ */ jsxs("form", {
				className: "space-y-4 rounded-2xl border border-slate-200 bg-white p-4",
				onSubmit: (e) => {
					e.preventDefault();
					setError("");
					if (selectedTherapistId) {
						if (!slotIso) {
							setError("Pick an available time slot");
							return;
						}
						withTherapistMutation.mutate();
					} else anyAvailableMutation.mutate();
				},
				children: [
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
						className: "mb-2 text-xs font-bold text-slate-600",
						children: "Therapy type"
					}), /* @__PURE__ */ jsx("div", {
						className: "grid grid-cols-2 gap-2 sm:grid-cols-3",
						children: Object.entries(THERAPY_LABEL).map(([key, label]) => /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setForm((f) => ({
								...f,
								therapyType: key
							})),
							className: `rounded-xl border px-3 py-2 text-left text-xs font-semibold ${form.therapyType === key ? "border-teal-600 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600"}`,
							children: [label, /* @__PURE__ */ jsxs("span", {
								className: "block text-[11px] font-normal text-slate-400",
								children: [
									"₹",
									THERAPY_FEE[key],
									"/session"
								]
							})]
						}, key))
					})] }),
					/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
						className: "mb-2 text-xs font-bold text-slate-600",
						children: "Choose your physiotherapist"
					}), /* @__PURE__ */ jsxs("div", {
						className: "space-y-2",
						children: [/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => {
								setSelectedTherapistId(null);
								setSlotIso("");
							},
							className: `flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${selectedTherapistId === null ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"}`,
							children: [/* @__PURE__ */ jsx("span", {
								className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base",
								children: "📡"
							}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("span", {
								className: "block text-sm font-bold text-slate-900",
								children: "Any available therapist"
							}), /* @__PURE__ */ jsx("span", {
								className: "block text-[11px] text-slate-500",
								children: "Request a time — our partner network assigns a therapist for you"
							})] })]
						}), rosterQuery.isLoading ? /* @__PURE__ */ jsx("div", {
							className: "rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500",
							children: "Loading therapists…"
						}) : roster.map((t) => /* @__PURE__ */ jsxs("div", {
							className: `flex items-center gap-3 rounded-xl border px-3 py-2.5 ${selectedTherapistId === t.therapistId ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white"}`,
							children: [/* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: () => {
									setSelectedTherapistId(t.therapistId);
									setSlotIso("");
								},
								className: "flex flex-1 items-center gap-3 text-left",
								children: [/* @__PURE__ */ jsx("span", {
									className: "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700",
									children: t.name.split(" ").map((w) => w[0]).slice(0, 2).join("")
								}), /* @__PURE__ */ jsxs("span", {
									className: "min-w-0",
									children: [/* @__PURE__ */ jsx("span", {
										className: "block text-sm font-bold text-slate-900",
										children: t.name
									}), /* @__PURE__ */ jsxs("span", {
										className: "block text-[11px] text-slate-500",
										children: [t.area ? `${t.area} · ` : "", t.specializations.length ? t.specializations.join(", ") : "Physiotherapist"]
									})]
								})]
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => favoriteMutation.mutate(t.therapistId),
								"aria-label": "Favourite",
								className: "shrink-0 p-1 text-lg",
								style: { color: t.isFavorite ? "#EF4444" : "#CBD5E1" },
								children: "♥"
							})]
						}, t.therapistId))]
					})] }),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-1 gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs("label", {
							className: "block text-xs font-semibold text-slate-600",
							children: ["Area / locality", /* @__PURE__ */ jsx("input", {
								required: true,
								maxLength: 100,
								value: form.area,
								onChange: (e) => setForm((f) => ({
									...f,
									area: e.target.value
								})),
								placeholder: "e.g. Koregaon Park",
								className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
							})]
						}), /* @__PURE__ */ jsxs("label", {
							className: "block text-xs font-semibold text-slate-600",
							children: ["City", /* @__PURE__ */ jsx("input", {
								required: true,
								maxLength: 100,
								value: form.city,
								onChange: (e) => setForm((f) => ({
									...f,
									city: e.target.value
								})),
								className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "block text-xs font-semibold text-slate-600",
						children: ["Full address", /* @__PURE__ */ jsx("textarea", {
							maxLength: 500,
							rows: 2,
							value: form.address,
							onChange: (e) => setForm((f) => ({
								...f,
								address: e.target.value
							})),
							placeholder: "Flat, building, street, landmark",
							className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid grid-cols-1 gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs("label", {
							className: "block text-xs font-semibold text-slate-600",
							children: ["Duration", /* @__PURE__ */ jsx("select", {
								value: form.durationMin,
								onChange: (e) => {
									setForm((f) => ({
										...f,
										durationMin: Number(e.target.value)
									}));
									setSlotIso("");
								},
								className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm",
								children: [
									30,
									45,
									60,
									90
								].map((m) => /* @__PURE__ */ jsxs("option", {
									value: m,
									children: [m, " minutes"]
								}, m))
							})]
						}), /* @__PURE__ */ jsxs("label", {
							className: "block text-xs font-semibold text-slate-600",
							children: ["Urgency", /* @__PURE__ */ jsxs("select", {
								value: form.urgency,
								onChange: (e) => setForm((f) => ({
									...f,
									urgency: e.target.value
								})),
								className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm",
								children: [/* @__PURE__ */ jsx("option", {
									value: "planned",
									children: "Planned"
								}), /* @__PURE__ */ jsx("option", {
									value: "urgent",
									children: "Urgent (same day priority)"
								})]
							})]
						})]
					}),
					selectedTherapistId ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
						className: "mb-2 flex items-baseline justify-between",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "text-xs font-bold text-slate-600",
							children: [selectedTherapist?.name ?? "Therapist", "'s availability"]
						}), slotsQuery.isFetched ? /* @__PURE__ */ jsxs("div", {
							className: "text-[11px] text-slate-500",
							children: [openSlotCount, " open slots in the next 2 weeks"]
						}) : null]
					}), /* @__PURE__ */ jsx(SlotPickerCalendarStandalone, {
						days: 14,
						accent: "#0D9488",
						value: slotIso,
						onChange: setSlotIso
					})] }) : /* @__PURE__ */ jsxs("label", {
						className: "block text-xs font-semibold text-slate-600",
						children: ["Date & time", /* @__PURE__ */ jsx("input", {
							required: true,
							type: "datetime-local",
							value: form.scheduledAt,
							min: toLocalInputValue(/* @__PURE__ */ new Date()),
							onChange: (e) => setForm((f) => ({
								...f,
								scheduledAt: e.target.value
							})),
							className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "block text-xs font-semibold text-slate-600",
						children: ["Notes for the therapist (optional)", /* @__PURE__ */ jsx("textarea", {
							maxLength: 1e3,
							rows: 3,
							value: form.notes,
							onChange: (e) => setForm((f) => ({
								...f,
								notes: e.target.value
							})),
							placeholder: "Condition, mobility constraints, equipment needed…",
							className: "mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm"
						})]
					}),
					error ? /* @__PURE__ */ jsx("div", {
						className: "rounded-xl bg-red-50 px-4 py-2 text-xs font-semibold text-red-700",
						children: error
					}) : null,
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between border-t border-slate-100 pt-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "text-sm",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "text-slate-500",
									children: "Session fee: "
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "font-extrabold",
									children: ["₹", fee]
								}),
								/* @__PURE__ */ jsx("span", {
									className: "block text-[11px] text-slate-400",
									children: selectedTherapistId ? "Payable after the session · confirmed instantly for this therapist's slot" : "Payable after the session · therapist assigned by our partner network"
								})
							]
						}), /* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: pending,
							className: "rounded-full bg-teal-600 px-6 py-2 text-sm font-bold text-white disabled:opacity-60",
							children: pending ? "Booking…" : "Book session"
						})]
					})
				]
			})
		})]
	});
}
//#endregion
export { BookPhysioVisit as component };
