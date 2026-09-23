import { a as PATIENT_SERVICE_GROUPS, i as HEALTH_CARE_SERVICES } from "./stitch-preview-CQApfgSV.js";
import { t as HealthCareServicesBanner } from "./PatientDashboard-BVYr6yn6.js";
import { useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, Bone, Brain, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, Eye, FileText, Heart, HeartPulse, House, LayoutGrid, MapPin, MessageCircle, Navigation, Pill, Plus, Search, ShieldCheck, Sparkles, Stethoscope, TestTube, UserRound, Users, Video, Wind, X } from "lucide-react";
//#region src/features/mydox/preview/PatientDesignPreview.tsx
var specialties = [
	{
		name: "General physician",
		detail: "Everyday health",
		icon: Stethoscope,
		tone: "teal",
		common: true
	},
	{
		name: "Children’s health",
		detail: "Paediatrics",
		icon: Users,
		tone: "peach",
		common: true
	},
	{
		name: "Skin & hair",
		detail: "Dermatology",
		icon: Sparkles,
		tone: "rose",
		common: true
	},
	{
		name: "Women’s health",
		detail: "Gynaecology",
		icon: Heart,
		tone: "violet",
		common: true
	},
	{
		name: "Bones & joints",
		detail: "Orthopaedics",
		icon: Bone,
		tone: "sand",
		common: true
	},
	{
		name: "Heart care",
		detail: "Cardiology",
		icon: HeartPulse,
		tone: "blue",
		common: true
	},
	{
		name: "Brain & nerves",
		detail: "Neurology",
		icon: Brain,
		tone: "violet"
	},
	{
		name: "Breathing & lungs",
		detail: "Pulmonology",
		icon: Wind,
		tone: "teal"
	},
	{
		name: "Eye care",
		detail: "Ophthalmology",
		icon: Eye,
		tone: "peach"
	},
	{
		name: "Mental wellbeing",
		detail: "Psychiatry",
		icon: Brain,
		tone: "blue"
	}
];
var modes = [
	{
		label: "Clinic visit",
		detail: "Care nearby",
		icon: Stethoscope,
		tone: "teal"
	},
	{
		label: "Video consult",
		detail: "From anywhere",
		icon: Video,
		tone: "blue"
	},
	{
		label: "Home visit",
		detail: "At your door",
		icon: House,
		tone: "sand"
	}
];
var tabs = [
	{
		id: "home",
		label: "Home",
		icon: House
	},
	{
		id: "services",
		label: "Services",
		icon: LayoutGrid
	},
	{
		id: "care",
		label: "My Care",
		icon: HeartPulse
	},
	{
		id: "nearby",
		label: "Nearby",
		icon: MapPin
	},
	{
		id: "profile",
		label: "Profile",
		icon: UserRound
	}
];
var doctors = [{
	name: "Dr. Anita Rao",
	initials: "AR",
	tone: "teal",
	fee: 500,
	experience: "12 years’ experience",
	time: "10:30 AM"
}, {
	name: "Dr. Vikram Iyer",
	initials: "VI",
	tone: "blue",
	fee: 600,
	experience: "9 years’ experience",
	time: "11:00 AM"
}];
var areas = [
	"Koregaon Park",
	"Wakad",
	"Baner",
	"Kothrud",
	"Aundh",
	"Viman Nagar",
	"Hinjewadi",
	"Hadapsar",
	"Kharadi",
	"Pimpri-Chinchwad"
];
var dates = [
	{
		day: "Wed",
		date: "09"
	},
	{
		day: "Thu",
		date: "10"
	},
	{
		day: "Fri",
		date: "11"
	},
	{
		day: "Sat",
		date: "12"
	},
	{
		day: "Sun",
		date: "13"
	}
];
var slots = [
	"09:00 AM",
	"09:30 AM",
	"10:00 AM",
	"10:30 AM",
	"11:00 AM",
	"11:30 AM"
];
function IconTile({ icon: Icon, tone = "teal", children }) {
	return /* @__PURE__ */ jsxs("span", {
		className: `mp-icon ${tone}`,
		children: [/* @__PURE__ */ jsx(Icon, {
			size: 25,
			strokeWidth: 1.65
		}), children]
	});
}
function SectionHeading({ title, action, onClick }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mp-section-title",
		children: [/* @__PURE__ */ jsx("h2", { children: title }), action && /* @__PURE__ */ jsxs("button", {
			onClick,
			children: [action, /* @__PURE__ */ jsx(ChevronRight, { size: 15 })]
		})]
	});
}
function Row({ icon, title, detail, onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		className: "mp-row",
		onClick,
		children: [
			/* @__PURE__ */ jsx(IconTile, { icon }),
			/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: title }), detail && /* @__PURE__ */ jsx("small", { children: detail })] }),
			/* @__PURE__ */ jsx(ChevronRight, { size: 18 })
		]
	});
}
function SampleSheet({ title, onClose, children }) {
	const ref = useRef(null);
	useEffect(() => {
		const dialog = ref.current;
		dialog?.showModal();
		return () => dialog?.close();
	}, []);
	return /* @__PURE__ */ jsx("dialog", {
		ref,
		className: "mp-dialog",
		"aria-label": title,
		onCancel: (e) => {
			e.preventDefault();
			onClose();
		},
		onClick: (e) => {
			if (e.target === e.currentTarget) onClose();
		},
		children: /* @__PURE__ */ jsxs("div", {
			className: "mp-sheet",
			children: [
				/* @__PURE__ */ jsx("div", { className: "mp-sheet-handle" }),
				/* @__PURE__ */ jsxs("header", { children: [/* @__PURE__ */ jsx("h2", { children: title }), /* @__PURE__ */ jsx("button", {
					className: "mp-circle-button",
					onClick: onClose,
					"aria-label": "Close preview panel",
					children: /* @__PURE__ */ jsx(X, { size: 20 })
				})] }),
				children
			]
		})
	});
}
function PatientDesignPreview() {
	const [tab, setTab] = useState("home");
	const [flow, setFlow] = useState(null);
	const [mode, setMode] = useState("Clinic visit");
	const [specialty, setSpecialty] = useState(specialties[0]);
	const [doctorIndex, setDoctorIndex] = useState(0);
	const [dateIndex, setDateIndex] = useState(0);
	const [slot, setSlot] = useState("");
	const [area, setArea] = useState("Koregaon Park");
	const [recentAreas, setRecentAreas] = useState(["Koregaon Park"]);
	const [patient, setPatient] = useState("Priya Sharma");
	const [sheet, setSheet] = useState(null);
	const [query, setQuery] = useState("");
	const [locationQuery, setLocationQuery] = useState("");
	const [commonOnly, setCommonOnly] = useState(true);
	const [group, setGroup] = useState(null);
	const [service, setService] = useState(null);
	const scroller = useRef(null);
	const doctor = doctors[doctorIndex];
	const resetScroll = () => {
		scroller.current?.scrollTo({ top: 0 });
	};
	const navigate = (next) => {
		setTab(next);
		setFlow(null);
		setService(null);
		setQuery("");
		resetScroll();
	};
	const startBooking = (nextMode = mode) => {
		setMode(nextMode);
		setFlow(0);
		setQuery("");
		setService(null);
		resetScroll();
	};
	const nextStage = (step) => {
		setFlow(step);
		resetScroll();
	};
	const selectSpecialty = (item) => {
		setSpecialty(item);
		if (item.name !== specialty.name) setSlot("");
		setDoctorIndex(0);
		nextStage(1);
	};
	const openService = (id, label) => {
		if (id === "doctor") startBooking();
		else {
			setService(label);
			resetScroll();
		}
	};
	const chooseArea = (next) => {
		setArea(next);
		setRecentAreas((prev) => [next, ...prev.filter((a) => a !== next)].slice(0, 3));
		setSheet(null);
	};
	const filteredSpecialties = specialties.filter((s) => (!commonOnly || Boolean(query.trim()) || s.common) && `${s.name} ${s.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
	const filteredGroups = PATIENT_SERVICE_GROUPS.map((g) => ({
		...g,
		services: g.services.filter((s) => `${g.label} ${s.label} ${s.detail || ""}`.toLowerCase().includes(query.toLowerCase()))
	})).filter((g) => g.services.length);
	const pageTitle = flow !== null ? [
		"Find your specialty",
		"Choose your doctor",
		"Choose a time",
		"Review your visit"
	][flow] : service || tabs.find((t) => t.id === tab)?.label;
	return /* @__PURE__ */ jsxs("div", {
		className: "mp-preview",
		children: [
			/* @__PURE__ */ jsxs("aside", {
				className: "mp-review-note",
				children: [
					/* @__PURE__ */ jsx("span", { className: "mp-review-dot" }),
					/* @__PURE__ */ jsx("strong", { children: "DESIGN PREVIEW" }),
					/* @__PURE__ */ jsx("span", { children: "Sample data · explore freely" }),
					/* @__PURE__ */ jsxs("a", {
						href: "/",
						children: ["Current app", /* @__PURE__ */ jsx(ArrowUpRight, { size: 13 })]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mp-phone",
				children: [
					/* @__PURE__ */ jsx("header", {
						className: "mp-header",
						children: flow !== null || service ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx("button", {
								className: "mp-circle-button",
								"aria-label": "Go back",
								onClick: () => {
									if (service) {
										setService(null);
										resetScroll();
									} else if (flow === 0) navigate("home");
									else nextStage((flow ?? 1) - 1);
								},
								children: /* @__PURE__ */ jsx(ArrowLeft, { size: 21 })
							}),
							/* @__PURE__ */ jsx("span", {
								className: "mp-header-title",
								children: pageTitle
							}),
							/* @__PURE__ */ jsx("span", {
								className: "mp-mini-brand",
								children: "MyDox"
							})
						] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-brand",
								children: [
									/* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(Plus, {
										size: 22,
										strokeWidth: 3
									}) }),
									"MyDox",
									/* @__PURE__ */ jsx("span", {
										className: "mp-brand-dot",
										children: "."
									})
								]
							}),
							/* @__PURE__ */ jsxs("button", {
								className: "mp-area",
								onClick: () => {
									setLocationQuery("");
									setSheet("location");
								},
								children: [
									/* @__PURE__ */ jsx(MapPin, { size: 14 }),
									/* @__PURE__ */ jsx("span", { children: area }),
									/* @__PURE__ */ jsx(ChevronDown, { size: 13 })
								]
							}),
							/* @__PURE__ */ jsxs("button", {
								className: "mp-circle-button",
								"aria-label": "Notifications preview",
								onClick: () => setSheet("notifications"),
								children: [/* @__PURE__ */ jsx(Bell, { size: 20 }), /* @__PURE__ */ jsx("i", {})]
							})
						] })
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mp-scroll",
						ref: scroller,
						children: flow !== null ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx("div", {
								className: "mp-stepper",
								"aria-label": "Booking progress",
								children: [
									"Specialty",
									"Doctor",
									"Time",
									"Review"
								].map((label, index) => /* @__PURE__ */ jsxs("button", {
									className: flow === index ? "active" : flow > index ? "complete" : "",
									disabled: index > flow,
									onClick: () => nextStage(index),
									"aria-current": flow === index ? "step" : void 0,
									children: [/* @__PURE__ */ jsx("span", { children: flow > index ? /* @__PURE__ */ jsx(Check, { size: 13 }) : index + 1 }), label]
								}, label))
							}),
							flow === 0 && /* @__PURE__ */ jsxs(Fragment, { children: [
								/* @__PURE__ */ jsxs("div", {
									className: "mp-page-intro",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "mp-kicker",
											children: "THE RIGHT CARE STARTS HERE"
										}),
										/* @__PURE__ */ jsxs("h1", { children: [
											"What can we",
											/* @__PURE__ */ jsx("br", {}),
											"help you with?"
										] }),
										/* @__PURE__ */ jsx("p", { children: "Find a specialty that feels right for you." })
									]
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mp-mode-switch",
									"aria-label": "Consultation type",
									children: modes.map((m) => /* @__PURE__ */ jsxs("button", {
										"aria-pressed": mode === m.label,
										onClick: () => setMode(m.label),
										children: [/* @__PURE__ */ jsx(m.icon, { size: 17 }), m.label]
									}, m.label))
								}),
								/* @__PURE__ */ jsxs("label", {
									className: "mp-search",
									children: [/* @__PURE__ */ jsx(Search, { size: 20 }), /* @__PURE__ */ jsx("input", {
										"aria-label": "Search specialties",
										placeholder: "Search a specialty or concern",
										value: query,
										onChange: (e) => setQuery(e.target.value)
									})]
								}),
								!query && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(SectionHeading, { title: "Your familiar care" }), /* @__PURE__ */ jsxs("button", {
									className: "mp-familiar",
									onClick: () => {
										setSpecialty(specialties[0]);
										setDoctorIndex(0);
										nextStage(2);
									},
									children: [
										/* @__PURE__ */ jsx("span", {
											className: "mp-avatar teal",
											children: "AR"
										}),
										/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: "Dr. Anita Rao" }), /* @__PURE__ */ jsx("small", { children: "General physician · example profile" })] }),
										/* @__PURE__ */ jsxs("span", {
											className: "mp-text-action",
											children: ["Book again", /* @__PURE__ */ jsx(ArrowUpRight, { size: 15 })]
										})
									]
								})] }),
								/* @__PURE__ */ jsxs("div", {
									className: "mp-segment",
									children: [/* @__PURE__ */ jsx("button", {
										"aria-pressed": commonOnly,
										onClick: () => setCommonOnly(true),
										children: "Common care"
									}), /* @__PURE__ */ jsx("button", {
										"aria-pressed": !commonOnly,
										onClick: () => setCommonOnly(false),
										children: "All specialties"
									})]
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mp-specialty-grid",
									children: filteredSpecialties.map((s) => /* @__PURE__ */ jsxs("button", {
										onClick: () => selectSpecialty(s),
										children: [
											/* @__PURE__ */ jsx(IconTile, {
												icon: s.icon,
												tone: s.tone
											}),
											/* @__PURE__ */ jsx("strong", { children: s.name }),
											/* @__PURE__ */ jsx("small", { children: s.detail }),
											/* @__PURE__ */ jsx(ArrowUpRight, { size: 15 })
										]
									}, s.name))
								}),
								!filteredSpecialties.length && /* @__PURE__ */ jsxs("div", {
									className: "mp-empty",
									children: [
										/* @__PURE__ */ jsx(Search, { size: 26 }),
										/* @__PURE__ */ jsx("h2", { children: "No matching specialty" }),
										/* @__PURE__ */ jsx("p", { children: "Try “skin”, “heart” or “general”." }),
										/* @__PURE__ */ jsx("button", {
											className: "mp-secondary",
											onClick: () => setQuery(""),
											children: "Clear search"
										})
									]
								})
							] }),
							flow === 1 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
								className: "mp-page-intro",
								children: [
									/* @__PURE__ */ jsxs("p", {
										className: "mp-kicker",
										children: [
											mode.toUpperCase(),
											" · ",
											area.toUpperCase()
										]
									}),
									/* @__PURE__ */ jsxs("h1", { children: [
										"Your care.",
										/* @__PURE__ */ jsx("br", {}),
										"Your choice."
									] }),
									/* @__PURE__ */ jsxs("p", { children: [specialty.name, " · example doctor profiles"] })
								]
							}), /* @__PURE__ */ jsx("div", {
								className: "mp-doctor-list",
								children: doctors.map((d, index) => /* @__PURE__ */ jsxs("article", {
									className: `mp-doctor-card${doctorIndex === index ? " selected" : ""}`,
									children: [/* @__PURE__ */ jsxs("div", {
										className: `mp-doctor-portrait ${d.tone}`,
										children: [
											/* @__PURE__ */ jsx("span", {
												className: "mp-portrait-circle",
												children: /* @__PURE__ */ jsx(UserRound, {
													size: 57,
													strokeWidth: 1.1
												})
											}),
											/* @__PURE__ */ jsx("span", {
												className: "mp-example-label",
												children: "Example profile"
											}),
											/* @__PURE__ */ jsx("button", {
												"aria-label": `About ${d.name}`,
												onClick: () => {
													setDoctorIndex(index);
													setSheet("doctor");
												},
												children: /* @__PURE__ */ jsx(ArrowUpRight, { size: 20 })
											})
										]
									}), /* @__PURE__ */ jsxs("div", {
										className: "mp-doctor-copy",
										children: [
											/* @__PURE__ */ jsx("h2", { children: d.name }),
											/* @__PURE__ */ jsx("p", { children: specialty.name }),
											/* @__PURE__ */ jsxs("small", { children: [d.experience, " · sample information"] }),
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsxs("strong", { children: ["₹", d.fee] }), /* @__PURE__ */ jsx("small", { children: "Example visit fee" })] }), /* @__PURE__ */ jsxs("button", {
												className: "mp-primary",
												onClick: () => {
													if (doctorIndex !== index) setSlot("");
													setDoctorIndex(index);
													nextStage(2);
												},
												children: ["Choose", /* @__PURE__ */ jsx(ArrowRight, { size: 16 })]
											})] })
										]
									})]
								}, d.name))
							})] }),
							flow === 2 && /* @__PURE__ */ jsxs(Fragment, { children: [
								/* @__PURE__ */ jsxs("div", {
									className: "mp-page-intro",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "mp-kicker",
											children: "MAKE TIME FOR YOU"
										}),
										/* @__PURE__ */ jsxs("h1", { children: [
											"A time that",
											/* @__PURE__ */ jsx("br", {}),
											"works for you."
										] }),
										/* @__PURE__ */ jsx("p", { children: "Select an example date and time." })
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mp-familiar",
									children: [
										/* @__PURE__ */ jsx("span", {
											className: `mp-avatar ${doctor.tone}`,
											children: doctor.initials
										}),
										/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: doctor.name }), /* @__PURE__ */ jsx("small", { children: specialty.name })] }),
										/* @__PURE__ */ jsx("span", {
											className: "mp-mode-tag",
											children: mode
										})
									]
								}),
								/* @__PURE__ */ jsx(SectionHeading, { title: "September 2026" }),
								/* @__PURE__ */ jsx("div", {
									className: "mp-dates",
									children: dates.map((d, index) => /* @__PURE__ */ jsxs("button", {
										"aria-pressed": dateIndex === index,
										"aria-label": `${d.day} ${d.date} September`,
										onClick: () => {
											setDateIndex(index);
											setSlot("");
										},
										children: [
											/* @__PURE__ */ jsx("small", { children: d.day }),
											/* @__PURE__ */ jsx("strong", { children: d.date }),
											/* @__PURE__ */ jsx("i", {})
										]
									}, d.date))
								}),
								/* @__PURE__ */ jsx(SectionHeading, { title: "Morning" }),
								/* @__PURE__ */ jsx("div", {
									className: "mp-time-slots",
									children: slots.map((time) => /* @__PURE__ */ jsx("button", {
										"aria-pressed": slot === time,
										onClick: () => setSlot(time),
										children: time
									}, time))
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mp-sample-note",
									children: [/* @__PURE__ */ jsx(Clock3, { size: 15 }), "Example slots for reviewing this design"]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mp-patient-row",
									children: [
										/* @__PURE__ */ jsx(IconTile, { icon: UserRound }),
										/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: "Booking for" }), /* @__PURE__ */ jsx("strong", { children: patient })] }),
										/* @__PURE__ */ jsx("button", {
											onClick: () => setSheet("patient"),
											children: "Change"
										})
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mp-soft-note",
									children: [/* @__PURE__ */ jsx(ShieldCheck, { size: 22 }), /* @__PURE__ */ jsxs("p", { children: [
										"Everything in one place.",
										/* @__PURE__ */ jsx("br", {}),
										/* @__PURE__ */ jsx("span", { children: "Review your visit details before continuing." })
									] })]
								})
							] }),
							flow === 3 && /* @__PURE__ */ jsxs(Fragment, { children: [
								/* @__PURE__ */ jsxs("div", {
									className: "mp-page-intro",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "mp-kicker",
											children: "ONE LAST LOOK"
										}),
										/* @__PURE__ */ jsxs("h1", { children: [
											"Your visit,",
											/* @__PURE__ */ jsx("br", {}),
											"at a glance."
										] }),
										/* @__PURE__ */ jsx("p", { children: "Review this sample appointment." })
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mp-review-card",
									children: [
										/* @__PURE__ */ jsxs("div", {
											className: "mp-familiar",
											children: [/* @__PURE__ */ jsx("span", {
												className: `mp-avatar ${doctor.tone}`,
												children: doctor.initials
											}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: doctor.name }), /* @__PURE__ */ jsx("small", { children: specialty.name })] })]
										}),
										/* @__PURE__ */ jsxs("dl", { children: [
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: "Consultation" }), /* @__PURE__ */ jsx("dd", { children: mode })] }),
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: "Date & time" }), /* @__PURE__ */ jsxs("dd", { children: [
												dates[dateIndex].date,
												" Sep 2026 · ",
												slot
											] })] }),
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: "Patient" }), /* @__PURE__ */ jsx("dd", { children: patient })] }),
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: "Location" }), /* @__PURE__ */ jsx("dd", { children: mode === "Video consult" ? "Online" : area })] }),
											/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", { children: "Example fee" }), /* @__PURE__ */ jsxs("dd", { children: ["₹", doctor.fee] })] })
										] }),
										/* @__PURE__ */ jsxs("button", {
											className: "mp-inline",
											onClick: () => nextStage(2),
											children: ["Edit visit details", /* @__PURE__ */ jsx(ArrowRight, { size: 15 })]
										})
									]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mp-sample-note",
									children: "Design preview only. No payment or appointment will be created."
								})
							] })
						] }) : service ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-page-intro",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "mp-kicker",
										children: "YOUR CARE, SIMPLIFIED"
									}),
									/* @__PURE__ */ jsx("h1", { children: service }),
									/* @__PURE__ */ jsx("p", { children: "An example of how a service opens into its own focused page." })
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-service-example",
								children: [
									/* @__PURE__ */ jsx(IconTile, { icon: HeartPulse }),
									/* @__PURE__ */ jsx("h2", { children: "Care that comes together." }),
									/* @__PURE__ */ jsx("p", { children: "Choose your preferences, explore your options and review the details." })
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-list",
								children: [
									/* @__PURE__ */ jsx(Row, {
										icon: ClipboardListIcon,
										title: "Your requirements",
										detail: "Tell us what you need",
										onClick: () => setSheet("requirements")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: MapPin,
										title: area,
										detail: "Choose your area",
										onClick: () => setSheet("location")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: CalendarDays,
										title: "Preferred time",
										detail: "Choose what suits you",
										onClick: () => setSheet("preferred-time")
									})
								]
							}),
							/* @__PURE__ */ jsxs("button", {
								className: "mp-primary mp-full",
								onClick: () => setSheet("service-example"),
								children: ["Explore options", /* @__PURE__ */ jsx(ArrowRight, { size: 17 })]
							})
						] }) : tab === "home" ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-greeting",
								children: [/* @__PURE__ */ jsxs("div", { children: [
									/* @__PURE__ */ jsx("p", {
										className: "mp-kicker",
										children: "A LITTLE CARE, EVERY DAY"
									}),
									/* @__PURE__ */ jsxs("h1", { children: ["Hello, Priya", /* @__PURE__ */ jsx("span", { children: "✦" })] }),
									/* @__PURE__ */ jsx("p", { children: "Let’s find the right care for you." })
								] }), /* @__PURE__ */ jsxs("button", {
									className: "mp-emergency",
									onClick: () => setSheet("emergency"),
									children: [/* @__PURE__ */ jsx(HeartPulse, { size: 15 }), "SOS"]
								})]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-search-row",
								children: [/* @__PURE__ */ jsxs("button", {
									className: "mp-search",
									onClick: () => {
										navigate("services");
									},
									children: [/* @__PURE__ */ jsx(Search, { size: 20 }), /* @__PURE__ */ jsx("span", { children: "Search your care" })]
								}), /* @__PURE__ */ jsxs("button", {
									className: "mp-ai",
									onClick: () => setSheet("ai"),
									children: [/* @__PURE__ */ jsx(Sparkles, { size: 19 }), /* @__PURE__ */ jsx("span", { children: "Ask AI" })]
								})]
							}),
							/* @__PURE__ */ jsx(SectionHeading, { title: "How would you like to consult?" }),
							/* @__PURE__ */ jsx("div", {
								className: "mp-consult-grid",
								children: modes.map((m) => /* @__PURE__ */ jsxs("button", {
									onClick: () => startBooking(m.label),
									children: [
										/* @__PURE__ */ jsx(IconTile, {
											icon: m.icon,
											tone: m.tone
										}),
										/* @__PURE__ */ jsx("strong", { children: m.label }),
										/* @__PURE__ */ jsx("small", { children: m.detail })
									]
								}, m.label))
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mp-quick-services",
								children: [
									{
										id: "labtest",
										label: "Lab tests",
										icon: TestTube
									},
									{
										id: "medicines",
										label: "Medicines",
										icon: Pill
									},
									{
										id: "programs",
										label: "Care plans",
										icon: Heart
									},
									{
										id: "all",
										label: "All services",
										icon: LayoutGrid
									}
								].map((s) => /* @__PURE__ */ jsxs("button", {
									onClick: () => {
										if (s.id === "all") navigate("services");
										else if (s.id === "programs") {
											navigate("services");
											setGroup("programs");
										} else openService(s.id, s.label);
									},
									children: [/* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(s.icon, {
										size: 23,
										strokeWidth: 1.7
									}) }), s.label]
								}, s.id))
							}),
							/* @__PURE__ */ jsx(SectionHeading, {
								title: "Your next appointment",
								action: "My Care",
								onClick: () => navigate("care")
							}),
							/* @__PURE__ */ jsx(AppointmentCard, { onClick: () => setSheet("appointment") }),
							/* @__PURE__ */ jsx(SectionHeading, {
								title: "Find care by specialty",
								action: "View all",
								onClick: () => startBooking()
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mp-specialty-grid compact",
								children: specialties.slice(0, 4).map((s) => /* @__PURE__ */ jsxs("button", {
									onClick: () => {
										setMode("Clinic visit");
										selectSpecialty(s);
									},
									children: [
										/* @__PURE__ */ jsx(IconTile, {
											icon: s.icon,
											tone: s.tone
										}),
										/* @__PURE__ */ jsx("strong", { children: s.name }),
										/* @__PURE__ */ jsx("small", { children: s.detail }),
										/* @__PURE__ */ jsx(ArrowUpRight, { size: 15 })
									]
								}, s.name))
							}),
							/* @__PURE__ */ jsxs("button", {
								className: "mp-community",
								onClick: () => {
									navigate("services");
									setGroup("community");
								},
								children: [
									/* @__PURE__ */ jsx(Users, { size: 26 }),
									/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: "Better care, together." }), /* @__PURE__ */ jsx("small", { children: "Explore community programs & benefits" })] }),
									/* @__PURE__ */ jsx(ArrowUpRight, { size: 18 })
								]
							})
						] }) : tab === "services" ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-page-intro",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "mp-kicker",
										children: "EVERY PART OF YOUR HEALTH"
									}),
									/* @__PURE__ */ jsxs("h1", { children: [
										"One place.",
										/* @__PURE__ */ jsx("br", {}),
										"All your care."
									] }),
									/* @__PURE__ */ jsx("p", { children: "Open a section. Find what you need." })
								]
							}),
							/* @__PURE__ */ jsxs("label", {
								className: "mp-search",
								children: [/* @__PURE__ */ jsx(Search, { size: 20 }), /* @__PURE__ */ jsx("input", {
									"aria-label": "Search services",
									placeholder: "Doctors, tests, home care…",
									value: query,
									onChange: (e) => setQuery(e.target.value)
								})]
							}),
							/* @__PURE__ */ jsx(HealthCareServicesBanner, { onAction: (id) => openService(id, HEALTH_CARE_SERVICES.find((h) => h.id === id)?.label || id) }),
							/* @__PURE__ */ jsx("div", {
								className: "mp-groups",
								children: filteredGroups.map((g) => {
									const open = Boolean(query) || group === g.id;
									return /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("button", {
										className: "mp-group",
										onClick: () => {
											setQuery("");
											setGroup(open ? null : g.id);
										},
										"aria-expanded": open,
										"aria-controls": `mp-${g.id}`,
										children: [
											/* @__PURE__ */ jsx(IconTile, { icon: g.icon }),
											/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: g.label }), /* @__PURE__ */ jsx("small", { children: g.description })] }),
											/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
										]
									}), /* @__PURE__ */ jsx("div", {
										id: `mp-${g.id}`,
										hidden: !open,
										className: "mp-group-items",
										children: g.services.map((s) => /* @__PURE__ */ jsx(Row, {
											icon: s.icon,
											title: s.label,
											onClick: () => openService(s.id, s.label)
										}, s.id))
									})] }, g.id);
								})
							}),
							!filteredGroups.length && /* @__PURE__ */ jsx("p", {
								className: "mp-empty",
								children: "No matching service. Try another search."
							})
						] }) : tab === "care" ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-page-intro",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "mp-kicker",
										children: "WITH YOU, EVERY STEP"
									}),
									/* @__PURE__ */ jsxs("h1", { children: [
										"Your care,",
										/* @__PURE__ */ jsx("br", {}),
										"all together."
									] }),
									/* @__PURE__ */ jsx("p", { children: "Appointments, conversations and health records." })
								]
							}),
							/* @__PURE__ */ jsx(SectionHeading, { title: "Upcoming" }),
							/* @__PURE__ */ jsx(AppointmentCard, { onClick: () => setSheet("appointment") }),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-list",
								children: [
									/* @__PURE__ */ jsx(Row, {
										icon: CalendarDays,
										title: "All appointments",
										detail: "Visits & requests across your services",
										onClick: () => setSheet("appointment")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: FileText,
										title: "Health records",
										detail: "Reports, prescriptions & summaries",
										onClick: () => setSheet("records")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: MessageCircle,
										title: "Care conversations",
										detail: "Your doctors & care groups",
										onClick: () => setSheet("conversations")
									})
								]
							}),
							/* @__PURE__ */ jsx(SectionHeading, { title: "Your care team" }),
							/* @__PURE__ */ jsxs("button", {
								className: "mp-familiar",
								onClick: () => startBooking(),
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "mp-avatar teal",
										children: "AR"
									}),
									/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: "Dr. Anita Rao" }), /* @__PURE__ */ jsx("small", { children: "General physician · example profile" })] }),
									/* @__PURE__ */ jsx(ArrowUpRight, { size: 18 })
								]
							})
						] }) : tab === "nearby" ? /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-page-intro",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "mp-kicker",
										children: "GOOD CARE, CLOSER"
									}),
									/* @__PURE__ */ jsxs("h1", { children: [
										"In your",
										/* @__PURE__ */ jsx("br", {}),
										"neighbourhood."
									] }),
									/* @__PURE__ */ jsxs("button", {
										className: "mp-inline",
										onClick: () => setSheet("location"),
										children: [
											/* @__PURE__ */ jsx(MapPin, { size: 16 }),
											area,
											/* @__PURE__ */ jsx(ChevronDown, { size: 15 })
										]
									})
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-map",
								children: [
									/* @__PURE__ */ jsxs("svg", {
										viewBox: "0 0 400 260",
										"aria-hidden": "true",
										children: [
											/* @__PURE__ */ jsx("rect", {
												width: "400",
												height: "260",
												fill: "#e7efec"
											}),
											/* @__PURE__ */ jsx("path", {
												d: "M0 20H130V105H0ZM240 160H400V260H240Z",
												fill: "#d0e2d6"
											}),
											/* @__PURE__ */ jsx("path", {
												d: "M-10 170L410 35M120 -10L260 270M-10 240L400 145M-10 40L410 225",
												fill: "none",
												stroke: "#fff",
												strokeWidth: "14"
											}),
											/* @__PURE__ */ jsx("path", {
												d: "M10 265Q230 80 400 220",
												fill: "none",
												stroke: "#b7dce0",
												strokeWidth: "21"
											}),
											/* @__PURE__ */ jsx("circle", {
												cx: "210",
												cy: "130",
												r: "45",
												fill: "#137c8020"
											}),
											/* @__PURE__ */ jsx("circle", {
												cx: "210",
												cy: "130",
												r: "9",
												fill: "#147a80",
												stroke: "white",
												strokeWidth: "4"
											})
										]
									}),
									/* @__PURE__ */ jsx("button", {
										className: "mp-map-pin",
										onClick: () => setSheet("hub"),
										"aria-label": "Explore example MyDox hub",
										children: /* @__PURE__ */ jsx(Plus, { size: 24 })
									}),
									/* @__PURE__ */ jsx("span", { children: "Illustrative map" })
								]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-list",
								children: [/* @__PURE__ */ jsx(Row, {
									icon: Stethoscope,
									title: "MyDox care hub",
									detail: "Example listing · tap to explore",
									onClick: () => setSheet("hub")
								}), /* @__PURE__ */ jsx(Row, {
									icon: TestTube,
									title: "Diagnostics nearby",
									detail: "Explore tests and scans",
									onClick: () => openService("labtest", "Tests & scans")
								})]
							})
						] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mp-page-intro",
								children: [/* @__PURE__ */ jsx("p", {
									className: "mp-kicker",
									children: "YOUR MYDOX"
								}), /* @__PURE__ */ jsx("h1", { children: "Made for you." })]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-profile",
								children: [/* @__PURE__ */ jsx("span", {
									className: "mp-avatar teal",
									children: "PS"
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: "Priya Sharma" }), /* @__PURE__ */ jsx("p", { children: "Sample patient profile" })] })]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mp-list",
								children: [
									/* @__PURE__ */ jsx(Row, {
										icon: UserRound,
										title: "My health profile",
										detail: "Personal details & preferences",
										onClick: () => setSheet("patient")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: Users,
										title: "Family & loved ones",
										detail: "Preview family selection",
										onClick: () => setSheet("patient")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: Heart,
										title: "Plans & benefits",
										onClick: () => {
											navigate("services");
											setGroup("community");
										}
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: Bell,
										title: "Notifications",
										onClick: () => setSheet("notifications")
									}),
									/* @__PURE__ */ jsx(Row, {
										icon: ShieldCheck,
										title: "Privacy & account",
										onClick: () => setSheet("account")
									})
								]
							}),
							/* @__PURE__ */ jsxs("a", {
								className: "mp-current-app",
								href: "/",
								children: ["Return to current MyDox app", /* @__PURE__ */ jsx(ArrowUpRight, { size: 17 })]
							})
						] })
					}),
					flow === 2 || flow === 3 ? /* @__PURE__ */ jsxs("div", {
						className: "mp-booking-footer",
						children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("small", { children: "Example consultation fee" }), /* @__PURE__ */ jsxs("strong", { children: ["₹", doctor.fee] })] }), /* @__PURE__ */ jsxs("button", {
							className: "mp-primary",
							disabled: flow === 2 && !slot,
							onClick: () => flow === 2 ? nextStage(3) : setSheet("complete"),
							children: [flow === 2 ? "Review visit" : "Finish sample", /* @__PURE__ */ jsx(ArrowRight, { size: 17 })]
						})]
					}) : /* @__PURE__ */ jsx("nav", {
						className: "mp-nav",
						"aria-label": "Preview navigation",
						children: tabs.map((t) => /* @__PURE__ */ jsxs("button", {
							"aria-current": (flow !== null ? "services" : tab) === t.id ? "page" : void 0,
							onClick: () => navigate(t.id),
							children: [/* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(t.icon, {
								size: 23,
								strokeWidth: 1.7
							}) }), t.label]
						}, t.id))
					})
				]
			}),
			sheet && /* @__PURE__ */ jsx(SampleSheet, {
				title: {
					location: "Choose your area",
					patient: "Who is this visit for?",
					complete: "Preview complete",
					doctor: doctor.name,
					ai: "Ask MyDox AI",
					emergency: "Emergency access preview",
					appointment: "Your appointment",
					hub: "MyDox care hub"
				}[sheet] || "Explore this preview",
				onClose: () => setSheet(null),
				children: sheet === "location" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("label", {
						className: "mp-search",
						children: [/* @__PURE__ */ jsx(Search, { size: 19 }), /* @__PURE__ */ jsx("input", {
							autoFocus: true,
							"aria-label": "Search city or area",
							placeholder: "Search city or area",
							value: locationQuery,
							onChange: (e) => setLocationQuery(e.target.value)
						})]
					}),
					/* @__PURE__ */ jsxs("button", {
						className: "mp-locate",
						onClick: () => chooseArea("Koregaon Park"),
						children: [/* @__PURE__ */ jsx(Navigation, { size: 19 }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: "Use current location" }), /* @__PURE__ */ jsx("small", { children: "Simulates selection in this preview" })] })]
					}),
					!locationQuery && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("p", {
						className: "mp-kicker",
						children: "RECENT AREAS"
					}), /* @__PURE__ */ jsx("div", {
						className: "mp-location-chips",
						children: recentAreas.map((a) => /* @__PURE__ */ jsx("button", {
							onClick: () => chooseArea(a),
							children: a
						}, a))
					})] }),
					/* @__PURE__ */ jsx(SectionHeading, { title: "Areas in Pune" }),
					/* @__PURE__ */ jsx("div", {
						className: "mp-area-list",
						children: areas.filter((a) => a.toLowerCase().includes(locationQuery.toLowerCase())).map((a) => /* @__PURE__ */ jsxs("button", {
							onClick: () => chooseArea(a),
							children: [
								/* @__PURE__ */ jsx(MapPin, { size: 17 }),
								a,
								area === a ? /* @__PURE__ */ jsx(Check, { size: 17 }) : /* @__PURE__ */ jsx(ChevronRight, { size: 17 })
							]
						}, a))
					}),
					!areas.some((a) => a.toLowerCase().includes(locationQuery.toLowerCase())) && /* @__PURE__ */ jsx("p", {
						className: "mp-sample-note",
						children: "No sample areas match this search."
					})
				] }) : sheet === "patient" ? /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("p", {
					className: "mp-sample-note",
					children: "Example profiles for reviewing patient selection."
				}), ["Priya Sharma", "Rahul Verma"].map((p) => /* @__PURE__ */ jsx(Row, {
					icon: UserRound,
					title: p,
					detail: p === patient ? "Selected for this sample" : "Sample family profile",
					onClick: () => {
						setPatient(p);
						setSheet(null);
					}
				}, p))] }) : sheet === "complete" ? /* @__PURE__ */ jsxs("div", {
					className: "mp-complete",
					children: [
						/* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(Check, { size: 34 }) }),
						/* @__PURE__ */ jsx("h3", { children: "That’s the new booking experience." }),
						/* @__PURE__ */ jsx("p", { children: "You’ve reached the end of the sample. No appointment or payment was created." }),
						/* @__PURE__ */ jsxs("button", {
							className: "mp-primary mp-full",
							onClick: () => {
								setSheet(null);
								navigate("home");
							},
							children: ["Back to preview home", /* @__PURE__ */ jsx(ArrowRight, { size: 16 })]
						})
					]
				}) : sheet === "doctor" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mp-familiar",
						children: [/* @__PURE__ */ jsx("span", {
							className: `mp-avatar ${doctor.tone}`,
							children: doctor.initials
						}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: doctor.name }), /* @__PURE__ */ jsx("small", { children: specialty.name })] })]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mp-sheet-copy",
						children: "A calm, focused space for the doctor’s introduction, experience, consultation options and visit details."
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mp-sample-note",
						children: [
							"Example profile · ₹",
							doctor.fee,
							" sample visit fee"
						]
					}),
					/* @__PURE__ */ jsxs("button", {
						className: "mp-primary mp-full",
						onClick: () => {
							setSheet(null);
							nextStage(2);
						},
						children: ["Choose a time", /* @__PURE__ */ jsx(ArrowRight, { size: 16 })]
					})
				] }) : sheet === "appointment" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mp-familiar",
						children: [/* @__PURE__ */ jsx("span", {
							className: "mp-avatar teal",
							children: "AR"
						}), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: "Dr. Anita Rao" }), /* @__PURE__ */ jsx("small", { children: "General physician" })] })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mp-appointment-meta",
						children: [/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(CalendarDays, { size: 17 }), "09 Sep · 10:30 AM"] }), /* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(Video, { size: 17 }), "Video consult"] })]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mp-sample-note",
						children: "This is an example appointment, not a real booking."
					}),
					/* @__PURE__ */ jsxs("button", {
						className: "mp-primary mp-full",
						onClick: () => {
							setSheet(null);
							setMode("Video consult");
							setSpecialty(specialties[0]);
							setDoctorIndex(0);
							nextStage(2);
						},
						children: ["Try the schedule screen", /* @__PURE__ */ jsx(ArrowRight, { size: 16 })]
					})
				] }) : sheet === "ai" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mp-ai-welcome",
						children: [
							/* @__PURE__ */ jsx(Sparkles, { size: 32 }),
							/* @__PURE__ */ jsx("h3", { children: "A little guidance to get started." }),
							/* @__PURE__ */ jsx("p", { children: "A sample entry to the existing MyDox health assistant." })
						]
					}),
					/* @__PURE__ */ jsx(Row, {
						icon: Stethoscope,
						title: "Help me find a specialty",
						onClick: () => {
							setSheet(null);
							startBooking();
						}
					}),
					/* @__PURE__ */ jsx(Row, {
						icon: LayoutGrid,
						title: "Explore available services",
						onClick: () => {
							setSheet(null);
							navigate("services");
						}
					})
				] }) : sheet === "emergency" ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsx("p", {
						className: "mp-sheet-copy",
						children: "Emergency support stays easy to find, with clear choices for ambulance and hospital assistance."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mp-soft-note",
						children: [/* @__PURE__ */ jsx(HeartPulse, { size: 25 }), /* @__PURE__ */ jsxs("p", { children: [
							"This panel demonstrates the entry point.",
							/* @__PURE__ */ jsx("br", {}),
							/* @__PURE__ */ jsx("span", { children: "No call or dispatch is made in this sample." })
						] })]
					}),
					/* @__PURE__ */ jsx("button", {
						className: "mp-secondary mp-full",
						onClick: () => setSheet(null),
						children: "Return to preview"
					})
				] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
					className: "mp-service-example",
					children: [
						/* @__PURE__ */ jsx(IconTile, { icon: sheet === "records" ? FileText : sheet === "conversations" ? MessageCircle : HeartPulse }),
						/* @__PURE__ */ jsx("h3", { children: {
							records: "Your health story, organised.",
							conversations: "Care is a conversation.",
							notifications: "Your updates, in one place.",
							hub: "Care in your neighbourhood.",
							account: "Your preferences. Your control.",
							requirements: "Start with what you need.",
							"preferred-time": "Make room for care."
						}[sheet] || service || "A focused space for your care." }),
						/* @__PURE__ */ jsx("p", { children: "This panel shows the proposed layout for this section. It uses sample content for design review." })
					]
				}), /* @__PURE__ */ jsx("button", {
					className: "mp-secondary mp-full",
					onClick: () => setSheet(null),
					children: "Back to exploring"
				})] })
			})
		]
	});
}
function AppointmentCard({ onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		className: "mp-appointment",
		onClick,
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mp-appointment-top",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "mp-avatar",
					children: "AR"
				}),
				/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: "Dr. Anita Rao" }), /* @__PURE__ */ jsx("small", { children: "General physician" })] }),
				/* @__PURE__ */ jsx("span", {
					className: "mp-example-label",
					children: "Example"
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "mp-appointment-meta",
			children: [
				/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(CalendarDays, { size: 16 }), "09 Sep · 10:30 AM"] }),
				/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx(Video, { size: 16 }), "Video consult"] }),
				/* @__PURE__ */ jsx(ChevronRight, { size: 17 })
			]
		})]
	});
}
var ClipboardListIcon = FileText;
//#endregion
//#region src/routes/design-preview.tsx?tsr-split=component
var SplitComponent = PatientDesignPreview;
//#endregion
export { SplitComponent as component };
