import { a as PATIENT_SERVICE_GROUPS, i as HEALTH_CARE_SERVICES, n as Heading, r as IconPod, t as clinicalShortcuts } from "./stitch-preview-CQApfgSV.js";
import { useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ArrowUpRight, Bell, Brain, CalendarDays, ChevronDown, ChevronRight, ClipboardList, FileText, Heart, HeartPulse, House, LayoutGrid, LogOut, MapPin, MessageCircle, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Stethoscope, TestTube, UserRound, Users } from "lucide-react";
//#region src/features/mydox/stitch/StitchPatientHome.tsx
function StitchPatientHome({ name, onAction, onServices, onNearby, allergyReport, activeRequest, onTrack }) {
	const firstName = name.trim().split(/\s+/)[0] || "there";
	const [greeting] = useState(() => {
		const hour = (/* @__PURE__ */ new Date()).getHours();
		return hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "sp-preview mdx-stitch-home",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "sp-home-glow",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "sp-greeting",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("p", { children: greeting }),
							/* @__PURE__ */ jsxs("h1", { children: [
								"Hi, ",
								firstName,
								" ",
								/* @__PURE__ */ jsx("span", { children: "✦" })
							] }),
							/* @__PURE__ */ jsx("small", { children: "A little care. A healthier you." })
						] }), /* @__PURE__ */ jsxs("button", {
							className: "sp-sos",
							onClick: () => onAction("emergency"),
							"aria-label": "SOS emergency care",
							children: [/* @__PURE__ */ jsx(HeartPulse, { size: 18 }), " SOS"]
						})]
					}),
					/* @__PURE__ */ jsxs("button", {
						className: "sp-search sp-search-link",
						onClick: () => onAction("search"),
						children: [
							/* @__PURE__ */ jsx(Search, { size: 20 }),
							/* @__PURE__ */ jsx("span", { children: "Search doctors, tests, services…" }),
							/* @__PURE__ */ jsx(SlidersHorizontal, { size: 17 })
						]
					}),
					/* @__PURE__ */ jsx(Heading, {
						title: activeRequest ? "Your active care" : "Your appointments",
						action: "Details",
						onClick: () => onAction("bookings")
					}),
					/* @__PURE__ */ jsxs("article", {
						className: "sp-appointment",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "sp-appointment-person",
							children: [/* @__PURE__ */ jsx(IconPod, { icon: activeRequest ? Stethoscope : CalendarDays }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", { children: activeRequest?.title || "Your next step in care" }), /* @__PURE__ */ jsx("p", { children: activeRequest?.detail || "Find your upcoming visits, requests and follow-ups in My bookings." })] })]
						}), /* @__PURE__ */ jsxs("div", {
							className: "mdx-stitch-appointment-actions",
							children: [/* @__PURE__ */ jsx("button", {
								className: "sp-secondary",
								onClick: () => onAction("bookings"),
								children: "My bookings"
							}), /* @__PURE__ */ jsxs("button", {
								className: "sp-primary",
								onClick: () => onAction("doctor"),
								children: ["Book a doctor", /* @__PURE__ */ jsx(ChevronRight, { size: 15 })]
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "sp-section",
				children: [/* @__PURE__ */ jsx(Heading, {
					title: "Clinical services",
					subtitle: "Care for every part of your health",
					action: "Explore all",
					onClick: onServices
				}), /* @__PURE__ */ jsx("div", {
					className: "sp-services-grid",
					children: clinicalShortcuts.map((service) => /* @__PURE__ */ jsxs("button", {
						onClick: () => onAction(service.id),
						children: [
							/* @__PURE__ */ jsx(IconPod, {
								icon: service.icon,
								tone: service.tone
							}),
							/* @__PURE__ */ jsx("strong", { children: service.label }),
							/* @__PURE__ */ jsx("small", { children: service.detail })
						]
					}, service.id))
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "sp-section",
				children: [/* @__PURE__ */ jsx(Heading, {
					title: "Find your specialist",
					action: "View all",
					onClick: () => onAction("doctor")
				}), /* @__PURE__ */ jsxs("div", {
					className: "sp-chips",
					children: [
						/* @__PURE__ */ jsxs("button", {
							onClick: () => onAction("specialty:Neurologist"),
							children: [/* @__PURE__ */ jsx(Brain, { size: 17 }), "Neurologist"]
						}),
						/* @__PURE__ */ jsxs("button", {
							onClick: () => onAction("specialty:Cardiologist"),
							children: [/* @__PURE__ */ jsx(Heart, { size: 17 }), "Cardiologist"]
						}),
						/* @__PURE__ */ jsxs("button", {
							onClick: () => onAction("dental"),
							children: [/* @__PURE__ */ jsx(Sparkles, { size: 17 }), "Dentist"]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "sp-section",
				children: [/* @__PURE__ */ jsx(Heading, {
					title: "Meet your care team",
					subtitle: "Find the right specialist for your visit"
				}), [{
					specialty: "Neurologist",
					title: "Brain & nerve care",
					summary: "Find a specialist for your brain, nerve and spinal care.",
					image: "krishna.jpg"
				}, {
					specialty: "Cardiologist",
					title: "Care for your heart",
					summary: "Explore heart specialists and ongoing cardiovascular care.",
					image: "charlotte.jpg"
				}].map((doctor) => /* @__PURE__ */ jsxs("article", {
					className: "sp-doctor-card sp-card",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "sp-doctor-copy",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "sp-eyebrow",
									children: doctor.specialty
								}),
								/* @__PURE__ */ jsx("h2", { children: doctor.title }),
								/* @__PURE__ */ jsx("p", { children: doctor.summary }),
								/* @__PURE__ */ jsx("small", { children: "Choose a doctor to see visit options" })
							]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "sp-doctor-photo",
							children: /* @__PURE__ */ jsx("img", {
								src: `/design/stitch/${doctor.image}`,
								alt: ""
							})
						}),
						/* @__PURE__ */ jsxs("button", {
							className: "sp-primary sp-wide",
							onClick: () => onAction(`specialty:${doctor.specialty}`),
							children: [
								/* @__PURE__ */ jsx(Stethoscope, { size: 17 }),
								"Find a ",
								doctor.specialty.toLowerCase(),
								/* @__PURE__ */ jsx(ChevronRight, { size: 15 })
							]
						})
					]
				}, doctor.specialty))]
			}),
			allergyReport && /* @__PURE__ */ jsx("section", {
				className: "sp-section",
				children: allergyReport
			}),
			/* @__PURE__ */ jsx("section", {
				className: "sp-section",
				children: /* @__PURE__ */ jsxs("button", {
					className: "sp-wellness",
					onClick: () => onAction("ai"),
					children: [
						/* @__PURE__ */ jsx(Sparkles, { size: 30 }),
						/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("span", {
								className: "sp-tag",
								children: "YOUR HEALTH COMPANION"
							}),
							/* @__PURE__ */ jsx("h3", { children: "A little guidance, whenever you need." }),
							/* @__PURE__ */ jsx("p", { children: "Explore the MyDox assistant." })
						] }),
						/* @__PURE__ */ jsx(ChevronRight, { size: 18 })
					]
				})
			}),
			/* @__PURE__ */ jsx("section", {
				className: "sp-section",
				children: /* @__PURE__ */ jsxs("button", {
					className: "mdx-action-row",
					onClick: onNearby,
					children: [
						/* @__PURE__ */ jsx(IconPod, {
							icon: MapPin,
							tone: "mint"
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "mdx-row-copy",
							children: [/* @__PURE__ */ jsx("strong", { children: "Care near you" }), /* @__PURE__ */ jsx("small", { children: "Explore hubs, hospitals and services" })]
						}),
						/* @__PURE__ */ jsx(ChevronRight, { size: 18 })
					]
				})
			})
		]
	});
}
//#endregion
//#region src/features/mydox/PatientDashboard.tsx
function HealthCareServicesBanner({ onAction }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mdx-hcs-banner",
		"aria-label": "Health Care Services",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mdx-hcs-header",
			children: [
				/* @__PURE__ */ jsx("span", { className: "mdx-hcs-line" }),
				/* @__PURE__ */ jsx("span", {
					className: "mdx-hcs-badge",
					children: "HEALTH CARE SERVICES"
				}),
				/* @__PURE__ */ jsx("span", { className: "mdx-hcs-line" })
			]
		}), /* @__PURE__ */ jsx("div", {
			className: "mdx-hcs-grid",
			children: HEALTH_CARE_SERVICES.map((item) => /* @__PURE__ */ jsxs("button", {
				className: "mdx-hcs-card",
				style: {
					"--hcs-bg": item.bg,
					"--hcs-border": item.borderColor
				},
				onClick: () => onAction(item.id),
				"aria-label": `Open ${item.label}`,
				children: [/* @__PURE__ */ jsx("div", {
					className: "mdx-hcs-visual",
					children: item.image ? /* @__PURE__ */ jsx("img", {
						src: item.image,
						alt: item.label
					}) : /* @__PURE__ */ jsx("span", { children: item.emoji })
				}), /* @__PURE__ */ jsx("span", {
					className: "mdx-hcs-title",
					children: item.label
				})]
			}, item.id))
		})]
	});
}
function PatientHeader({ area, areas, onAreaChange, onAction, unread, name, home, onProfile }) {
	return /* @__PURE__ */ jsxs("header", {
		className: "mdx-header mdx-stitch-header",
		"data-home": home,
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "sp-logo",
				children: /* @__PURE__ */ jsx(Plus, {
					size: 21,
					strokeWidth: 2.7
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mdx-stitch-brand",
				children: [/* @__PURE__ */ jsx("strong", { children: "MyDox" }), /* @__PURE__ */ jsxs("label", {
					className: "mdx-location",
					children: [/* @__PURE__ */ jsx(MapPin, { size: 12 }), /* @__PURE__ */ jsx("select", {
						"aria-label": "Care location",
						value: area,
						onChange: (e) => onAreaChange(e.target.value),
						children: areas.map((a) => /* @__PURE__ */ jsx("option", { children: a }, a))
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("button", {
				className: "mdx-icon-button mdx-notifications",
				onClick: () => onAction("notifications"),
				"aria-label": unread ? `Notifications, ${unread} unread` : "Notifications",
				children: [/* @__PURE__ */ jsx(Bell, { size: 20 }), unread > 0 && /* @__PURE__ */ jsx("span", { className: "mdx-notification-dot" })]
			}),
			/* @__PURE__ */ jsx("button", {
				className: "mdx-stitch-avatar",
				onClick: onProfile,
				"aria-label": "Open profile",
				children: name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("") || /* @__PURE__ */ jsx(UserRound, { size: 18 })
			})
		]
	});
}
var tabs = [
	{
		id: "home",
		label: "Home",
		icon: House
	},
	{
		id: "care",
		label: "Schedule",
		icon: CalendarDays
	},
	{
		id: "services",
		label: "Services",
		icon: Stethoscope
	},
	{
		id: "consult",
		label: "Consult",
		icon: MessageCircle
	},
	{
		id: "profile",
		label: "Profile",
		icon: UserRound
	}
];
function PatientBottomNav({ tab, onChange }) {
	const activeTab = tab === "nearby" ? "home" : tab;
	return /* @__PURE__ */ jsx("nav", {
		className: "mdx-bottom-nav",
		"aria-label": "Main navigation",
		children: tabs.map(({ id, label, icon: Icon }) => /* @__PURE__ */ jsxs("button", {
			"aria-current": activeTab === id ? "page" : void 0,
			onClick: () => onChange(id),
			children: [/* @__PURE__ */ jsx("span", { children: /* @__PURE__ */ jsx(Icon, {
				size: 21,
				strokeWidth: activeTab === id ? 2.3 : 1.7
			}) }), label]
		}, id))
	});
}
function ActionRow({ icon: Icon, label, detail, onClick }) {
	return /* @__PURE__ */ jsxs("button", {
		className: "mdx-action-row",
		onClick,
		children: [
			/* @__PURE__ */ jsx(IconPod, { icon: Icon }),
			/* @__PURE__ */ jsxs("span", {
				className: "mdx-row-copy",
				children: [/* @__PURE__ */ jsx("strong", { children: label }), detail && /* @__PURE__ */ jsx("small", { children: detail })]
			}),
			/* @__PURE__ */ jsx(ChevronRight, { size: 17 })
		]
	});
}
function PatientDashboard({ tab, onTabChange, onAction, name, mapContent, doctorsContent, chatsContent, recommendationsContent, reportContent, allergyReport, activeRequest, onTrack }) {
	const [expanded, setExpanded] = useState(null);
	const [filter, setFilter] = useState("");
	const openCategory = (id) => {
		setExpanded(id);
		setFilter("");
		onTabChange("services");
	};
	const filteredGroups = PATIENT_SERVICE_GROUPS.map((group) => ({
		...group,
		services: group.services.filter((service) => `${group.label} ${service.label} ${service.detail || ""}`.toLowerCase().includes(filter.trim().toLowerCase()))
	})).filter((group) => group.services.length);
	return /* @__PURE__ */ jsxs("main", {
		className: "mdx-dashboard",
		"data-tab": tab,
		"aria-label": `${tab === "nearby" ? "Care nearby" : tabs.find((t) => t.id === tab)?.label} section`,
		children: [
			tab === "home" && /* @__PURE__ */ jsx(StitchPatientHome, {
				name,
				onAction,
				onServices: () => onTabChange("services"),
				onNearby: () => onTabChange("nearby"),
				allergyReport,
				activeRequest,
				onTrack
			}),
			tab === "services" && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-page-heading",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "mdx-eyebrow",
							children: "EXPLORE MYDOX"
						}),
						/* @__PURE__ */ jsxs("h1", { children: [
							"All your care.",
							/* @__PURE__ */ jsx("br", {}),
							"Simply organised."
						] }),
						/* @__PURE__ */ jsx("p", { children: "Choose a section to see what’s inside." })
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mdx-service-search",
					children: [/* @__PURE__ */ jsx(Search, { size: 18 }), /* @__PURE__ */ jsx("input", {
						"aria-label": "Find a service",
						placeholder: "Find a service…",
						value: filter,
						onChange: (e) => setFilter(e.target.value)
					})]
				}),
				/* @__PURE__ */ jsx(HealthCareServicesBanner, { onAction }),
				/* @__PURE__ */ jsx("div", {
					className: "mdx-service-groups",
					children: filteredGroups.map(({ id, label, description, icon: Icon, services }) => {
						const open = Boolean(filter.trim()) || expanded === id;
						return /* @__PURE__ */ jsxs("section", {
							className: `mdx-service-group${open ? " is-open" : ""}`,
							children: [/* @__PURE__ */ jsxs("button", {
								className: "mdx-group-toggle",
								"aria-expanded": open,
								"aria-controls": `mdx-group-${id}`,
								onClick: () => {
									setFilter("");
									setExpanded(open ? null : id);
								},
								children: [
									/* @__PURE__ */ jsx(IconPod, {
										icon: Icon,
										tone: id === "homecare" ? "mint" : id === "programs" ? "lavender" : "blue"
									}),
									/* @__PURE__ */ jsxs("span", { children: [/* @__PURE__ */ jsx("strong", { children: label }), /* @__PURE__ */ jsx("small", { children: description })] }),
									/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
								]
							}), /* @__PURE__ */ jsx("div", {
								id: `mdx-group-${id}`,
								hidden: !open,
								className: "mdx-group-content",
								children: services.map((service) => /* @__PURE__ */ jsx(ActionRow, {
									icon: service.icon,
									label: service.label,
									detail: service.detail,
									onClick: () => onAction(service.id)
								}, service.id))
							})]
						}, id);
					})
				}),
				!filteredGroups.length && /* @__PURE__ */ jsxs("p", {
					className: "mdx-empty",
					role: "status",
					children: [
						"No services match “",
						filter,
						"”. Try another name."
					]
				}),
				/* @__PURE__ */ jsxs("button", {
					className: "mdx-emergency mdx-emergency-wide",
					onClick: () => onAction("emergency"),
					children: [
						/* @__PURE__ */ jsx(HeartPulse, { size: 18 }),
						"Need urgent help? Open emergency care ",
						/* @__PURE__ */ jsx(ChevronRight, { size: 16 })
					]
				})
			] }),
			tab === "care" && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-page-heading",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "mdx-eyebrow",
							children: "WITH YOU, EVERY STEP"
						}),
						/* @__PURE__ */ jsx("h1", { children: "Your schedule" }),
						/* @__PURE__ */ jsx("p", { children: "Your appointments, people and health story." })
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-action-list",
					children: [
						/* @__PURE__ */ jsx(ActionRow, {
							icon: CalendarDays,
							label: "My bookings",
							detail: "Appointments & requests across all services",
							onClick: () => onAction("bookings")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: ClipboardList,
							label: "Consultation history",
							detail: "Past visits, payments & follow-ups",
							onClick: () => onAction("history")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: FileText,
							label: "Health records",
							detail: "Your reports & medical history",
							onClick: () => onAction("records")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: CalendarDays,
							label: "My calendar",
							onClick: () => onAction("calendar")
						})
					]
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "mdx-disclosure",
					children: [/* @__PURE__ */ jsxs("summary", { children: [
						/* @__PURE__ */ jsx(Stethoscope, { size: 20 }),
						/* @__PURE__ */ jsx("span", { children: "My doctors & family plan" }),
						/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
					] }), /* @__PURE__ */ jsxs("div", { children: [doctorsContent, /* @__PURE__ */ jsx(ActionRow, {
						icon: Heart,
						label: "Preferred doctors",
						onClick: () => onAction("preferred")
					})] })]
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "mdx-disclosure",
					children: [/* @__PURE__ */ jsxs("summary", { children: [
						/* @__PURE__ */ jsx(ClipboardList, { size: 20 }),
						/* @__PURE__ */ jsx("span", { children: "Recommended by my doctor" }),
						/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
					] }), /* @__PURE__ */ jsx("div", { children: recommendationsContent })]
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "mdx-disclosure",
					children: [/* @__PURE__ */ jsxs("summary", { children: [
						/* @__PURE__ */ jsx(Sparkles, { size: 20 }),
						/* @__PURE__ */ jsx("span", { children: "AI health tools" }),
						/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
					] }), /* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Sparkles,
							label: "Ask AI",
							onClick: () => onAction("ai")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: HeartPulse,
							label: "Health companion",
							onClick: () => onAction("companion")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: FileText,
							label: "Saved AI summaries",
							onClick: () => onAction("aiHistory")
						}),
						reportContent
					] })]
				})
			] }),
			tab === "consult" && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-page-heading",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "mdx-eyebrow",
							children: "CARE, CONNECTED"
						}),
						/* @__PURE__ */ jsx("h1", { children: "Your consultations" }),
						/* @__PURE__ */ jsx("p", { children: "Your doctors, conversations and follow-up care." })
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-action-list",
					children: [/* @__PURE__ */ jsx(ActionRow, {
						icon: Stethoscope,
						label: "Book a consultation",
						detail: "Clinic, video or home visit",
						onClick: () => onAction("doctor")
					}), /* @__PURE__ */ jsx(ActionRow, {
						icon: ClipboardList,
						label: "Consultation history",
						onClick: () => onAction("history")
					})]
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "mdx-stitch-consult",
					children: [/* @__PURE__ */ jsx("h2", { children: "Chats & care groups" }), chatsContent]
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "mdx-disclosure",
					children: [/* @__PURE__ */ jsxs("summary", { children: [
						/* @__PURE__ */ jsx(ClipboardList, { size: 20 }),
						/* @__PURE__ */ jsx("span", { children: "Recommended by my doctor" }),
						/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
					] }), /* @__PURE__ */ jsx("div", { children: recommendationsContent })]
				})
			] }),
			tab === "nearby" && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-page-heading",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "mdx-eyebrow",
							children: "CLOSER TO BETTER CARE"
						}),
						/* @__PURE__ */ jsx("h1", { children: "Care nearby" }),
						/* @__PURE__ */ jsx("p", { children: "Explore hubs and services around you." })
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "mdx-map",
					children: mapContent
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-action-list",
					children: [
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Stethoscope,
							label: "Find a doctor",
							onClick: () => onAction("doctor")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: ShieldCheck,
							label: "Hospital admission",
							onClick: () => onAction("admit")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: TestTube,
							label: "Labs & scans",
							onClick: () => openCategory("diagnostics")
						})
					]
				}),
				/* @__PURE__ */ jsxs("button", {
					className: "mdx-emergency mdx-emergency-wide",
					onClick: () => onAction("sos"),
					children: [
						/* @__PURE__ */ jsx(HeartPulse, { size: 18 }),
						"Ambulance · SOS ",
						/* @__PURE__ */ jsx(ChevronRight, { size: 16 })
					]
				})
			] }),
			tab === "profile" && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-page-heading",
					children: [/* @__PURE__ */ jsx("p", {
						className: "mdx-eyebrow",
						children: "YOUR MYDOX"
					}), /* @__PURE__ */ jsx("h1", { children: "Profile" })]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-profile-card",
					children: [/* @__PURE__ */ jsx("span", { children: name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("") || /* @__PURE__ */ jsx(UserRound, {}) }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: name || "Your account" }), /* @__PURE__ */ jsx("p", { children: "Your care, your way" })] })]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mdx-action-list",
					children: [
						/* @__PURE__ */ jsx(ActionRow, {
							icon: UserRound,
							label: "Health profile & settings",
							onClick: () => onAction("profile")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: FileText,
							label: "My health records",
							onClick: () => onAction("records")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: MapPin,
							label: "Care nearby",
							onClick: () => onTabChange("nearby")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Star,
							label: "Rewards",
							onClick: () => onAction("rewards")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Bell,
							label: "Notifications",
							onClick: () => onAction("notifications")
						})
					]
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "mdx-disclosure",
					children: [/* @__PURE__ */ jsxs("summary", { children: [
						/* @__PURE__ */ jsx(Users, { size: 20 }),
						/* @__PURE__ */ jsx("span", { children: "Memberships & benefits" }),
						/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
					] }), /* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Users,
							label: "Family physician plan",
							onClick: () => onAction("family")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: ShieldCheck,
							label: "Insurance benefit",
							onClick: () => onAction("insurance")
						}),
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Heart,
							label: "Community programs",
							onClick: () => openCategory("community")
						})
					] })]
				}),
				/* @__PURE__ */ jsxs("details", {
					className: "mdx-disclosure",
					children: [/* @__PURE__ */ jsxs("summary", { children: [
						/* @__PURE__ */ jsx(LayoutGrid, { size: 20 }),
						/* @__PURE__ */ jsx("span", { children: "More from MyDox" }),
						/* @__PURE__ */ jsx(ChevronDown, { size: 18 })
					] }), /* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx(ActionRow, {
							icon: Stethoscope,
							label: "Clinic app demo",
							onClick: () => onAction("clinicDemo")
						}),
						/* @__PURE__ */ jsxs("a", {
							className: "mdx-account-link",
							href: "/provider/earnings",
							children: ["Provider earnings ", /* @__PURE__ */ jsx(ArrowUpRight, { size: 16 })]
						}),
						/* @__PURE__ */ jsxs("a", {
							className: "mdx-account-link",
							href: "/provider/availability",
							children: ["Provider availability ", /* @__PURE__ */ jsx(ArrowUpRight, { size: 16 })]
						}),
						/* @__PURE__ */ jsxs("a", {
							className: "mdx-account-link",
							href: "/auth?admin=1",
							children: ["Admin sign in ", /* @__PURE__ */ jsx(ArrowUpRight, { size: 16 })]
						})
					] })]
				}),
				/* @__PURE__ */ jsxs("button", {
					className: "mdx-signout",
					onClick: () => onAction("signout"),
					children: [/* @__PURE__ */ jsx(LogOut, { size: 17 }), "Sign out"]
				})
			] })
		]
	});
}
//#endregion
export { PatientHeader as i, PatientBottomNav as n, PatientDashboard as r, HealthCareServicesBanner as t };
