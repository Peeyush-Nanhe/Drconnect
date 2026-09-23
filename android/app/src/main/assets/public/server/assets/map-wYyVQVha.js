import { B as useSession, M as useLiveCareRequests, n as acceptCareRequest, u as createCareRequest } from "./backend-eXdx240h.js";
import { t as Button } from "./button-BT328xhy.js";
import { Suspense, lazy, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/map.tsx?tsr-split=component
var LiveMap = lazy(() => import("./LiveMap-tB50ywC7.js"));
function MapPage() {
	const { user, role } = useSession();
	const { rows } = useLiveCareRequests();
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState(null);
	const [spec, setSpec] = useState("General Physician");
	const [emergency, setEmergency] = useState(false);
	const [focusLocation, setFocusLocation] = useState(null);
	async function broadcast() {
		setBusy(true);
		setMsg(null);
		try {
			await createCareRequest({
				specialty: spec,
				emergency,
				lat: 18.5362,
				lng: 73.893
			});
			setMsg("Broadcast sent — providers can see it now.");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Failed to broadcast");
		} finally {
			setBusy(false);
		}
	}
	async function accept(id) {
		setBusy(true);
		setMsg(null);
		try {
			await acceptCareRequest(id);
			setMsg("Accepted! Patient has been notified.");
		} catch (e) {
			setMsg(e instanceof Error ? e.message : "Couldn't accept");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-screen px-4 py-6",
		style: {
			background: "#DCE6E1",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: [/* @__PURE__ */ jsx("link", {
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
		}), /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-4xl",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-4 flex items-center justify-between",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
						className: "text-2xl font-extrabold text-slate-900",
						children: "Live Map"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-sm text-slate-600",
						children: "Real map · your GPS · real requests · real-time updates."
					})] }), /* @__PURE__ */ jsx(Link, {
						to: "/",
						className: "text-sm font-semibold text-teal-700 hover:underline",
						children: "← Back to app"
					})]
				}),
				/* @__PURE__ */ jsx(Suspense, {
					fallback: /* @__PURE__ */ jsx("div", {
						className: "flex h-[480px] items-center justify-center rounded-2xl bg-white text-sm text-slate-500",
						children: "Loading map…"
					}),
					children: /* @__PURE__ */ jsx(LiveMap, {
						height: "min(62dvh, 560px)",
						focusLocation
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-5 grid gap-4 sm:grid-cols-2",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "rounded-2xl bg-white p-4",
						children: [
							/* @__PURE__ */ jsx("h3", {
								className: "text-sm font-bold text-slate-800",
								children: "Send a real request"
							}),
							user ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex gap-2",
								children: [/* @__PURE__ */ jsx("input", {
									value: spec,
									onChange: (e) => setSpec(e.target.value),
									className: "flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm",
									placeholder: "Specialty"
								}), /* @__PURE__ */ jsxs("label", {
									className: "flex items-center gap-1 text-xs text-slate-600",
									children: [/* @__PURE__ */ jsx("input", {
										type: "checkbox",
										checked: emergency,
										onChange: (e) => setEmergency(e.target.checked)
									}), "Emergency"]
								})]
							}), /* @__PURE__ */ jsx(Button, {
								disabled: busy,
								onClick: broadcast,
								className: "mt-2 w-full bg-teal-700 font-bold text-primary-foreground hover:bg-teal-800",
								children: busy ? "Sending…" : "Broadcast to providers"
							})] }) : /* @__PURE__ */ jsxs("p", {
								className: "mt-2 text-xs text-slate-500",
								children: [
									/* @__PURE__ */ jsx(Link, {
										to: "/auth",
										search: {
											admin: void 0,
											next: void 0
										},
										className: "font-semibold text-teal-700",
										children: "Sign in"
									}),
									" ",
									"to broadcast a real request."
								]
							}),
							msg && /* @__PURE__ */ jsx("p", {
								className: "mt-2 text-xs text-slate-600",
								children: msg
							})
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "rounded-2xl bg-white p-4",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "text-sm font-bold text-slate-800",
							children: "Open requests"
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-2 max-h-64 space-y-2 overflow-y-auto",
							children: rows.filter((r) => r.status === "open").length === 0 ? /* @__PURE__ */ jsx("p", {
								className: "text-xs text-slate-500",
								children: "Nothing open right now."
							}) : rows.filter((r) => r.status === "open").map((r) => /* @__PURE__ */ jsxs("div", {
								className: "flex items-center justify-between rounded-lg border border-slate-100 px-2 py-2 text-xs",
								children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
									className: "font-bold text-slate-800",
									children: [r.emergency ? "🚨 " : "", r.specialty]
								}), /* @__PURE__ */ jsx("div", {
									className: "text-[10px] text-slate-500",
									children: new Date(r.created_at).toLocaleTimeString()
								})] }), /* @__PURE__ */ jsxs("div", {
									className: "flex items-center gap-1",
									children: [r.lat != null && r.lng != null ? /* @__PURE__ */ jsx(Button, {
										type: "button",
										variant: "ghost",
										size: "sm",
										onClick: () => setFocusLocation([r.lat, r.lng]),
										className: "text-[11px] text-teal-700",
										children: "View"
									}) : null, role === "provider" && /* @__PURE__ */ jsx(Button, {
										onClick: () => accept(r.id),
										disabled: busy,
										size: "sm",
										className: "rounded-full bg-slate-900 text-[11px] font-bold text-primary-foreground hover:bg-slate-800",
										children: "Accept"
									})]
								})]
							}, r.id))
						})]
					})]
				})
			]
		})]
	});
}
//#endregion
export { MapPage as component };
