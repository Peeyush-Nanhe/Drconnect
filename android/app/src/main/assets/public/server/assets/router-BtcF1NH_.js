import { n as supabase, r as __exportAll } from "./client-BSmVQfT1.js";
import { r as getSharedAiHistory } from "./ai-history.functions-CAK4YTJt.js";
import { useEffect } from "react";
import { HeadContent, Link, Outlet, Scripts, createFileRoute, createRootRouteWithContext, createRouter, lazyRouteComponent, notFound, redirect, useRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { createClient } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { createTanStackInvokeToolHandler, createTanStackListToolsHandler, createTanStackMcpHandler, createTanStackOAuthProtectedResourceMetadataHandler } from "@lovable.dev/mcp-js/stacks/tanstack";
import { auth, defineMcp, defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
//#region src/styles.css?url
var styles_default = "/assets/styles-Cn5VINOv.css";
//#endregion
//#region src/components/ui/sonner.tsx
var Toaster$1 = ({ ...props }) => {
	return /* @__PURE__ */ jsx(Toaster, {
		className: "toaster group",
		toastOptions: { classNames: {
			toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
			description: "group-[.toast]:text-muted-foreground",
			actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
			cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
		} },
		...props
	});
};
//#endregion
//#region src/lib/lovable-error-reporting.ts
function reportLovableError(error, context = {}) {
	if (typeof window === "undefined") return;
	window.__lovableEvents?.captureException?.(error, {
		source: "react_error_boundary",
		route: window.location.pathname,
		...context
	}, {
		mechanism: "react_error_boundary",
		handled: false,
		severity: "error"
	});
}
function NotFoundComponent() {
	return /* @__PURE__ */ jsx("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ jsxs("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ jsx("h1", {
					className: "text-7xl font-bold text-foreground",
					children: "404"
				}),
				/* @__PURE__ */ jsx("h2", {
					className: "mt-4 text-xl font-semibold text-foreground",
					children: "Page not found"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "The page you're looking for doesn't exist or has been moved."
				}),
				/* @__PURE__ */ jsx("div", {
					className: "mt-6",
					children: /* @__PURE__ */ jsx(Link, {
						to: "/",
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Go home"
					})
				})
			]
		})
	});
}
function ErrorComponent({ error, reset }) {
	console.error(error);
	const router = useRouter();
	useEffect(() => {
		reportLovableError(error, { boundary: "tanstack_root_error_component" });
	}, [error]);
	return /* @__PURE__ */ jsx("div", {
		className: "flex min-h-screen items-center justify-center bg-background px-4",
		children: /* @__PURE__ */ jsxs("div", {
			className: "max-w-md text-center",
			children: [
				/* @__PURE__ */ jsx("h1", {
					className: "text-xl font-semibold tracking-tight text-foreground",
					children: "This page didn't load"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Something went wrong on our end. You can try refreshing or head back home."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-6 flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ jsx("button", {
						onClick: () => {
							router.invalidate();
							reset();
						},
						className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
						children: "Try again"
					}), /* @__PURE__ */ jsx("a", {
						href: "/",
						className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
						children: "Go home"
					})]
				})
			]
		})
	});
}
var Route$48 = createRootRouteWithContext()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: "MyDox — Real-time care, on demand" },
			{
				name: "description",
				content: "Book doctors, dispatch hubs and see live care requests around you — powered by MyDox."
			},
			{
				property: "og:title",
				content: "MyDox — Real-time care, on demand"
			},
			{
				property: "og:description",
				content: "Real-time care marketplace connecting patients, providers, hubs and hospitals."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			},
			{
				name: "twitter:title",
				content: "MyDox — Real-time care, on demand"
			},
			{
				name: "description",
				content: "MyDox connects patients, doctors, hubs and hospitals in real time — book care, dispatch responders, and see everything live."
			},
			{
				property: "og:description",
				content: "MyDox connects patients, doctors, hubs and hospitals in real time — book care, dispatch responders, and see everything live."
			},
			{
				name: "twitter:description",
				content: "MyDox connects patients, doctors, hubs and hospitals in real time — book care, dispatch responders, and see everything live."
			},
			{
				property: "og:image",
				content: "/icon-512.png"
			},
			{
				name: "twitter:image",
				content: "/icon-512.png"
			},
			{
				name: "theme-color",
				content: "#0D9488"
			},
			{
				name: "mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-capable",
				content: "yes"
			},
			{
				name: "apple-mobile-web-app-status-bar-style",
				content: "default"
			},
			{
				name: "apple-mobile-web-app-title",
				content: "MyDox"
			}
		],
		links: [
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "icon",
				type: "image/png",
				href: "/icon-512.png"
			},
			{
				rel: "apple-touch-icon",
				href: "/icon-512.png"
			},
			{
				rel: "manifest",
				href: "/manifest.webmanifest"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap"
			}
		]
	}),
	shellComponent: RootShell,
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
	errorComponent: ErrorComponent
});
function RootShell({ children }) {
	return /* @__PURE__ */ jsxs("html", {
		lang: "en",
		children: [/* @__PURE__ */ jsx("head", { children: /* @__PURE__ */ jsx(HeadContent, {}) }), /* @__PURE__ */ jsxs("body", { children: [children, /* @__PURE__ */ jsx(Scripts, {})] })]
	});
}
function RootComponent() {
	const { queryClient } = Route$48.useRouteContext();
	return /* @__PURE__ */ jsxs(QueryClientProvider, {
		client: queryClient,
		children: [/* @__PURE__ */ jsx(Outlet, {}), /* @__PURE__ */ jsx(Toaster$1, {})]
	});
}
//#endregion
//#region src/routes/index.tsx
var $$splitComponentImporter$40 = () => import("./routes-BL-I9dwv.js");
var Route$47 = createFileRoute("/")({
	head: () => ({
		links: [{
			rel: "stylesheet",
			href: "/design/stitch/fonts.css"
		}],
		meta: [
			{ title: "MyDox — Real-time care, on demand" },
			{
				name: "description",
				content: "MyDox connects patients, doctors, hubs and hospitals in real time — book care, dispatch responders, and see everything live."
			},
			{
				property: "og:title",
				content: "MyDox — Real-time care, on demand"
			},
			{
				property: "og:description",
				content: "MyDox connects patients, doctors, hubs and hospitals in real time."
			},
			{
				property: "og:type",
				content: "website"
			},
			{
				name: "twitter:card",
				content: "summary_large_image"
			}
		]
	}),
	component: lazyRouteComponent($$splitComponentImporter$40, "component"),
	ssr: false
});
//#endregion
//#region src/routes/auth.tsx
var $$splitComponentImporter$39 = () => import("./auth-Cq3r1qvF.js");
var Route$46 = createFileRoute("/auth")({
	validateSearch: (s) => ({
		admin: s.admin === "1" || s.admin === 1 ? "1" : void 0,
		next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : void 0
	}),
	head: () => ({ meta: [
		{ title: "Sign in — MyDox" },
		{
			name: "description",
			content: "Sign in or create your MyDox account."
		},
		{
			property: "og:title",
			content: "Sign in — MyDox"
		},
		{
			property: "og:description",
			content: "Securely access your MyDox care workspace."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$39, "component")
});
//#endregion
//#region src/routes/bookings.tsx
var $$splitComponentImporter$38 = () => import("./bookings-BmkYxRrF.js");
var Route$45 = createFileRoute("/bookings")({
	head: () => ({ meta: [
		{ title: "My Bookings — MyDox" },
		{
			name: "description",
			content: "Unified timeline of all your MyDox bookings — doctors, nurses, labs, scans, surgery, care programs, prosthetics, special needs and blood bank."
		},
		{
			property: "og:title",
			content: "My Bookings — MyDox"
		},
		{
			property: "og:description",
			content: "View care, program and hospital staffing activity in one MyDox timeline."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$38, "component"),
	ssr: false
});
//#endregion
//#region src/routes/care-booking.tsx
var $$splitComponentImporter$37 = () => import("./care-booking-D-96R7eW.js");
var Route$44 = createFileRoute("/care-booking")({
	head: () => ({ meta: [
		{ title: "Book Trusted Care — MedConnect" },
		{
			name: "description",
			content: "Book a nurse, medical technician, care physician, or hospital and follow live matching and service updates."
		},
		{
			property: "og:title",
			content: "Book Trusted Care — MedConnect"
		},
		{
			property: "og:description",
			content: "Book verified care professionals and track matching, arrival, completion, and ratings live."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$37, "component"),
	ssr: false
});
//#endregion
//#region src/routes/design-preview.tsx
var $$splitComponentImporter$36 = () => import("./design-preview-C64mN_df.js");
var Route$43 = createFileRoute("/design-preview")({
	head: () => ({ meta: [{ title: "MyDox · Interactive design preview" }, {
		name: "robots",
		content: "noindex, nofollow"
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$36, "component")
});
//#endregion
//#region src/routes/home-visits.tsx
var $$splitComponentImporter$35 = () => import("./home-visits-C6XyJDs5.js");
var Route$42 = createFileRoute("/home-visits")({
	ssr: false,
	head: () => ({ meta: [{ title: "Doctor home visits — MyDox" }] }),
	beforeLoad: async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) throw redirect({
			to: "/auth",
			search: {
				next: "/home-visits",
				admin: void 0
			}
		});
	},
	component: lazyRouteComponent($$splitComponentImporter$35, "component")
});
//#endregion
//#region src/routes/map.tsx
var $$splitComponentImporter$34 = () => import("./map-wYyVQVha.js");
var Route$41 = createFileRoute("/map")({
	head: () => ({ meta: [
		{ title: "Live Map — MyDox" },
		{
			name: "description",
			content: "See providers and open care requests around you in real time."
		},
		{
			property: "og:title",
			content: "Live Map — MyDox"
		},
		{
			property: "og:description",
			content: "See providers and open care requests around you in real time."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$34, "component"),
	ssr: false
});
//#endregion
//#region src/routes/matching.tsx
var $$splitComponentImporter$33 = () => import("./matching-BTSLot-V.js");
var Route$40 = createFileRoute("/matching")({
	head: () => ({ meta: [
		{ title: "Live Matching Dashboard — MedConnect" },
		{
			name: "description",
			content: "Follow care requests, offers, assignments and job status live for patients, nurses, technicians, physiotherapists and ambulance crews."
		},
		{
			property: "og:title",
			content: "Live Matching Dashboard — MedConnect"
		},
		{
			property: "og:description",
			content: "Live offers, assignments and service status in one place."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$33, "component"),
	ssr: false
});
//#endregion
//#region src/lib/mcp/tools/list-my-bookings.ts
function sb$2(ctx) {
	return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
		global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}
var list_my_bookings_default = defineTool({
	name: "list_my_bookings",
	title: "List my bookings",
	description: "List the signed-in user's care requests (doctor/nurse/lab/scan/etc.), newest first.",
	inputSchema: {
		limit: z.number().int().min(1).max(50).optional().describe("Max rows to return. Default 20."),
		status: z.string().optional().describe("Optional status filter (e.g. 'pending', 'accepted', 'completed', 'cancelled').")
	},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	},
	handler: async ({ limit, status }, ctx) => {
		if (!ctx.isAuthenticated()) return {
			content: [{
				type: "text",
				text: "Not authenticated"
			}],
			isError: true
		};
		let q = sb$2(ctx).from("care_requests").select("id, specialty, status, created_at, scheduled_for, address, notes").eq("patient_id", ctx.getUserId()).order("created_at", { ascending: false }).limit(limit ?? 20);
		if (status) q = q.eq("status", status);
		const { data, error } = await q;
		if (error) return {
			content: [{
				type: "text",
				text: error.message
			}],
			isError: true
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify(data ?? [])
			}],
			structuredContent: { bookings: data ?? [] }
		};
	}
});
//#endregion
//#region src/lib/mcp/tools/get-my-profile.ts
function sb$1(ctx) {
	return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
		global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}
var get_my_profile_default = defineTool({
	name: "get_my_profile",
	title: "Get my profile",
	description: "Return the signed-in user's profile row from the app.",
	inputSchema: {},
	annotations: {
		readOnlyHint: true,
		idempotentHint: true,
		openWorldHint: false
	},
	handler: async (_input, ctx) => {
		if (!ctx.isAuthenticated()) return {
			content: [{
				type: "text",
				text: "Not authenticated"
			}],
			isError: true
		};
		const { data, error } = await sb$1(ctx).from("profiles").select("*").eq("id", ctx.getUserId()).maybeSingle();
		if (error) return {
			content: [{
				type: "text",
				text: error.message
			}],
			isError: true
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify({
					user_id: ctx.getUserId(),
					email: ctx.getUserEmail(),
					profile: data
				})
			}],
			structuredContent: {
				user_id: ctx.getUserId(),
				email: ctx.getUserEmail(),
				profile: data
			}
		};
	}
});
//#endregion
//#region src/lib/mcp/tools/create-care-request.ts
function sb(ctx) {
	return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
		global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}
var create_care_request_default = defineTool({
	name: "create_care_request",
	title: "Create care request",
	description: "Create a new care request (doctor, nurse, lab, scan, physio, technician, home-care) for the signed-in patient.",
	inputSchema: {
		specialty: z.string().min(1).describe("Specialty or service kind (e.g. 'doctor', 'nurse', 'lab')."),
		notes: z.string().max(2e3).optional().describe("Symptoms or notes for the provider."),
		address: z.string().max(500).optional().describe("Visit address, if home-visit."),
		scheduled_for: z.string().datetime().optional().describe("ISO timestamp for a planned booking; omit for urgent.")
	},
	annotations: {
		readOnlyHint: false,
		destructiveHint: false,
		openWorldHint: false
	},
	handler: async ({ specialty, notes, address, scheduled_for }, ctx) => {
		if (!ctx.isAuthenticated()) return {
			content: [{
				type: "text",
				text: "Not authenticated"
			}],
			isError: true
		};
		const { data, error } = await sb(ctx).from("care_requests").insert({
			patient_id: ctx.getUserId(),
			specialty,
			notes: notes ?? null,
			address: address ?? null,
			scheduled_for: scheduled_for ?? null,
			status: "pending"
		}).select().single();
		if (error) return {
			content: [{
				type: "text",
				text: error.message
			}],
			isError: true
		};
		return {
			content: [{
				type: "text",
				text: JSON.stringify(data)
			}],
			structuredContent: { booking: data }
		};
	}
});
var mcp_default = defineMcp({
	name: "mydox-mcp",
	title: "MyDox",
	version: "0.1.0",
	instructions: "MyDox tools for the signed-in user. Use `get_my_profile` and `list_my_bookings` to read, and `create_care_request` to book a doctor, nurse, lab, scan, physio or home-care visit.",
	auth: auth.oauth.issuer({
		issuer: `https://pyrlvjeectjikvfksukb.supabase.co/auth/v1`,
		acceptedAudiences: "authenticated"
	}),
	tools: [
		get_my_profile_default,
		list_my_bookings_default,
		create_care_request_default
	]
});
//#endregion
//#region src/routes/mcp.ts
var Route$39 = createFileRoute("/mcp")({ server: { handlers: { ANY: createTanStackMcpHandler(mcp_default, {
	resourcePath: "/mcp",
	metadataPath: "/.well-known/oauth-protected-resource",
	trustForwardedHost: true
}) } } });
//#endregion
//#region src/routes/nurse.tsx
var $$splitComponentImporter$32 = () => import("./nurse-CkutU6__.js");
var Route$38 = createFileRoute("/nurse")({
	head: () => ({ meta: [
		{ title: "Nurse Duty Home — MedConnect" },
		{
			name: "description",
			content: "Nurse portal: go online for duties, see today's shifts, upcoming and past jobs, and build a skills profile for ICU, OT, maternity, neonatal and home care work."
		},
		{
			property: "og:title",
			content: "Nurse Duty Home — MedConnect"
		},
		{
			property: "og:description",
			content: "Go online, pick up hospital shifts and home-care duties, and keep your nursing skills profile live."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$32, "component"),
	ssr: false
});
//#endregion
//#region src/routes/stitch-preview.tsx
var $$splitComponentImporter$31 = () => import("./stitch-preview-C1QkcLnM.js");
var Route$37 = createFileRoute("/stitch-preview")({
	head: () => ({
		meta: [{ title: "MyDox · Stitch design preview" }, {
			name: "robots",
			content: "noindex, nofollow"
		}],
		links: [{
			rel: "stylesheet",
			href: "/design/stitch/fonts.css"
		}]
	}),
	component: lazyRouteComponent($$splitComponentImporter$31, "component")
});
//#endregion
//#region src/routes/surgery.tsx
var $$splitComponentImporter$30 = () => import("./surgery-D-5gFGVe.js");
var Route$36 = createFileRoute("/surgery")({
	head: () => ({ meta: [{ title: "Surgery Planning — MyDox" }, {
		name: "description",
		content: "Coordinate multi-provider surgeries: surgeon, anaesthetist, OT technician, and more — booked together in one broadcast."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$30, "component"),
	ssr: false
});
//#endregion
//#region src/routes/technician.tsx
var $$splitComponentImporter$29 = () => import("./technician-CHzfYx2-.js");
var Route$35 = createFileRoute("/technician")({
	head: () => ({ meta: [
		{ title: "Technician Test Home — MedConnect" },
		{
			name: "description",
			content: "Technician portal: list the tests you can run — EMG, NCS, EEG, VEP, BERA, VNG, ECG, X-ray, audiometry — go online, and manage today's, upcoming and past test jobs with machine pickup from tie-up hubs."
		},
		{
			property: "og:title",
			content: "Technician Test Home — MedConnect"
		},
		{
			property: "og:description",
			content: "Pick your tests, go online and run home, clinic and hub test jobs with machine pickup guidance."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$29, "component"),
	ssr: false
});
//#endregion
//#region src/routes/[.mcp]/list-tools.ts
var Route$34 = createFileRoute("/.mcp/list-tools")({ server: { handlers: { ANY: createTanStackListToolsHandler(mcp_default, {
	resourcePath: "/mcp",
	metadataPath: "/.well-known/oauth-protected-resource",
	trustForwardedHost: true
}) } } });
//#endregion
//#region src/routes/[.well-known]/oauth-protected-resource.ts
var Route$33 = createFileRoute("/.well-known/oauth-protected-resource")({ server: { handlers: { ANY: createTanStackOAuthProtectedResourceMetadataHandler(mcp_default, {
	resourcePath: "/mcp",
	metadataPath: "/.well-known/oauth-protected-resource",
	trustForwardedHost: true
}) } } });
//#endregion
//#region src/routes/admin.index.tsx
var $$splitComponentImporter$28 = () => import("./admin.index-BGT5Z4DD.js");
var Route$32 = createFileRoute("/admin/")({
	head: () => ({ meta: [
		{ title: "Admin Console — MyDox" },
		{
			name: "description",
			content: "MyDox admin console: mental wellness analytics, care physician locum control room, live operations and user roles."
		},
		{
			property: "og:title",
			content: "Admin Console — MyDox"
		},
		{
			property: "og:description",
			content: "Wellness analytics, locum control room, live operations and user management in one place."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$28, "component")
});
//#endregion
//#region src/routes/admin.booking-operations.tsx
var $$splitComponentImporter$27 = () => import("./admin.booking-operations-CXV0xX94.js");
var Route$31 = createFileRoute("/admin/booking-operations")({
	head: () => ({ meta: [
		{ title: "Booking Operations — MedConnect" },
		{
			name: "description",
			content: "Set matching parameters, review offer history, and manage staff reliability across every care service."
		},
		{
			property: "og:title",
			content: "Booking Operations — MedConnect"
		},
		{
			property: "og:description",
			content: "Matching controls, offer history and staff reliability management."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$27, "component"),
	ssr: false
});
//#endregion
//#region src/routes/admin.credentials.tsx
var $$splitComponentImporter$26 = () => import("./admin.credentials-F3sl1GBc.js");
var Route$30 = createFileRoute("/admin/credentials")({
	head: () => ({ meta: [{ title: "Care Physician Verification — MyDox Admin" }, {
		name: "description",
		content: "Verify Care Physician registration before ICU and gated clinical duties are enabled."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$26, "component")
});
//#endregion
//#region src/routes/admin.emergency.tsx
var $$splitComponentImporter$25 = () => import("./admin.emergency-jInDVBqH.js");
var Route$29 = createFileRoute("/admin/emergency")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$25, "component")
});
//#endregion
//#region src/routes/admin.homecare.tsx
var $$splitComponentImporter$24 = () => import("./admin.homecare-6zjvmeK8.js");
var Route$28 = createFileRoute("/admin/homecare")({
	head: () => ({ meta: [
		{ title: "Home Care Board — Physiotherapy & Visiting Doctors" },
		{
			name: "description",
			content: "Monitor home physiotherapy positions, visiting doctor bookings and who is available today."
		},
		{
			property: "og:title",
			content: "Home Care Board — Physiotherapy & Visiting Doctors"
		},
		{
			property: "og:description",
			content: "Monitor home physiotherapy positions, visiting doctor bookings and who is available today."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$24, "component")
});
//#endregion
//#region src/routes/admin.live.tsx
var $$splitComponentImporter$23 = () => import("./admin.live-KBRZYL0o.js");
var Route$27 = createFileRoute("/admin/live")({
	head: () => ({ meta: [{ title: "Live Admin — MyDox" }, {
		name: "description",
		content: "Real-time user, request and hub statistics."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$23, "component")
});
//#endregion
//#region src/routes/admin.locum.tsx
var $$splitComponentImporter$22 = () => import("./admin.locum-Ddl6xt3r.js");
var Route$26 = createFileRoute("/admin/locum")({
	head: () => ({ meta: [
		{ title: "Locum Control Room — MyDox Admin" },
		{
			name: "description",
			content: "Control room for care physician locum duties: ward and ICU cover, attendance, hospital demand hotspots, fulfilment and hospital feedback."
		},
		{
			property: "og:title",
			content: "Locum Control Room — MyDox Admin"
		},
		{
			property: "og:description",
			content: "Live duty status, hospital demand hotspots, fulfilment rates and hospital ratings."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$22, "component")
});
//#endregion
//#region src/routes/admin.physician.tsx
var $$splitComponentImporter$21 = () => import("./admin.physician-B-N1EJ9L.js");
var Route$25 = createFileRoute("/admin/physician")({
	head: () => ({ meta: [
		{ title: "Care Physician Portal — MyDox" },
		{
			name: "description",
			content: "Care physician portal: log on-duty hours for hospital locum shifts, submit duty feedback and track your own reliability score."
		},
		{
			property: "og:title",
			content: "Care Physician Portal — MyDox"
		},
		{
			property: "og:description",
			content: "Log duty hours, review hospital feedback and see your reliability score."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$21, "component")
});
//#endregion
//#region src/routes/admin.physio.tsx
var $$splitComponentImporter$20 = () => import("./admin.physio-CSrf-yaC.js");
var Route$24 = createFileRoute("/admin/physio")({
	head: () => ({ meta: [
		{ title: "Home Physiotherapy Control Room — MyDox Admin" },
		{
			name: "description",
			content: "Monitor home physiotherapy visits by area and therapy type: neuro, orthopaedic, paediatric and geriatric cover, late or absent therapists, demand hotspots and patient feedback."
		},
		{
			property: "og:title",
			content: "Home Physiotherapy Control Room — MyDox Admin"
		},
		{
			property: "og:description",
			content: "Live home-visit board, therapy mix, area hotspots, therapist reliability and service quality ratings."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$20, "component")
});
//#endregion
//#region src/routes/admin.technician.tsx
var $$splitComponentImporter$19 = () => import("./admin.technician-BiPqYjih.js");
var Route$23 = createFileRoute("/admin/technician")({
	head: () => ({ meta: [
		{ title: "Technician Testing Control Room — MedConnect Admin" },
		{
			name: "description",
			content: "Monitor every technician-led test in one board: ECG, Holter, EEG, VNG, audiometry and spirometry — assignments, turnaround, reports, area demand and patient ratings."
		},
		{
			property: "og:title",
			content: "Technician Testing Control Room — MedConnect Admin"
		},
		{
			property: "og:description",
			content: "Live test board, technician reliability, report filing, area hotspots and patient feedback."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$19, "component")
});
//#endregion
//#region src/routes/admin.users.tsx
var $$splitComponentImporter$18 = () => import("./admin.users-DjBBXMlA.js");
var Route$22 = createFileRoute("/admin/users")({
	head: () => ({ meta: [{ title: "User Management — MyDox Admin" }, {
		name: "description",
		content: "Admin: manage all user accounts."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$18, "component")
});
//#endregion
//#region src/routes/admin.wellness.tsx
var $$splitComponentImporter$17 = () => import("./admin.wellness-BCOK-c0a.js");
var Route$21 = createFileRoute("/admin/wellness")({
	head: () => ({ meta: [
		{ title: "Wellness Console — MyDox Admin" },
		{
			name: "description",
			content: "Admin console for the mental wellness module: screening scores, provider performance, care-team SLA compliance and patient outcome trends."
		},
		{
			property: "og:title",
			content: "Wellness Console — MyDox Admin"
		},
		{
			property: "og:description",
			content: "Screening scores, provider performance, SLA compliance and patient trends."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$17, "component")
});
//#endregion
//#region src/routes/dev.race-accept.tsx
var Route$20 = createFileRoute("/dev/race-accept")({
	component: RaceAcceptTester,
	head: () => ({ meta: [{ title: "Race Accept Tester" }, {
		name: "robots",
		content: "noindex,nofollow"
	}] })
});
function RaceAcceptTester() {
	return /* @__PURE__ */ jsxs("main", {
		className: "mx-auto max-w-xl p-6",
		children: [/* @__PURE__ */ jsx("h1", {
			className: "text-xl font-bold",
			children: "Developer tool disabled"
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-2 text-sm text-slate-600",
			children: "Enable VITE_ENABLE_DEV_TOOLS=true only in a local development environment."
		})]
	});
}
//#endregion
//#region src/routes/emergency.ambulance.tsx
var $$splitComponentImporter$16 = () => import("./emergency.ambulance-Hih96CIa.js");
var Route$19 = createFileRoute("/emergency/ambulance")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$16, "component")
});
//#endregion
//#region src/routes/emergency.doctor.tsx
var $$splitComponentImporter$15 = () => import("./emergency.doctor-Cb-zDTJB.js");
var Route$18 = createFileRoute("/emergency/doctor")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$15, "component")
});
//#endregion
//#region src/routes/emergency.hospital.tsx
var $$splitComponentImporter$14 = () => import("./emergency.hospital-BuF82myH.js");
var Route$17 = createFileRoute("/emergency/hospital")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$14, "component")
});
//#endregion
//#region src/routes/emergency.patient.tsx
var $$splitComponentImporter$13 = () => import("./emergency.patient-Dv85MZPs.js");
var Route$16 = createFileRoute("/emergency/patient")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$13, "component")
});
//#endregion
//#region src/routes/hospital.nurse-duties.tsx
var $$splitComponentImporter$12 = () => import("./hospital.nurse-duties-xMddNUMz.js");
var Route$15 = createFileRoute("/hospital/nurse-duties")({
	head: () => ({ meta: [
		{ title: "Post Nurse Duties — MedConnect Hospital" },
		{
			name: "description",
			content: "Hospitals and clinics post ward, ICU, OT and maternity nurse duties on MedConnect and reach verified nurses nearby within minutes."
		},
		{
			property: "og:title",
			content: "Post Nurse Duties — MedConnect Hospital"
		},
		{
			property: "og:description",
			content: "Post a nurse duty and let MedConnect find verified nurses nearby automatically."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$12, "component"),
	ssr: false
});
//#endregion
//#region src/routes/nurse.book.tsx
var $$splitComponentImporter$11 = () => import("./nurse.book-BI36IdVr.js");
var Route$14 = createFileRoute("/nurse/book")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$11, "component")
});
//#endregion
//#region src/routes/nurse.visits.tsx
var $$splitComponentImporter$10 = () => import("./nurse.visits-D9mY4CNi.js");
var Route$13 = createFileRoute("/nurse/visits")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$10, "component")
});
//#endregion
//#region src/routes/nurses.find.tsx
var $$splitComponentImporter$9 = () => import("./nurses.find-JwSrlZqM.js");
var Route$12 = createFileRoute("/nurses/find")({
	head: () => ({ meta: [
		{ title: "Find a Nurse — MedConnect" },
		{
			name: "description",
			content: "Hospitals, clinics and families filter MedConnect nurses by ward skills, ICU and OT experience, shift, area and availability to find the right nurse for a duty."
		},
		{
			property: "og:title",
			content: "Find a Nurse — MedConnect"
		},
		{
			property: "og:description",
			content: "Filter nurses by ICU, OT scrub, maternity, neonatal and home-care skills, shift and area."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$9, "component"),
	ssr: false
});
//#endregion
//#region src/routes/physio.book.tsx
var $$splitComponentImporter$8 = () => import("./physio.book-CvYJKGkY.js");
var Route$11 = createFileRoute("/physio/book")({
	head: () => ({ meta: [
		{ title: "Book a Home Physiotherapy Session — MyDox" },
		{
			name: "description",
			content: "Book a home physiotherapy session: choose neuro, orthopaedic, sports or general therapy, pick a time and a verified therapist visits your home."
		},
		{
			property: "og:title",
			content: "Book a Home Physiotherapy Session — MyDox"
		},
		{
			property: "og:description",
			content: "Book a verified physiotherapist for a home visit at a time that suits you."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$8, "component"),
	ssr: false
});
//#endregion
//#region src/routes/physio.therapist.tsx
var $$splitComponentImporter$7 = () => import("./physio.therapist-DQCdj0cK.js");
var Route$10 = createFileRoute("/physio/therapist")({
	head: () => ({ meta: [
		{ title: "Physiotherapist Home — MedConnect" },
		{
			name: "description",
			content: "Physiotherapist portal: go online, see today's sessions, upcoming visits and past history, pick your preferred clinics and centres, and move sessions from on-the-way to completed."
		},
		{
			property: "og:title",
			content: "Physiotherapist Home — MedConnect"
		},
		{
			property: "og:description",
			content: "Go online, manage today's and future physiotherapy sessions and set your preferred centres."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$7, "component"),
	ssr: false
});
//#endregion
//#region src/routes/physio.visits.tsx
var $$splitComponentImporter$6 = () => import("./physio.visits--E-yhrcL.js");
var Route$9 = createFileRoute("/physio/visits")({
	head: () => ({ meta: [
		{ title: "My Physiotherapy Visits — MyDox" },
		{
			name: "description",
			content: "Track your booked home physiotherapy sessions: therapist arrival, check-in and check-out status, session history and feedback."
		},
		{
			property: "og:title",
			content: "My Physiotherapy Visits — MyDox"
		},
		{
			property: "og:description",
			content: "See your home physiotherapy sessions, therapist check-in status and rate completed visits."
		},
		{
			property: "og:type",
			content: "website"
		},
		{
			name: "twitter:card",
			content: "summary"
		}
	] }),
	component: lazyRouteComponent($$splitComponentImporter$6, "component"),
	ssr: false
});
//#endregion
//#region src/routes/provider.availability.tsx
var $$splitComponentImporter$5 = () => import("./provider.availability-Bu1pAsbu.js");
var Route$8 = createFileRoute("/provider/availability")({
	head: () => ({ meta: [{ title: "Availability — MyDox Provider" }, {
		name: "description",
		content: "Set your working hours, block dates and toggle services on/off. Dispatch respects your settings in real time."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
//#endregion
//#region src/routes/provider.earnings.tsx
var $$splitComponentImporter$4 = () => import("./provider.earnings-BJ84QsrS.js");
var Route$7 = createFileRoute("/provider/earnings")({
	head: () => ({ meta: [{ title: "Provider Earnings — MyDox" }, {
		name: "description",
		content: "Track your earnings, completed jobs, acceptance rate, ratings and pending payouts."
	}] }),
	component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
//#endregion
//#region src/routes/technician.book.tsx
var $$splitComponentImporter$3 = () => import("./technician.book-DjXy3tkW.js");
var Route$6 = createFileRoute("/technician/book")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
//#endregion
//#region src/routes/technician.visits.tsx
var $$splitComponentImporter$2 = () => import("./technician.visits-Cn4Kei-l.js");
var Route$5 = createFileRoute("/technician/visits")({
	ssr: false,
	component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
//#endregion
//#region src/routes/[.]lovable.oauth.consent.tsx?tsr-shared=1
var oauth = () => supabase.auth.oauth;
//#endregion
//#region src/routes/[.]lovable.oauth.consent.tsx
var $$splitErrorComponentImporter$1 = () => import("./_._lovable.oauth.consent-cIvchVOT.js");
var $$splitComponentImporter$1 = () => import("./_._lovable.oauth.consent-BWH2891p.js");
var Route$4 = createFileRoute("/.lovable/oauth/consent")({
	ssr: false,
	validateSearch: (s) => ({ authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "" }),
	beforeLoad: async ({ search, location }) => {
		if (!search.authorization_id) throw new Error("Missing authorization_id");
		const { data } = await supabase.auth.getSession();
		const next = location.pathname + location.searchStr;
		if (!data.session) throw redirect({
			to: "/auth",
			search: {
				next,
				admin: void 0
			}
		});
	},
	loader: async ({ location }) => {
		const authorizationId = new URLSearchParams(location.search).get("authorization_id");
		const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
		if (error) throw error;
		const immediate = data?.redirect_url ?? data?.redirect_to;
		if (immediate && !data?.client) throw redirect({ href: immediate });
		return data;
	},
	component: lazyRouteComponent($$splitComponentImporter$1, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter$1, "errorComponent")
});
//#endregion
//#region src/routes/[.mcp]/invoke-tool/$tool.ts
var Route$3 = createFileRoute("/.mcp/invoke-tool/$tool")({ server: { handlers: { ANY: createTanStackInvokeToolHandler(mcp_default, {
	resourcePath: "/mcp",
	metadataPath: "/.well-known/oauth-protected-resource",
	trustForwardedHost: true
}) } } });
//#endregion
//#region src/routes/shared.ai.$token.tsx
var $$splitComponentImporter = () => import("./shared.ai._token-CuJEaywd.js");
var $$splitNotFoundComponentImporter = () => import("./shared.ai._token-gn_A4ve3.js");
var $$splitErrorComponentImporter = () => import("./shared.ai._token-C3cULr76.js");
var Route$2 = createFileRoute("/shared/ai/$token")({
	loader: async ({ params }) => {
		try {
			return await getSharedAiHistory({ data: { token: params.token } });
		} catch {
			throw notFound();
		}
	},
	head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? "Shared AI summary"} — MyDox` }, {
		name: "description",
		content: "A shared AI summary from MyDox."
	}] }),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent"),
	notFoundComponent: lazyRouteComponent($$splitNotFoundComponentImporter, "notFoundComponent"),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
//#region src/routes/api/internal/home-visits/jobs.ts
var response = (body, status = 200) => new Response(JSON.stringify(body), {
	status,
	headers: {
		"content-type": "application/json",
		"cache-control": "no-store"
	}
});
var Route$1 = createFileRoute("/api/internal/home-visits/jobs")({ server: { handlers: { POST: async ({ request }) => {
	const expected = process.env.HOME_VISIT_JOB_SECRET;
	if (!expected || expected.length < 32) return response({ error: "Home-visit jobs are not configured" }, 503);
	const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
	const a = Buffer.from(supplied);
	const b = Buffer.from(expected);
	if (a.length !== b.length || !timingSafeEqual(a, b)) return response({ error: "Unauthorized" }, 401);
	try {
		const { runHomeVisitJobs } = await import("./home-visits-jobs.server-BTKLJF5C.js");
		return response(await runHomeVisitJobs());
	} catch {
		return response({ error: "Home-visit jobs failed; retry is safe" }, 503);
	}
} } } });
//#endregion
//#region src/routes/api/public/push/dispatch.ts
function timingSafeEqual$1(a, b) {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
var json = (payload, status = 200) => new Response(JSON.stringify(payload), {
	status,
	headers: {
		"content-type": "application/json",
		"cache-control": "no-store"
	}
});
var Route = createFileRoute("/api/public/push/dispatch")({ server: { handlers: { POST: async ({ request }) => {
	const secret = process.env["PUSH_DISPATCH_SECRET"];
	if (!secret) return json({ error: "dispatch not configured" }, 503);
	const provided = request.headers.get("x-push-secret") ?? "";
	if (!provided || !timingSafeEqual$1(provided, secret)) return json({ error: "unauthorized" }, 401);
	let payload;
	try {
		payload = await request.json();
	} catch {
		return json({ error: "invalid JSON body" }, 400);
	}
	const userIds = Array.isArray(payload.user_ids) ? payload.user_ids.filter((id) => typeof id === "string" && id.length > 0) : [];
	const title = typeof payload.title === "string" ? payload.title.trim() : "";
	const body = typeof payload.body === "string" ? payload.body.trim() : "";
	if (userIds.length === 0 || userIds.length > 500) return json({ error: "user_ids must contain 1-500 ids" }, 400);
	if (!title || title.length > 200) return json({ error: "title required (<=200)" }, 400);
	if (!body || body.length > 1e3) return json({ error: "body required (<=1000)" }, 400);
	const rawData = payload.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : {};
	const data = {};
	for (const [k, v] of Object.entries(rawData).slice(0, 20)) data[k] = typeof v === "string" ? v.slice(0, 500) : String(v).slice(0, 500);
	try {
		const { dispatchPush } = await import("./push.server-DUikjrTP.js");
		return json({
			ok: true,
			...await dispatchPush(userIds, {
				title,
				body,
				data,
				topic: typeof payload.topic === "string" ? payload.topic.slice(0, 100) : null
			})
		});
	} catch (e) {
		console.error("[push/dispatch]", e);
		return json({ error: "dispatch failed" }, 500);
	}
} } } });
//#endregion
//#region src/routeTree.gen.ts
var IndexRoute = Route$47.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$48
});
var AuthRoute = Route$46.update({
	id: "/auth",
	path: "/auth",
	getParentRoute: () => Route$48
});
var BookingsRoute = Route$45.update({
	id: "/bookings",
	path: "/bookings",
	getParentRoute: () => Route$48
});
var CareBookingRoute = Route$44.update({
	id: "/care-booking",
	path: "/care-booking",
	getParentRoute: () => Route$48
});
var DesignPreviewRoute = Route$43.update({
	id: "/design-preview",
	path: "/design-preview",
	getParentRoute: () => Route$48
});
var HomeVisitsRoute = Route$42.update({
	id: "/home-visits",
	path: "/home-visits",
	getParentRoute: () => Route$48
});
var MapRoute = Route$41.update({
	id: "/map",
	path: "/map",
	getParentRoute: () => Route$48
});
var MatchingRoute = Route$40.update({
	id: "/matching",
	path: "/matching",
	getParentRoute: () => Route$48
});
var McpRoute = Route$39.update({
	id: "/mcp",
	path: "/mcp",
	getParentRoute: () => Route$48
});
var NurseRoute = Route$38.update({
	id: "/nurse",
	path: "/nurse",
	getParentRoute: () => Route$48
});
var StitchPreviewRoute = Route$37.update({
	id: "/stitch-preview",
	path: "/stitch-preview",
	getParentRoute: () => Route$48
});
var SurgeryRoute = Route$36.update({
	id: "/surgery",
	path: "/surgery",
	getParentRoute: () => Route$48
});
var TechnicianRoute = Route$35.update({
	id: "/technician",
	path: "/technician",
	getParentRoute: () => Route$48
});
var Char91DotmcpChar93ListToolsRoute = Route$34.update({
	id: "/.mcp/list-tools",
	path: "/.mcp/list-tools",
	getParentRoute: () => Route$48
});
var Char91DotwellKnownChar93OauthProtectedResourceRoute = Route$33.update({
	id: "/.well-known/oauth-protected-resource",
	path: "/.well-known/oauth-protected-resource",
	getParentRoute: () => Route$48
});
var AdminIndexRoute = Route$32.update({
	id: "/admin/",
	path: "/admin/",
	getParentRoute: () => Route$48
});
var AdminBookingOperationsRoute = Route$31.update({
	id: "/admin/booking-operations",
	path: "/admin/booking-operations",
	getParentRoute: () => Route$48
});
var AdminCredentialsRoute = Route$30.update({
	id: "/admin/credentials",
	path: "/admin/credentials",
	getParentRoute: () => Route$48
});
var AdminEmergencyRoute = Route$29.update({
	id: "/admin/emergency",
	path: "/admin/emergency",
	getParentRoute: () => Route$48
});
var AdminHomecareRoute = Route$28.update({
	id: "/admin/homecare",
	path: "/admin/homecare",
	getParentRoute: () => Route$48
});
var AdminLiveRoute = Route$27.update({
	id: "/admin/live",
	path: "/admin/live",
	getParentRoute: () => Route$48
});
var AdminLocumRoute = Route$26.update({
	id: "/admin/locum",
	path: "/admin/locum",
	getParentRoute: () => Route$48
});
var AdminPhysicianRoute = Route$25.update({
	id: "/admin/physician",
	path: "/admin/physician",
	getParentRoute: () => Route$48
});
var AdminPhysioRoute = Route$24.update({
	id: "/admin/physio",
	path: "/admin/physio",
	getParentRoute: () => Route$48
});
var AdminTechnicianRoute = Route$23.update({
	id: "/admin/technician",
	path: "/admin/technician",
	getParentRoute: () => Route$48
});
var AdminUsersRoute = Route$22.update({
	id: "/admin/users",
	path: "/admin/users",
	getParentRoute: () => Route$48
});
var AdminWellnessRoute = Route$21.update({
	id: "/admin/wellness",
	path: "/admin/wellness",
	getParentRoute: () => Route$48
});
var DevRaceAcceptRoute = Route$20.update({
	id: "/dev/race-accept",
	path: "/dev/race-accept",
	getParentRoute: () => Route$48
});
var EmergencyAmbulanceRoute = Route$19.update({
	id: "/emergency/ambulance",
	path: "/emergency/ambulance",
	getParentRoute: () => Route$48
});
var EmergencyDoctorRoute = Route$18.update({
	id: "/emergency/doctor",
	path: "/emergency/doctor",
	getParentRoute: () => Route$48
});
var EmergencyHospitalRoute = Route$17.update({
	id: "/emergency/hospital",
	path: "/emergency/hospital",
	getParentRoute: () => Route$48
});
var EmergencyPatientRoute = Route$16.update({
	id: "/emergency/patient",
	path: "/emergency/patient",
	getParentRoute: () => Route$48
});
var HospitalNurseDutiesRoute = Route$15.update({
	id: "/hospital/nurse-duties",
	path: "/hospital/nurse-duties",
	getParentRoute: () => Route$48
});
var NurseBookRoute = Route$14.update({
	id: "/book",
	path: "/book",
	getParentRoute: () => NurseRoute
});
var NurseVisitsRoute = Route$13.update({
	id: "/visits",
	path: "/visits",
	getParentRoute: () => NurseRoute
});
var NursesFindRoute = Route$12.update({
	id: "/nurses/find",
	path: "/nurses/find",
	getParentRoute: () => Route$48
});
var PhysioBookRoute = Route$11.update({
	id: "/physio/book",
	path: "/physio/book",
	getParentRoute: () => Route$48
});
var PhysioTherapistRoute = Route$10.update({
	id: "/physio/therapist",
	path: "/physio/therapist",
	getParentRoute: () => Route$48
});
var PhysioVisitsRoute = Route$9.update({
	id: "/physio/visits",
	path: "/physio/visits",
	getParentRoute: () => Route$48
});
var ProviderAvailabilityRoute = Route$8.update({
	id: "/provider/availability",
	path: "/provider/availability",
	getParentRoute: () => Route$48
});
var ProviderEarningsRoute = Route$7.update({
	id: "/provider/earnings",
	path: "/provider/earnings",
	getParentRoute: () => Route$48
});
var TechnicianBookRoute = Route$6.update({
	id: "/book",
	path: "/book",
	getParentRoute: () => TechnicianRoute
});
var TechnicianVisitsRoute = Route$5.update({
	id: "/visits",
	path: "/visits",
	getParentRoute: () => TechnicianRoute
});
var DotlovableOauthConsentRoute = Route$4.update({
	id: "/.lovable/oauth/consent",
	path: "/.lovable/oauth/consent",
	getParentRoute: () => Route$48
});
var Char91DotmcpChar93InvokeToolToolRoute = Route$3.update({
	id: "/.mcp/invoke-tool/$tool",
	path: "/.mcp/invoke-tool/$tool",
	getParentRoute: () => Route$48
});
var SharedAiTokenRoute = Route$2.update({
	id: "/shared/ai/$token",
	path: "/shared/ai/$token",
	getParentRoute: () => Route$48
});
var ApiInternalHomeVisitsJobsRoute = Route$1.update({
	id: "/api/internal/home-visits/jobs",
	path: "/api/internal/home-visits/jobs",
	getParentRoute: () => Route$48
});
var ApiPublicPushDispatchRoute = Route.update({
	id: "/api/public/push/dispatch",
	path: "/api/public/push/dispatch",
	getParentRoute: () => Route$48
});
var NurseRouteChildren = {
	NurseBookRoute,
	NurseVisitsRoute
};
var NurseRouteWithChildren = NurseRoute._addFileChildren(NurseRouteChildren);
var TechnicianRouteChildren = {
	TechnicianBookRoute,
	TechnicianVisitsRoute
};
var rootRouteChildren = {
	IndexRoute,
	AuthRoute,
	BookingsRoute,
	CareBookingRoute,
	DesignPreviewRoute,
	HomeVisitsRoute,
	MapRoute,
	MatchingRoute,
	McpRoute,
	NurseRoute: NurseRouteWithChildren,
	StitchPreviewRoute,
	SurgeryRoute,
	TechnicianRoute: TechnicianRoute._addFileChildren(TechnicianRouteChildren),
	Char91DotmcpChar93ListToolsRoute,
	Char91DotwellKnownChar93OauthProtectedResourceRoute,
	AdminBookingOperationsRoute,
	AdminCredentialsRoute,
	AdminEmergencyRoute,
	AdminHomecareRoute,
	AdminLiveRoute,
	AdminLocumRoute,
	AdminPhysicianRoute,
	AdminPhysioRoute,
	AdminTechnicianRoute,
	AdminUsersRoute,
	AdminWellnessRoute,
	DevRaceAcceptRoute,
	EmergencyAmbulanceRoute,
	EmergencyDoctorRoute,
	EmergencyHospitalRoute,
	EmergencyPatientRoute,
	HospitalNurseDutiesRoute,
	NursesFindRoute,
	PhysioBookRoute,
	PhysioTherapistRoute,
	PhysioVisitsRoute,
	ProviderAvailabilityRoute,
	ProviderEarningsRoute,
	AdminIndexRoute,
	DotlovableOauthConsentRoute,
	Char91DotmcpChar93InvokeToolToolRoute,
	SharedAiTokenRoute,
	ApiInternalHomeVisitsJobsRoute,
	ApiPublicPushDispatchRoute
};
var routeTree = Route$48._addFileChildren(rootRouteChildren)._addFileTypes();
//#endregion
//#region src/router.tsx
var router_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var getRouter = () => {
	const queryClient = new QueryClient();
	return createRouter({
		routeTree,
		context: { queryClient },
		scrollRestoration: true,
		defaultPreloadStaleTime: 0
	});
};
//#endregion
export { Route$46 as a, getRouter, oauth as i, Route$2 as n, Route$4 as r, router_exports as t };
