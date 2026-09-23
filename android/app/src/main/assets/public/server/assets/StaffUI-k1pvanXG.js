import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { ChevronLeft } from "lucide-react";
//#region src/features/careteam/StaffUI.tsx
/** Shared building blocks for the nurse / physio / technician home screens. */
function StaffShell({ title, subtitle, right, stats, children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "min-h-[100dvh] bg-slate-200/60 text-slate-900",
		style: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" },
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[#E7F0EC] shadow-xl",
			children: [
				/* @__PURE__ */ jsx("header", {
					className: "sticky top-0 z-20 px-4 pb-6 pt-4 text-white shadow-lg",
					style: { background: "linear-gradient(135deg, #059669 0%, #10B981 100%)" },
					children: /* @__PURE__ */ jsxs("div", {
						className: "w-full space-y-3",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-start gap-3",
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => window.history.back(),
									className: "mt-0.5 shrink-0 rounded-full bg-white/20 p-1 hover:bg-white/30",
									children: /* @__PURE__ */ jsx(ChevronLeft, { size: 20 })
								}), /* @__PURE__ */ jsxs("div", {
									className: "min-w-0 flex-1",
									children: [/* @__PURE__ */ jsx("h1", {
										className: "truncate text-base font-black",
										children: title
									}), subtitle ? /* @__PURE__ */ jsx("p", {
										className: "truncate text-[11px] font-bold opacity-80",
										children: subtitle
									}) : null]
								})]
							}),
							right ? /* @__PURE__ */ jsx("div", {
								className: "flex flex-wrap items-center gap-2",
								children: right
							}) : null,
							stats && /* @__PURE__ */ jsx("div", {
								className: "mt-2 grid grid-cols-2 gap-3",
								children: stats
							})
						]
					})
				}),
				/* @__PURE__ */ jsx("main", {
					className: "w-full space-y-4 px-3 py-4",
					children
				}),
				/* @__PURE__ */ jsxs("footer", {
					className: "flex w-full items-center justify-between px-4 pb-8 pt-2 text-[11px] text-slate-500",
					children: [/* @__PURE__ */ jsx("a", {
						href: "/?view=patient",
						className: "font-semibold text-teal-700 hover:underline",
						children: "← MyDox patient home"
					}), /* @__PURE__ */ jsx(Link, {
						to: "/auth",
						search: {
							admin: void 0,
							next: void 0
						},
						className: "font-semibold text-slate-500 hover:text-slate-800",
						children: "Switch account / Sign in"
					})]
				})
			]
		})
	});
}
function OnlineToggle({ online, busy, onChange, onlineLabel = "Online — taking jobs", offlineLabel = "Offline" }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		disabled: busy,
		"aria-pressed": online,
		onClick: () => onChange(!online),
		className: `flex min-h-[40px] items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold transition disabled:opacity-60 ${online ? "bg-teal-600 text-white" : "bg-slate-200 text-slate-700"}`,
		children: [/* @__PURE__ */ jsx("span", { className: `h-2.5 w-2.5 rounded-full ${online ? "bg-white" : "bg-slate-500"}` }), busy ? "Updating…" : online ? onlineLabel : offlineLabel]
	});
}
function Stat({ label, value, tone = "teal" }) {
	const valueClass = tone === "slate" ? "text-slate-800" : "text-teal-800";
	const labelClass = tone === "slate" ? "text-slate-500" : "text-teal-700/80";
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-2xl border border-slate-200 bg-white p-3 text-center shadow-sm",
		children: [/* @__PURE__ */ jsx("div", {
			className: `text-lg font-black leading-none tabular-nums ${valueClass}`,
			children: value
		}), /* @__PURE__ */ jsx("div", {
			className: `mt-1 text-[10px] font-bold uppercase tracking-wider ${labelClass}`,
			children: label
		})]
	});
}
function Card({ children, accent }) {
	return /* @__PURE__ */ jsx("article", {
		className: `rounded-2xl border bg-white p-4 ${accent ? "border-teal-300" : "border-slate-200"}`,
		children
	});
}
function Section({ title, count, children }) {
	return /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h2", {
		className: "mb-2 text-sm font-extrabold",
		children: [title, count === void 0 ? "" : ` (${count})`]
	}), children] });
}
function Empty({ children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500",
		children
	});
}
function Tabs({ tabs, value, onChange }) {
	return /* @__PURE__ */ jsx("div", {
		className: "flex gap-2 overflow-x-auto pb-1",
		children: tabs.map((t) => /* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: () => onChange(t.value),
			className: `min-h-[40px] shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${value === t.value ? "bg-[#0B201C] text-white" : "bg-white text-slate-600 border border-slate-200"}`,
			children: [t.label, t.count === void 0 ? "" : ` · ${t.count}`]
		}, t.value))
	});
}
function Chips({ options, selected, onToggle, grouped }) {
	const groups = grouped ? Array.from(new Set(options.map((o) => o.group ?? "Other"))) : [null];
	return /* @__PURE__ */ jsx("div", {
		className: "space-y-3",
		children: groups.map((g) => /* @__PURE__ */ jsxs("div", { children: [g ? /* @__PURE__ */ jsx("div", {
			className: "mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500",
			children: g
		}) : null, /* @__PURE__ */ jsx("div", {
			className: "flex flex-wrap gap-2",
			children: options.filter((o) => !g || (o.group ?? "Other") === g).map((o) => {
				const on = selected.includes(o.value);
				return /* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-pressed": on,
					onClick: () => onToggle(o.value),
					className: `min-h-[36px] rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${on ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-700"}`,
					children: o.label
				}, o.value);
			})
		})] }, g ?? "all"))
	});
}
function Field({ label, children }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "block",
		children: [/* @__PURE__ */ jsx("span", {
			className: "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500",
			children: label
		}), children]
	});
}
var inputClass = "w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500";
function Switch({ on, onChange, label }) {
	return /* @__PURE__ */ jsxs("button", {
		type: "button",
		"aria-pressed": on,
		onClick: () => onChange(!on),
		className: `flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs font-semibold ${on ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 bg-white text-slate-600"}`,
		children: [label, /* @__PURE__ */ jsx("span", {
			className: `h-5 w-9 shrink-0 rounded-full p-0.5 transition ${on ? "bg-teal-600" : "bg-slate-300"}`,
			children: /* @__PURE__ */ jsx("span", { className: `block h-4 w-4 rounded-full bg-white transition ${on ? "translate-x-4" : ""}` })
		})]
	});
}
function fmtWhen(dt) {
	if (!dt) return "Time to be set";
	return new Date(dt).toLocaleString("en-IN", {
		weekday: "short",
		day: "2-digit",
		month: "short",
		hour: "2-digit",
		minute: "2-digit"
	});
}
//#endregion
export { OnlineToggle as a, Stat as c, fmtWhen as d, inputClass as f, Field as i, Switch as l, Chips as n, Section as o, Empty as r, StaffShell as s, Card as t, Tabs as u };
