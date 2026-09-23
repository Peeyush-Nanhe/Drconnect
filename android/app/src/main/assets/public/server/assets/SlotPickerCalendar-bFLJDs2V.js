import React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/features/mydox/SlotPickerCalendar.tsx
/**
* Shared slot-picker calendar.
* - Day chips (next N days, "Today" / "Tomorrow" labels)
* - Times bucketed into Morning / Afternoon / Evening
* - Past and already-booked slots (greyed-out + line-through, not clickable)
*
* Two flavours:
*  1) Controlled by external state (schedDates + schedTimes + indices) — used
*     inside SpecialtyPickerModern / SpecialtyPickerSimple in MyDoxFull.
*  2) Self-contained (`SlotPickerCalendarStandalone`) — emits an ISO datetime
*     string via `onChange`. Used by the Surgery planning flow.
*/
var BUCKETS = [
	{
		key: "morning",
		label: "Morning",
		emoji: "🌅",
		from: 9,
		to: 12,
		sub: "9 AM – 12 PM"
	},
	{
		key: "afternoon",
		label: "Afternoon",
		emoji: "☀️",
		from: 12,
		to: 17,
		sub: "12 PM – 5 PM"
	},
	{
		key: "evening",
		label: "Evening",
		emoji: "🌆",
		from: 17,
		to: 22,
		sub: "5 PM – 9:30 PM"
	}
];
var fmtSlotTime = (t) => {
	const ap = t.h < 12 ? "AM" : "PM";
	return `${t.h % 12 === 0 ? 12 : t.h % 12}:${t.m === 0 ? "00" : String(t.m).padStart(2, "0")} ${ap}`;
};
var dayLabel = (d, i) => i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short" });
function slotMatches(slots, dateIdx, t) {
	return !!slots?.some((s) => s.dateIdx === dateIdx && s.h === t.h && s.m === t.m);
}
function isSlotBooked(t, schedDate, bookedSlots) {
	if (schedDate == null) return false;
	return slotMatches(bookedSlots, schedDate, t);
}
function isSlotAvailable(t, schedDate, schedDates, availableSlots, bookedSlots, strict = false) {
	if (schedDate == null || !schedDates[schedDate]) return false;
	const selectedDate = schedDates[schedDate];
	const slotDt = new Date(selectedDate);
	slotDt.setHours(t.h, t.m, 0, 0);
	if (slotDt.getTime() <= Date.now()) return false;
	if (slotMatches(bookedSlots, schedDate, t)) return false;
	if (strict) return !!availableSlots?.some((s) => s.dateIdx === schedDate && s.h === t.h && s.m === t.m);
	if (availableSlots && availableSlots.length > 0) {
		if (availableSlots.some((s) => s.dateIdx === schedDate)) return availableSlots.some((s) => s.dateIdx === schedDate && s.h === t.h && s.m === t.m);
		return false;
	}
	return true;
}
function SlotPickerCalendar({ schedDates, schedTimes, schedDate, schedTime, setSchedDate, setSchedTime, accent = "#7C3AED", seed = "default", size = "md", line = "#E5E7EB", ink = "#0F172A", faint = "#94A3B8", sub = "#475569", availableSlots, bookedSlots, strict = false }) {
	const small = size === "sm";
	React.useEffect(() => {
		if (schedDate != null && schedTime != null) {
			const t = schedTimes[schedTime];
			if (t && !isSlotAvailable(t, schedDate, schedDates, availableSlots, bookedSlots, strict)) setSchedTime(null);
		}
	}, [
		schedDate,
		schedTime,
		schedDates,
		schedTimes,
		availableSlots,
		bookedSlots,
		strict,
		setSchedTime
	]);
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsx("p", {
			style: {
				margin: "0 0 6px",
				fontSize: 10,
				fontWeight: 800,
				color: faint,
				textTransform: "uppercase",
				letterSpacing: .5
			},
			children: "📅 Date"
		}),
		/* @__PURE__ */ jsx("div", {
			style: {
				display: "flex",
				gap: 6,
				overflowX: "auto",
				paddingBottom: 4,
				marginBottom: 10,
				scrollbarWidth: "none"
			},
			children: schedDates.map((d, i) => {
				const a = schedDate === i;
				const dayHasSlots = !strict || !!availableSlots?.some((s) => s.dateIdx === i);
				return /* @__PURE__ */ jsxs("button", {
					onClick: () => {
						setSchedDate(i);
						setSchedTime(null);
					},
					style: {
						flex: "0 0 auto",
						minWidth: small ? 48 : 56,
						padding: small ? "7px 5px" : "10px 6px",
						borderRadius: small ? 11 : 13,
						border: `1.5px solid ${a ? accent : line}`,
						background: a ? `${accent}14` : "#fff",
						cursor: "pointer",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 1,
						opacity: dayHasSlots ? 1 : .4,
						fontFamily: "'Plus Jakarta Sans',sans-serif"
					},
					title: dayHasSlots ? void 0 : "No free slots this day",
					children: [
						/* @__PURE__ */ jsx("span", {
							style: {
								fontSize: small ? 8.5 : 10,
								fontWeight: 700,
								color: a ? accent : faint
							},
							children: dayLabel(d, i)
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								fontSize: small ? 15 : 17,
								fontWeight: 800,
								color: ink,
								lineHeight: 1
							},
							children: d.getDate()
						}),
						/* @__PURE__ */ jsx("span", {
							style: {
								fontSize: small ? 8 : 9,
								color: sub
							},
							children: d.toLocaleDateString("en-US", { month: "short" })
						})
					]
				}, i);
			})
		}),
		schedDate == null ? /* @__PURE__ */ jsx("p", {
			style: {
				margin: 0,
				fontSize: 11.5,
				color: faint
			},
			children: "Pick a date to see available slots"
		}) : /* @__PURE__ */ jsx("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				gap: 10
			},
			children: BUCKETS.map((b) => {
				const inBucket = schedTimes.map((t, i) => ({
					t,
					i
				})).filter(({ t }) => t.h >= b.from && t.h < b.to);
				if (!inBucket.length) return null;
				const anyAvail = inBucket.some(({ t }) => isSlotAvailable(t, schedDate, schedDates, availableSlots, bookedSlots, strict));
				return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						alignItems: "baseline",
						justifyContent: "space-between",
						margin: "0 0 5px"
					},
					children: [/* @__PURE__ */ jsxs("p", {
						style: {
							margin: 0,
							fontSize: 11,
							fontWeight: 800,
							color: ink
						},
						children: [
							b.emoji,
							" ",
							b.label,
							" ",
							/* @__PURE__ */ jsxs("span", {
								style: {
									color: faint,
									fontWeight: 600
								},
								children: ["· ", b.sub]
							})
						]
					}), !anyAvail && /* @__PURE__ */ jsx("span", {
						style: {
							fontSize: 9.5,
							color: "#94A3B8",
							fontWeight: 700
						},
						children: "· Fully booked / Past"
					})]
				}), /* @__PURE__ */ jsx("div", {
					style: {
						display: "grid",
						gridTemplateColumns: `repeat(${small ? 4 : 3},1fr)`,
						gap: 6
					},
					children: inBucket.map(({ t, i }) => {
						const unavail = !isSlotAvailable(t, schedDate, schedDates, availableSlots, bookedSlots, strict);
						const a = schedTime === i;
						const isPast = (() => {
							if (schedDate == null || !schedDates[schedDate]) return false;
							const d = new Date(schedDates[schedDate]);
							d.setHours(t.h, t.m, 0, 0);
							return d.getTime() <= Date.now();
						})();
						const isBooked = isSlotBooked(t, schedDate, bookedSlots);
						return /* @__PURE__ */ jsx("button", {
							type: "button",
							disabled: unavail,
							onClick: () => {
								if (!unavail) setSchedTime(i);
							},
							title: unavail ? isPast ? "Past slot" : isBooked ? "Already booked" : "Slot unavailable" : "Select slot",
							"aria-disabled": unavail,
							style: {
								padding: small ? "8px 2px" : "10px 3px",
								borderRadius: small ? 9 : 11,
								border: `1.5px solid ${a ? accent : unavail ? "#F1F5F9" : line}`,
								background: unavail ? "#F8FAFC" : a ? accent : "#fff",
								color: unavail ? "#CBD5E1" : a ? "#fff" : ink,
								cursor: unavail ? "not-allowed" : "pointer",
								fontSize: small ? 10.5 : 12,
								fontWeight: 800,
								textDecoration: unavail ? "line-through" : "none",
								opacity: unavail ? .6 : 1,
								fontFamily: "'Plus Jakarta Sans',sans-serif",
								transition: "all 0.15s ease"
							},
							children: fmtSlotTime(t)
						}, i);
					})
				})] }, b.key);
			})
		})
	] });
}
/**
* Self-contained variant — builds its own date + time arrays and emits
* `onChange(isoString | "")` whenever the user picks a full slot.
*/
function SlotPickerCalendarStandalone({ days = 14, seed = "surgery", accent = "#0D9488", value, onChange, size = "md", availableIso = null, startHour = 9, endHour = 21, stepMin = 30 }) {
	const schedDates = React.useMemo(() => {
		const out = [];
		const now = /* @__PURE__ */ new Date();
		for (let i = 0; i < days; i++) {
			const d = new Date(now);
			d.setDate(now.getDate() + i);
			d.setHours(0, 0, 0, 0);
			out.push(d);
		}
		return out;
	}, [days]);
	const strict = Array.isArray(availableIso);
	const availableSlots = React.useMemo(() => {
		if (!strict) return [];
		const out = [];
		for (const iso of availableIso) {
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) continue;
			const day0 = new Date(d);
			day0.setHours(0, 0, 0, 0);
			const dateIdx = schedDates.findIndex((x) => x.getTime() === day0.getTime());
			if (dateIdx >= 0) out.push({
				dateIdx,
				h: d.getHours(),
				m: d.getMinutes()
			});
		}
		return out;
	}, [
		strict,
		availableIso,
		schedDates
	]);
	const schedTimes = React.useMemo(() => {
		if (strict) {
			const seen = /* @__PURE__ */ new Map();
			for (const s of availableSlots) seen.set(`${s.h}:${s.m}`, {
				h: s.h,
				m: s.m
			});
			return [...seen.values()].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
		}
		const out = [];
		for (let mins = startHour * 60; mins <= endHour * 60; mins += stepMin) out.push({
			h: Math.floor(mins / 60),
			m: mins % 60
		});
		return out;
	}, [
		strict,
		availableSlots,
		startHour,
		endHour,
		stepMin
	]);
	const [schedDate, setSchedDate] = React.useState(null);
	const [schedTime, setSchedTime] = React.useState(null);
	React.useEffect(() => {
		if (!value) return;
		const d = new Date(value);
		if (isNaN(d.getTime())) return;
		const day0 = new Date(d);
		day0.setHours(0, 0, 0, 0);
		const di = schedDates.findIndex((x) => x.getTime() === day0.getTime());
		if (di < 0) return;
		const ti = schedTimes.findIndex((t) => t.h === d.getHours() && t.m === d.getMinutes());
		setSchedDate(di);
		setSchedTime(ti >= 0 ? ti : null);
	}, []);
	const slotsKey = strict ? availableIso.join(",") : "";
	const firstRender = React.useRef(true);
	React.useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false;
			return;
		}
		setSchedTime(null);
		if (onChange) onChange("");
	}, [slotsKey]);
	const handleTime = (i) => {
		setSchedTime(i);
		if (i == null || schedDate == null || !onChange) return;
		const d = new Date(schedDates[schedDate]);
		d.setHours(schedTimes[i].h, schedTimes[i].m, 0, 0);
		onChange(d.toISOString());
	};
	const handleDate = (i) => {
		setSchedDate(i);
		setSchedTime(null);
		if (onChange) onChange("");
	};
	return /* @__PURE__ */ jsx(SlotPickerCalendar, {
		schedDates,
		schedTimes,
		schedDate,
		schedTime,
		setSchedDate: handleDate,
		setSchedTime: handleTime,
		accent,
		seed,
		size,
		availableSlots,
		strict
	});
}
//#endregion
export { SlotPickerCalendarStandalone as n, isSlotAvailable as r, SlotPickerCalendar as t };
