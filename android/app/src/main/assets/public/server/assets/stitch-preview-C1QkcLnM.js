import { a as PATIENT_SERVICE_GROUPS, n as Heading, r as IconPod, t as clinicalShortcuts } from "./stitch-preview-CQApfgSV.js";
import { useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Bell, Brain, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, CreditCard, FileText, Heart, HeartPulse, House, MapPin, MessageCircle, Plus, ScanLine, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, TestTube, UserRound, Users, Video, Wallet, X } from "lucide-react";
//#region src/features/mydox/stitch/stitch-data.ts
var exampleDoctors = [{
	id: "krishna",
	name: "Dr. Krishna Patel",
	specialty: "Neurologist",
	image: "krishna.jpg",
	experience: "14 years",
	summary: "Brain, nerve and spinal care, with a thoughtful approach to every visit.",
	clinic: "MyDox Neuro Care Centre",
	fee: 600
}, {
	id: "charlotte",
	name: "Dr. Charlotte Adams",
	specialty: "Cardiologist",
	image: "charlotte.jpg",
	experience: "12 years",
	summary: "Heart health and ongoing cardiovascular care, all in one place.",
	clinic: "MyDox Heart Care Centre",
	fee: 700
}];
var exampleTests = [
	{
		id: "mri",
		name: "High-resolution Brain MRI",
		category: "MRI & CT",
		label: "IMAGING CENTRE",
		detail: "1.5T / 3.0T MRI",
		description: "Explore imaging centres, appointment options and report preferences.",
		delivery: "At the centre",
		fee: 5500,
		icon: Brain,
		tone: "blue"
	},
	{
		id: "vital",
		name: "Comprehensive Vital Health Panel",
		category: "Health checks",
		label: "HOME SAMPLE COLLECTION",
		detail: "Health check panel",
		description: "A sample layout for reviewing the tests included in your health check.",
		delivery: "Home or lab visit",
		fee: 1200,
		icon: TestTube,
		tone: "mint"
	},
	{
		id: "ecg",
		name: "Digital 12-lead ECG",
		category: "Heart care",
		label: "TECHNICIAN VISIT",
		detail: "Heart health",
		description: "Choose your visit preferences and review available options.",
		delivery: "Home or centre visit",
		fee: 600,
		icon: HeartPulse,
		tone: "rose"
	},
	{
		id: "ct",
		name: "Chest CT scan (HRCT)",
		category: "MRI & CT",
		label: "IMAGING CENTRE",
		detail: "CT imaging",
		description: "A focused booking page for your scan and collection of reports.",
		delivery: "At the centre",
		fee: 3500,
		icon: ScanLine,
		tone: "blue"
	}
];
var sampleDates = [
	"10",
	"11",
	"12",
	"13",
	"14",
	"15",
	"16"
];
var weekdays = [
	"Thu",
	"Fri",
	"Sat",
	"Sun",
	"Mon",
	"Tue",
	"Wed"
];
var sampleSlots = [
	"10:00 AM",
	"10:30 AM",
	"11:00 AM",
	"11:30 AM",
	"12:00 PM",
	"02:30 PM",
	"04:00 PM",
	"05:30 PM",
	"06:15 PM"
];
var areas = [
	"Koregaon Park",
	"Wakad",
	"Baner",
	"Kothrud",
	"Aundh",
	"Viman Nagar",
	"Hadapsar",
	"Kharadi"
];
var rupees = (value) => `₹${value.toLocaleString("en-IN")}`;
//#endregion
//#region src/features/mydox/stitch/StitchPreview.tsx
var navItems = [
	{
		page: "home",
		label: "Home",
		icon: House
	},
	{
		page: "schedule",
		label: "Schedule",
		icon: CalendarDays
	},
	{
		page: "services",
		label: "Services",
		icon: Stethoscope
	},
	{
		page: "chat",
		label: "Consult",
		icon: MessageCircle
	},
	{
		page: "profile",
		label: "Profile",
		icon: UserRound
	}
];
function Sheet({ title, onClose, children }) {
	const ref = useRef(null);
	useEffect(() => {
		const el = ref.current;
		el?.showModal();
		return () => el?.close();
	}, []);
	return /* @__PURE__ */ jsx("dialog", {
		className: "sp-dialog",
		ref,
		"aria-label": title,
		onCancel: (e) => {
			e.preventDefault();
			onClose();
		},
		onClick: (e) => {
			if (e.target === e.currentTarget) onClose();
		},
		children: /* @__PURE__ */ jsxs("div", {
			className: "sp-sheet",
			children: [/* @__PURE__ */ jsxs("header", { children: [/* @__PURE__ */ jsx("h2", { children: title }), /* @__PURE__ */ jsx("button", {
				className: "sp-round",
				"aria-label": "Close panel",
				onClick: onClose,
				children: /* @__PURE__ */ jsx(X, { size: 20 })
			})] }), children]
		})
	});
}
function StitchPreview() {
	const [page, setPage] = useState("home");
	const [doctorIndex, setDoctorIndex] = useState(0);
	const [mode, setMode] = useState("Video call");
	const [date, setDate] = useState("10");
	const [slot, setSlot] = useState("11:00 AM");
	const [bioOpen, setBioOpen] = useState(false);
	const [area, setArea] = useState("Koregaon Park");
	const [query, setQuery] = useState("");
	const [locationQuery, setLocationQuery] = useState("");
	const [category, setCategory] = useState("All tests");
	const [delivery, setDelivery] = useState("Home collection");
	const [basket, setBasket] = useState([]);
	const [favorites, setFavorites] = useState([]);
	const [group, setGroup] = useState(null);
	const [sheet, setSheet] = useState(null);
	const [checkoutKind, setCheckoutKind] = useState("doctor");
	const [payment, setPayment] = useState("UPI");
	const [patientKind, setPatientKind] = useState("self");
	const [patient, setPatient] = useState({
		name: "Priya Sharma",
		email: "patient1@demo.med",
		phone: "",
		age: "",
		gender: "Female",
		note: ""
	});
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState([]);
	const [completed, setCompleted] = useState(false);
	const scroller = useRef(null);
	const doctor = exampleDoctors[doctorIndex];
	const selectedTests = exampleTests.filter((t) => basket.includes(t.id));
	const testTotal = selectedTests.reduce((sum, t) => sum + t.fee, 0);
	const consultationFee = doctor.fee + (mode === "At clinic" ? 200 : mode === "Home visit" ? 600 : 0);
	const total = checkoutKind === "doctor" ? consultationFee : testTotal;
	const go = (next) => {
		setPage(next);
		setQuery("");
	};
	useEffect(() => {
		scroller.current?.scrollTo({ top: 0 });
	}, [page]);
	const openDoctor = (index = 0, nextMode = mode) => {
		setDoctorIndex(index);
		setMode(nextMode);
		setBioOpen(false);
		go("doctor");
	};
	const openCheckout = (kind) => {
		setCheckoutKind(kind);
		go("checkout");
	};
	const toggleTest = (id) => setBasket((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
	const toggleFavorite = (id) => setFavorites((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
	const openLocation = () => {
		setLocationQuery("");
		setSheet("location");
	};
	const openService = (id, label) => {
		if (id === "doctor") openDoctor();
		else if (["care", "homePackage"].includes(id)) openDoctor(0, "Home visit");
		else if ([
			"labtest",
			"scan",
			"technician"
		].includes(id)) {
			setCategory(id === "scan" ? "MRI & CT" : "All tests");
			go("diagnostics");
		} else setSheet(label);
	};
	const sendMessage = (text = message) => {
		if (!text.trim()) return;
		setMessages((prev) => [...prev, text.trim()]);
		setMessage("");
	};
	const finishSample = (e) => {
		e.preventDefault();
		setCompleted(true);
		setSheet("complete");
	};
	const activeNav = ["doctor", "checkout"].includes(page) ? "schedule" : page === "diagnostics" ? "services" : page;
	const title = {
		home: "",
		doctor: "Doctor details",
		diagnostics: "Diagnostics & scans",
		chat: "Your consultation",
		checkout: "Review & checkout",
		services: "All your care",
		schedule: "Your schedule",
		profile: "Your MyDox"
	}[page];
	const groups = PATIENT_SERVICE_GROUPS.map((g) => ({
		...g,
		services: g.services.filter((s) => `${s.label} ${g.label}`.toLowerCase().includes(query.toLowerCase()))
	})).filter((g) => g.services.length);
	const tests = exampleTests.filter((t) => (category === "All tests" || category === t.category) && `${t.name} ${t.description}`.toLowerCase().includes(query.toLowerCase()));
	const appointment = /* @__PURE__ */ jsxs("section", {
		className: "sp-appointment sp-card",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "sp-appointment-person",
			children: [/* @__PURE__ */ jsx("img", {
				src: "/design/stitch/vishal.jpg",
				alt: "Example doctor portrait"
			}), /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "sp-line",
					children: [/* @__PURE__ */ jsx("h3", { children: "Dr. Vishal Shah" }), /* @__PURE__ */ jsx("span", {
						className: "sp-tag",
						children: "VIDEO"
					})]
				}),
				/* @__PURE__ */ jsx("p", { children: "Cardiologist · sample appointment" }),
				/* @__PURE__ */ jsxs("div", {
					className: "sp-meta",
					children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(CalendarDays, { size: 14 }), "10 Sep"] }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(Clock3, { size: 14 }), "10:30 AM"] })]
				})
			] })]
		}), /* @__PURE__ */ jsxs("div", {
			className: "sp-split",
			children: [/* @__PURE__ */ jsx("button", {
				className: "sp-secondary",
				onClick: () => openDoctor(),
				children: "Try rescheduling"
			}), /* @__PURE__ */ jsxs("button", {
				className: "sp-primary",
				onClick: () => go("chat"),
				children: [/* @__PURE__ */ jsx(Video, { size: 17 }), "Join preview"]
			})]
		})]
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "sp-preview",
		children: [
			/* @__PURE__ */ jsxs("aside", {
				className: "sp-review-bar",
				children: [/* @__PURE__ */ jsxs("span", { children: [
					/* @__PURE__ */ jsx("i", {}),
					"APPROVED THEME ",
					/* @__PURE__ */ jsx("small", { children: "· Sample data" })
				] }), /* @__PURE__ */ jsxs("a", {
					href: "/",
					children: ["Open MyDox", /* @__PURE__ */ jsx(ArrowUpRight, { size: 13 })]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "sp-device",
				"data-screen": page,
				children: [
					/* @__PURE__ */ jsxs("header", {
						className: "sp-header",
						children: [
							page !== "home" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
								className: "sp-round",
								"aria-label": "Go back",
								onClick: () => go(page === "checkout" ? checkoutKind === "doctor" ? "doctor" : "diagnostics" : "home"),
								children: /* @__PURE__ */ jsx(ArrowLeft, { size: 21 })
							}), /* @__PURE__ */ jsxs("div", {
								className: "sp-header-title",
								children: [/* @__PURE__ */ jsx("strong", { children: title }), /* @__PURE__ */ jsx("small", { children: "MyDox · design preview" })]
							})] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
								className: "sp-logo",
								children: /* @__PURE__ */ jsx(Plus, {
									size: 22,
									strokeWidth: 3
								})
							}), /* @__PURE__ */ jsxs("div", {
								className: "sp-brand",
								children: [/* @__PURE__ */ jsx("strong", { children: "MyDox" }), /* @__PURE__ */ jsxs("button", {
									onClick: openLocation,
									children: [
										/* @__PURE__ */ jsx(MapPin, { size: 13 }),
										area,
										/* @__PURE__ */ jsx(ChevronDown, { size: 12 })
									]
								})]
							})] }),
							page === "home" && /* @__PURE__ */ jsxs("button", {
								className: "sp-round sp-bell",
								"aria-label": "Notifications",
								onClick: () => setSheet("Notifications"),
								children: [/* @__PURE__ */ jsx(Bell, { size: 20 }), /* @__PURE__ */ jsx("i", {})]
							}),
							/* @__PURE__ */ jsx("button", {
								className: "sp-avatar-button",
								"aria-label": "Open profile",
								onClick: () => go("profile"),
								children: /* @__PURE__ */ jsx("img", {
									src: "/design/stitch/patient.png",
									alt: "Sample patient avatar"
								})
							})
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: `sp-scroll sp-page-${page}`,
						ref: scroller,
						children: [
							page === "home" && /* @__PURE__ */ jsxs(Fragment, { children: [
								/* @__PURE__ */ jsxs("div", {
									className: "sp-home-glow",
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "sp-greeting",
											children: [/* @__PURE__ */ jsxs("div", { children: [
												/* @__PURE__ */ jsx("p", { children: "GOOD MORNING" }),
												/* @__PURE__ */ jsxs("h1", { children: ["Hi, Priya ", /* @__PURE__ */ jsx("span", { children: "✦" })] }),
												/* @__PURE__ */ jsx("small", { children: "A little care. A healthier you." })
											] }), /* @__PURE__ */ jsxs("button", {
												className: "sp-sos",
												onClick: () => setSheet("Emergency access"),
												children: [/* @__PURE__ */ jsx(HeartPulse, { size: 18 }), "SOS"]
											})]
										}),
										/* @__PURE__ */ jsxs("button", {
											className: "sp-search sp-search-link",
											onClick: () => go("services"),
											children: [
												/* @__PURE__ */ jsx(Search, { size: 20 }),
												/* @__PURE__ */ jsx("span", { children: "Search doctors, tests, services…" }),
												/* @__PURE__ */ jsx(SlidersHorizontal, { size: 17 })
											]
										}),
										/* @__PURE__ */ jsx(Heading, {
											title: "Upcoming appointment",
											action: "Details",
											onClick: () => go("schedule")
										}),
										appointment
									]
								}),
								/* @__PURE__ */ jsxs("section", {
									className: "sp-section",
									children: [/* @__PURE__ */ jsx(Heading, {
										title: "Clinical services",
										subtitle: "Care for every part of your health",
										action: "Explore all",
										onClick: () => go("services")
									}), /* @__PURE__ */ jsx("div", {
										className: "sp-services-grid",
										children: clinicalShortcuts.map((s) => /* @__PURE__ */ jsxs("button", {
											onClick: () => openService(s.id, s.label),
											children: [
												/* @__PURE__ */ jsx(IconPod, {
													icon: s.icon,
													tone: s.tone
												}),
												/* @__PURE__ */ jsx("strong", { children: s.label }),
												/* @__PURE__ */ jsx("small", { children: s.detail })
											]
										}, s.id))
									})]
								}),
								/* @__PURE__ */ jsxs("section", {
									className: "sp-section",
									children: [/* @__PURE__ */ jsx(Heading, {
										title: "Find your specialist",
										action: "View all",
										onClick: () => go("services")
									}), /* @__PURE__ */ jsxs("div", {
										className: "sp-chips",
										children: [[{
											label: "Neurologist",
											icon: Brain,
											index: 0
										}, {
											label: "Cardiologist",
											icon: Heart,
											index: 1
										}].map((s) => /* @__PURE__ */ jsxs("button", {
											className: doctorIndex === s.index ? "active" : "",
											onClick: () => openDoctor(s.index),
											children: [/* @__PURE__ */ jsx(s.icon, { size: 17 }), s.label]
										}, s.label)), /* @__PURE__ */ jsxs("button", {
											onClick: () => setSheet("Dental care"),
											children: [/* @__PURE__ */ jsx(Sparkles, { size: 17 }), "Dentist"]
										})]
									})]
								}),
								/* @__PURE__ */ jsxs("section", {
									className: "sp-section",
									children: [/* @__PURE__ */ jsx(Heading, {
										title: "Meet your care team",
										subtitle: "Example profiles from your design"
									}), exampleDoctors.map((d, index) => /* @__PURE__ */ jsxs("article", {
										className: "sp-doctor-card sp-card",
										children: [
											/* @__PURE__ */ jsxs("div", {
												className: "sp-doctor-copy",
												children: [
													/* @__PURE__ */ jsx("span", {
														className: "sp-eyebrow",
														children: d.specialty
													}),
													/* @__PURE__ */ jsx("h2", { children: d.name }),
													/* @__PURE__ */ jsx("p", { children: d.summary }),
													/* @__PURE__ */ jsx("small", { children: "Example visit fee" }),
													/* @__PURE__ */ jsxs("strong", {
														className: "sp-price",
														children: [rupees(d.fee), /* @__PURE__ */ jsx("small", { children: " / visit" })]
													})
												]
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "sp-doctor-photo",
												children: [/* @__PURE__ */ jsx("img", {
													src: `/design/stitch/${d.image}`,
													alt: `${d.name} example portrait`
												}), /* @__PURE__ */ jsx("button", {
													className: "sp-round",
													"aria-label": `Save ${d.name}`,
													"aria-pressed": favorites.includes(d.id),
													onClick: () => toggleFavorite(d.id),
													children: /* @__PURE__ */ jsx(Heart, {
														size: 17,
														fill: favorites.includes(d.id) ? "currentColor" : "none"
													})
												})]
											}),
											/* @__PURE__ */ jsxs("button", {
												className: "sp-primary sp-wide",
												onClick: () => openDoctor(index),
												children: [
													/* @__PURE__ */ jsx(CalendarDays, { size: 17 }),
													"View profile & book",
													/* @__PURE__ */ jsx(ArrowRight, { size: 17 })
												]
											})
										]
									}, d.id))]
								}),
								/* @__PURE__ */ jsx("section", {
									className: "sp-section",
									children: /* @__PURE__ */ jsxs("button", {
										className: "sp-wellness",
										onClick: () => setSheet("Your health companion"),
										children: [/* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsx("span", {
												className: "sp-tag",
												children: "YOUR HEALTH COMPANION"
											}),
											/* @__PURE__ */ jsx("h3", { children: "A little guidance, whenever you need." }),
											/* @__PURE__ */ jsx("p", { children: "Explore the MyDox assistant." })
										] }), /* @__PURE__ */ jsx(Sparkles, { size: 35 })]
									})
								})
							] }),
							page === "doctor" && /* @__PURE__ */ jsxs("div", {
								className: "sp-content",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "sp-doctor-hero sp-card",
										children: [
											/* @__PURE__ */ jsx("div", {
												className: "sp-profile-photo",
												children: /* @__PURE__ */ jsx("img", {
													src: `/design/stitch/${doctor.image}`,
													alt: `${doctor.name} example portrait`
												})
											}),
											/* @__PURE__ */ jsxs("div", { children: [
												/* @__PURE__ */ jsx("span", {
													className: "sp-eyebrow",
													children: doctor.specialty
												}),
												/* @__PURE__ */ jsx("h1", { children: doctor.name }),
												/* @__PURE__ */ jsx("span", {
													className: "sp-tag",
													children: "EXAMPLE PROFILE"
												}),
												/* @__PURE__ */ jsxs("p", { children: [
													"From ",
													/* @__PURE__ */ jsx("strong", { children: rupees(doctor.fee) }),
													" / visit"
												] })
											] }),
											/* @__PURE__ */ jsxs("div", {
												className: "sp-clinic",
												children: [
													/* @__PURE__ */ jsx(Stethoscope, { size: 18 }),
													/* @__PURE__ */ jsx("span", { children: doctor.clinic }),
													/* @__PURE__ */ jsxs("span", { children: [doctor.experience, "*"] })
												]
											})
										]
									}),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-card sp-padding",
										children: [
											/* @__PURE__ */ jsx(Heading, { title: "Details" }),
											/* @__PURE__ */ jsxs("p", { children: [
												doctor.summary,
												" ",
												bioOpen && "This sample profile demonstrates where qualifications, languages, experience and consultation information would appear in MyDox."
											] }),
											/* @__PURE__ */ jsxs("button", {
												className: "sp-text-button",
												"aria-expanded": bioOpen,
												onClick: () => setBioOpen(!bioOpen),
												children: [bioOpen ? "See less" : "See more", /* @__PURE__ */ jsx(ChevronDown, { size: 15 })]
											}),
											/* @__PURE__ */ jsx("small", {
												className: "sp-muted",
												children: "*Profile details and prices are illustrative."
											})
										]
									}),
									/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx(Heading, {
										title: "Consultation mode",
										subtitle: "Choose what works for you"
									}), /* @__PURE__ */ jsx("div", {
										className: "sp-modes",
										children: [
											{
												label: "Video call",
												icon: Video,
												add: 0
											},
											{
												label: "At clinic",
												icon: Stethoscope,
												add: 200
											},
											{
												label: "Home visit",
												icon: House,
												add: 600
											}
										].map((m) => /* @__PURE__ */ jsxs("button", {
											className: mode === m.label ? "active" : "",
											"aria-pressed": mode === m.label,
											onClick: () => setMode(m.label),
											children: [
												/* @__PURE__ */ jsx(IconPod, { icon: m.icon }),
												/* @__PURE__ */ jsx("strong", { children: m.label }),
												/* @__PURE__ */ jsx("span", { children: rupees(doctor.fee + m.add) })
											]
										}, m.label))
									})] }),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-card sp-padding",
										children: [
											/* @__PURE__ */ jsx(Heading, {
												title: "Create schedule",
												subtitle: "Choose an example date and time"
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "sp-tag sp-month",
												children: [/* @__PURE__ */ jsx(CalendarDays, { size: 14 }), "September 2026"]
											}),
											/* @__PURE__ */ jsx("div", {
												className: "sp-dates",
												children: sampleDates.map((d, i) => /* @__PURE__ */ jsxs("button", {
													"aria-label": `${weekdays[i]} ${d} September`,
													"aria-pressed": date === d,
													onClick: () => {
														setDate(d);
														setSlot("");
													},
													children: [/* @__PURE__ */ jsx("small", { children: weekdays[i] }), /* @__PURE__ */ jsx("strong", { children: d })]
												}, d))
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "sp-slot-label",
												children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("i", {}), "Example availability"] }), /* @__PURE__ */ jsxs("small", { children: [date, " Sep"] })]
											}),
											/* @__PURE__ */ jsx("div", {
												className: "sp-slots",
												children: sampleSlots.map((t) => /* @__PURE__ */ jsx("button", {
													disabled: t === "05:30 PM",
													"aria-pressed": slot === t,
													onClick: () => setSlot(t),
													children: t
												}, t))
											})
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "sp-info",
										children: [/* @__PURE__ */ jsx(ShieldCheck, { size: 24 }), /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx("strong", { children: "Your visit, at a glance" }), "Review your patient details and visit preferences before finishing the sample."] })]
									})
								]
							}),
							page === "diagnostics" && /* @__PURE__ */ jsxs("div", {
								className: "sp-content",
								children: [
									/* @__PURE__ */ jsxs("label", {
										className: "sp-search",
										children: [/* @__PURE__ */ jsx(Search, { size: 19 }), /* @__PURE__ */ jsx("input", {
											"aria-label": "Search diagnostic tests",
											placeholder: "Search tests, scans, MRI…",
											value: query,
											onChange: (e) => setQuery(e.target.value)
										})]
									}),
									/* @__PURE__ */ jsx("div", {
										className: "sp-segment",
										children: ["Home collection", "Visit a centre"].map((d, i) => /* @__PURE__ */ jsxs("button", {
											"aria-pressed": delivery === d,
											onClick: () => setDelivery(d),
											children: [i === 0 ? /* @__PURE__ */ jsx(House, { size: 17 }) : /* @__PURE__ */ jsx(Stethoscope, { size: 17 }), d]
										}, d))
									}),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-rx-banner",
										children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(IconPod, { icon: FileText }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "Have a prescription?" }), /* @__PURE__ */ jsx("p", { children: "Keep your prescribed tests together." })] })] }), /* @__PURE__ */ jsxs("button", {
											className: "sp-white-button",
											onClick: () => setSheet("Prescription preview"),
											children: [/* @__PURE__ */ jsx(ScanLine, { size: 17 }), "Explore sample Rx"]
										})]
									}),
									/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx(Heading, {
										title: "Categories",
										subtitle: "Sample catalogue · prices are illustrative"
									}), /* @__PURE__ */ jsx("div", {
										className: "sp-chips",
										children: [
											"All tests",
											"Health checks",
											"MRI & CT",
											"Heart care"
										].map((c) => /* @__PURE__ */ jsx("button", {
											className: category === c ? "active" : "",
											"aria-pressed": category === c,
											onClick: () => setCategory(c),
											children: c
										}, c))
									})] }),
									/* @__PURE__ */ jsx("div", {
										className: "sp-test-list",
										children: tests.map((t) => /* @__PURE__ */ jsxs("article", {
											className: "sp-test sp-card",
											children: [
												/* @__PURE__ */ jsxs("div", {
													className: "sp-test-title",
													children: [/* @__PURE__ */ jsx(IconPod, {
														icon: t.icon,
														tone: t.tone
													}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
														className: "sp-tag",
														children: t.label
													}), /* @__PURE__ */ jsx("h2", { children: t.name })] })]
												}),
												/* @__PURE__ */ jsx("p", { children: t.description }),
												/* @__PURE__ */ jsxs("div", {
													className: "sp-test-info",
													children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(MapPin, { size: 16 }), t.delivery] }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(FileText, { size: 16 }), t.detail] })]
												}),
												/* @__PURE__ */ jsxs("footer", { children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: rupees(t.fee) }), /* @__PURE__ */ jsx("small", { children: "Sample fee" })] }), /* @__PURE__ */ jsxs("button", {
													className: basket.includes(t.id) ? "sp-added" : "sp-primary",
													"aria-pressed": basket.includes(t.id),
													"aria-label": `${basket.includes(t.id) ? "Remove" : "Add"} ${t.name}`,
													onClick: () => toggleTest(t.id),
													children: [basket.includes(t.id) ? /* @__PURE__ */ jsx(Check, { size: 16 }) : /* @__PURE__ */ jsx(Plus, { size: 16 }), basket.includes(t.id) ? "Added" : "Add test"]
												})] })
											]
										}, t.id))
									}),
									!tests.length && /* @__PURE__ */ jsx("p", {
										className: "sp-empty",
										children: "No sample tests match. Try another category or search."
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "sp-info",
										children: [/* @__PURE__ */ jsx(MapPin, { size: 24 }), /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx("strong", { children: "Choose the right visit" }), "Scans take place at an imaging centre. Home collection applies to eligible tests only."] })]
									})
								]
							}),
							page === "chat" && /* @__PURE__ */ jsxs("div", {
								className: "sp-content sp-chat",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "sp-chat-person",
										children: [
											/* @__PURE__ */ jsx("img", {
												src: "/design/stitch/krishna.jpg",
												alt: "Example doctor portrait"
											}),
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "Dr. Krishna Patel" }), /* @__PURE__ */ jsx("p", { children: "Neurologist · example conversation" })] }),
											/* @__PURE__ */ jsx("button", {
												className: "sp-round",
												"aria-label": "Preview video call",
												onClick: () => setSheet("Video call preview"),
												children: /* @__PURE__ */ jsx(Video, { size: 20 })
											})
										]
									}),
									/* @__PURE__ */ jsx("p", {
										className: "sp-chat-note",
										children: "Demo chat · messages stay in this preview"
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "sp-bubble mine",
										children: ["Hello doctor, where can I see the tests from my consultation?", /* @__PURE__ */ jsxs("small", { children: ["10:32 AM ", /* @__PURE__ */ jsx(Check, { size: 12 })] })]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "sp-bubble",
										children: ["Your care plan can appear right here, with an option to review and book its tests together.", /* @__PURE__ */ jsx("small", { children: "10:34 AM · sample reply" })]
									}),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-care-plan sp-card",
										children: [/* @__PURE__ */ jsxs("header", { children: [/* @__PURE__ */ jsx(IconPod, { icon: Activity }), /* @__PURE__ */ jsxs("div", { children: [
											/* @__PURE__ */ jsx("span", {
												className: "sp-tag",
												children: "SAMPLE CARE PLAN"
											}),
											/* @__PURE__ */ jsx("h2", { children: "Your diagnostic plan" }),
											/* @__PURE__ */ jsx("p", { children: "Layout example · not a medical prescription" })
										] })] }), /* @__PURE__ */ jsxs("div", {
											className: "sp-padding",
											children: [
												/* @__PURE__ */ jsx("p", {
													className: "sp-plan-note",
													children: "A connected journey from consultation to diagnostics. Your clinician’s instructions would appear here."
												}),
												exampleTests.filter((t) => ["mri", "ecg"].includes(t.id)).map((t) => /* @__PURE__ */ jsxs("div", {
													className: "sp-plan-test",
													children: [
														/* @__PURE__ */ jsx(IconPod, { icon: t.icon }),
														/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("strong", { children: t.name }), /* @__PURE__ */ jsx("small", { children: t.delivery })] }),
														/* @__PURE__ */ jsx("strong", { children: rupees(t.fee) })
													]
												}, t.id)),
												/* @__PURE__ */ jsxs("div", {
													className: "sp-plan-total",
													children: [/* @__PURE__ */ jsx("span", { children: "Example total" }), /* @__PURE__ */ jsx("strong", { children: rupees(exampleTests[0].fee + exampleTests[2].fee) })]
												}),
												/* @__PURE__ */ jsxs("button", {
													className: "sp-primary sp-wide",
													onClick: () => {
														setBasket(["mri", "ecg"]);
														setCategory("All tests");
														go("diagnostics");
													},
													children: ["Review these tests", /* @__PURE__ */ jsx(ArrowRight, { size: 17 })]
												})
											]
										})]
									}),
									messages.map((m, i) => /* @__PURE__ */ jsxs("div", {
										className: "sp-bubble mine",
										children: [m, /* @__PURE__ */ jsxs("small", { children: ["Local preview only ", /* @__PURE__ */ jsx(Check, { size: 12 })] })]
									}, i)),
									/* @__PURE__ */ jsxs("div", {
										className: "sp-chips",
										children: [/* @__PURE__ */ jsx("button", {
											onClick: () => sendMessage("I’d like to review the appointment options."),
											children: "Review appointment options"
										}), /* @__PURE__ */ jsx("button", {
											onClick: () => setSheet("Care support"),
											children: "Care support"
										})]
									})
								]
							}),
							page === "checkout" && /* @__PURE__ */ jsxs("form", {
								id: "sp-checkout",
								className: "sp-content",
								onSubmit: finishSample,
								children: [
									/* @__PURE__ */ jsxs("section", {
										className: "sp-card sp-padding",
										children: [
											/* @__PURE__ */ jsx(Heading, {
												title: "Patient information",
												subtitle: "Use sample details to try the layout"
											}),
											/* @__PURE__ */ jsx("div", {
												className: "sp-segment",
												children: [{
													id: "self",
													label: "For myself",
													icon: UserRound
												}, {
													id: "family",
													label: "Family member",
													icon: Users
												}].map((p) => /* @__PURE__ */ jsxs("button", {
													type: "button",
													"aria-pressed": patientKind === p.id,
													onClick: () => {
														setPatientKind(p.id);
														setPatient((prev) => ({
															...prev,
															name: p.id === "self" ? "Priya Sharma" : "Rahul Verma",
															gender: p.id === "self" ? "Female" : "Prefer not to say",
															email: p.id === "self" ? "patient1@demo.med" : "patient2@demo.med"
														}));
													},
													children: [/* @__PURE__ */ jsx(p.icon, { size: 17 }), p.label]
												}, p.id))
											}),
											/* @__PURE__ */ jsxs("div", {
												className: "sp-fields",
												children: [
													/* @__PURE__ */ jsxs("label", { children: ["Full name", /* @__PURE__ */ jsx("input", {
														required: true,
														autoComplete: "off",
														value: patient.name,
														onChange: (e) => setPatient({
															...patient,
															name: e.target.value
														})
													})] }),
													/* @__PURE__ */ jsxs("label", { children: ["Email address", /* @__PURE__ */ jsx("input", {
														type: "email",
														required: true,
														autoComplete: "off",
														value: patient.email,
														onChange: (e) => setPatient({
															...patient,
															email: e.target.value
														})
													})] }),
													/* @__PURE__ */ jsxs("label", { children: [
														"Phone number ",
														/* @__PURE__ */ jsx("small", { children: "(optional in sample)" }),
														/* @__PURE__ */ jsx("input", {
															type: "tel",
															autoComplete: "off",
															placeholder: "Example contact number",
															value: patient.phone,
															onChange: (e) => setPatient({
																...patient,
																phone: e.target.value
															})
														})
													] }),
													/* @__PURE__ */ jsxs("div", {
														className: "sp-split",
														children: [/* @__PURE__ */ jsxs("label", { children: ["Age", /* @__PURE__ */ jsx("input", {
															type: "number",
															min: "0",
															max: "120",
															placeholder: "Years",
															value: patient.age,
															onChange: (e) => setPatient({
																...patient,
																age: e.target.value
															})
														})] }), /* @__PURE__ */ jsxs("label", { children: ["Gender", /* @__PURE__ */ jsxs("select", {
															value: patient.gender,
															onChange: (e) => setPatient({
																...patient,
																gender: e.target.value
															}),
															children: [
																/* @__PURE__ */ jsx("option", { children: "Female" }),
																/* @__PURE__ */ jsx("option", { children: "Male" }),
																/* @__PURE__ */ jsx("option", { children: "Prefer not to say" })
															]
														})] })]
													}),
													/* @__PURE__ */ jsxs("label", { children: ["Notes for the visit", /* @__PURE__ */ jsx("textarea", {
														placeholder: "Try adding a sample note",
														value: patient.note,
														onChange: (e) => setPatient({
															...patient,
															note: e.target.value
														})
													})] })
												]
											})
										]
									}),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-card sp-padding",
										children: [
											/* @__PURE__ */ jsx(Heading, { title: "Your visit" }),
											/* @__PURE__ */ jsxs("button", {
												type: "button",
												className: "sp-detail-row",
												onClick: openLocation,
												children: [
													/* @__PURE__ */ jsx(MapPin, { size: 19 }),
													/* @__PURE__ */ jsx("span", { children: checkoutKind === "doctor" && mode === "Video call" ? "Online consultation" : `${area}, Pune` }),
													/* @__PURE__ */ jsx("small", { children: "Change" })
												]
											}),
											/* @__PURE__ */ jsxs("button", {
												type: "button",
												className: "sp-detail-row",
												onClick: () => setSheet("visit-time"),
												children: [
													/* @__PURE__ */ jsx(Clock3, { size: 19 }),
													/* @__PURE__ */ jsxs("span", { children: [
														date,
														" Sep 2026 · ",
														slot || "Choose a time"
													] }),
													/* @__PURE__ */ jsx(ChevronRight, { size: 15 })
												]
											}),
											/* @__PURE__ */ jsx("p", {
												className: "sp-muted",
												children: checkoutKind === "doctor" ? `${doctor.name} · ${mode}` : `${delivery} where eligible; imaging at the centre.`
											})
										]
									}),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-card sp-padding",
										children: [/* @__PURE__ */ jsx(Heading, {
											title: "Bill summary",
											subtitle: "Illustrative prices for design review"
										}), /* @__PURE__ */ jsxs("dl", {
											className: "sp-bill",
											children: [checkoutKind === "doctor" ? /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("dt", { children: ["Consultation · ", mode] }), /* @__PURE__ */ jsx("dd", { children: rupees(consultationFee) })] }) : selectedTests.map((t) => /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: t.name }), /* @__PURE__ */ jsx("dd", { children: rupees(t.fee) })] }, t.id)), /* @__PURE__ */ jsxs("div", {
												className: "sp-total",
												children: [/* @__PURE__ */ jsx("dt", { children: "Example total" }), /* @__PURE__ */ jsx("dd", { children: rupees(total) })]
											})]
										})]
									}),
									/* @__PURE__ */ jsxs("section", {
										className: "sp-card sp-padding",
										children: [/* @__PURE__ */ jsx(Heading, {
											title: "Payment preference",
											subtitle: "No payment details or charges in this sample"
										}), /* @__PURE__ */ jsx("div", {
											className: "sp-payment",
											children: [
												{
													name: "UPI",
													icon: Wallet,
													detail: "Choose an app at checkout"
												},
												{
													name: "Credit / debit card",
													icon: CreditCard,
													detail: "Card details would follow"
												},
												{
													name: "Pay at visit",
													icon: Wallet,
													detail: "Where supported by the provider"
												}
											].map((p) => /* @__PURE__ */ jsxs("button", {
												type: "button",
												"aria-pressed": payment === p.name,
												onClick: () => setPayment(p.name),
												children: [
													/* @__PURE__ */ jsx(IconPod, { icon: p.icon }),
													/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: p.name }), /* @__PURE__ */ jsx("small", { children: p.detail })] }),
													/* @__PURE__ */ jsx("span", {
														className: "sp-radio",
														children: payment === p.name && /* @__PURE__ */ jsx(Check, { size: 14 })
													})
												]
											}, p.name))
										})]
									})
								]
							}),
							page === "services" && /* @__PURE__ */ jsxs("div", {
								className: "sp-content",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "sp-page-intro",
										children: [
											/* @__PURE__ */ jsx("span", {
												className: "sp-eyebrow",
												children: "THE MYDOX CARE NETWORK"
											}),
											/* @__PURE__ */ jsxs("h1", { children: [
												"All your care.",
												/* @__PURE__ */ jsx("br", {}),
												"One place."
											] }),
											/* @__PURE__ */ jsx("p", { children: "Open a section to explore what you need." })
										]
									}),
									/* @__PURE__ */ jsxs("label", {
										className: "sp-search",
										children: [/* @__PURE__ */ jsx(Search, { size: 19 }), /* @__PURE__ */ jsx("input", {
											"aria-label": "Search all services",
											placeholder: "Doctor, MRI, medicines…",
											value: query,
											onChange: (e) => setQuery(e.target.value)
										})]
									}),
									groups.map((g) => /* @__PURE__ */ jsxs("section", {
										className: "sp-service-group sp-card",
										children: [/* @__PURE__ */ jsxs("button", {
											className: "sp-group-heading",
											"aria-expanded": Boolean(query) || group === g.id,
											onClick: () => {
												setGroup(group === g.id ? null : g.id);
												setQuery("");
											},
											children: [
												/* @__PURE__ */ jsx(IconPod, { icon: g.icon }),
												/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: g.label }), /* @__PURE__ */ jsx("small", { children: g.description })] }),
												/* @__PURE__ */ jsx(ChevronDown, { size: 19 })
											]
										}), (query || group === g.id) && /* @__PURE__ */ jsx("div", {
											className: "sp-group-entries",
											children: g.services.map((s) => /* @__PURE__ */ jsxs("button", {
												onClick: () => openService(s.id, s.label),
												children: [
													/* @__PURE__ */ jsx(s.icon, { size: 19 }),
													/* @__PURE__ */ jsx("span", { children: s.label }),
													/* @__PURE__ */ jsx(ChevronRight, { size: 16 })
												]
											}, s.id))
										})]
									}, g.id)),
									!groups.length && /* @__PURE__ */ jsx("p", {
										className: "sp-empty",
										children: "No matching service. Try a different search."
									})
								]
							}),
							page === "schedule" && /* @__PURE__ */ jsxs("div", {
								className: "sp-content",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "sp-page-intro",
										children: [
											/* @__PURE__ */ jsx("span", {
												className: "sp-eyebrow",
												children: "WITH YOU, EVERY STEP"
											}),
											/* @__PURE__ */ jsx("h1", { children: "Your care calendar" }),
											/* @__PURE__ */ jsx("p", { children: "Appointments and requests, together." })
										]
									}),
									/* @__PURE__ */ jsx(Heading, { title: "Upcoming" }),
									appointment,
									completed && /* @__PURE__ */ jsxs("div", {
										className: "sp-info",
										children: [/* @__PURE__ */ jsx(Check, { size: 24 }), /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx("strong", { children: "You’ve completed the sample flow" }), "Your design review is complete. No real booking was created."] })]
									}),
									/* @__PURE__ */ jsxs("button", {
										className: "sp-primary sp-wide",
										onClick: () => openDoctor(),
										children: [/* @__PURE__ */ jsx(Plus, { size: 17 }), "Explore a new consultation"]
									}),
									/* @__PURE__ */ jsxs("button", {
										className: "sp-card sp-menu-row",
										onClick: () => go("diagnostics"),
										children: [
											/* @__PURE__ */ jsx(TestTube, { size: 22 }),
											/* @__PURE__ */ jsx("span", { children: "Tests & scans" }),
											/* @__PURE__ */ jsx(ChevronRight, { size: 18 })
										]
									}),
									/* @__PURE__ */ jsxs("button", {
										className: "sp-card sp-menu-row",
										onClick: () => setSheet("Health records"),
										children: [
											/* @__PURE__ */ jsx(FileText, { size: 22 }),
											/* @__PURE__ */ jsx("span", { children: "Health records & prescriptions" }),
											/* @__PURE__ */ jsx(ChevronRight, { size: 18 })
										]
									})
								]
							}),
							page === "profile" && /* @__PURE__ */ jsxs("div", {
								className: "sp-content",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "sp-profile-intro",
										children: [
											/* @__PURE__ */ jsx("img", {
												src: "/design/stitch/patient.png",
												alt: "Sample patient portrait"
											}),
											/* @__PURE__ */ jsx("h1", { children: "Priya Sharma" }),
											/* @__PURE__ */ jsx("p", { children: "Sample patient profile" })
										]
									}),
									[
										{
											name: "My family",
											icon: Users
										},
										{
											name: "Health records",
											icon: FileText
										},
										{
											name: "Saved doctors",
											icon: Heart
										},
										{
											name: "Notifications",
											icon: Bell
										},
										{
											name: "Privacy & preferences",
											icon: ShieldCheck
										}
									].map((p) => /* @__PURE__ */ jsxs("button", {
										className: "sp-card sp-menu-row",
										onClick: () => setSheet(p.name),
										children: [
											/* @__PURE__ */ jsx(p.icon, { size: 22 }),
											/* @__PURE__ */ jsx("span", { children: p.name }),
											/* @__PURE__ */ jsx(ChevronRight, { size: 18 })
										]
									}, p.name)),
									/* @__PURE__ */ jsxs("a", {
										className: "sp-compare-link",
										href: "/design-preview",
										children: ["Compare the previous design", /* @__PURE__ */ jsx(ArrowUpRight, { size: 17 })]
									}),
									/* @__PURE__ */ jsxs("a", {
										className: "sp-compare-link",
										href: "/",
										children: ["Open the current MyDox app", /* @__PURE__ */ jsx(ArrowUpRight, { size: 17 })]
									})
								]
							})
						]
					}),
					page === "chat" && /* @__PURE__ */ jsxs("form", {
						className: "sp-composer",
						onSubmit: (e) => {
							e.preventDefault();
							sendMessage();
						},
						children: [/* @__PURE__ */ jsx("input", {
							"aria-label": "Sample chat message",
							placeholder: "Try a sample message…",
							value: message,
							onChange: (e) => setMessage(e.target.value)
						}), /* @__PURE__ */ jsx("button", {
							className: "sp-primary",
							"aria-label": "Send sample message",
							disabled: !message.trim(),
							children: /* @__PURE__ */ jsx(Send, { size: 18 })
						})]
					}),
					page === "doctor" && /* @__PURE__ */ jsxs("div", {
						className: "sp-bookbar",
						children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: "Example visit fee" }), /* @__PURE__ */ jsx("strong", { children: rupees(consultationFee) })] }), /* @__PURE__ */ jsxs("button", {
							className: "sp-primary",
							disabled: !slot,
							onClick: () => openCheckout("doctor"),
							children: ["Book preview", /* @__PURE__ */ jsx(ArrowRight, { size: 18 })]
						})]
					}),
					page === "diagnostics" && basket.length > 0 && /* @__PURE__ */ jsxs("div", {
						className: "sp-basket",
						children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsxs("strong", { children: [
							basket.length,
							" ",
							basket.length === 1 ? "test" : "tests",
							" · ",
							rupees(testTotal)
						] }), /* @__PURE__ */ jsx("small", { children: "Example basket" })] }), /* @__PURE__ */ jsxs("button", {
							onClick: () => openCheckout("tests"),
							children: ["Review & book", /* @__PURE__ */ jsx(ArrowRight, { size: 16 })]
						})]
					}),
					page === "checkout" && /* @__PURE__ */ jsxs("div", {
						className: "sp-bookbar",
						children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: "Example total" }), /* @__PURE__ */ jsx("strong", { children: rupees(total) })] }), /* @__PURE__ */ jsxs("button", {
							type: "submit",
							form: "sp-checkout",
							className: "sp-primary",
							disabled: checkoutKind === "tests" && !basket.length,
							children: ["Finish sample", /* @__PURE__ */ jsx(ArrowRight, { size: 18 })]
						})]
					}),
					!["doctor", "checkout"].includes(page) && /* @__PURE__ */ jsx("nav", {
						className: "sp-nav",
						"aria-label": "Stitch preview navigation",
						children: navItems.map((n) => /* @__PURE__ */ jsxs("button", {
							"aria-current": activeNav === n.page ? "page" : void 0,
							onClick: () => go(n.page),
							children: [/* @__PURE__ */ jsx(n.icon, {
								size: 21,
								strokeWidth: 1.7
							}), /* @__PURE__ */ jsx("span", { children: n.label })]
						}, n.page))
					})
				]
			}),
			sheet && /* @__PURE__ */ jsx(Sheet, {
				title: sheet === "location" ? "Choose your area" : sheet === "complete" ? "Preview complete" : sheet === "visit-time" ? "Choose a sample time" : sheet,
				onClose: () => setSheet(null),
				children: sheet === "location" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("label", {
						className: "sp-search",
						children: [/* @__PURE__ */ jsx(Search, { size: 18 }), /* @__PURE__ */ jsx("input", {
							"aria-label": "Search area",
							placeholder: "Search areas in Pune",
							value: locationQuery,
							onChange: (e) => setLocationQuery(e.target.value)
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "sp-location-list",
						children: areas.filter((a) => a.toLowerCase().includes(locationQuery.toLowerCase())).map((a) => /* @__PURE__ */ jsxs("button", {
							onClick: () => {
								setArea(a);
								setSheet(null);
							},
							children: [
								/* @__PURE__ */ jsx(MapPin, { size: 18 }),
								a,
								area === a ? /* @__PURE__ */ jsx(Check, { size: 18 }) : /* @__PURE__ */ jsx(ChevronRight, { size: 18 })
							]
						}, a))
					}),
					/* @__PURE__ */ jsx("p", {
						className: "sp-muted",
						children: "Sample locations for reviewing the design."
					})
				] }) : sheet === "complete" ? /* @__PURE__ */ jsxs("div", {
					className: "sp-complete",
					children: [
						/* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(Check, { size: 32 }) }),
						/* @__PURE__ */ jsx("h3", { children: "All set for your review." }),
						/* @__PURE__ */ jsx("p", { children: "You’ve completed the sample checkout. No booking, payment or message has been sent." }),
						/* @__PURE__ */ jsxs("button", {
							className: "sp-primary sp-wide",
							onClick: () => {
								setSheet(null);
								go("schedule");
							},
							children: ["Back to schedule", /* @__PURE__ */ jsx(ArrowRight, { size: 17 })]
						})
					]
				}) : sheet === "visit-time" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
					className: "sp-dates",
					children: sampleDates.map((d, i) => /* @__PURE__ */ jsxs("button", {
						"aria-label": `${weekdays[i]} ${d} September`,
						"aria-pressed": date === d,
						onClick: () => setDate(d),
						children: [/* @__PURE__ */ jsx("small", { children: weekdays[i] }), /* @__PURE__ */ jsx("strong", { children: d })]
					}, d))
				}), /* @__PURE__ */ jsx("div", {
					className: "sp-slots",
					children: sampleSlots.filter((t) => t !== "05:30 PM").map((t) => /* @__PURE__ */ jsx("button", {
						"aria-pressed": slot === t,
						onClick: () => {
							setSlot(t);
							setSheet(null);
						},
						children: t
					}, t))
				})] }) : sheet === "Prescription preview" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
					className: "sp-info",
					children: [/* @__PURE__ */ jsx(FileText, { size: 27 }), /* @__PURE__ */ jsxs("p", { children: [/* @__PURE__ */ jsx("strong", { children: "From prescription to care" }), "Try the sample care plan from the consultation screen. No file upload or AI extraction is performed."] })]
				}), /* @__PURE__ */ jsxs("button", {
					className: "sp-primary sp-wide",
					onClick: () => {
						setSheet(null);
						go("chat");
					},
					children: ["Open sample care plan", /* @__PURE__ */ jsx(ArrowRight, { size: 17 })]
				})] }) : sheet === "Saved doctors" ? /* @__PURE__ */ jsxs(Fragment, { children: [exampleDoctors.filter((d) => favorites.includes(d.id)).map((d) => /* @__PURE__ */ jsx("p", {
					className: "sp-info",
					children: d.name
				}, d.id)), !favorites.length && /* @__PURE__ */ jsx("p", { children: "Tap the heart on a doctor’s card to save an example profile here." })] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx(IconPod, { icon: sheet === "Emergency access" ? HeartPulse : Sparkles }),
					/* @__PURE__ */ jsxs("h3", {
						className: "sp-panel-title",
						children: [
							"A focused space for ",
							sheet.toLowerCase(),
							"."
						]
					}),
					/* @__PURE__ */ jsxs("p", { children: [
						"This section is a layout preview.",
						" ",
						sheet === "Emergency access" ? "No emergency call or ambulance request is made." : "Its full workflow can be connected after you choose the design."
					] }),
					/* @__PURE__ */ jsx("button", {
						className: "sp-secondary sp-wide",
						onClick: () => setSheet(null),
						children: "Keep exploring"
					})
				] })
			})
		]
	});
}
//#endregion
//#region src/routes/stitch-preview.tsx?tsr-split=component
var SplitComponent = StitchPreview;
//#endregion
export { SplitComponent as component };
