import { B as useSession } from "./backend-eXdx240h.js";
import { a as money, c as clearRecoveryReference, d as readRecoveryReference, f as recoveryReference, i as homeTime, l as homeVisitError, n as HomeVisitPanel, s as HomeVisitRpcError, u as homeVisits } from "./HomeVisitPanel-oPTBOTPN.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/features/mydox/home-visits/HomeVisitBooking.tsx
var EMPTY_ADDRESS = {
	full_address: "",
	locality: "",
	pincode: "",
	phone: "",
	landmark: "",
	reason: ""
};
function HomeVisitBooking(props) {
	const { session } = useSession();
	return /* @__PURE__ */ jsx(BookingForm, {
		...props,
		actorId: session?.user.id
	}, session?.user.id || "signed-out");
}
function BookingForm({ onClose, initialProviderId, initialMode = "now", actorId }) {
	const [context, setContext] = useState(null);
	const [address, setAddress] = useState(EMPTY_ADDRESS);
	const [mode, setMode] = useState(initialMode);
	const [date, setDate] = useState("");
	const [providers, setProviders] = useState([]);
	const [providerId, setProviderId] = useState(initialProviderId || "");
	const [slot, setSlot] = useState("");
	const [searched, setSearched] = useState(false);
	const [quote, setQuote] = useState(null);
	const [consent, setConsent] = useState(false);
	const [visit, setVisit] = useState(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [recoveryPending, setRecoveryPending] = useState(false);
	const discoverySequence = useRef(0);
	const sentInput = useRef(null);
	const mounted = useRef(true);
	const reconcile = useCallback(async () => {
		if (!actorId) return;
		const key = readRecoveryReference(actorId);
		if (!key) return;
		const saved = await homeVisits.recover(key);
		if (saved) {
			clearRecoveryReference(actorId);
			setVisit(saved);
			setError("");
		}
		setRecoveryPending(false);
		return saved;
	}, [actorId]);
	useEffect(() => {
		mounted.current = true;
		if (!actorId) return;
		setBusy(true);
		Promise.all([homeVisits.context(), reconcile()]).then(([config]) => {
			if (mounted.current) setContext(config);
		}).catch((e) => {
			if (mounted.current) setError(homeVisitError(e));
		}).finally(() => {
			if (mounted.current) setBusy(false);
		});
		return () => {
			mounted.current = false;
		};
	}, [actorId, reconcile]);
	function invalidate() {
		discoverySequence.current++;
		setQuote(null);
		setConsent(false);
		setProviders([]);
		setSlot("");
		setSearched(false);
	}
	function updateAddress(field, value) {
		if (field === "pincode") invalidate();
		else {
			setQuote(null);
			setConsent(false);
		}
		setAddress((current) => ({
			...current,
			[field]: value
		}));
	}
	async function discover() {
		const sequence = ++discoverySequence.current;
		setBusy(true);
		setError("");
		setQuote(null);
		setConsent(false);
		try {
			const result = await homeVisits.discover({
				pincode: address.pincode,
				is_now: mode === "now",
				...mode === "later" ? { date } : {}
			});
			if (sequence !== discoverySequence.current) return;
			const eligible = initialProviderId ? result.filter((p) => p.provider_id === initialProviderId) : result;
			setProviders(eligible);
			setSlot("");
			setSearched(true);
			if (initialProviderId) setProviderId(initialProviderId);
		} catch (e) {
			setError(homeVisitError(e));
		} finally {
			setBusy(false);
		}
	}
	async function review() {
		const sequence = ++discoverySequence.current;
		setBusy(true);
		setError("");
		try {
			const result = await homeVisits.quote({
				provider_id: providerId || null,
				routing: providerId ? "named" : "pool",
				is_now: mode === "now",
				pincode: address.pincode,
				...slot ? { start_time: slot } : {}
			});
			if (mounted.current && sequence === discoverySequence.current) {
				setQuote(result);
				setConsent(false);
			}
		} catch (e) {
			setError(homeVisitError(e));
		} finally {
			setBusy(false);
		}
	}
	async function submit() {
		if (!actorId || !quote || !context || !consent) return;
		setBusy(true);
		setError("");
		try {
			const key = recoveryReference(actorId);
			const recovered = await homeVisits.recover(key);
			if (recovered) {
				setVisit(recovered);
				clearRecoveryReference(actorId);
				return;
			}
			const input = sentInput.current || {
				quote_id: quote.quote_id,
				idempotency_key: key,
				address: { ...address },
				consent_version: context.consent_version,
				consent: true,
				dependent_id: null
			};
			sentInput.current = input;
			const saved = await homeVisits.create(input);
			clearRecoveryReference(actorId);
			setVisit(saved);
			sentInput.current = null;
			setRecoveryPending(false);
		} catch (e) {
			setError(homeVisitError(e));
			setRecoveryPending(!!sentInput.current);
			try {
				if (!await reconcile() && e instanceof HomeVisitRpcError && e.transactionRejected) {
					sentInput.current = null;
					clearRecoveryReference(actorId);
					setRecoveryPending(false);
					setQuote(null);
					setConsent(false);
				}
			} catch {}
		} finally {
			setBusy(false);
		}
	}
	const selectedProvider = providers.find((p) => p.provider_id === providerId);
	const validAddress = address.full_address.trim().length >= 10 && address.locality.trim().length > 0 && /^\d{6}$/.test(address.pincode) && address.phone.trim().length >= 10 && address.reason.trim().length > 0;
	return /* @__PURE__ */ jsx("div", {
		className: "hv-overlay",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "hv-book-title",
		children: /* @__PURE__ */ jsxs("section", {
			className: "hv hv-dialog",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "hv-header",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					id: "hv-book-title",
					children: "Doctor home visit"
				}), /* @__PURE__ */ jsx("p", { children: "Visit Now or Book for Later" })] }), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onClose,
					"aria-label": "Close home visit",
					children: "Close"
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "hv-body",
				children: [
					!actorId && /* @__PURE__ */ jsx("p", {
						role: "alert",
						children: "Please sign in before booking."
					}),
					error && /* @__PURE__ */ jsx("p", {
						className: "hv-error",
						role: "alert",
						children: error
					}),
					recoveryPending && /* @__PURE__ */ jsxs("div", {
						className: "hv-note",
						children: [/* @__PURE__ */ jsx("p", { children: "A previous submission needs checking. No booking is confirmed until the server returns its saved status." }), /* @__PURE__ */ jsx("button", {
							disabled: busy,
							onClick: () => {
								setBusy(true);
								reconcile().catch((e) => setError(homeVisitError(e))).finally(() => setBusy(false));
							},
							children: "Check saved request"
						})]
					}),
					visit ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("p", {
						className: "hv-success",
						children: [
							"Request saved · ",
							visit.id || visit.booking_id,
							". Status: ",
							(visit.home_visit_status || visit.status).replaceAll("_", " "),
							".",
							(visit.home_visit_status || visit.status) === "pending" ? " The doctor must explicitly accept before confirmation." : ""
						]
					}), /* @__PURE__ */ jsx(HomeVisitPanel, { audience: "patient" })] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
						busy && !context && /* @__PURE__ */ jsx("p", {
							role: "status",
							children: "Checking home-visit service…"
						}),
						context && (!context.enabled || !context.participant) && /* @__PURE__ */ jsx("p", {
							className: "hv-note",
							children: context.reason || "Home visits are not open for this account. The pilot is awaiting approval."
						}),
						context?.enabled && context.participant && /* @__PURE__ */ jsxs("form", {
							onSubmit: (e) => {
								e.preventDefault();
								discover();
							},
							children: [/* @__PURE__ */ jsxs("fieldset", {
								disabled: busy || recoveryPending || !!sentInput.current,
								children: [
									/* @__PURE__ */ jsx("legend", { children: "Patient and home address" }),
									/* @__PURE__ */ jsxs("label", { children: ["Patient", /* @__PURE__ */ jsx("input", {
										value: "Myself — signed-in account",
										readOnly: true
									})] }),
									/* @__PURE__ */ jsx("p", {
										className: "hv-help",
										children: "Family booking is unavailable until an authorised relationship and record access are enabled. This visit does not share your other records."
									}),
									/* @__PURE__ */ jsxs("label", { children: ["Full home address", /* @__PURE__ */ jsx("textarea", {
										required: true,
										value: address.full_address,
										onChange: (e) => updateAddress("full_address", e.target.value),
										autoComplete: "street-address"
									})] }),
									/* @__PURE__ */ jsxs("div", {
										className: "hv-grid",
										children: [/* @__PURE__ */ jsxs("label", { children: ["Locality", /* @__PURE__ */ jsx("input", {
											required: true,
											value: address.locality,
											onChange: (e) => updateAddress("locality", e.target.value)
										})] }), /* @__PURE__ */ jsxs("label", { children: ["Pincode", /* @__PURE__ */ jsx("input", {
											required: true,
											inputMode: "numeric",
											pattern: "[0-9]{6}",
											maxLength: 6,
											value: address.pincode,
											onChange: (e) => updateAddress("pincode", e.target.value),
											autoComplete: "postal-code"
										})] })]
									}),
									/* @__PURE__ */ jsxs("label", { children: ["Contact phone", /* @__PURE__ */ jsx("input", {
										type: "tel",
										required: true,
										value: address.phone,
										onChange: (e) => updateAddress("phone", e.target.value),
										autoComplete: "tel"
									})] }),
									/* @__PURE__ */ jsxs("label", { children: ["Landmark or access instructions (optional)", /* @__PURE__ */ jsx("input", {
										value: address.landmark,
										onChange: (e) => updateAddress("landmark", e.target.value)
									})] }),
									/* @__PURE__ */ jsxs("label", { children: ["Reason for visit", /* @__PURE__ */ jsx("textarea", {
										required: true,
										value: address.reason,
										onChange: (e) => updateAddress("reason", e.target.value)
									})] }),
									/* @__PURE__ */ jsx("p", {
										className: "hv-help",
										children: "Enter your address manually. Coverage is checked against published service pincodes. Visit Now is a home-care request; emergency/SOS remains separate."
									}),
									/* @__PURE__ */ jsxs("label", { children: ["When", /* @__PURE__ */ jsxs("select", {
										value: mode,
										onChange: (e) => {
											invalidate();
											setMode(e.target.value);
										},
										children: [/* @__PURE__ */ jsx("option", {
											value: "now",
											children: "Visit Now"
										}), /* @__PURE__ */ jsx("option", {
											value: "later",
											children: "Book for Later"
										})]
									})] }),
									mode === "later" && /* @__PURE__ */ jsxs("label", { children: [
										"Appointment date",
										/* @__PURE__ */ jsx("input", {
											type: "date",
											required: true,
											value: date,
											onChange: (e) => {
												invalidate();
												setDate(e.target.value);
											}
										}),
										/* @__PURE__ */ jsx("span", {
											className: "hv-help",
											children: "Times below use each doctor's published timezone."
										})
									] }),
									/* @__PURE__ */ jsx("button", {
										type: "submit",
										disabled: !validAddress || mode === "later" && !date,
										children: "Check actual availability"
									}),
									searched && providers.length === 0 && /* @__PURE__ */ jsx("p", {
										className: "hv-note",
										children: "No eligible doctor is available for this pincode and time. Try another date or Book for Later."
									}),
									providers.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
										/* @__PURE__ */ jsxs("label", { children: ["Doctor", /* @__PURE__ */ jsxs("select", {
											value: providerId,
											onChange: (e) => {
												setProviderId(e.target.value);
												setSlot("");
												setQuote(null);
												setConsent(false);
											},
											children: [!initialProviderId && /* @__PURE__ */ jsx("option", {
												value: "",
												children: mode === "now" ? "Eligible doctor pool — first explicit acceptance" : "Select a doctor"
											}), providers.map((p) => /* @__PURE__ */ jsxs("option", {
												value: p.provider_id,
												children: [
													p.name,
													" · ",
													money(p.fee, p.currency)
												]
											}, p.provider_id))]
										})] }),
										selectedProvider && /* @__PURE__ */ jsxs("p", {
											className: "hv-help",
											children: [
												selectedProvider.duration_minutes,
												" minute consultation · ",
												selectedProvider.buffer_before_minutes,
												" minutes before and ",
												selectedProvider.buffer_after_minutes,
												" minutes after reserved for travel · ",
												selectedProvider.timezone
											]
										}),
										mode === "later" && selectedProvider && /* @__PURE__ */ jsxs("label", { children: ["Published slot", /* @__PURE__ */ jsxs("select", {
											value: slot,
											onChange: (e) => {
												setSlot(e.target.value);
												setQuote(null);
												setConsent(false);
											},
											children: [/* @__PURE__ */ jsx("option", {
												value: "",
												children: "Select a time"
											}), selectedProvider.slots.map((s) => /* @__PURE__ */ jsx("option", {
												value: s.start_time,
												children: homeTime(s.start_time, selectedProvider.timezone)
											}, s.start_time))]
										})] }),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: () => void review(),
											disabled: mode === "later" && (!providerId || !slot),
											children: "Review server quote"
										})
									] })
								]
							}), quote && /* @__PURE__ */ jsxs("section", {
								className: "hv-card",
								children: [
									/* @__PURE__ */ jsx("h3", { children: "Review your request" }),
									/* @__PURE__ */ jsx("p", { children: quote.routing === "named" ? selectedProvider?.name || "Selected doctor" : `Eligible provider pool · ${quote.candidate_count} candidates` }),
									/* @__PURE__ */ jsxs("p", { children: [
										homeTime(quote.start_time, selectedProvider?.timezone),
										" · ",
										money(quote.total, quote.currency)
									] }),
									/* @__PURE__ */ jsx(QuoteBreakdown, { quote }),
									/* @__PURE__ */ jsxs("p", { children: [
										"Payment method: ",
										quote.payment_method?.replaceAll("_", " ") || "Not configured",
										". Payment is separate from visit completion."
									] }),
									/* @__PURE__ */ jsxs("p", { children: [
										address.full_address,
										", ",
										address.locality,
										", ",
										address.pincode,
										" · ",
										address.phone
									] }),
									/* @__PURE__ */ jsxs("p", {
										className: "hv-help",
										children: [
											"Quote expires ",
											new Date(quote.expires_at).toLocaleString(),
											". Confirmation and arrival time depend on doctor acceptance."
										]
									}),
									/* @__PURE__ */ jsx("p", {
										className: "hv-policy",
										children: context.terms || "Terms must be approved before real-patient use."
									}),
									/* @__PURE__ */ jsxs("details", { children: [/* @__PURE__ */ jsxs("summary", { children: ["Home-visit consent · ", context.consent_version] }), /* @__PURE__ */ jsx("p", {
										className: "hv-policy",
										children: context.consent_text || "Consent wording is not available. Booking cannot continue."
									})] }),
									/* @__PURE__ */ jsxs("label", {
										className: "hv-check",
										children: [/* @__PURE__ */ jsx("input", {
											type: "checkbox",
											checked: consent,
											disabled: busy,
											onChange: (e) => setConsent(e.target.checked)
										}), "I have read and agree to this visit's consent and terms."]
									}),
									/* @__PURE__ */ jsx("button", {
										type: "button",
										disabled: busy || !consent || !context.consent_text || recoveryPending,
										onClick: () => void submit(),
										children: busy ? "Saving…" : sentInput.current ? "Retry the same request" : "Save pending home-visit request"
									})
								]
							})]
						})
					] })
				]
			})]
		})
	});
}
function HomeVisitEntry({ onOpen }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "hv hv-card",
		children: [
			/* @__PURE__ */ jsx("h3", { children: "Doctor home visit" }),
			/* @__PURE__ */ jsx("p", { children: "Enter your address to see eligible doctors, published times and the actual fee." }),
			/* @__PURE__ */ jsx("p", {
				className: "hv-help",
				children: "Visit Now needs doctor acceptance. No arrival time is promised before acceptance."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "hv-actions",
				children: [/* @__PURE__ */ jsx("button", {
					onClick: () => onOpen({ initialMode: "now" }),
					children: "Visit Now"
				}), /* @__PURE__ */ jsx("button", {
					onClick: () => onOpen({ initialMode: "later" }),
					children: "Book for Later"
				})]
			}),
			/* @__PURE__ */ jsx("a", {
				href: "/home-visits",
				children: "View saved doctor home visits"
			})
		]
	});
}
function QuoteBreakdown({ quote }) {
	if (Array.isArray(quote.breakdown)) return /* @__PURE__ */ jsx("ul", { children: quote.breakdown.map((line, index) => /* @__PURE__ */ jsxs("li", { children: [
		line.label || "Consultation",
		": ",
		money(line.amount, quote.currency)
	] }, index)) });
	return /* @__PURE__ */ jsx("ul", { children: Object.entries(quote.breakdown || {}).map(([label, amount]) => /* @__PURE__ */ jsxs("li", { children: [
		label.replaceAll("_", " "),
		": ",
		typeof amount === "number" ? money(amount, quote.currency) : String(amount)
	] }, label)) });
}
//#endregion
export { HomeVisitEntry as n, HomeVisitBooking as t };
