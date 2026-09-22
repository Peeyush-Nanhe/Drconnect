import { n as useSession } from "./backend-DBk1HdRG.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as Button } from "./button-BT328xhy.js";
import { s as getMyUnifiedBookingHub, t as useUnifiedBookingRealtime } from "./useUnifiedBookingRealtime-Bveds-oj.js";
import { t as getBookingLiveTracks } from "./booking-tracking.functions-DTbwSr2x.js";
import { c as Stat, o as Section, r as Empty, s as StaffShell, t as Card, u as Tabs } from "./StaffUI-k1pvanXG.js";
import { n as PhoneAlertsButton, t as UnifiedProviderOffers } from "./UnifiedProviderOffers-U5ao8Mat.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Activity, Ambulance, Bell, Clock3, MapPin, Phone, RefreshCw } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/features/bookings/LiveTrackMap.tsx
function loadGoogleMaps() {
	if (typeof window === "undefined") return Promise.reject(/* @__PURE__ */ new Error("Map unavailable"));
	const w = window;
	if (w.google?.maps) return Promise.resolve(w.google.maps);
	return Promise.reject(/* @__PURE__ */ new Error("Map key missing"));
}
function LiveTrackMap({ destination, provider, accent = "#0D9488", height = 200 }) {
	const holder = useRef(null);
	const mapRef = useRef(null);
	const markersRef = useRef([]);
	const lineRef = useRef(null);
	const [error, setError] = useState(null);
	useEffect(() => {
		let cancelled = false;
		const anchor = destination ?? provider;
		if (!anchor) return;
		loadGoogleMaps().then((maps) => {
			if (cancelled || !holder.current) return;
			if (!mapRef.current) mapRef.current = new maps.Map(holder.current, {
				center: anchor,
				zoom: 13,
				disableDefaultUI: true,
				zoomControl: true,
				gestureHandling: "greedy",
				clickableIcons: false
			});
			const map = mapRef.current;
			markersRef.current.forEach((marker) => marker.setMap(null));
			markersRef.current = [];
			lineRef.current?.setMap(null);
			if (destination) markersRef.current.push(new maps.Marker({
				map,
				position: destination,
				title: "Where care is needed",
				icon: {
					path: maps.SymbolPath.CIRCLE,
					scale: 7,
					fillColor: "#ffffff",
					fillOpacity: 1,
					strokeColor: accent,
					strokeWeight: 3
				}
			}));
			if (provider) markersRef.current.push(new maps.Marker({
				map,
				position: provider,
				title: "Professional on the way",
				icon: {
					path: maps.SymbolPath.CIRCLE,
					scale: 9,
					fillColor: accent,
					fillOpacity: 1,
					strokeColor: "#ffffff",
					strokeWeight: 3
				}
			}));
			if (destination && provider) {
				lineRef.current = new maps.Polyline({
					map,
					path: [provider, destination],
					strokeColor: accent,
					strokeOpacity: .8,
					strokeWeight: 3
				});
				const bounds = new maps.LatLngBounds();
				bounds.extend(destination);
				bounds.extend(provider);
				map.fitBounds(bounds, 48);
			} else map.setCenter(anchor);
		}).catch((cause) => setError(cause.message));
		return () => {
			cancelled = true;
		};
	}, [
		destination?.lat,
		destination?.lng,
		provider?.lat,
		provider?.lng,
		accent
	]);
	if (!destination && !provider) return /* @__PURE__ */ jsx("div", {
		className: "flex items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground",
		style: { height },
		children: "Location not shared yet"
	});
	if (error) return /* @__PURE__ */ jsx("div", {
		className: "flex items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground",
		style: { height },
		children: "Map unavailable right now"
	});
	return /* @__PURE__ */ jsx("div", {
		ref: holder,
		className: "overflow-hidden rounded-xl border border-border",
		style: { height },
		"aria-label": "Live location map"
	});
}
//#endregion
//#region src/features/bookings/LiveTrackPanel.tsx
var ROLE_TEXT = {
	ambulance: "Ambulance",
	physiotherapist: "Physiotherapist",
	nurse: "Nurse",
	technician: "Technician",
	care_physician: "Care physician",
	hospital: "Hospital team"
};
function minutesAgo(iso) {
	if (!iso) return null;
	return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 6e4));
}
function LiveTrackPanel() {
	const fetchTracks = useServerFn(getBookingLiveTracks);
	const rows = useQuery({
		queryKey: ["booking-live-tracks"],
		queryFn: () => fetchTracks({}),
		refetchInterval: 15e3
	}).data?.tracks ?? [];
	if (!rows.length) return null;
	return /* @__PURE__ */ jsx(Section, {
		title: "Live location and arrival time",
		count: rows.length,
		children: /* @__PURE__ */ jsx("div", {
			className: "space-y-3",
			children: rows.map((track) => {
				const stale = minutesAgo(track.provider?.updatedAt ?? null);
				return /* @__PURE__ */ jsxs(Card, {
					accent: track.role === "ambulance",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "flex items-center gap-2 text-sm font-bold",
								children: [
									track.role === "ambulance" ? /* @__PURE__ */ jsx(Ambulance, { className: "size-4 text-clinical-strong" }) : /* @__PURE__ */ jsx(Activity, { className: "size-4 text-clinical-strong" }),
									ROLE_TEXT[track.role] ?? "Professional",
									track.providerName ? /* @__PURE__ */ jsxs("span", {
										className: "text-muted-foreground",
										children: ["· ", track.providerName]
									}) : null
								]
							}), /* @__PURE__ */ jsx("span", {
								className: "rounded-full bg-muted px-2 py-1 text-[11px] font-bold uppercase",
								children: track.status.replaceAll("_", " ")
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-2 grid grid-cols-2 gap-2 text-xs",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "flex items-center gap-1 font-semibold",
								children: [/* @__PURE__ */ jsx(MapPin, { className: "size-3 text-clinical-strong" }), track.distanceKm != null ? `${track.distanceKm} km away` : "Distance not available"]
							}), /* @__PURE__ */ jsxs("p", {
								className: "flex items-center gap-1 font-semibold",
								children: [/* @__PURE__ */ jsx(Clock3, { className: "size-3 text-clinical-strong" }), track.status === "arrived" || track.status === "started" ? "Already with you" : track.etaMinutes != null ? `About ${track.etaMinutes} min away` : "Arrival time not available"]
							})]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-2",
							children: /* @__PURE__ */ jsx(LiveTrackMap, {
								destination: track.destination,
								provider: track.provider
							})
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-2 text-[11px] text-muted-foreground",
							children: track.provider ? stale != null && stale > 0 ? `Location updated ${stale} min ago` : "Location updating live" : "Waiting for the professional to share their location"
						})
					]
				}, track.bookingId);
			})
		})
	});
}
//#endregion
//#region src/routes/matching.tsx?tsr-split=component
var ACTIVE = /* @__PURE__ */ new Set([
	"requested",
	"searching",
	"expanded",
	"offered",
	"accepted",
	"en_route",
	"arrived",
	"started",
	"unavailable"
]);
var STAGE = {
	requested: "Request received",
	searching: "Searching nearby",
	expanded: "Search area widened",
	offered: "Professionals notified",
	accepted: "Professional assigned",
	en_route: "On the way",
	arrived: "Arrived",
	started: "Service started",
	completed: "Completed",
	cancelled: "Cancelled",
	unavailable: "No match yet",
	disputed: "Under review"
};
var ROLE_LABEL = {
	nurse: "nursing",
	technician: "test",
	physiotherapist: "physiotherapy",
	ambulance: "transport",
	care_physician: "consultation",
	hospital: "facility"
};
function MatchingDashboard() {
	const { user } = useSession();
	const fetchHub = useServerFn(getMyUnifiedBookingHub);
	const queryClient = useQueryClient();
	useUnifiedBookingRealtime(queryClient);
	const hub = useQuery({
		queryKey: ["unified-booking-hub"],
		queryFn: () => fetchHub({}),
		refetchInterval: 15e3
	});
	const [tab, setTab] = useState("requests");
	const uid = user?.id;
	const hubData = hub.data;
	const bookings = hubData?.bookings ?? [];
	const myRequests = bookings.filter((booking) => uid && booking.requested_by === uid);
	const activeRequests = myRequests.filter((booking) => ACTIVE.has(booking.status));
	const myJobs = bookings.filter((booking) => uid && booking.assigned_provider_id === uid);
	const pendingOffers = (hubData?.offers ?? []).filter((offer) => offer.status === "pending" && new Date(offer.expires_at).getTime() > Date.now());
	const unread = (hubData?.notifications ?? []).filter((item) => !item.read_at);
	const historyRows = hubData?.history ?? [];
	const historyByBooking = /* @__PURE__ */ new Map();
	for (const event of historyRows) historyByBooking.set(event.booking_id, [...historyByBooking.get(event.booking_id) ?? [], event]);
	const offerRole = pendingOffers[0]?.provider_role ?? myJobs[0]?.provider_role ?? "";
	const isProviderSide = pendingOffers.length > 0 || myJobs.length > 0;
	return /* @__PURE__ */ jsxs(StaffShell, {
		title: "Live matching dashboard",
		subtitle: "Offers, assignments and service status, updating as they happen",
		right: /* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-2",
			children: [
				unread.length ? /* @__PURE__ */ jsxs("span", {
					className: "inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-700",
					children: [/* @__PURE__ */ jsx(Bell, { className: "size-3" }), unread.length]
				}) : null,
				/* @__PURE__ */ jsx(PhoneAlertsButton, {}),
				/* @__PURE__ */ jsxs(Button, {
					size: "sm",
					variant: "outline",
					onClick: () => void queryClient.invalidateQueries({ queryKey: ["unified-booking-hub"] }),
					disabled: hub.isFetching,
					children: [/* @__PURE__ */ jsx(RefreshCw, {}), hub.isFetching ? "Updating…" : "Refresh"]
				})
			]
		}),
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "My live requests",
						value: activeRequests.length
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Offers waiting",
						value: pendingOffers.length
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Jobs assigned to me",
						value: myJobs.filter((booking) => ACTIVE.has(booking.status)).length,
						tone: "slate"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Completed",
						value: [...myRequests, ...myJobs].filter((booking) => booking.status === "completed").length,
						tone: "slate"
					})
				]
			}),
			/* @__PURE__ */ jsx(Tabs, {
				value: tab,
				onChange: setTab,
				tabs: [{
					value: "requests",
					label: "My care requests",
					count: myRequests.length
				}, {
					value: "jobs",
					label: "My jobs",
					count: pendingOffers.length + myJobs.length
				}]
			}),
			hub.error ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "rounded-2xl bg-white p-4 text-sm font-semibold text-rose-700",
				children: hub.error.message
			}) : null,
			tab === "requests" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(LiveTrackPanel, {}), /* @__PURE__ */ jsx(Section, {
				title: "Care I have requested",
				count: myRequests.length,
				children: hub.isLoading ? /* @__PURE__ */ jsx(Empty, { children: "Loading your requests…" }) : myRequests.length ? /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: myRequests.map((booking) => {
						const professionalId = booking.assigned_provider_id ?? booking.assigned_facility_id;
						const professional = professionalId ? hubData?.providerDetails[professionalId] : void 0;
						return /* @__PURE__ */ jsxs(Card, {
							accent: booking.priority !== "normal",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex flex-wrap items-start justify-between gap-3",
									children: [/* @__PURE__ */ jsxs("div", {
										className: "min-w-0",
										children: [
											/* @__PURE__ */ jsxs("p", {
												className: "text-[11px] font-extrabold uppercase text-teal-700",
												children: [
													booking.provider_role.replaceAll("_", " "),
													" · ",
													booking.priority
												]
											}),
											/* @__PURE__ */ jsx("h3", {
												className: "truncate text-sm font-bold",
												children: booking.title
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "text-[11px] text-slate-500",
												children: [
													/* @__PURE__ */ jsx(MapPin, { className: "mr-1 inline size-3" }),
													booking.area ?? booking.city,
													" · requested ",
													new Date(booking.created_at).toLocaleString()
												]
											})
										]
									}), /* @__PURE__ */ jsx("span", {
										className: "rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-800",
										children: STAGE[booking.status] ?? booking.status
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 grid grid-cols-3 gap-2 text-center",
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "rounded-xl bg-slate-50 p-2",
											children: [/* @__PURE__ */ jsxs("b", {
												className: "text-sm",
												children: [booking.current_radius_km, " km"]
											}), /* @__PURE__ */ jsx("p", {
												className: "text-[10px] text-slate-500",
												children: "Search radius"
											})]
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "rounded-xl bg-slate-50 p-2",
											children: [/* @__PURE__ */ jsx("b", {
												className: "text-sm",
												children: booking.notified_provider_count
											}), /* @__PURE__ */ jsx("p", {
												className: "text-[10px] text-slate-500",
												children: "Notified"
											})]
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "rounded-xl bg-slate-50 p-2",
											children: [/* @__PURE__ */ jsx("b", {
												className: "text-sm",
												children: professionalId ? "Assigned" : "Searching"
											}), /* @__PURE__ */ jsx("p", {
												className: "text-[10px] text-slate-500",
												children: "Professional"
											})]
										})
									]
								}),
								professional ? /* @__PURE__ */ jsxs("div", {
									className: "mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3",
									children: [
										/* @__PURE__ */ jsx("div", {
											className: "grid size-10 shrink-0 place-items-center rounded-full bg-teal-100 font-bold text-teal-800",
											children: professional.name.slice(0, 1)
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ jsx("p", {
												className: "truncate text-sm font-bold",
												children: professional.name
											}), /* @__PURE__ */ jsx("p", {
												className: "truncate text-[11px] text-slate-500",
												children: professional.qualification ?? professional.specialty ?? "Verified care professional"
											})]
										}),
										professional.phone ? /* @__PURE__ */ jsx(Button, {
											asChild: true,
											size: "icon",
											variant: "outline",
											children: /* @__PURE__ */ jsx("a", {
												href: `tel:${professional.phone}`,
												"aria-label": `Call ${professional.name}`,
												children: /* @__PURE__ */ jsx(Phone, {})
											})
										}) : null
									]
								}) : null,
								/* @__PURE__ */ jsx("ol", {
									className: "mt-3 space-y-1 border-l-2 border-slate-200 pl-3",
									children: (historyByBooking.get(booking.id) ?? []).map((event) => /* @__PURE__ */ jsxs("li", {
										className: "text-[11px]",
										children: [/* @__PURE__ */ jsx("b", { children: STAGE[event.status] ?? event.status }), /* @__PURE__ */ jsx("span", {
											className: "ml-2 text-slate-500",
											children: new Date(event.created_at).toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit"
											})
										})]
									}, event.id))
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mt-3 border-t border-slate-200 pt-3",
									children: /* @__PURE__ */ jsx(Button, {
										asChild: true,
										size: "sm",
										variant: "outline",
										children: /* @__PURE__ */ jsx(Link, {
											to: "/care-booking",
											children: "Open booking details"
										})
									})
								})
							]
						}, booking.id);
					})
				}) : /* @__PURE__ */ jsxs(Empty, { children: [
					"You have no care requests yet.",
					" ",
					/* @__PURE__ */ jsx(Link, {
						to: "/care-booking",
						className: "font-bold text-teal-700",
						children: "Book care"
					}),
					"."
				] })
			})] }) : /* @__PURE__ */ jsxs("div", {
				className: "space-y-4",
				children: [isProviderSide ? null : /* @__PURE__ */ jsx(Empty, { children: "No offers or assigned jobs yet. Go online in your own portal to start receiving work." }), /* @__PURE__ */ jsx(UnifiedProviderOffers, { roleLabel: ROLE_LABEL[offerRole] ?? "professional" })]
			})
		]
	});
}
//#endregion
export { MatchingDashboard as component };
