import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/admin.index.tsx?tsr-split=component
var PANELS = [
	{
		to: "/admin/wellness",
		emoji: "🧠",
		title: "Mental Wellness Console",
		desc: "Screening scores, care-team SLA compliance, provider performance and patient outcome trends.",
		tone: "#4F46E5"
	},
	{
		to: "/admin/locum",
		emoji: "🩺",
		title: "Locum Control Room",
		desc: "Care physician ward/ICU/special duty cover, attendance, hospital demand hotspots and feedback.",
		tone: "#0D9488"
	},
	{
		to: "/admin/credentials",
		emoji: "✅",
		title: "Physician Credential Verification",
		desc: "Review council registration details and unlock ICU/gated duties only after verification.",
		tone: "#047857"
	},
	{
		to: "/admin/physio",
		emoji: "🏃",
		title: "Home Physiotherapy Control Room",
		desc: "Home visits by area and therapy type, therapist attendance, hotspots, partner quality and patient ratings.",
		tone: "#7C3AED"
	},
	{
		to: "/admin/physician",
		emoji: "🧑‍⚕️",
		title: "Care Physician Portal",
		desc: "For doctors: log on-duty hours, submit hospital feedback and track your own reliability score.",
		tone: "#0369A1"
	},
	{
		to: "/admin/live",
		emoji: "📡",
		title: "Live Operations",
		desc: "Real-time users, care requests, programme bookings and community requests.",
		tone: "#B45309"
	},
	{
		to: "/admin/users",
		emoji: "👤",
		title: "Users & Roles",
		desc: "Review accounts and manage administrator access.",
		tone: "#BE123C"
	}
];
function AdminConsole() {
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen px-4 py-10",
		style: {
			background: "#DCE6E1",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: [/* @__PURE__ */ jsx("link", {
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
		}), /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-4xl",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "mb-6 flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					className: "text-2xl font-extrabold text-slate-900",
					children: "Admin Console"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-slate-600",
					children: "Every operational board for MyDox, in one place."
				})] }), /* @__PURE__ */ jsx(Link, {
					to: "/",
					className: "text-sm font-semibold text-teal-700 hover:underline",
					children: "← Back to app"
				})]
			}), /* @__PURE__ */ jsx("div", {
				className: "grid gap-3 sm:grid-cols-2",
				children: PANELS.map((p) => /* @__PURE__ */ jsxs(Link, {
					to: p.to,
					className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
					children: [
						/* @__PURE__ */ jsx("div", {
							className: "text-2xl",
							children: p.emoji
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-2 text-base font-extrabold",
							style: { color: p.tone },
							children: p.title
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs text-slate-600",
							children: p.desc
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-3 text-xs font-semibold text-slate-500",
							children: "Open →"
						})
					]
				}, p.to))
			})]
		})]
	});
}
//#endregion
export { AdminConsole as component };
