import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as Button } from "./button-BT328xhy.js";
import { c as getUnifiedBookingOperations, m as updateUnifiedMatchingSettings, r as adjustProviderReliability, t as useUnifiedBookingRealtime, u as resolveUnifiedBookingIssue } from "./useUnifiedBookingRealtime-Bveds-oj.js";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/routes/admin.booking-operations.tsx?tsr-split=component
var TABS = [
	{
		value: "controls",
		label: "Matching controls"
	},
	{
		value: "queue",
		label: "Live queue"
	},
	{
		value: "offers",
		label: "Offer history"
	},
	{
		value: "reliability",
		label: "Staff reliability"
	},
	{
		value: "issues",
		label: "Service issues"
	}
];
var CONTROL_FIELDS = [
	[
		"initialRadiusKm",
		"Starting radius (km)",
		"Where the search begins for every new request."
	],
	[
		"expansionIntervalMinutes",
		"Expand every (min)",
		"How long before the search widens."
	],
	[
		"expansionStepKm",
		"Expansion step (km)",
		"How much wider each time."
	],
	[
		"maxRadiusKm",
		"Maximum radius (km)",
		"The search never goes past this."
	],
	[
		"offerExpiryMinutes",
		"Offer expires (min)",
		"Time a professional has to accept."
	],
	[
		"minimumReliabilityScore",
		"Minimum reliability",
		"Staff below this get no offers."
	],
	[
		"providerCancellationPenalty",
		"Provider cancellation points",
		"Deducted when staff drop a job."
	],
	[
		"lateArrivalPenalty",
		"Late arrival points",
		"Deducted for late arrivals."
	],
	[
		"noShowPenalty",
		"No-show points",
		"Deducted when staff never arrive."
	]
];
function Stat({ label, value }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-lg border border-border bg-card p-4",
		children: [/* @__PURE__ */ jsx("b", {
			className: "text-2xl text-clinical-strong",
			children: value
		}), /* @__PURE__ */ jsx("p", {
			className: "text-xs text-muted-foreground",
			children: label
		})]
	});
}
function BookingOperations() {
	const fetchOps = useServerFn(getUnifiedBookingOperations);
	const saveFn = useServerFn(updateUnifiedMatchingSettings);
	const resolveFn = useServerFn(resolveUnifiedBookingIssue);
	const adjustFn = useServerFn(adjustProviderReliability);
	const qc = useQueryClient();
	useUnifiedBookingRealtime(qc, false);
	const query = useQuery({
		queryKey: ["booking-operations"],
		queryFn: () => fetchOps({}),
		refetchInterval: 15e3
	});
	const refresh = () => void qc.invalidateQueries({ queryKey: ["booking-operations"] });
	const [tab, setTab] = useState("controls");
	const [form, setForm] = useState({
		initialRadiusKm: 4,
		expansionIntervalMinutes: 1,
		expansionStepKm: 1,
		maxRadiusKm: 11,
		offerExpiryMinutes: 5,
		minimumReliabilityScore: 45,
		providerCancellationPenalty: -8,
		lateArrivalPenalty: -3,
		noShowPenalty: -20
	});
	const [resolution, setResolution] = useState({});
	const [adjust, setAdjust] = useState({});
	const [offerFilter, setOfferFilter] = useState("all");
	const [staffSearch, setStaffSearch] = useState("");
	const qData = query.data;
	useEffect(() => {
		const s = qData?.settings;
		if (s) setForm({
			initialRadiusKm: Number(s.initial_radius_km),
			expansionIntervalMinutes: s.expansion_interval_minutes,
			expansionStepKm: Number(s.expansion_step_km),
			maxRadiusKm: Number(s.max_radius_km),
			offerExpiryMinutes: s.offer_expiry_minutes,
			minimumReliabilityScore: Number(s.minimum_reliability_score),
			providerCancellationPenalty: s.provider_cancellation_penalty,
			lateArrivalPenalty: s.late_arrival_penalty,
			noShowPenalty: s.no_show_penalty
		});
	}, [qData?.settings]);
	const save = useMutation({
		mutationFn: () => saveFn({ data: form }),
		onSuccess: refresh
	});
	const resolve = useMutation({
		mutationFn: (data) => resolveFn({ data }),
		onSuccess: refresh
	});
	const adjustScore = useMutation({
		mutationFn: (data) => adjustFn({ data }),
		onSuccess: (_result, variables) => {
			setAdjust((prev) => ({
				...prev,
				[variables.providerId]: {
					delta: "",
					note: ""
				}
			}));
			refresh();
		}
	});
	const bookings = qData?.bookings ?? [];
	const offers = qData?.offers ?? [];
	const staff = qData?.staff ?? [];
	const titleById = qData?.bookingTitleById ?? {};
	const nameById = qData?.nameById ?? {};
	const pending = bookings.filter((b) => [
		"requested",
		"searching",
		"expanded",
		"offered",
		"unavailable"
	].includes(b.status));
	const openIssues = (qData?.issues ?? []).filter((issue) => issue.status !== "resolved" && issue.status !== "dismissed");
	const filteredOffers = offerFilter === "all" ? offers : offers.filter((offer) => offer.status === offerFilter);
	const visibleStaff = staffSearch.trim() ? staff.filter((member) => member.name.toLowerCase().includes(staffSearch.trim().toLowerCase())) : staff;
	return /* @__PURE__ */ jsx("main", {
		className: "min-h-screen bg-clinical-soft p-4",
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-6xl space-y-5",
			children: [
				/* @__PURE__ */ jsxs("header", { children: [
					/* @__PURE__ */ jsx(Link, {
						to: "/admin",
						className: "text-xs font-bold text-clinical-strong",
						children: "← Admin console"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "text-2xl font-extrabold",
						children: "Booking Operations"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-muted-foreground",
						children: "Set the matching rules, review every offer, and manage staff reliability."
					})
				] }),
				query.error ? /* @__PURE__ */ jsx("p", {
					role: "alert",
					className: "rounded-lg bg-card p-4 text-destructive",
					children: query.error.message
				}) : null,
				/* @__PURE__ */ jsxs("section", {
					className: "grid grid-cols-2 gap-3 sm:grid-cols-4",
					children: [
						/* @__PURE__ */ jsx(Stat, {
							label: "Open matching",
							value: pending.length
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Active jobs",
							value: bookings.filter((b) => [
								"accepted",
								"en_route",
								"arrived",
								"started"
							].includes(b.status)).length
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Offers sent",
							value: offers.length
						}),
						/* @__PURE__ */ jsx(Stat, {
							label: "Staff below limit",
							value: staff.filter((member) => member.score < form.minimumReliabilityScore).length
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "flex gap-2 overflow-x-auto pb-1",
					children: TABS.map((item) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => setTab(item.value),
						className: `min-h-10 shrink-0 rounded-full px-4 text-xs font-bold ${tab === item.value ? "bg-clinical-strong text-white" : "border border-border bg-card"}`,
						children: [item.label, item.value === "issues" && openIssues.length ? ` · ${openIssues.length}` : ""]
					}, item.value))
				}),
				tab === "controls" ? /* @__PURE__ */ jsxs("form", {
					className: "rounded-lg border border-border bg-card p-4",
					onSubmit: (event) => {
						event.preventDefault();
						save.mutate();
					},
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "mb-1 font-bold",
							children: "Matching parameters"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mb-3 text-xs text-muted-foreground",
							children: "These apply to every service — nursing, tests, physiotherapy, consultations and ambulance."
						}),
						/* @__PURE__ */ jsx("div", {
							className: "grid gap-3 sm:grid-cols-3",
							children: CONTROL_FIELDS.map(([key, label, help]) => /* @__PURE__ */ jsxs("label", {
								className: "text-xs font-bold",
								children: [
									label,
									/* @__PURE__ */ jsx("input", {
										type: "number",
										step: key.includes("Radius") || key === "expansionStepKm" ? "0.5" : "1",
										className: "mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3",
										value: form[key],
										onChange: (event) => setForm({
											...form,
											[key]: Number(event.target.value)
										})
									}),
									/* @__PURE__ */ jsx("span", {
										className: "mt-1 block font-normal text-muted-foreground",
										children: help
									})
								]
							}, key))
						}),
						/* @__PURE__ */ jsx(Button, {
							className: "mt-3",
							type: "submit",
							disabled: save.isPending,
							children: save.isPending ? "Saving…" : "Save controls"
						}),
						save.error ? /* @__PURE__ */ jsx("p", {
							role: "alert",
							className: "mt-2 text-sm font-semibold text-destructive",
							children: save.error.message
						}) : null,
						save.isSuccess && !save.isPending ? /* @__PURE__ */ jsx("p", {
							className: "mt-2 text-sm font-semibold text-clinical-strong",
							children: "Saved — new requests use these rules."
						}) : null
					]
				}) : null,
				tab === "queue" ? /* @__PURE__ */ jsx("section", {
					className: "overflow-x-auto rounded-lg border border-border bg-card",
					children: /* @__PURE__ */ jsxs("table", {
						className: "min-w-full text-sm",
						children: [/* @__PURE__ */ jsx("thead", {
							className: "bg-muted text-left text-xs",
							children: /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Created"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Service"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Role"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Status"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Radius"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Notified"
								}),
								/* @__PURE__ */ jsx("th", {
									className: "p-3",
									children: "Assigned to"
								})
							] })
						}), /* @__PURE__ */ jsxs("tbody", { children: [bookings.map((b) => /* @__PURE__ */ jsxs("tr", {
							className: "border-t border-border",
							children: [
								/* @__PURE__ */ jsx("td", {
									className: "p-3",
									children: new Date(b.created_at).toLocaleString()
								}),
								/* @__PURE__ */ jsx("td", {
									className: "p-3 font-semibold",
									children: b.title
								}),
								/* @__PURE__ */ jsx("td", {
									className: "p-3 capitalize",
									children: b.provider_role.replaceAll("_", " ")
								}),
								/* @__PURE__ */ jsx("td", {
									className: "p-3 capitalize",
									children: b.status.replaceAll("_", " ")
								}),
								/* @__PURE__ */ jsxs("td", {
									className: "p-3",
									children: [b.current_radius_km, " km"]
								}),
								/* @__PURE__ */ jsx("td", {
									className: "p-3",
									children: b.notified_provider_count
								}),
								/* @__PURE__ */ jsx("td", {
									className: "p-3",
									children: b.assigned_provider_id ? nameById[b.assigned_provider_id] ?? "Assigned" : "—"
								})
							]
						}, b.id)), bookings.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
							className: "p-4 text-muted-foreground",
							colSpan: 7,
							children: "No bookings yet."
						}) }) : null] })]
					})
				}) : null,
				tab === "offers" ? /* @__PURE__ */ jsxs("section", {
					className: "space-y-3",
					children: [/* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-2",
						children: [
							"all",
							"pending",
							"accepted",
							"declined",
							"expired",
							"cancelled"
						].map((status) => /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setOfferFilter(status),
							className: `min-h-9 rounded-full px-3 text-xs font-bold capitalize ${offerFilter === status ? "bg-clinical-strong text-white" : "border border-border bg-card"}`,
							children: status
						}, status))
					}), /* @__PURE__ */ jsx("div", {
						className: "overflow-x-auto rounded-lg border border-border bg-card",
						children: /* @__PURE__ */ jsxs("table", {
							className: "min-w-full text-sm",
							children: [/* @__PURE__ */ jsx("thead", {
								className: "bg-muted text-left text-xs",
								children: /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Sent"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Service"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Offered to"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Role"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Distance"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Fee"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Status"
									}),
									/* @__PURE__ */ jsx("th", {
										className: "p-3",
										children: "Answered in"
									})
								] })
							}), /* @__PURE__ */ jsxs("tbody", { children: [filteredOffers.map((offer) => {
								const answered = offer.responded_at ? Math.max(0, Math.round((new Date(offer.responded_at).getTime() - new Date(offer.offered_at).getTime()) / 1e3)) : null;
								return /* @__PURE__ */ jsxs("tr", {
									className: "border-t border-border",
									children: [
										/* @__PURE__ */ jsx("td", {
											className: "p-3",
											children: new Date(offer.offered_at).toLocaleString()
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 font-semibold",
											children: titleById[offer.booking_id] ?? "Booking"
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3",
											children: offer.provider_id ? nameById[offer.provider_id] ?? "Staff member" : "Facility"
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3 capitalize",
											children: offer.provider_role.replaceAll("_", " ")
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3",
											children: offer.distance_km == null ? "—" : `${Number(offer.distance_km).toFixed(1)} km`
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3",
											children: offer.earnings ? `₹${offer.earnings}` : "—"
										}),
										/* @__PURE__ */ jsx("td", {
											className: `p-3 font-bold capitalize ${offer.status === "accepted" ? "text-clinical-strong" : offer.status === "pending" ? "" : "text-destructive"}`,
											children: offer.status
										}),
										/* @__PURE__ */ jsx("td", {
											className: "p-3",
											children: answered == null ? "—" : answered < 60 ? `${answered}s` : `${Math.round(answered / 60)}m`
										})
									]
								}, offer.id);
							}), filteredOffers.length === 0 ? /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
								className: "p-4 text-muted-foreground",
								colSpan: 8,
								children: "No offers in this list."
							}) }) : null] })]
						})
					})]
				}) : null,
				tab === "reliability" ? /* @__PURE__ */ jsxs("section", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ jsx("input", {
							className: "min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm sm:max-w-xs",
							placeholder: "Search staff by name",
							value: staffSearch,
							onChange: (event) => setStaffSearch(event.target.value)
						}),
						adjustScore.error ? /* @__PURE__ */ jsx("p", {
							role: "alert",
							className: "text-sm font-semibold text-destructive",
							children: adjustScore.error.message
						}) : null,
						visibleStaff.length === 0 ? /* @__PURE__ */ jsx("p", {
							className: "rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground",
							children: "No staff have received offers yet."
						}) : null,
						visibleStaff.map((member) => {
							const entry = adjust[member.providerId] ?? {
								delta: "",
								note: ""
							};
							const below = member.score < form.minimumReliabilityScore;
							return /* @__PURE__ */ jsxs("article", {
								className: `rounded-lg border bg-card p-4 ${below ? "border-destructive" : "border-border"}`,
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex flex-wrap items-start justify-between gap-3",
										children: [/* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsx("p", {
												className: "font-bold",
												children: member.name
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "text-xs text-muted-foreground",
												children: [
													member.offers,
													" offers · ",
													member.accepted,
													" accepted · ",
													member.declined,
													" declined · ",
													member.expired,
													" missed · ",
													member.completed,
													" completed"
												]
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "text-xs text-muted-foreground",
												children: [
													"Acceptance ",
													member.acceptanceRate == null ? "—" : `${member.acceptanceRate}%`,
													" · Rating ",
													member.averageRating == null ? "new" : `${member.averageRating}★`,
													" · Cancellations ",
													member.cancellations
												]
											})
										] }), /* @__PURE__ */ jsxs("div", {
											className: "text-right",
											children: [/* @__PURE__ */ jsx("b", {
												className: `text-2xl ${below ? "text-destructive" : "text-clinical-strong"}`,
												children: member.score
											}), /* @__PURE__ */ jsxs("p", {
												className: "text-xs text-muted-foreground",
												children: ["reliability", below ? " · no offers" : ""]
											})]
										})]
									}),
									member.events.length ? /* @__PURE__ */ jsx("div", {
										className: "mt-3 space-y-1 border-t border-border pt-3",
										children: member.events.map((event) => /* @__PURE__ */ jsxs("div", {
											className: "flex justify-between text-xs",
											children: [/* @__PURE__ */ jsxs("span", {
												className: "capitalize",
												children: [event.event_type.replaceAll("_", " "), event.note ? ` — ${event.note}` : ""]
											}), /* @__PURE__ */ jsxs("span", {
												className: `font-bold ${event.score_delta >= 0 ? "text-clinical-strong" : "text-destructive"}`,
												children: [event.score_delta >= 0 ? "+" : "", event.score_delta]
											})]
										}, event.id))
									}) : null,
									/* @__PURE__ */ jsxs("form", {
										className: "mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3",
										onSubmit: (event) => {
											event.preventDefault();
											adjustScore.mutate({
												providerId: member.providerId,
												scoreDelta: Number(entry.delta),
												note: entry.note
											});
										},
										children: [
											/* @__PURE__ */ jsx("input", {
												type: "number",
												min: -50,
												max: 50,
												required: true,
												className: "min-h-10 w-24 rounded-md border border-input bg-background px-3 text-sm",
												placeholder: "±points",
												value: entry.delta,
												onChange: (event) => setAdjust({
													...adjust,
													[member.providerId]: {
														...entry,
														delta: event.target.value
													}
												})
											}),
											/* @__PURE__ */ jsx("input", {
												required: true,
												minLength: 3,
												className: "min-h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm",
												placeholder: "Reason for this adjustment",
												value: entry.note,
												onChange: (event) => setAdjust({
													...adjust,
													[member.providerId]: {
														...entry,
														note: event.target.value
													}
												})
											}),
											/* @__PURE__ */ jsx(Button, {
												size: "sm",
												type: "submit",
												disabled: adjustScore.isPending,
												children: "Apply"
											})
										]
									})
								]
							}, member.providerId);
						})
					]
				}) : null,
				tab === "issues" ? /* @__PURE__ */ jsxs("section", {
					className: "space-y-2",
					children: [(qData?.issues ?? []).length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground",
						children: "No service issues reported."
					}) : null, (qData?.issues ?? []).map((issue) => /* @__PURE__ */ jsxs("article", {
						className: "rounded-lg border border-border bg-card p-3",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", { children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-sm font-bold capitalize",
									children: issue.category.replaceAll("_", " ")
								}),
								/* @__PURE__ */ jsx("p", {
									className: "text-xs text-muted-foreground",
									children: issue.details
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-1 text-xs text-muted-foreground",
									children: [
										titleById[issue.booking_id] ?? "Booking",
										" · ",
										new Date(issue.created_at).toLocaleString()
									]
								})
							] }), /* @__PURE__ */ jsx("span", {
								className: "text-xs font-bold uppercase text-destructive",
								children: issue.status
							})]
						}), issue.status !== "resolved" && issue.status !== "dismissed" ? /* @__PURE__ */ jsxs("div", {
							className: "mt-3 flex flex-wrap gap-2",
							children: [
								/* @__PURE__ */ jsx("input", {
									className: "min-h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm",
									placeholder: "Review note",
									value: resolution[issue.id] ?? "",
									onChange: (event) => setResolution({
										...resolution,
										[issue.id]: event.target.value
									})
								}),
								/* @__PURE__ */ jsx(Button, {
									size: "sm",
									onClick: () => resolve.mutate({
										issueId: issue.id,
										status: "resolved",
										resolution: resolution[issue.id] ?? ""
									}),
									children: "Resolve"
								}),
								/* @__PURE__ */ jsx(Button, {
									size: "sm",
									variant: "outline",
									onClick: () => resolve.mutate({
										issueId: issue.id,
										status: "dismissed",
										resolution: resolution[issue.id] ?? ""
									}),
									children: "Dismiss"
								})
							]
						}) : issue.resolution ? /* @__PURE__ */ jsxs("p", {
							className: "mt-2 text-xs",
							children: ["Resolution: ", issue.resolution]
						}) : null]
					}, issue.id))]
				}) : null
			]
		})
	});
}
//#endregion
export { BookingOperations as component };
