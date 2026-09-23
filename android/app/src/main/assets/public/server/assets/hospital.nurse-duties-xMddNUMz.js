import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { a as NURSE_SKILL_LABEL, i as NURSE_SKILLS, u as SHIFT_PREFS } from "./care-staff-catalog-C1GuGVZe.js";
import { t as Button } from "./button-BT328xhy.js";
import { n as getFacilityNurseDuties, r as postFacilityNurseDuty } from "./booking-tracking.functions-DTbwSr2x.js";
import { c as Stat, f as inputClass, i as Field, o as Section, r as Empty, s as StaffShell, t as Card } from "./StaffUI-k1pvanXG.js";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { CalendarClock, ClipboardList, IndianRupee, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/routes/hospital.nurse-duties.tsx?tsr-split=component
var OPEN = /* @__PURE__ */ new Set([
	"requested",
	"searching",
	"expanded",
	"offered",
	"unavailable"
]);
var STAGE = {
	requested: "Posted",
	searching: "Searching nurses",
	expanded: "Search widened",
	offered: "Nurses notified",
	accepted: "Nurse assigned",
	en_route: "On the way",
	arrived: "Arrived",
	started: "On duty",
	completed: "Completed",
	cancelled: "Cancelled",
	unavailable: "No nurse yet"
};
function HospitalNurseDuties() {
	const fetchDuties = useServerFn(getFacilityNurseDuties);
	const postDuty = useServerFn(postFacilityNurseDuty);
	const queryClient = useQueryClient();
	const board = useQuery({
		queryKey: ["facility-nurse-duties"],
		queryFn: () => fetchDuties({}),
		refetchInterval: 15e3
	});
	const boardData = board.data;
	const hospitals = boardData?.hospitals ?? [];
	const [hospitalId, setHospitalId] = useState("");
	const [skill, setSkill] = useState(NURSE_SKILLS[0]?.value ?? "ward");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [shift, setShift] = useState(SHIFT_PREFS[0]?.value ?? "day");
	const [scheduledFor, setScheduledFor] = useState("");
	const [hours, setHours] = useState(8);
	const [payInr, setPayInr] = useState(1200);
	const [priority, setPriority] = useState("normal");
	const chosenHospital = hospitalId || hospitals[0]?.id || "";
	const post = useMutation({
		mutationFn: () => postDuty({ data: {
			hospitalId: chosenHospital,
			skill,
			title: title.trim(),
			description: description.trim() || void 0,
			shift,
			scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : void 0,
			durationMinutes: Math.round(hours * 60),
			payInr,
			priority
		} }),
		onSuccess: () => {
			setTitle("");
			setDescription("");
			queryClient.invalidateQueries({ queryKey: ["facility-nurse-duties"] });
		}
	});
	const duties = boardData?.duties ?? [];
	const offers = boardData?.offers ?? [];
	const offersByDuty = useMemo(() => {
		const map = /* @__PURE__ */ new Map();
		for (const offer of offers) map.set(offer.booking_id, [...map.get(offer.booking_id) ?? [], offer]);
		return map;
	}, [offers]);
	return /* @__PURE__ */ jsxs(StaffShell, {
		title: "Nurse duties",
		subtitle: "Post a duty and MedConnect offers it to verified nurses nearby straight away",
		right: /* @__PURE__ */ jsx(Button, {
			asChild: true,
			size: "sm",
			variant: "outline",
			children: /* @__PURE__ */ jsx(Link, {
				to: "/nurses/find",
				children: "Browse nurses"
			})
		}),
		children: [/* @__PURE__ */ jsxs("div", {
			className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
			children: [
				/* @__PURE__ */ jsx(Stat, {
					label: "Open duties",
					value: duties.filter((duty) => OPEN.has(duty.status)).length
				}),
				/* @__PURE__ */ jsx(Stat, {
					label: "Nurse assigned",
					value: duties.filter((duty) => [
						"accepted",
						"en_route",
						"arrived",
						"started"
					].includes(duty.status)).length,
					tone: "slate"
				}),
				/* @__PURE__ */ jsx(Stat, {
					label: "Completed",
					value: duties.filter((duty) => duty.status === "completed").length,
					tone: "slate"
				}),
				/* @__PURE__ */ jsx(Stat, {
					label: "Nurses notified",
					value: duties.reduce((sum, duty) => sum + (duty.notified_provider_count ?? 0), 0),
					tone: "slate"
				})
			]
		}), board.isLoading ? /* @__PURE__ */ jsx(Empty, { children: "Loading your duty board…" }) : hospitals.length === 0 ? /* @__PURE__ */ jsx(Empty, { children: "This account is not linked to a hospital yet. Ask the MedConnect admin team to link your hospital, then post duties here." }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Section, {
			title: "Post a duty",
			children: /* @__PURE__ */ jsxs(Card, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-3 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ jsx(Field, {
							label: "Hospital or clinic",
							children: /* @__PURE__ */ jsx("select", {
								className: inputClass,
								value: chosenHospital,
								onChange: (event) => setHospitalId(event.target.value),
								children: hospitals.map((hospital) => /* @__PURE__ */ jsxs("option", {
									value: hospital.id,
									children: [hospital.name, hospital.area ? ` · ${hospital.area}` : ""]
								}, hospital.id))
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Nursing skill needed",
							children: /* @__PURE__ */ jsx("select", {
								className: inputClass,
								value: skill,
								onChange: (event) => setSkill(event.target.value),
								children: NURSE_SKILLS.map((option) => /* @__PURE__ */ jsx("option", {
									value: option.value,
									children: option.label
								}, option.value))
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Duty title",
							children: /* @__PURE__ */ jsx("input", {
								className: inputClass,
								value: title,
								onChange: (event) => setTitle(event.target.value),
								placeholder: "Night ICU cover — 2 beds"
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Shift",
							children: /* @__PURE__ */ jsx("select", {
								className: inputClass,
								value: shift,
								onChange: (event) => setShift(event.target.value),
								children: SHIFT_PREFS.map((option) => /* @__PURE__ */ jsx("option", {
									value: option.value,
									children: option.label
								}, option.value))
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Starts at",
							children: /* @__PURE__ */ jsx("input", {
								className: inputClass,
								type: "datetime-local",
								value: scheduledFor,
								onChange: (event) => setScheduledFor(event.target.value)
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Duty length (hours)",
							children: /* @__PURE__ */ jsx("input", {
								className: inputClass,
								type: "number",
								min: 1,
								max: 24,
								value: hours,
								onChange: (event) => setHours(Number(event.target.value))
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Pay for the duty (₹)",
							children: /* @__PURE__ */ jsx("input", {
								className: inputClass,
								type: "number",
								min: 0,
								step: 50,
								value: payInr,
								onChange: (event) => setPayInr(Number(event.target.value))
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Urgency",
							children: /* @__PURE__ */ jsxs("select", {
								className: inputClass,
								value: priority,
								onChange: (event) => setPriority(event.target.value),
								children: [
									/* @__PURE__ */ jsx("option", {
										value: "normal",
										children: "Planned"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "urgent",
										children: "Urgent"
									}),
									/* @__PURE__ */ jsx("option", {
										value: "emergency",
										children: "Emergency"
									})
								]
							})
						}),
						/* @__PURE__ */ jsx("div", {
							className: "sm:col-span-2",
							children: /* @__PURE__ */ jsx(Field, {
								label: "Anything the nurse should know",
								children: /* @__PURE__ */ jsx("textarea", {
									className: inputClass,
									rows: 3,
									value: description,
									onChange: (event) => setDescription(event.target.value),
									placeholder: "Ward, reporting person, patient load, entry gate"
								})
							})
						})
					]
				}),
				post.error ? /* @__PURE__ */ jsx("p", {
					role: "alert",
					className: "mt-2 text-sm font-semibold text-rose-700",
					children: post.error.message
				}) : null,
				post.isSuccess ? /* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm font-semibold text-emerald-700",
					children: "Duty posted — nurses nearby are being contacted now."
				}) : null,
				/* @__PURE__ */ jsx("div", {
					className: "mt-3",
					children: /* @__PURE__ */ jsxs(Button, {
						onClick: () => post.mutate(),
						disabled: post.isPending || !title.trim(),
						children: [/* @__PURE__ */ jsx(ClipboardList, {}), post.isPending ? "Posting…" : "Post duty to nurses"]
					})
				})
			] })
		}), /* @__PURE__ */ jsx(Section, {
			title: "Duties posted",
			count: duties.length,
			children: duties.length ? /* @__PURE__ */ jsx("div", {
				className: "space-y-3",
				children: duties.map((duty) => {
					const dutyOffers = offersByDuty.get(duty.id) ?? [];
					const assignedName = duty.assigned_provider_id ? boardData?.nameById[duty.assigned_provider_id] : null;
					return /* @__PURE__ */ jsxs(Card, {
						accent: duty.priority !== "normal",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-wrap items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "min-w-0",
									children: [
										/* @__PURE__ */ jsxs("p", {
											className: "text-[11px] font-extrabold uppercase text-clinical-strong",
											children: [
												NURSE_SKILL_LABEL[duty.service_code ?? ""] ?? duty.service_code ?? "Nursing",
												" · ",
												duty.priority
											]
										}),
										/* @__PURE__ */ jsx("p", {
											className: "truncate text-sm font-bold",
											children: duty.title
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "text-xs text-muted-foreground",
											children: [
												/* @__PURE__ */ jsx(CalendarClock, { className: "mr-1 inline size-3" }),
												duty.scheduled_for ? new Date(duty.scheduled_for).toLocaleString() : "As soon as possible",
												" · ",
												Math.round((duty.duration_minutes ?? 60) / 60),
												" h"
											]
										})
									]
								}), /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase",
									children: STAGE[duty.status] ?? duty.status
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-2 grid grid-cols-3 gap-2 text-xs",
								children: [
									/* @__PURE__ */ jsxs("p", {
										className: "rounded-xl bg-muted p-2 font-semibold",
										children: [/* @__PURE__ */ jsx(IndianRupee, { className: "mr-1 inline size-3" }), duty.estimated_earnings ?? 0]
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "rounded-xl bg-muted p-2 font-semibold",
										children: [
											/* @__PURE__ */ jsx(Users, { className: "mr-1 inline size-3" }),
											duty.notified_provider_count ?? 0,
											" notified"
										]
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "rounded-xl bg-muted p-2 font-semibold",
										children: [duty.current_radius_km, " km search"]
									})
								]
							}),
							assignedName ? /* @__PURE__ */ jsxs("p", {
								className: "mt-2 text-sm font-bold text-emerald-700",
								children: ["Assigned to ", assignedName]
							}) : null,
							dutyOffers.length ? /* @__PURE__ */ jsx("ul", {
								className: "mt-2 space-y-1 text-[11px] text-muted-foreground",
								children: dutyOffers.slice(0, 6).map((offer) => /* @__PURE__ */ jsxs("li", { children: [
									boardData?.nameById[offer.provider_id ?? ""] ?? "Nurse",
									" · ",
									offer.status,
									offer.distance_km != null ? ` · ${Number(offer.distance_km).toFixed(1)} km` : ""
								] }, offer.id))
							}) : null
						]
					}, duty.id);
				})
			}) : /* @__PURE__ */ jsx(Empty, { children: "No duties posted yet. Post one above and nurses nearby will see it on their home screen." })
		})] })]
	});
}
//#endregion
export { HospitalNurseDuties as component };
