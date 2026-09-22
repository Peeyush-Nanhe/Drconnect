/* empty css                 */
import { M as useLiveCareRequests, O as upsertMyProfileLocation, g as fetchProviderLocations } from "./backend-eXdx240h.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import { Crosshair, Siren, SlidersHorizontal, Stethoscope, X } from "lucide-react";
//#region src/features/mydox/LiveMap.tsx
var userIcon = L.divIcon({
	className: "",
	html: `<div aria-hidden="true" style="width:20px;height:20px;border-radius:50%;background:#2563EB;border:4px solid white;box-shadow:0 0 0 5px rgba(37,99,235,.2),0 2px 8px rgba(0,0,0,.3)"></div>`,
	iconSize: [20, 20],
	iconAnchor: [10, 10]
});
var providerIcon = L.divIcon({
	className: "",
	html: `<div style="width:22px;height:22px;border-radius:50%;background:#0D9488;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
	iconSize: [22, 22],
	iconAnchor: [11, 11]
});
var emergencyIcon = L.divIcon({
	className: "",
	html: `<div style="width:26px;height:26px;border-radius:50%;background:#DC2626;border:3px solid white;box-shadow:0 0 0 6px rgba(220,38,38,.25);animation:mc-ping 1.4s infinite"></div><style>@keyframes mc-ping{0%{box-shadow:0 0 0 0 rgba(220,38,38,.5)}70%{box-shadow:0 0 0 14px rgba(220,38,38,0)}100%{box-shadow:0 0 0 0 rgba(220,38,38,0)}}</style>`,
	iconSize: [26, 26],
	iconAnchor: [13, 13]
});
var requestIcon = L.divIcon({
	className: "",
	html: `<div aria-hidden="true" style="width:24px;height:24px;border-radius:6px 6px 6px 0;background:#334155;border:3px solid white;box-shadow:0 2px 7px rgba(0,0,0,.3);transform:rotate(-45deg)"></div>`,
	iconSize: [24, 24],
	iconAnchor: [6, 20]
});
function Recenter({ pos, trigger }) {
	const map = useMap();
	useEffect(() => {
		if (pos) map.setView(pos, 14, { animate: true });
	}, [pos, trigger]);
	return null;
}
function FocusMarker({ pos }) {
	const map = useMap();
	useEffect(() => {
		if (pos) map.flyTo(pos, Math.max(map.getZoom(), 15), { duration: .75 });
	}, [map, pos]);
	return null;
}
function LiveMap({ height = 480, focusLocation = null }) {
	const [pos, setPos] = useState(null);
	const [providers, setProviders] = useState([]);
	const [error, setError] = useState(null);
	const [recenterTick, setRecenterTick] = useState(0);
	const [locating, setLocating] = useState(false);
	const [providersLoading, setProvidersLoading] = useState(true);
	const [showFilters, setShowFilters] = useState(false);
	const [showProviders, setShowProviders] = useState(true);
	const [showEmergencies, setShowEmergencies] = useState(true);
	const [showRoutine, setShowRoutine] = useState(true);
	const { rows: requests } = useLiveCareRequests();
	const filterBtnRef = useRef(null);
	const locate = () => {
		if (!("geolocation" in navigator)) {
			setError("Geolocation not supported — defaulting to Pune.");
			setPos([18.5204, 73.8567]);
			setRecenterTick((t) => t + 1);
			return;
		}
		setLocating(true);
		navigator.geolocation.getCurrentPosition((p) => {
			const c = [p.coords.latitude, p.coords.longitude];
			setPos(c);
			setRecenterTick((t) => t + 1);
			setLocating(false);
			setError(null);
			upsertMyProfileLocation(c[0], c[1]).catch(() => {});
		}, () => {
			setError("Location permission denied — showing Pune.");
			setPos([18.5204, 73.8567]);
			setRecenterTick((t) => t + 1);
			setLocating(false);
		}, {
			enableHighAccuracy: true,
			timeout: 8e3
		});
	};
	useEffect(() => {
		locate();
	}, []);
	useEffect(() => {
		let mounted = true;
		const refreshProviders = async () => {
			try {
				const rows = await fetchProviderLocations();
				if (mounted) {
					setProviders(rows);
					setProvidersLoading(false);
				}
			} catch {
				if (mounted) {
					setProvidersLoading(false);
					setError("Provider locations could not be refreshed.");
				}
			}
		};
		refreshProviders();
		const timer = window.setInterval(refreshProviders, 15e3);
		return () => {
			mounted = false;
			window.clearInterval(timer);
		};
	}, []);
	const activeFilterCount = useMemo(() => [
		showProviders,
		showEmergencies,
		showRoutine
	].filter((v) => !v).length, [
		showProviders,
		showEmergencies,
		showRoutine
	]);
	if (!pos) return /* @__PURE__ */ jsx("div", {
		style: {
			height,
			background: "#eef2f0"
		},
		className: "flex items-center justify-center rounded-2xl text-sm text-slate-600",
		children: "Locating you…"
	});
	const controlBtn = "flex items-center gap-2 rounded-full bg-white/95 backdrop-blur px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg border border-slate-200 active:scale-[0.97] transition min-h-[48px]";
	return /* @__PURE__ */ jsxs("div", {
		style: { height },
		className: "relative overflow-hidden rounded-2xl border border-slate-200",
		children: [
			error ? /* @__PURE__ */ jsx("div", {
				className: "absolute top-3 left-1/2 z-[1000] -translate-x-1/2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow max-w-[85%] text-center",
				children: error
			}) : null,
			/* @__PURE__ */ jsx("div", {
				className: "pointer-events-none absolute inset-0 z-[1000]",
				children: /* @__PURE__ */ jsxs("div", {
					className: "pointer-events-auto absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col items-end gap-2.5 sm:top-3 sm:bottom-auto",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: locate,
							"aria-label": "Center map on my location",
							className: controlBtn,
							style: { color: "#0D9488" },
							children: [/* @__PURE__ */ jsx(Crosshair, {
								size: 20,
								className: locating ? "animate-spin" : ""
							}), /* @__PURE__ */ jsx("span", { children: locating ? "Locating…" : "My location" })]
						}),
						/* @__PURE__ */ jsxs("button", {
							ref: filterBtnRef,
							type: "button",
							onClick: () => setShowFilters((v) => !v),
							"aria-label": "Filter map markers",
							"aria-expanded": showFilters,
							className: controlBtn,
							children: [
								/* @__PURE__ */ jsx(SlidersHorizontal, { size: 20 }),
								/* @__PURE__ */ jsx("span", { children: "Filters" }),
								activeFilterCount > 0 && /* @__PURE__ */ jsx("span", {
									className: "ml-1 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-bold text-white",
									style: { background: "#0D9488" },
									children: activeFilterCount
								})
							]
						}),
						showFilters && /* @__PURE__ */ jsxs("div", {
							role: "dialog",
							"aria-label": "Map filters",
							className: "w-[min(280px,80vw)] rounded-2xl bg-white p-3 shadow-xl border border-slate-200",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "mb-2 flex items-center justify-between",
									children: [/* @__PURE__ */ jsx("span", {
										className: "text-xs font-bold uppercase tracking-wide text-slate-500",
										children: "Show on map"
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => setShowFilters(false),
										"aria-label": "Close filters",
										className: "grid h-8 w-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100",
										children: /* @__PURE__ */ jsx(X, { size: 16 })
									})]
								}),
								/* @__PURE__ */ jsx(FilterRow, {
									icon: /* @__PURE__ */ jsx(Stethoscope, {
										size: 18,
										style: { color: "#0D9488" }
									}),
									label: "Providers",
									checked: showProviders,
									onChange: setShowProviders,
									count: providersLoading ? void 0 : providers.length
								}),
								/* @__PURE__ */ jsx(FilterRow, {
									icon: /* @__PURE__ */ jsx(Siren, {
										size: 18,
										style: { color: "#DC2626" }
									}),
									label: "Emergency requests",
									checked: showEmergencies,
									onChange: setShowEmergencies
								}),
								/* @__PURE__ */ jsx(FilterRow, {
									icon: /* @__PURE__ */ jsx(Stethoscope, {
										size: 18,
										className: "text-slate-500"
									}),
									label: "Routine requests",
									checked: showRoutine,
									onChange: setShowRoutine
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ jsxs(MapContainer, {
				center: pos,
				zoom: 13,
				style: {
					height: "100%",
					width: "100%"
				},
				scrollWheelZoom: true,
				zoomControl: false,
				children: [
					/* @__PURE__ */ jsx(TileLayer, {
						attribution: "© <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
						url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
					}),
					/* @__PURE__ */ jsx(ZoomControl, { position: "bottomleft" }),
					/* @__PURE__ */ jsx(Recenter, {
						pos,
						trigger: recenterTick
					}),
					/* @__PURE__ */ jsx(FocusMarker, { pos: focusLocation }),
					/* @__PURE__ */ jsx(Circle, {
						center: pos,
						radius: 800,
						pathOptions: {
							color: "#0D9488",
							fillOpacity: .08
						}
					}),
					/* @__PURE__ */ jsx(Marker, {
						position: pos,
						icon: userIcon,
						children: /* @__PURE__ */ jsx(Popup, { children: "You are here" })
					}),
					showProviders && providers.map((p) => p.lat != null && p.lng != null ? /* @__PURE__ */ jsx(Marker, {
						position: [p.lat, p.lng],
						icon: providerIcon,
						children: /* @__PURE__ */ jsxs(Popup, { children: [
							/* @__PURE__ */ jsx("strong", { children: p.full_name ?? "Provider" }),
							/* @__PURE__ */ jsx("br", {}),
							p.specialty ?? "General"
						] })
					}, p.id) : null),
					requests.filter((r) => r.status === "open" && r.lat != null && r.lng != null).filter((r) => r.emergency ? showEmergencies : showRoutine).map((r) => {
						if (r.lat == null || r.lng == null) return null;
						return /* @__PURE__ */ jsx(Marker, {
							position: [r.lat, r.lng],
							icon: r.emergency ? emergencyIcon : requestIcon,
							children: /* @__PURE__ */ jsxs(Popup, { children: [
								/* @__PURE__ */ jsx("strong", { children: r.emergency ? "Emergency request" : "Care request" }),
								/* @__PURE__ */ jsx("br", {}),
								r.specialty
							] })
						}, r.id);
					})
				]
			})
		]
	});
}
function FilterRow({ icon, label, checked, onChange, count }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-50",
		children: [/* @__PURE__ */ jsxs("span", {
			className: "flex items-center gap-2.5 text-sm font-medium text-slate-800",
			children: [
				icon,
				label,
				count !== void 0 ? /* @__PURE__ */ jsxs("span", {
					className: "text-xs text-slate-500",
					children: [
						"(",
						count,
						")"
					]
				}) : null
			]
		}), /* @__PURE__ */ jsx("input", {
			type: "checkbox",
			checked,
			onChange: (e) => onChange(e.target.checked),
			className: "h-5 w-5 accent-teal-600"
		})]
	});
}
//#endregion
export { LiveMap as default };
