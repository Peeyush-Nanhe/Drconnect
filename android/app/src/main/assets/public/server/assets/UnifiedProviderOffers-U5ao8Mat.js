import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { t as Button } from "./button-BT328xhy.js";
import { i as cancelUnifiedBooking, l as markUnifiedNotificationsRead, n as acceptUnifiedOffer, o as declineUnifiedOffer, p as transitionUnifiedBooking, s as getMyUnifiedBookingHub, t as useUnifiedBookingRealtime } from "./useUnifiedBookingRealtime-Bveds-oj.js";
import { i as shareProviderLocation } from "./booking-tracking.functions-DTbwSr2x.js";
import { c as Stat, o as Section, r as Empty, t as Card } from "./StaffUI-k1pvanXG.js";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { Bell, CheckCircle2, Clock3, MapPin, Navigation, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
//#region src/lib/push.functions.ts
var PLATFORMS = [
	"android",
	"ios",
	"web"
];
var PROVIDERS = [
	"fcm",
	"apns",
	"expo",
	"webpush"
];
/** Register (or refresh) the current user's push token for this device. */
var registerDeviceToken = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => {
	if (!data || typeof data !== "object") throw new Error("invalid input");
	if (!data.token || typeof data.token !== "string" || data.token.length > 4096) throw new Error("token required");
	if (!PLATFORMS.includes(data.platform)) throw new Error("invalid platform");
	if (data.provider && !PROVIDERS.includes(data.provider)) throw new Error("invalid provider");
	return data;
}).handler(createSsrRpc("eed86b1d944a67233fe1c0007f65484482f26e3ede34c365a0ecec262082ae72"));
createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((data) => {
	if (!data?.token || typeof data.token !== "string") throw new Error("token required");
	return data;
}).handler(createSsrRpc("90de4c4cc73a76b85874a8e52d9a856607befe6646323d341d76a31c7742ad23"));
createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("4592910ff3c97ff5a5f3c6c992f7ee5d86a3d9706a6c9624ecf0c39fef7a58c3"));
//#endregion
//#region src/lib/push-client.ts
/**
* Browser push notification registration using Firebase Cloud Messaging.
*
* This module is safe to import from client code. It only talks to the
* browser Firebase SDK and the app's own `registerDeviceToken` server function.
*
* The Firebase project credentials come from the Lovable Firebase Cloud
* Messaging connector (VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_* env vars).
* If those variables are not set, the helper returns `not-configured`.
*/
var app = null;
var messaging = null;
function getFirebaseConfig() {
	return {
		apiKey: void 0,
		projectId: void 0,
		appId: void 0,
		vapidKey: void 0,
		messagingSenderId: ""
	};
}
async function ensureMessaging() {
	if (messaging) return messaging;
	const { apiKey, projectId, appId, messagingSenderId } = getFirebaseConfig();
	if (!apiKey || !projectId || !appId || !messagingSenderId) return null;
	try {
		const appMod = "firebase/app";
		const msgMod = "firebase/messaging";
		const { initializeApp } = await import(
			/* @vite-ignore */
			appMod
);
		const { getMessaging } = await import(
			/* @vite-ignore */
			msgMod
);
		app = initializeApp({
			apiKey,
			projectId,
			appId,
			messagingSenderId
		});
		messaging = getMessaging(app);
		return messaging;
	} catch {
		return null;
	}
}
/**
* Request notification permission and register this browser for push.
* Must be called from a user gesture (button click) on a top-level page.
*/
async function enablePushNotifications() {
	const { vapidKey, appId } = getFirebaseConfig();
	if (!vapidKey || !appId) return { status: "not-configured" };
	if (typeof window === "undefined") return { status: "unavailable" };
	let isSupportedFn = null;
	let getTokenFn = null;
	try {
		const fbm = await import(
			/* @vite-ignore */
			"firebase/messaging"
);
		isSupportedFn = fbm.isSupported;
		getTokenFn = fbm.getToken;
	} catch {
		return { status: "not-configured" };
	}
	if (!("Notification" in window) || isSupportedFn && !await isSupportedFn()) return { status: "unsupported" };
	if (window.top !== window.self) return { status: "open-in-new-tab" };
	if ((Notification.permission === "granted" ? "granted" : await Notification.requestPermission()) !== "granted") return { status: "denied" };
	const msg = await ensureMessaging();
	if (!msg || !getTokenFn) return { status: "unavailable" };
	try {
		const token = await getTokenFn(msg, { vapidKey });
		if (!token) return { status: "unavailable" };
		await registerDeviceToken({ data: {
			token,
			platform: "web",
			deviceInfo: {
				userAgent: navigator.userAgent,
				language: navigator.language,
				registeredAt: (/* @__PURE__ */ new Date()).toISOString()
			}
		} });
		return {
			status: "registered",
			token
		};
	} catch (err) {
		console.warn("Could not register for push notifications:", err);
		return { status: "unavailable" };
	}
}
//#endregion
//#region src/features/native/PhoneAlertsButton.tsx
function PhoneAlertsButton() {
	const [busy, setBusy] = useState(false);
	const handleClick = async () => {
		setBusy(true);
		try {
			const res = await enablePushNotifications();
			if (res.status === "registered") toast.success("Phone alerts enabled!");
			else if (res.status === "denied") toast.error("Notification permission was denied.");
			else toast.info("Push alerts not configured on this browser/environment.");
		} catch {
			toast.error("Could not enable phone alerts.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ jsxs(Button, {
		type: "button",
		variant: "outline",
		size: "sm",
		disabled: busy,
		onClick: handleClick,
		className: "flex items-center gap-1.5 text-xs font-semibold",
		children: [/* @__PURE__ */ jsx(Bell, { className: "h-3.5 w-3.5 text-teal-600" }), busy ? "Enabling…" : "Phone alerts"]
	});
}
//#endregion
//#region src/features/bookings/ShareLocationToggle.tsx
function ShareLocationToggle({ active }) {
	const share = useServerFn(shareProviderLocation);
	const [state, setState] = useState("off");
	const [message, setMessage] = useState(null);
	const watchRef = useRef(null);
	const lastSentRef = useRef(0);
	const stop = () => {
		if (watchRef.current != null && typeof navigator !== "undefined") navigator.geolocation.clearWatch(watchRef.current);
		watchRef.current = null;
	};
	useEffect(() => stop, []);
	useEffect(() => {
		if (!active && watchRef.current != null) {
			stop();
			setState("off");
		}
	}, [active]);
	const start = () => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			setState("error");
			setMessage("This device cannot share location.");
			return;
		}
		watchRef.current = navigator.geolocation.watchPosition((position) => {
			const now = Date.now();
			if (now - lastSentRef.current < 2e4) return;
			lastSentRef.current = now;
			share({ data: {
				lat: position.coords.latitude,
				lng: position.coords.longitude
			} }).then(() => {
				setState("on");
				setMessage(null);
			}).catch((cause) => {
				setState("error");
				setMessage(cause.message);
			});
		}, (cause) => {
			setState("error");
			setMessage(cause.code === cause.PERMISSION_DENIED ? "Allow location for MedConnect in your browser settings." : "Could not read your location.");
		}, {
			enableHighAccuracy: true,
			maximumAge: 15e3,
			timeout: 2e4
		});
		setState("on");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-1",
		children: [state === "on" ? /* @__PURE__ */ jsxs(Button, {
			size: "sm",
			variant: "outline",
			onClick: () => {
				stop();
				setState("off");
			},
			children: [/* @__PURE__ */ jsx(Navigation, { className: "text-clinical-strong" }), "Sharing my location — stop"]
		}) : /* @__PURE__ */ jsxs(Button, {
			size: "sm",
			variant: "outline",
			onClick: start,
			children: [/* @__PURE__ */ jsx(Navigation, {}), "Share my location"]
		}), message ? /* @__PURE__ */ jsx("p", {
			className: "text-[11px] font-semibold text-rose-700",
			children: message
		}) : null]
	});
}
//#endregion
//#region src/features/bookings/UnifiedProviderOffers.tsx
var NEXT = {
	accepted: {
		status: "en_route",
		label: "Start travel"
	},
	en_route: {
		status: "arrived",
		label: "Mark arrived"
	},
	arrived: {
		status: "started",
		label: "Start service"
	},
	started: {
		status: "completed",
		label: "Complete service"
	}
};
function notificationPriority(metadata) {
	return metadata && typeof metadata === "object" && !Array.isArray(metadata) && "priority" in metadata ? String(metadata.priority ?? "") : "";
}
function UnifiedProviderOffers({ roleLabel = "professional" }) {
	const fetchHub = useServerFn(getMyUnifiedBookingHub);
	const acceptFn = useServerFn(acceptUnifiedOffer);
	const declineFn = useServerFn(declineUnifiedOffer);
	const transitionFn = useServerFn(transitionUnifiedBooking);
	const cancelFn = useServerFn(cancelUnifiedBooking);
	const markReadFn = useServerFn(markUnifiedNotificationsRead);
	const qc = useQueryClient();
	useUnifiedBookingRealtime(qc);
	const [cancelTarget, setCancelTarget] = useState(null);
	const [cancelReason, setCancelReason] = useState("");
	const [showNotifications, setShowNotifications] = useState(false);
	const hub = useQuery({
		queryKey: ["unified-booking-hub"],
		queryFn: () => fetchHub({}),
		refetchInterval: 15e3
	});
	const refresh = () => void qc.invalidateQueries({ queryKey: ["unified-booking-hub"] });
	const accept = useMutation({
		mutationFn: (offerId) => acceptFn({ data: { offerId } }),
		onSuccess: refresh
	});
	const decline = useMutation({
		mutationFn: (offerId) => declineFn({ data: { offerId } }),
		onSuccess: refresh
	});
	const transition = useMutation({
		mutationFn: (data) => transitionFn({ data }),
		onSuccess: refresh
	});
	const cancel = useMutation({
		mutationFn: ({ bookingId, reason }) => cancelFn({ data: {
			bookingId,
			reason
		} }),
		onSuccess: () => {
			setCancelTarget(null);
			setCancelReason("");
			refresh();
		}
	});
	const markRead = useMutation({
		mutationFn: (ids) => markReadFn({ data: { ids } }),
		onSuccess: refresh
	});
	const hubData = hub.data;
	const bookings = hubData?.bookings ?? [];
	const byId = new Map(bookings.map((booking) => [booking.id, booking]));
	const pending = (hubData?.offers ?? []).filter((offer) => offer.status === "pending" && new Date(offer.expires_at).getTime() > Date.now());
	const active = bookings.filter((booking) => (booking.assigned_provider_id || booking.assigned_facility_id) && [
		"accepted",
		"en_route",
		"arrived",
		"started"
	].includes(booking.status));
	const unread = (hubData?.notifications ?? []).filter((item) => !item.read_at);
	if (hub.isLoading) return /* @__PURE__ */ jsx(Empty, { children: "Loading live assignments…" });
	return /* @__PURE__ */ jsxs("div", {
		className: "space-y-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ jsx(ShareLocationToggle, { active: active.length > 0 }),
					/* @__PURE__ */ jsx(PhoneAlertsButton, {}),
					/* @__PURE__ */ jsx(Button, {
						asChild: true,
						size: "sm",
						variant: "outline",
						className: "min-h-9",
						children: /* @__PURE__ */ jsx(Link, {
							to: "/matching",
							children: "Live matching dashboard"
						})
					})
				]
			}),
			(hubData?.notifications?.length ?? 0) > 0 ? /* @__PURE__ */ jsxs(Card, {
				accent: unread.some((item) => notificationPriority(item.metadata) === "emergency"),
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("button", {
						type: "button",
						className: "flex min-w-0 gap-2 text-left",
						onClick: () => setShowNotifications((value) => !value),
						"aria-expanded": showNotifications,
						children: [/* @__PURE__ */ jsx(Bell, { className: "size-4 shrink-0 text-clinical-strong" }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
							className: "text-sm font-bold",
							children: ["Notifications ", unread.length ? `(${unread.length} unread)` : ""]
						}), /* @__PURE__ */ jsx("p", {
							className: "truncate text-xs text-muted-foreground",
							children: unread[0]?.title ?? hubData?.notifications[0]?.title
						})] })]
					}), unread.length ? /* @__PURE__ */ jsx(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => markRead.mutate(unread.map((item) => item.id)),
						children: "Mark read"
					}) : null]
				}), showNotifications ? /* @__PURE__ */ jsx("div", {
					className: "mt-3 max-h-64 space-y-2 overflow-y-auto border-t border-border pt-3",
					children: (hubData?.notifications ?? []).map((item) => /* @__PURE__ */ jsxs("div", {
						className: `rounded-md p-2 text-xs ${notificationPriority(item.metadata) === "emergency" ? "bg-destructive/10 text-destructive" : "bg-muted"}`,
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-bold",
								children: item.title
							}),
							/* @__PURE__ */ jsx("p", { children: item.body }),
							/* @__PURE__ */ jsx("time", {
								className: "text-muted-foreground",
								children: new Date(item.created_at).toLocaleString()
							})
						]
					}, item.id))
				}) : null]
			}) : null,
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "New offers",
						value: pending.length
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Active",
						value: active.length
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Reliability",
						value: `${hubData?.reliability.score ?? 80}/100`,
						tone: "slate"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Patient rating",
						value: (() => {
							const mine = (hubData?.reviews ?? []).filter((review) => review.reviewee_id && bookings.some((booking) => booking.assigned_provider_id === review.reviewee_id));
							return mine.length ? `${(mine.reduce((sum, review) => sum + review.overall_rating, 0) / mine.length).toFixed(1)}★` : "New";
						})(),
						tone: "slate"
					})
				]
			}),
			/* @__PURE__ */ jsx(Section, {
				title: `New ${roleLabel} offers`,
				count: pending.length,
				children: /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: pending.length ? pending.map((offer) => {
						const booking = byId.get(offer.booking_id);
						return booking ? /* @__PURE__ */ jsxs(Card, {
							accent: booking.priority !== "normal",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex items-start justify-between gap-3",
									children: [/* @__PURE__ */ jsxs("div", {
										className: "min-w-0 flex-1",
										children: [
											/* @__PURE__ */ jsxs("p", {
												className: `text-[11px] font-extrabold uppercase ${booking.priority === "emergency" ? "text-destructive" : "text-clinical-strong"}`,
												children: [
													booking.priority,
													" · ",
													booking.visit_mode.replace("_", " ")
												]
											}),
											/* @__PURE__ */ jsx("h3", {
												className: "mt-1 truncate text-sm font-bold",
												children: booking.title
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "mt-1 truncate text-xs text-muted-foreground",
												children: [
													booking.area ?? booking.city,
													" · ",
													booking.duration_minutes ?? 60,
													" min"
												]
											}),
											booking.service_code ? /* @__PURE__ */ jsxs("p", {
												className: "mt-1 truncate text-xs font-semibold",
												children: ["Required: ", booking.service_code]
											}) : null
										]
									}), /* @__PURE__ */ jsxs("div", {
										className: "shrink-0 text-right",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-bold text-clinical-strong",
											children: offer.earnings ? `₹${offer.earnings}` : "Fee to confirm"
										}), offer.distance_km != null ? /* @__PURE__ */ jsxs("p", {
											className: "text-xs text-muted-foreground",
											children: [Number(offer.distance_km).toFixed(1), " km"]
										}) : null]
									})]
								}),
								booking.description ? /* @__PURE__ */ jsx("p", {
									className: "mt-3 text-xs text-muted-foreground",
									children: booking.description
								}) : null,
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3",
									children: [
										/* @__PURE__ */ jsxs(Button, {
											size: "sm",
											onClick: () => accept.mutate(offer.id),
											disabled: accept.isPending,
											children: [/* @__PURE__ */ jsx(CheckCircle2, {}), "Accept"]
										}),
										/* @__PURE__ */ jsxs(Button, {
											size: "sm",
											variant: "outline",
											onClick: () => decline.mutate(offer.id),
											disabled: decline.isPending,
											children: [/* @__PURE__ */ jsx(XCircle, {}), "Decline"]
										}),
										/* @__PURE__ */ jsxs("span", {
											className: "ml-auto whitespace-nowrap text-[11px] text-muted-foreground",
											children: [
												/* @__PURE__ */ jsx(Clock3, { className: "mr-1 inline size-3" }),
												"until ",
												new Date(offer.expires_at).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit"
												})
											]
										})
									]
								})
							]
						}, offer.id) : null;
					}) : /* @__PURE__ */ jsx(Empty, { children: "No new offers within your selected area." })
				})
			}),
			/* @__PURE__ */ jsx(Section, {
				title: "Active assignments",
				count: active.length,
				children: /* @__PURE__ */ jsx("div", {
					className: "space-y-3",
					children: active.length ? active.map((booking) => {
						const next = NEXT[booking.status];
						return /* @__PURE__ */ jsxs(Card, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between gap-3",
								children: [/* @__PURE__ */ jsxs("div", { children: [
									/* @__PURE__ */ jsx("h3", {
										className: "text-sm font-bold",
										children: booking.title
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "text-xs text-muted-foreground",
										children: [/* @__PURE__ */ jsx(MapPin, { className: "mr-1 inline size-3" }), booking.address ?? booking.area ?? booking.city]
									}),
									/* @__PURE__ */ jsx("p", {
										className: "mt-1 text-xs font-semibold capitalize text-clinical-strong",
										children: booking.status.replace("_", " ")
									})
								] }), booking.estimated_earnings ? /* @__PURE__ */ jsxs("p", {
									className: "font-bold",
									children: ["₹", booking.estimated_earnings]
								}) : null]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-3 flex gap-2 border-t border-border pt-3",
								children: [next ? /* @__PURE__ */ jsxs(Button, {
									size: "sm",
									onClick: () => transition.mutate({
										bookingId: booking.id,
										status: next.status
									}),
									disabled: transition.isPending,
									children: [/* @__PURE__ */ jsx(Navigation, {}), next.label]
								}) : null, /* @__PURE__ */ jsx(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => setCancelTarget(booking.id),
									disabled: cancel.isPending,
									children: "Cancel & reassign"
								})]
							}),
							cancelTarget === booking.id ? /* @__PURE__ */ jsxs("form", {
								className: "mt-3 flex flex-col gap-2 border-t border-border pt-3 sm:flex-row",
								onSubmit: (event) => {
									event.preventDefault();
									cancel.mutate({
										bookingId: booking.id,
										reason: cancelReason
									});
								},
								children: [
									/* @__PURE__ */ jsx("input", {
										required: true,
										minLength: 3,
										className: "min-h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm",
										value: cancelReason,
										onChange: (event) => setCancelReason(event.target.value),
										placeholder: "Reason for cancellation"
									}),
									/* @__PURE__ */ jsx(Button, {
										size: "sm",
										type: "submit",
										variant: "destructive",
										disabled: cancel.isPending || cancelReason.trim().length < 3,
										children: "Confirm reassignment"
									}),
									/* @__PURE__ */ jsx(Button, {
										size: "sm",
										type: "button",
										variant: "ghost",
										onClick: () => setCancelTarget(null),
										children: "Keep job"
									})
								]
							}) : null
						] }, booking.id);
					}) : /* @__PURE__ */ jsx(Empty, { children: "No active assignments." })
				})
			}),
			(hubData?.reliability.events.length ?? 0) > 0 ? /* @__PURE__ */ jsx(Section, {
				title: "Reliability history",
				children: /* @__PURE__ */ jsx(Card, { children: /* @__PURE__ */ jsx("div", {
					className: "space-y-2",
					children: hubData?.reliability.events.slice(0, 5).map((event, index) => /* @__PURE__ */ jsxs("div", {
						className: "flex justify-between border-b border-border py-2 last:border-0",
						children: [/* @__PURE__ */ jsx("span", {
							className: "text-xs capitalize",
							children: event.event_type.replaceAll("_", " ")
						}), /* @__PURE__ */ jsxs("span", {
							className: `text-xs font-bold ${event.score_delta >= 0 ? "text-clinical-strong" : "text-destructive"}`,
							children: [event.score_delta >= 0 ? "+" : "", event.score_delta]
						})]
					}, `${event.created_at}-${index}`))
				}) })
			}) : null,
			accept.error || decline.error || transition.error || cancel.error ? /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "text-sm font-semibold text-destructive",
				children: String((accept.error || decline.error || transition.error || cancel.error)?.message)
			}) : null
		]
	});
}
//#endregion
export { PhoneAlertsButton as n, UnifiedProviderOffers as t };
