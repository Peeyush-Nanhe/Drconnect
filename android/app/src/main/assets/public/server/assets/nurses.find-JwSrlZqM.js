import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { a as NURSE_SKILL_LABEL, c as PUNE_AREAS, i as NURSE_SKILLS, l as SHIFT_LABEL, u as SHIFT_PREFS } from "./care-staff-catalog-C1GuGVZe.js";
import { f as inputClass, i as Field, l as Switch, n as Chips, o as Section, r as Empty, s as StaffShell, t as Card } from "./StaffUI-k1pvanXG.js";
import { i as searchNurses } from "./nurse.functions-CuDC3Xdz.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useQuery } from "@tanstack/react-query";
//#region src/routes/nurses.find.tsx?tsr-split=component
function FindNurse() {
	const search = useServerFn(searchNurses);
	const [skills, setSkills] = useState([]);
	const [area, setArea] = useState("");
	const [shift, setShift] = useState("");
	const [minExperience, setMinExperience] = useState(0);
	const [onlineOnly, setOnlineOnly] = useState(false);
	const [homeCareOnly, setHomeCareOnly] = useState(false);
	const query = useQuery({
		queryKey: [
			"nurse-search",
			skills,
			area,
			shift,
			minExperience,
			onlineOnly,
			homeCareOnly
		],
		queryFn: () => search({ data: {
			skills,
			area: area || null,
			shift: shift || null,
			minExperience: minExperience || null,
			onlineOnly,
			homeCareOnly
		} })
	});
	const nurses = query.data?.nurses ?? [];
	return /* @__PURE__ */ jsxs(StaffShell, {
		title: "Find a nurse",
		subtitle: "Filter by skills, ward, shift and area",
		right: /* @__PURE__ */ jsx(Link, {
			to: "/hospital/nurse-duties",
			className: "text-sm font-semibold text-teal-700 hover:underline",
			children: "Post a nurse duty →"
		}),
		children: [/* @__PURE__ */ jsxs(Card, { children: [
			/* @__PURE__ */ jsx("h3", {
				className: "mb-2 text-sm font-extrabold",
				children: "Skills & wards needed"
			}),
			/* @__PURE__ */ jsx(Chips, {
				options: NURSE_SKILLS,
				selected: skills,
				onToggle: (v) => setSkills((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v]),
				grouped: true
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 grid gap-3 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ jsx(Field, {
						label: "Area",
						children: /* @__PURE__ */ jsxs("select", {
							className: inputClass,
							value: area,
							onChange: (e) => setArea(e.target.value),
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "Any area"
							}), PUNE_AREAS.map((a) => /* @__PURE__ */ jsx("option", {
								value: a,
								children: a
							}, a))]
						})
					}),
					/* @__PURE__ */ jsx(Field, {
						label: "Shift",
						children: /* @__PURE__ */ jsxs("select", {
							className: inputClass,
							value: shift,
							onChange: (e) => setShift(e.target.value),
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "Any shift"
							}), SHIFT_PREFS.map((s) => /* @__PURE__ */ jsx("option", {
								value: s.value,
								children: s.label
							}, s.value))]
						})
					}),
					/* @__PURE__ */ jsx(Field, {
						label: "Minimum experience (years)",
						children: /* @__PURE__ */ jsx("input", {
							type: "number",
							min: 0,
							max: 40,
							className: inputClass,
							value: minExperience,
							onChange: (e) => setMinExperience(Number(e.target.value))
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-2",
				children: [/* @__PURE__ */ jsx(Switch, {
					on: onlineOnly,
					onChange: setOnlineOnly,
					label: "Only nurses online now"
				}), /* @__PURE__ */ jsx(Switch, {
					on: homeCareOnly,
					onChange: setHomeCareOnly,
					label: "Only home-care nurses"
				})]
			})
		] }), /* @__PURE__ */ jsx(Section, {
			title: "Matching nurses",
			count: nurses.length,
			children: query.isLoading ? /* @__PURE__ */ jsx(Empty, { children: "Searching…" }) : query.isError ? /* @__PURE__ */ jsx(Empty, { children: query.error instanceof Error ? query.error.message : "Could not search nurses." }) : !nurses.length ? /* @__PURE__ */ jsx(Empty, { children: "No nurse matches these filters. Try fewer skills or a wider area." }) : /* @__PURE__ */ jsx("div", {
				className: "space-y-3",
				children: nurses.map((n) => /* @__PURE__ */ jsxs(Card, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-start justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "text-sm font-extrabold",
									children: [n.fullName, n.verified ? /* @__PURE__ */ jsx("span", {
										className: "ml-2 text-[10px] font-bold text-teal-700",
										children: "verified"
									}) : null]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "text-xs text-slate-500",
									children: [
										n.specialty ?? "Nurse",
										" · ",
										n.yearsExperience,
										" yrs · ",
										n.city
									]
								}),
								/* @__PURE__ */ jsx("div", {
									className: "text-xs text-slate-500",
									children: n.areas.length ? n.areas.join(", ") : "Any area"
								})
							]
						}), /* @__PURE__ */ jsx("span", {
							className: `shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${n.isOnline ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`,
							children: n.isOnline ? "Online" : "Offline"
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold",
						children: n.skills.slice(0, 8).map((s) => /* @__PURE__ */ jsx("span", {
							className: "rounded-full bg-slate-100 px-2 py-1 text-slate-700",
							children: NURSE_SKILL_LABEL[s] ?? s
						}, s))
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-2 text-[11px] text-slate-500",
						children: [
							n.shiftPrefs.map((s) => SHIFT_LABEL[s] ?? s).join(" · ") || "Shift flexible",
							n.homeCare ? " · home care" : "",
							n.hospitalDuty ? " · hospital duty" : "",
							n.phone ? ` · ${n.phone}` : ""
						]
					})
				] }, n.id))
			})
		})]
	});
}
//#endregion
export { FindNurse as component };
