import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as Button } from "./button-BT328xhy.js";
import { a as createUnifiedBooking, d as retryUnifiedBooking, f as submitUnifiedBookingReview, i as cancelUnifiedBooking, l as markUnifiedNotificationsRead, s as getMyUnifiedBookingHub, t as useUnifiedBookingRealtime } from "./useUnifiedBookingRealtime-Bveds-oj.js";
import { n as venueKindLabel, t as listCareVenues } from "./care-venues.functions-vV7C2ptZ.js";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { Bell, CheckCircle2, LocateFixed, MapPin, Phone, RefreshCw, Search, Star } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/routes/care-booking.tsx?tsr-split=component
var roles = [
	{
		value: "care_physician",
		label: "Care physician",
		help: "Consultations and home visits"
	},
	{
		value: "nurse",
		label: "Nurse",
		help: "Home nursing and clinical duties"
	},
	{
		value: "technician",
		label: "Medical technician",
		help: "ECG, EEG, imaging and diagnostics"
	},
	{
		value: "physiotherapist",
		label: "Physiotherapist",
		help: "Home and clinic physiotherapy sessions"
	},
	{
		value: "ambulance",
		label: "Ambulance",
		help: "Patient transport and emergency pickup"
	},
	{
		value: "hospital",
		label: "Hospital",
		help: "Facility care and operations"
	}
];
function initialRole() {
	if (typeof window === "undefined") return "care_physician";
	const r = new URLSearchParams(window.location.search).get("role");
	return roles.some((x) => x.value === r) ? r : "care_physician";
}
var activeStatuses = /* @__PURE__ */ new Set([
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
var stageLabel = {
	requested: "Request received",
	searching: "Searching nearby",
	expanded: "Search area expanded",
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
function notificationPriority(metadata) {
	return metadata && typeof metadata === "object" && !Array.isArray(metadata) && "priority" in metadata ? String(metadata.priority ?? "") : "";
}
function CareBookingPage() {
	const fetchHub = useServerFn(getMyUnifiedBookingHub), fetchVenues = useServerFn(listCareVenues), createFn = useServerFn(createUnifiedBooking), cancelFn = useServerFn(cancelUnifiedBooking), reviewFn = useServerFn(submitUnifiedBookingReview), markReadFn = useServerFn(markUnifiedNotificationsRead);
	const qc = useQueryClient();
	useUnifiedBookingRealtime(qc);
	const hub = useQuery({
		queryKey: ["unified-booking-hub"],
		queryFn: () => fetchHub({}),
		refetchInterval: 12e3
	});
	const venues = useQuery({
		queryKey: ["care-venues"],
		queryFn: () => fetchVenues({}),
		select: (data) => ({ venues: data.venues.filter((venue) => venue.kind === "hospital") })
	});
	const [role, setRole] = useState(initialRole), [priority, setPriority] = useState("normal"), [mode, setMode] = useState("home");
	const [form, setForm] = useState({
		title: "",
		serviceCode: "",
		description: "",
		address: "",
		area: "",
		city: "Pune",
		scheduledFor: "",
		preferredFacilityId: "",
		duration: 60,
		earnings: 0,
		lat: void 0,
		lng: void 0
	});
	const [ratingFor, setRatingFor] = useState(null), [ratings, setRatings] = useState({
		overall: 5,
		quality: 5,
		punctuality: 5,
		professionalism: 5,
		communication: 5
	}), [review, setReview] = useState(""), [wouldRecommend, setWouldRecommend] = useState(true), [reportIssue, setReportIssue] = useState(false), [showNotifications, setShowNotifications] = useState(false), [cancelTarget, setCancelTarget] = useState(null), [cancelReason, setCancelReason] = useState("");
	const refresh = () => void qc.invalidateQueries({ queryKey: ["unified-booking-hub"] });
	const create = useMutation({
		mutationFn: () => createFn({ data: {
			serviceType: role,
			providerRole: role,
			serviceCode: form.serviceCode,
			title: form.title,
			description: form.description,
			priority,
			visitMode: mode,
			scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : void 0,
			preferredFacilityId: form.preferredFacilityId || void 0,
			durationMinutes: form.duration,
			estimatedEarnings: form.earnings || void 0,
			address: form.address,
			area: form.area,
			city: form.city,
			lat: form.lat,
			lng: form.lng
		} }),
		onSuccess: () => {
			setForm((old) => ({
				...old,
				title: "",
				description: ""
			}));
			refresh();
		}
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
	const retryFn = useServerFn(retryUnifiedBooking);
	const retry = useMutation({
		mutationFn: (bookingId) => retryFn({ data: { bookingId } }),
		onSuccess: refresh
	});
	const submitReview = useMutation({
		mutationFn: (bookingId) => reviewFn({ data: {
			bookingId,
			...ratings,
			wouldRecommend,
			comment: review,
			reportIssue
		} }),
		onSuccess: () => {
			setRatingFor(null);
			setReview("");
			setReportIssue(false);
			refresh();
		}
	});
	const markRead = useMutation({
		mutationFn: (ids) => markReadFn({ data: { ids } }),
		onSuccess: refresh
	});
	const hubData = hub.data;
	const myBookings = hubData?.bookings ?? [];
	const active = myBookings.filter((booking) => activeStatuses.has(booking.status));
	const completed = myBookings.filter((booking) => booking.status === "completed");
	const reviewed = new Set((hubData?.reviews ?? []).map((item) => item.booking_id));
	const unread = (hubData?.notifications ?? []).filter((item) => !item.read_at);
	const historyByBooking = useMemo(() => new Map(myBookings.map((booking) => [booking.id, (hubData?.history ?? []).filter((event) => event.booking_id === booking.id)])), [hubData, myBookings]);
	const locate = () => navigator.geolocation?.getCurrentPosition((position) => setForm((old) => ({
		...old,
		lat: position.coords.latitude,
		lng: position.coords.longitude
	})));
	return /* @__PURE__ */ jsx("main", {
		className: "min-h-screen bg-clinical-soft px-3 py-5 text-foreground sm:px-6",
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-5xl space-y-5",
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(Link, {
							to: "/bookings",
							className: "text-xs font-bold text-clinical-strong",
							children: "← My bookings"
						}),
						/* @__PURE__ */ jsx("h1", {
							className: "mt-1 text-2xl font-extrabold",
							children: "Book trusted care"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted-foreground",
							children: "Nearby matching starts at 4 km and expands to 11 km."
						})
					] }), /* @__PURE__ */ jsxs(Button, {
						variant: "outline",
						onClick: () => setShowNotifications((value) => !value),
						children: [/* @__PURE__ */ jsx(Bell, {}), unread.length ? `${unread.length} new` : "Notifications"]
					})]
				}),
				showNotifications ? /* @__PURE__ */ jsxs("section", {
					className: "rounded-lg border border-border bg-card p-4",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "font-bold",
							children: "Notification history"
						}), unread.length ? /* @__PURE__ */ jsx(Button, {
							size: "sm",
							variant: "outline",
							onClick: () => markRead.mutate(unread.map((item) => item.id)),
							children: "Mark all read"
						}) : null]
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-3 max-h-64 space-y-2 overflow-y-auto",
						children: hubData?.notifications.length ? hubData.notifications.map((item) => /* @__PURE__ */ jsxs("div", {
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
						}, item.id)) : /* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted-foreground",
							children: "No notifications yet."
						})
					})]
				}) : null,
				/* @__PURE__ */ jsxs("section", {
					className: "grid gap-5 lg:grid-cols-[0.9fr_1.1fr]",
					children: [/* @__PURE__ */ jsxs("form", {
						className: "space-y-4 rounded-lg border border-border bg-card p-4",
						onSubmit: (event) => {
							event.preventDefault();
							create.mutate();
						},
						children: [
							/* @__PURE__ */ jsx("h2", {
								className: "text-lg font-bold",
								children: "What care do you need?"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "grid grid-cols-2 gap-2",
								children: roles.map((item) => /* @__PURE__ */ jsxs(Button, {
									type: "button",
									variant: role === item.value ? "default" : "outline",
									className: "h-auto min-h-16 flex-col items-start whitespace-normal text-left",
									onClick: () => setRole(item.value),
									children: [/* @__PURE__ */ jsx("span", { children: item.label }), /* @__PURE__ */ jsx("span", {
										className: "text-[10px] font-normal opacity-75",
										children: item.help
									})]
								}, item.value))
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "block text-xs font-bold",
								children: ["Service or test", /* @__PURE__ */ jsx("input", {
									required: true,
									value: form.title,
									onChange: (event) => setForm({
										...form,
										title: event.target.value
									}),
									className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm",
									placeholder: "e.g. Wound dressing or ECG"
								})]
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "block text-xs font-bold",
								children: ["Skill / test code", /* @__PURE__ */ jsx("input", {
									value: form.serviceCode,
									onChange: (event) => setForm({
										...form,
										serviceCode: event.target.value
									}),
									className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm",
									placeholder: "Optional matching specialty"
								})]
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "block text-xs font-bold",
								children: ["Details", /* @__PURE__ */ jsx("textarea", {
									rows: 3,
									value: form.description,
									onChange: (event) => setForm({
										...form,
										description: event.target.value
									}),
									className: "mt-1 w-full rounded-md border border-input bg-background p-3 text-sm"
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "grid grid-cols-2 gap-3",
								children: [/* @__PURE__ */ jsxs("label", {
									className: "text-xs font-bold",
									children: ["Priority", /* @__PURE__ */ jsxs("select", {
										value: priority,
										onChange: (event) => setPriority(event.target.value),
										className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2",
										children: [
											/* @__PURE__ */ jsx("option", {
												value: "normal",
												children: "Normal"
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
									})]
								}), /* @__PURE__ */ jsxs("label", {
									className: "text-xs font-bold",
									children: ["Visit type", /* @__PURE__ */ jsxs("select", {
										value: mode,
										onChange: (event) => setMode(event.target.value),
										className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2",
										children: [
											/* @__PURE__ */ jsx("option", {
												value: "home",
												children: "Home"
											}),
											/* @__PURE__ */ jsx("option", {
												value: "facility",
												children: "Facility"
											}),
											/* @__PURE__ */ jsx("option", {
												value: "virtual",
												children: "Virtual"
											}),
											/* @__PURE__ */ jsx("option", {
												value: "locum",
												children: "Locum"
											})
										]
									})]
								})]
							}),
							mode === "facility" || mode === "locum" || role === "hospital" ? /* @__PURE__ */ jsxs("label", {
								className: "block text-xs font-bold",
								children: ["Preferred facility", /* @__PURE__ */ jsxs("select", {
									value: form.preferredFacilityId,
									onChange: (event) => setForm({
										...form,
										preferredFacilityId: event.target.value
									}),
									className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-2",
									children: [/* @__PURE__ */ jsx("option", {
										value: "",
										children: "Any eligible facility"
									}), (venues.data?.venues ?? []).map((venue) => /* @__PURE__ */ jsxs("option", {
										value: venue.id,
										children: [
											venue.name,
											" · ",
											venueKindLabel(venue.kind),
											venue.area ? ` · ${venue.area}` : ""
										]
									}, `${venue.kind}:${venue.id}`))]
								})]
							}) : null,
							/* @__PURE__ */ jsxs("label", {
								className: "block text-xs font-bold",
								children: ["Address", /* @__PURE__ */ jsx("input", {
									required: mode === "home",
									value: form.address,
									onChange: (event) => setForm({
										...form,
										address: event.target.value
									}),
									className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "grid grid-cols-[1fr_auto] gap-2",
								children: [/* @__PURE__ */ jsxs("label", {
									className: "text-xs font-bold",
									children: ["Area", /* @__PURE__ */ jsx("input", {
										required: true,
										value: form.area,
										onChange: (event) => setForm({
											...form,
											area: event.target.value
										}),
										className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
									})]
								}), /* @__PURE__ */ jsxs(Button, {
									type: "button",
									variant: "outline",
									className: "mt-5",
									onClick: locate,
									children: [/* @__PURE__ */ jsx(LocateFixed, {}), "Use location"]
								})]
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "block text-xs font-bold",
								children: ["Schedule (optional)", /* @__PURE__ */ jsx("input", {
									type: "datetime-local",
									value: form.scheduledFor,
									onChange: (event) => setForm({
										...form,
										scheduledFor: event.target.value
									}),
									className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3"
								})]
							}),
							/* @__PURE__ */ jsxs(Button, {
								type: "submit",
								className: "w-full",
								disabled: create.isPending,
								children: [/* @__PURE__ */ jsx(Search, {}), create.isPending ? "Finding care…" : "Find available care"]
							}),
							create.error ? /* @__PURE__ */ jsx("p", {
								role: "alert",
								className: "text-sm text-destructive",
								children: create.error.message
							}) : null
						]
					}), /* @__PURE__ */ jsxs("div", {
						className: "space-y-4",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-lg font-bold",
							children: "Live bookings"
						}), hub.isLoading ? /* @__PURE__ */ jsx("div", {
							className: "rounded-lg bg-card p-6",
							children: "Loading bookings…"
						}) : active.length ? active.map((booking) => {
							const professionalId = booking.assigned_provider_id ?? booking.assigned_facility_id;
							const professional = professionalId ? hubData?.providerDetails[professionalId] : void 0;
							const acceptedOffer = (hubData?.offers ?? []).find((offer) => offer.booking_id === booking.id && offer.status === "accepted");
							const etaMinutes = booking.status === "accepted" ? Math.max(10, Math.round(10 + Number(acceptedOffer?.distance_km ?? 0) * 3)) : null;
							return /* @__PURE__ */ jsxs("article", {
								className: "rounded-lg border border-border bg-card p-4",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex justify-between gap-3",
										children: [/* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsxs("p", {
												className: `text-[11px] font-extrabold uppercase ${booking.priority === "emergency" ? "text-destructive" : "text-clinical-strong"}`,
												children: [
													booking.provider_role.replace("_", " "),
													" · ",
													booking.priority
												]
											}),
											/* @__PURE__ */ jsx("h3", {
												className: "font-bold",
												children: booking.title
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "text-xs text-muted-foreground",
												children: [/* @__PURE__ */ jsx(MapPin, { className: "mr-1 inline size-3" }), booking.area ?? booking.city]
											})
										] }), /* @__PURE__ */ jsx("span", {
											className: "h-fit rounded-full bg-clinical-soft px-3 py-1 text-xs font-bold text-clinical-strong",
											children: stageLabel[booking.status] ?? booking.status
										})]
									}),
									professional ? /* @__PURE__ */ jsxs("div", {
										className: "mt-3 flex items-center gap-3 rounded-md bg-muted p-3",
										children: [
											professional.photoUrl ? /* @__PURE__ */ jsx("img", {
												src: professional.photoUrl,
												alt: "",
												className: "size-11 rounded-full object-cover"
											}) : /* @__PURE__ */ jsx("div", {
												className: "grid size-11 place-items-center rounded-full bg-clinical-soft font-bold text-clinical-strong",
												children: professional.name.slice(0, 1)
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "min-w-0 flex-1",
												children: [
													/* @__PURE__ */ jsx("p", {
														className: "truncate text-sm font-bold",
														children: professional.name
													}),
													/* @__PURE__ */ jsx("p", {
														className: "truncate text-xs text-muted-foreground",
														children: professional.qualification ?? professional.specialty ?? "Verified care professional"
													}),
													/* @__PURE__ */ jsxs("p", {
														className: "text-xs font-semibold text-clinical-strong",
														children: [professional.averageRating ? `${professional.averageRating} ★ · ${professional.ratingCount} rating${professional.ratingCount === 1 ? "" : "s"}` : "New on MedConnect", etaMinutes ? ` · about ${etaMinutes} min` : ""]
													})
												]
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
									/* @__PURE__ */ jsxs("div", {
										className: "mt-4 grid grid-cols-3 gap-2 text-center",
										children: [
											/* @__PURE__ */ jsxs("div", {
												className: "rounded-md bg-muted p-2",
												children: [/* @__PURE__ */ jsxs("b", { children: [booking.current_radius_km, " km"] }), /* @__PURE__ */ jsx("p", {
													className: "text-[10px] text-muted-foreground",
													children: "Search radius"
												})]
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "rounded-md bg-muted p-2",
												children: [/* @__PURE__ */ jsx("b", { children: booking.notified_provider_count }), /* @__PURE__ */ jsx("p", {
													className: "text-[10px] text-muted-foreground",
													children: "Notified"
												})]
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "rounded-md bg-muted p-2",
												children: [/* @__PURE__ */ jsx("b", { children: professionalId ? "Assigned" : "Searching" }), /* @__PURE__ */ jsx("p", {
													className: "text-[10px] text-muted-foreground",
													children: "Professional"
												})]
											})
										]
									}),
									/* @__PURE__ */ jsx("ol", {
										className: "mt-4 space-y-2 border-l-2 border-border pl-4",
										children: (historyByBooking.get(booking.id) ?? []).map((event) => /* @__PURE__ */ jsxs("li", {
											className: "text-xs",
											children: [
												/* @__PURE__ */ jsx("b", { children: stageLabel[event.status] ?? event.status }),
												/* @__PURE__ */ jsx("span", {
													className: "ml-2 text-muted-foreground",
													children: new Date(event.created_at).toLocaleString()
												}),
												event.note ? /* @__PURE__ */ jsx("p", {
													className: "text-muted-foreground",
													children: event.note
												}) : null
											]
										}, event.id))
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "mt-4 flex flex-wrap gap-2",
										children: [
											booking.status === "unavailable" ? /* @__PURE__ */ jsxs(Button, {
												size: "sm",
												onClick: () => retry.mutate(booking.id),
												disabled: retry.isPending,
												children: [/* @__PURE__ */ jsx(RefreshCw, {}), "Retry matching"]
											}) : null,
											/* @__PURE__ */ jsx(Button, {
												variant: "outline",
												size: "sm",
												onClick: () => setCancelTarget(booking.id),
												children: "Cancel booking"
											}),
											/* @__PURE__ */ jsx("a", {
												className: "inline-flex min-h-9 items-center text-xs font-bold text-clinical-strong",
												href: "mailto:support@medconnect.example",
												children: "Contact support"
											})
										]
									}),
									cancelTarget === booking.id ? /* @__PURE__ */ jsxs("form", {
										className: "mt-3 flex flex-wrap gap-2 rounded-md bg-muted p-3",
										onSubmit: (event) => {
											event.preventDefault();
											cancel.mutate({
												bookingId: booking.id,
												reason: cancelReason
											});
										},
										children: [
											/* @__PURE__ */ jsxs("label", {
												className: "min-w-48 flex-1 text-xs font-bold",
												children: ["Why are you cancelling?", /* @__PURE__ */ jsx("input", {
													required: true,
													minLength: 3,
													value: cancelReason,
													onChange: (event) => setCancelReason(event.target.value),
													className: "mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 font-normal"
												})]
											}),
											/* @__PURE__ */ jsx(Button, {
												className: "mt-5",
												size: "sm",
												type: "submit",
												disabled: cancel.isPending || cancelReason.trim().length < 3,
												children: "Confirm cancellation"
											}),
											/* @__PURE__ */ jsx(Button, {
												className: "mt-5",
												size: "sm",
												type: "button",
												variant: "ghost",
												onClick: () => {
													setCancelTarget(null);
													setCancelReason("");
												},
												children: "Keep booking"
											})
										]
									}) : null
								]
							}, booking.id);
						}) : /* @__PURE__ */ jsx("div", {
							className: "rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground",
							children: "No active bookings. Create one to begin live matching."
						})]
					})]
				}),
				completed.some((booking) => !reviewed.has(booking.id)) ? /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
					className: "mb-3 text-lg font-bold",
					children: "Rate completed care"
				}), /* @__PURE__ */ jsx("div", {
					className: "grid gap-3 sm:grid-cols-2",
					children: completed.filter((booking) => !reviewed.has(booking.id)).map((booking) => /* @__PURE__ */ jsxs("article", {
						className: "rounded-lg border border-border bg-card p-4",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx(CheckCircle2, { className: "text-clinical-strong" }), /* @__PURE__ */ jsx("h3", {
								className: "font-bold",
								children: booking.title
							})]
						}), ratingFor === booking.id ? /* @__PURE__ */ jsxs("div", {
							className: "mt-3 space-y-3",
							children: [
								[
									["overall", "Overall"],
									["quality", "Service quality"],
									["punctuality", "Punctuality"],
									["professionalism", "Professionalism"],
									["communication", "Communication"]
								].map(([key, label]) => /* @__PURE__ */ jsxs("div", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ jsx("span", {
										className: "text-xs font-bold",
										children: label
									}), /* @__PURE__ */ jsx("div", {
										className: "flex",
										children: [
											1,
											2,
											3,
											4,
											5
										].map((value) => /* @__PURE__ */ jsx(Button, {
											type: "button",
											size: "icon",
											variant: "ghost",
											"aria-label": `${label}: ${value} stars`,
											onClick: () => setRatings((old) => ({
												...old,
												[key]: value
											})),
											children: /* @__PURE__ */ jsx(Star, { className: value <= ratings[key] ? "fill-current text-amber-500" : "text-muted-foreground" })
										}, value))
									})]
								}, key)),
								/* @__PURE__ */ jsx("textarea", {
									className: "w-full rounded-md border border-input bg-background p-3 text-sm",
									placeholder: "Share your experience",
									value: review,
									onChange: (event) => setReview(event.target.value)
								}),
								/* @__PURE__ */ jsxs("label", {
									className: "flex items-center gap-2 text-xs",
									children: [/* @__PURE__ */ jsx("input", {
										type: "checkbox",
										checked: wouldRecommend,
										onChange: (event) => setWouldRecommend(event.target.checked)
									}), "I would recommend this professional"]
								}),
								/* @__PURE__ */ jsxs("label", {
									className: "flex items-center gap-2 text-xs text-destructive",
									children: [/* @__PURE__ */ jsx("input", {
										type: "checkbox",
										checked: reportIssue,
										onChange: (event) => setReportIssue(event.target.checked)
									}), "Report this for operations review"]
								}),
								/* @__PURE__ */ jsx(Button, {
									onClick: () => submitReview.mutate(booking.id),
									disabled: submitReview.isPending,
									children: "Submit review"
								})
							]
						}) : /* @__PURE__ */ jsx(Button, {
							className: "mt-3",
							variant: "outline",
							onClick: () => setRatingFor(booking.id),
							children: "Rate care"
						})]
					}, booking.id))
				})] }) : null,
				completed.length ? /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
					className: "mb-3 text-lg font-bold",
					children: "Booking history"
				}), /* @__PURE__ */ jsx("div", {
					className: "space-y-2",
					children: completed.map((booking) => /* @__PURE__ */ jsxs("article", {
						className: "flex items-center justify-between rounded-lg border border-border bg-card p-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "text-sm font-bold",
							children: booking.title
						}), /* @__PURE__ */ jsx("p", {
							className: "text-xs text-muted-foreground",
							children: booking.completed_at ? new Date(booking.completed_at).toLocaleString() : "Completed"
						})] }), /* @__PURE__ */ jsx("span", {
							className: "text-xs font-bold text-clinical-strong",
							children: reviewed.has(booking.id) ? "Rated" : "Rating pending"
						})]
					}, booking.id))
				})] }) : null
			]
		})
	});
}
//#endregion
export { CareBookingPage as component };
