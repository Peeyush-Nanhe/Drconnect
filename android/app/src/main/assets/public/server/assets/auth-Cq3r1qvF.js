import { n as supabase } from "./client-BSmVQfT1.js";
import { a as Route } from "./router-BtcF1NH_.js";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { ShieldCheck } from "lucide-react";
//#region src/features/medconnect/demo-accounts.ts
var PW = "CareDemo!2026";
var DEMO_ACCOUNTS = [
	{
		label: "Patient 1",
		email: "patient1@demo.med",
		password: PW,
		name: "Priya Sharma",
		role: "patient",
		view: "patient",
		group: "Patients"
	},
	{
		label: "Patient 2",
		email: "patient2@demo.med",
		password: PW,
		name: "Rahul Verma",
		role: "patient",
		view: "patient",
		group: "Patients"
	},
	{
		label: "Medico 1",
		email: "medico1@demo.med",
		password: PW,
		name: "Dr. Anita Rao",
		role: "provider",
		view: "medico",
		group: "Doctors & care teams",
		specialty: "Cardiology"
	},
	{
		label: "Medico 2",
		email: "medico2@demo.med",
		password: PW,
		name: "Dr. Vikram Iyer",
		role: "provider",
		view: "medico",
		group: "Doctors & care teams",
		specialty: "Neurology"
	},
	{
		label: "Dr. Rahul Nair",
		email: "rahul.nair@demo.med",
		password: PW,
		name: "Dr. Rahul Nair",
		role: "provider",
		view: "medico",
		group: "Doctors & care teams",
		specialty: "General Physician"
	},
	{
		label: "Care Physician",
		email: "carephysician@demo.med",
		password: PW,
		name: "Dr. Suresh Menon",
		role: "provider",
		view: "care_physician",
		group: "Doctors & care teams",
		specialty: "General Physician"
	},
	{
		label: "Coordinator",
		email: "coordinator@demo.med",
		password: PW,
		name: "Care Coordinator Meera",
		role: "provider",
		view: "coordinator",
		group: "Doctors & care teams"
	},
	{
		label: "Seva 1",
		email: "seva1@demo.med",
		password: PW,
		name: "Seva Care Team Alpha",
		role: "provider",
		view: "seva",
		group: "Doctors & care teams"
	},
	{
		label: "Seva 2",
		email: "seva2@demo.med",
		password: PW,
		name: "Seva Care Team Beta",
		role: "provider",
		view: "seva",
		group: "Doctors & care teams"
	},
	{
		label: "Hub 1",
		email: "hub1@demo.med",
		password: PW,
		name: "Koregaon Park Hub",
		role: "facility",
		view: "hub",
		group: "Hospitals & centres"
	},
	{
		label: "Hub 2",
		email: "hub2@demo.med",
		password: PW,
		name: "Santacruz Hub",
		role: "facility",
		view: "hub",
		group: "Hospitals & centres"
	},
	{
		label: "Scan 1",
		email: "scan1@demo.med",
		password: PW,
		name: "CityScan Diagnostics Deccan",
		role: "facility",
		view: "diagnostic",
		group: "Hospitals & centres"
	},
	{
		label: "Scan 2",
		email: "scan2@demo.med",
		password: PW,
		name: "Metro Imaging Baner",
		role: "facility",
		view: "diagnostic",
		group: "Hospitals & centres"
	},
	{
		label: "Labs 1",
		email: "labs1@demo.med",
		password: PW,
		name: "Precision Labs Kothrud",
		role: "facility",
		view: "labs",
		group: "Hospitals & centres"
	},
	{
		label: "Labs 2",
		email: "labs2@demo.med",
		password: PW,
		name: "TruePath Labs Viman Nagar",
		role: "facility",
		view: "labs",
		group: "Hospitals & centres"
	},
	{
		label: "Pharmacy 1",
		email: "pharmacy1@demo.med",
		password: PW,
		name: "Wellness Pharmacy FC Road",
		role: "facility",
		view: "pharmacy",
		group: "Hospitals & centres"
	},
	{
		label: "Pharmacy 2",
		email: "pharmacy2@demo.med",
		password: PW,
		name: "CarePlus Chemist Aundh",
		role: "facility",
		view: "pharmacy",
		group: "Hospitals & centres"
	},
	{
		label: "Physiotherapist",
		email: "physio1@demo.med",
		password: PW,
		name: "Dr. Kavita Deshmukh",
		role: "provider",
		view: "physio_staff",
		group: "Nurses, physios & technicians",
		specialty: "Physiotherapy"
	},
	{
		label: "Nurse",
		email: "nurse1@demo.med",
		password: PW,
		name: "Sister Asha Pawar",
		role: "provider",
		view: "nurse",
		group: "Nurses, physios & technicians",
		specialty: "Nurse"
	},
	{
		label: "Technician",
		email: "tech1@demo.med",
		password: PW,
		name: "Rohit Kale (Tech)",
		role: "provider",
		view: "technician",
		group: "Nurses, physios & technicians"
	},
	{
		label: "Ambulance 1",
		email: "ambulance1@demo.med",
		password: PW,
		name: "Amb Unit A-101",
		role: "provider",
		view: "ambulance",
		group: "Ambulance"
	},
	{
		label: "Ambulance 2",
		email: "ambulance2@demo.med",
		password: PW,
		name: "Amb Unit A-207",
		role: "provider",
		view: "ambulance",
		group: "Ambulance"
	},
	{
		label: "Admin console",
		email: "admin.demo@careconnect.health",
		password: PW,
		name: "Ops Admin",
		role: "admin",
		view: "admin",
		group: "Admin"
	},
	{
		label: "Super admin",
		email: "superadmin.demo@careconnect.health",
		password: PW,
		name: "Super Admin",
		role: "super_admin",
		view: "admin",
		group: "Admin"
	}
];
Array.from(new Set(DEMO_ACCOUNTS.map((d) => d.group)));
//#endregion
//#region src/routes/auth.tsx?tsr-split=component
var ROLE_TO_VIEW = {
	patient: "patient",
	provider: "medico",
	facility: "hub",
	admin: "admin",
	super_admin: "admin"
};
var KIND_TO_ROLE = {
	patient: "patient",
	doctor: "provider",
	provider: "provider",
	facility: "facility",
	admin: "admin"
};
var SUBTYPES = {
	provider: [
		{
			view: "nurse",
			label: "Nurse",
			desc: "Home nursing & hospital duty shifts"
		},
		{
			view: "technician",
			label: "Diagnostic Technician",
			desc: "Sample collection & diagnostics"
		},
		{
			view: "physio_staff",
			label: "Physiotherapist",
			desc: "Rehabilitation & physio sessions"
		},
		{
			view: "ambulance",
			label: "Ambulance",
			desc: "Emergency transport crew"
		},
		{
			view: "seva",
			label: "Seva",
			desc: "Charitable and community care"
		},
		{
			view: "coordinator",
			label: "Health Coordinator",
			desc: "Patient cases, referrals and care navigation"
		},
		{
			view: "care_physician",
			label: "Care Physician / RMO",
			desc: "Hospital shifts, locum and full-time roles"
		},
		{
			view: "medico",
			label: "Other medico staff",
			desc: "Doctor, clinic, allied"
		}
	],
	facility: [
		{
			view: "hub",
			label: "Hospital / Hub",
			desc: "Beds, admissions, ER"
		},
		{
			view: "diagnostic",
			label: "Diagnostic centre",
			desc: "Imaging & scans"
		},
		{
			view: "pharmacy",
			label: "Pharmacy",
			desc: "Medicines & fulfilment"
		},
		{
			view: "labs",
			label: "Lab",
			desc: "Pathology & samples"
		}
	]
};
var DEMO_BUTTONS = [
	{
		label: "Patient 1",
		email: "patient1@demo.med",
		defaultPass: "CareDemo!2026",
		testNote: "One-Click Demo Patient Access"
	},
	{
		label: "Patient 2",
		email: "patient2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Medico 1 (Dr. Anita Rao - Cardiology)",
		email: "medico1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Medico 2 (Dr. Vikram Iyer - Neurology)",
		email: "medico2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Dr. Rahul Nair",
		email: "rahul.nair@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Nurse (Sister Asha)",
		email: "nurse1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Technician (Rohit Kale)",
		email: "tech1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Physio (Dr. Kavita Deshmukh - Physiotherapy)",
		email: "physio1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Hub 1",
		email: "hub1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Hub 2",
		email: "hub2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Scan 1",
		email: "scan1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Scan 2",
		email: "scan2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Ambulance 1",
		email: "ambulance1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Ambulance 2",
		email: "ambulance2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Pharmacy 1",
		email: "pharmacy1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Pharmacy 2",
		email: "pharmacy2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Labs 1",
		email: "labs1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Labs 2",
		email: "labs2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Seva 1",
		email: "seva1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Seva 2",
		email: "seva2@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Coordinator",
		email: "coordinator1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Care Physician",
		email: "carephysician1@demo.med",
		defaultPass: "CareDemo!2026"
	},
	{
		label: "Admin console",
		email: "admin.demo@careconnect.health",
		defaultPass: "CareDemo!2026",
		fallbackEmail: "admin1@demo.med",
		isAdmin: true
	},
	{
		label: "Super admin console",
		email: "superadmin.demo@careconnect.health",
		defaultPass: "CareDemo!2026",
		fallbackEmail: "admin2@demo.med",
		isAdmin: true
	}
];
function AuthPage() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const adminMode = search.admin === "1";
	const [mode, setMode] = useState("password");
	const [isSignup, setIsSignup] = useState(false);
	const [kind, setKind] = useState("patient");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [password, setPassword] = useState("");
	const [otp, setOtp] = useState("");
	const [otpSent, setOtpSent] = useState(false);
	const [busy, setBusy] = useState(false);
	const [msg, setMsg] = useState(null);
	const [pendingSubtype, setPendingSubtype] = useState(null);
	const role = KIND_TO_ROLE[kind];
	async function afterLogin(userId, viewOverride, nameOverride) {
		const [rolesRes, profileRes, authRes, requestRes] = await Promise.all([
			supabase.from("user_roles").select("role").eq("user_id", userId),
			supabase.from("profiles").select("full_name, view, specialty").eq("id", userId).maybeSingle(),
			supabase.auth.getUser(),
			supabase.from("account_role_requests").select("requested_role, requested_view, status").eq("user_id", userId).maybeSingle()
		]);
		const roles = (rolesRes.data ?? []).map((r) => r.role);
		const primary = [
			"super_admin",
			"admin",
			"facility",
			"provider",
			"patient"
		].find((r) => roles.includes(r)) ?? "patient";
		const fullName = nameOverride || profileRes.data?.full_name || name || email.split("@")[0] || "You";
		const metadata = authRes.data.user?.user_metadata ?? {};
		const storedSubtype = typeof metadata.subtype === "string" ? metadata.subtype : void 0;
		const request = requestRes.data;
		const providerViews = /* @__PURE__ */ new Set([
			"medico",
			"ambulance",
			"seva",
			"coordinator",
			"care_physician",
			"nurse",
			"technician",
			"physio_staff",
			"therapist",
			"diagnostic",
			"labs"
		]);
		const facilityViews = /* @__PURE__ */ new Set([
			"hub",
			"diagnostic",
			"pharmacy",
			"labs"
		]);
		const requestedView = viewOverride || storedSubtype || request?.requested_view || profileRes.data?.view || void 0;
		let derivedView = ROLE_TO_VIEW[primary];
		if (primary === "provider" && requestedView && providerViews.has(requestedView)) derivedView = requestedView;
		if (primary === "facility" && requestedView && facilityViews.has(requestedView)) derivedView = requestedView;
		if (derivedView === "nurse") {
			window.location.assign("/nurse");
			return;
		}
		if (derivedView === "technician") {
			window.location.assign("/technician");
			return;
		}
		if (typeof window !== "undefined") {
			localStorage.setItem("mc_view", derivedView);
			localStorage.setItem("mc_user_name", fullName);
			localStorage.setItem("mc_user_role", primary);
			localStorage.setItem("mc_profile_id", userId);
			if (profileRes.data?.specialty) localStorage.setItem("mc_user_specialty", profileRes.data.specialty);
			else localStorage.removeItem("mc_user_specialty");
		}
		if (primary === "patient" && request?.status === "pending") {
			if (!requestedView && (request.requested_role === "provider" || request.requested_role === "facility")) {
				setPendingSubtype({
					userId,
					kind: request.requested_role
				});
				return;
			}
			setPendingSubtype(null);
			setMsg(`Your ${request.requested_role} access request is pending administrator approval. You can still use the patient account meanwhile.`);
			return;
		}
		if (search.next) {
			window.location.assign(search.next);
			return;
		}
		if (derivedView === "nurse") {
			navigate({ to: "/nurse" });
			return;
		}
		if (derivedView === "technician") {
			navigate({ to: "/technician" });
			return;
		}
		if (derivedView === "physio_staff" || derivedView === "therapist") {
			navigate({ to: "/physio/therapist" });
			return;
		}
		navigate({ to: "/" });
	}
	async function handleSignupSuccess(userId, hasSession) {
		if (!hasSession) {
			setMsg("Account created. Confirm your email, then sign in. Provider/facility access will remain pending until administrator approval.");
			return;
		}
		if (kind === "provider" || kind === "facility") {
			setPendingSubtype({
				userId,
				kind
			});
			return;
		}
		await afterLogin(userId);
	}
	async function handleQuickDemoLogin(demoEmail, preferredPass = "CareDemo!2026", fallbackEmail) {
		setBusy(true);
		setMsg(null);
		const primaryEmail = fallbackEmail || demoEmail;
		const emails = Array.from(/* @__PURE__ */ new Set([primaryEmail, demoEmail]));
		const passwords = Array.from(/* @__PURE__ */ new Set([
			preferredPass,
			"CareDemo!2026",
			"demo123456"
		]));
		let lastError = null;
		for (const em of emails) for (const pwd of passwords) try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email: em,
				password: pwd
			});
			if (!error && data.user) {
				const isTherapist = demoEmail.toLowerCase().includes("therapist");
				const demoAccount = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === demoEmail.toLowerCase() || a.email.toLowerCase() === em.toLowerCase());
				const targetView = demoAccount?.view || (isTherapist ? "therapist" : void 0);
				const targetName = demoAccount?.name || (isTherapist ? "Therapist" : void 0);
				await afterLogin(data.user.id, targetView, targetName);
				return;
			}
			if (error) lastError = error;
		} catch (err) {
			lastError = err;
		}
		setMsg(lastError instanceof Error ? lastError.message : "Quick demo access failed.");
		setBusy(false);
	}
	async function submit(e) {
		e.preventDefault();
		setBusy(true);
		setMsg(null);
		try {
			if (mode === "password") {
				if (isSignup) {
					const { data, error } = await supabase.auth.signUp({
						email,
						password,
						options: {
							emailRedirectTo: window.location.origin,
							data: {
								full_name: name,
								role,
								kind,
								subtype: kind === "doctor" ? "medico" : void 0
							}
						}
					});
					if (error) throw error;
					if (data.user) await handleSignupSuccess(data.user.id, Boolean(data.session));
					else setMsg("Check your email to confirm your account.");
				} else {
					let targetEmail = email.trim();
					const normalizedEmail = targetEmail.toLowerCase();
					const isRahulNair = normalizedEmail === "rahul.nair@demo.med" || normalizedEmail === "therapist1@demo.med";
					const demoAccount = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === normalizedEmail);
					let { data, error } = await supabase.auth.signInWithPassword({
						email: targetEmail,
						password
					});
					if (error && (password === "demo123456" || password === "CareDemo!2026")) {
						const altPass = password === "demo123456" ? "CareDemo!2026" : "demo123456";
						const retry = await supabase.auth.signInWithPassword({
							email: targetEmail,
							password: altPass
						});
						if (!retry.error && retry.data) {
							data = retry.data;
							error = null;
						}
					}
					if (error && isRahulNair) {
						targetEmail = "medico1@demo.med";
						let retry = await supabase.auth.signInWithPassword({
							email: targetEmail,
							password
						});
						if (retry.error && (password === "demo123456" || password === "CareDemo!2026")) {
							const altPass = password === "demo123456" ? "CareDemo!2026" : "demo123456";
							retry = await supabase.auth.signInWithPassword({
								email: targetEmail,
								password: altPass
							});
						}
						if (!retry.error && retry.data) {
							data = retry.data;
							error = null;
						}
					}
					if (error) throw error;
					if (data?.user) {
						const targetView = demoAccount?.view || (isRahulNair ? "medico" : void 0);
						const targetName = demoAccount?.name || (isRahulNair ? "Dr. Rahul Nair" : void 0);
						await afterLogin(data.user.id, targetView, targetName);
					}
				}
			} else if (mode === "email-otp") {
				if (!otpSent) {
					const { error } = await supabase.auth.signInWithOtp({
						email,
						options: {
							shouldCreateUser: true,
							emailRedirectTo: window.location.origin,
							data: {
								full_name: name,
								role
							}
						}
					});
					if (error) throw error;
					setOtpSent(true);
					setMsg("6-digit code sent to your email.");
				} else {
					const { data, error } = await supabase.auth.verifyOtp({
						email,
						token: otp,
						type: "email"
					});
					if (error) throw error;
					if (data.user) await afterLogin(data.user.id);
				}
			} else if (!otpSent) {
				const { error } = await supabase.auth.signInWithOtp({
					phone,
					options: {
						shouldCreateUser: true,
						data: {
							full_name: name,
							role
						}
					}
				});
				if (error) throw error;
				setOtpSent(true);
				setMsg("SMS code sent to your phone.");
			} else {
				const { data, error } = await supabase.auth.verifyOtp({
					phone,
					token: otp,
					type: "sms"
				});
				if (error) throw error;
				if (data.user) await afterLogin(data.user.id);
			}
		} catch (err) {
			const m = err instanceof Error ? err.message : "Something went wrong.";
			if (mode === "phone-otp" && /sms|provider|twilio|msg91/i.test(m)) setMsg("Phone OTP is wired but no SMS provider is enabled yet. Add one in Cloud → Auth Settings → Phone to switch it on. Email OTP works right now.");
			else setMsg(m);
		} finally {
			setBusy(false);
		}
	}
	const tab = (k, label) => /* @__PURE__ */ jsx("button", {
		type: "button",
		onClick: () => {
			setMode(k);
			setOtpSent(false);
			setMsg(null);
		},
		className: `flex-1 rounded-full px-3 py-2 text-xs font-bold transition ${mode === k ? "bg-slate-900 text-white" : "text-slate-600"}`,
		children: label
	}, k);
	if (pendingSubtype) {
		const opts = SUBTYPES[pendingSubtype.kind];
		return /* @__PURE__ */ jsx("div", {
			className: "flex min-h-screen items-center justify-center px-4 py-10",
			style: {
				background: "#DCE6E1",
				fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
			},
			children: /* @__PURE__ */ jsxs("div", {
				className: "w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "mb-1 text-xs font-bold uppercase tracking-wider text-teal-700",
						children: "One last step"
					}),
					/* @__PURE__ */ jsxs("h1", {
						className: "mb-1 text-xl font-extrabold text-slate-900",
						children: [
							"What kind of ",
							pendingSubtype.kind,
							" are you?"
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mb-4 text-xs text-slate-500",
						children: "Pick the type that best matches you — this sets your dashboard."
					}),
					/* @__PURE__ */ jsx("div", {
						className: "space-y-2",
						children: opts.map((o) => /* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: busy,
							onClick: async () => {
								setBusy(true);
								try {
									await supabase.auth.updateUser({ data: { subtype: o.view } });
									const { error: requestError } = await supabase.from("account_role_requests").update({
										requested_view: o.view,
										updated_at: (/* @__PURE__ */ new Date()).toISOString()
									}).eq("user_id", pendingSubtype.userId);
									if (requestError) throw requestError;
									const { error: profileError } = await supabase.from("profiles").update({ view: o.view }).eq("id", pendingSubtype.userId);
									if (profileError) throw profileError;
									await afterLogin(pendingSubtype.userId, o.view);
								} catch (err) {
									setMsg(err instanceof Error ? err.message : "Could not save.");
									setBusy(false);
								}
							},
							className: "flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-teal-500 hover:bg-white disabled:opacity-60",
							children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
								className: "text-sm font-bold text-slate-900",
								children: o.label
							}), /* @__PURE__ */ jsx("div", {
								className: "text-[11px] text-slate-500",
								children: o.desc
							})] }), /* @__PURE__ */ jsx("span", {
								className: "text-teal-600",
								children: "→"
							})]
						}, o.view))
					}),
					msg && /* @__PURE__ */ jsx("p", {
						className: "mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700",
						children: msg
					})
				]
			})
		});
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "flex min-h-screen items-center justify-center px-4 py-10",
		style: {
			background: "#DCE6E1",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif"
		},
		children: [/* @__PURE__ */ jsx("link", {
			rel: "stylesheet",
			href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
		}), /* @__PURE__ */ jsxs("div", {
			className: "w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-5 flex items-center gap-3",
					children: [/* @__PURE__ */ jsx("div", {
						className: "flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-xs",
						style: { background: "#0D9488" },
						children: /* @__PURE__ */ jsx("svg", {
							width: "20",
							height: "20",
							viewBox: "0 0 24 24",
							fill: "currentColor",
							stroke: "none",
							children: /* @__PURE__ */ jsx("path", { d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" })
						})
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
						className: "text-lg font-bold text-slate-900 leading-tight",
						children: adminMode ? "MedConnect · Super Admin" : "MedConnect"
					}), /* @__PURE__ */ jsx("div", {
						className: "text-xs text-slate-500 font-normal",
						children: adminMode ? "Restricted — platform administrators only" : isSignup ? "Create your account" : "Welcome back"
					})] })]
				}),
				adminMode && /* @__PURE__ */ jsx("div", {
					className: "mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800",
					children: "You are on the super admin sign-in. Public sign-up is disabled here."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-4 flex gap-1 rounded-full bg-slate-100 p-1",
					children: [
						tab("password", "Password"),
						tab("email-otp", "Email OTP"),
						tab("phone-otp", "Phone OTP")
					]
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: submit,
					className: "space-y-3",
					children: [
						isSignup && !adminMode && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("input", {
							required: true,
							placeholder: "Full name",
							value: name,
							onChange: (e) => setName(e.target.value),
							className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
						}), /* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("label", {
								className: "mb-1 block text-[11px] font-semibold text-slate-600",
								children: "I am a…"
							}),
							/* @__PURE__ */ jsx("div", {
								className: "grid grid-cols-4 gap-1 rounded-full bg-slate-100 p-1",
								children: [
									"patient",
									"doctor",
									"provider",
									"facility"
								].map((k) => /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setKind(k),
									className: `rounded-full px-1 py-1.5 text-[10px] font-bold capitalize transition ${kind === k ? "bg-teal-600 text-white" : "text-slate-600"}`,
									children: k
								}, k))
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mt-1 text-[10px] text-slate-500",
								children: [
									kind === "doctor" && "Licensed MBBS / specialist physician.",
									kind === "provider" && "Non-doctor care staff — ambulance, seva, nurse, technician.",
									kind === "facility" && "Hospital, diagnostic centre, pharmacy or lab.",
									kind === "patient" && "Book care, track records."
								]
							})
						] })] }),
						mode === "phone-otp" ? /* @__PURE__ */ jsx("input", {
							required: true,
							type: "tel",
							"aria-label": "Phone number",
							placeholder: "+91 98765 43210",
							value: phone,
							onChange: (e) => setPhone(e.target.value),
							disabled: otpSent,
							className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
						}) : /* @__PURE__ */ jsx("input", {
							required: true,
							type: "email",
							"aria-label": "Email address",
							placeholder: "you@example.com",
							value: email,
							onChange: (e) => setEmail(e.target.value),
							disabled: otpSent,
							className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 disabled:bg-slate-50"
						}),
						mode === "password" && /* @__PURE__ */ jsx("input", {
							required: true,
							type: "password",
							"aria-label": "Password",
							placeholder: "Password (min 6 chars)",
							value: password,
							onChange: (e) => setPassword(e.target.value),
							minLength: 6,
							className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
						}),
						mode !== "password" && otpSent && /* @__PURE__ */ jsx("input", {
							required: true,
							inputMode: "numeric",
							"aria-label": "Verification code",
							placeholder: "6-digit code",
							value: otp,
							onChange: (e) => setOtp(e.target.value),
							className: "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-center text-lg tracking-[0.4em] outline-none focus:border-teal-500"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: busy,
							className: "w-full rounded-xl py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60",
							style: { background: "#0D9488" },
							children: busy ? "Please wait…" : mode === "password" ? isSignup ? "Create account" : "Sign in" : otpSent ? "Verify code" : "Send code"
						}),
						msg && /* @__PURE__ */ jsx("p", {
							className: "rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-700",
							children: msg
						})
					]
				}),
				mode === "password" && !adminMode && /* @__PURE__ */ jsxs("p", {
					className: "mt-3 text-center text-xs text-slate-600",
					children: [
						isSignup ? "Already have an account?" : "New here?",
						" ",
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setIsSignup((s) => !s),
							className: "font-bold text-teal-700 hover:underline",
							children: isSignup ? "Sign in" : "Create one"
						})
					]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "my-4 text-center",
					children: /* @__PURE__ */ jsx("span", {
						className: "text-[11px] font-bold tracking-wider text-slate-400 uppercase",
						children: "DEMO ONE-CLICK LOGIN"
					})
				}),
				/* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-2 gap-2.5",
					children: DEMO_BUTTONS.map((item) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						disabled: busy,
						onClick: () => handleQuickDemoLogin(item.email, item.defaultPass, item.fallbackEmail),
						className: item.isAdmin ? "w-full rounded-full border border-teal-400 bg-white py-2 px-3 text-center text-xs font-semibold text-teal-700 shadow-xs transition hover:bg-teal-50/50 hover:border-teal-500 disabled:opacity-50" : "w-full rounded-full border border-slate-200 bg-white py-2 px-3 text-center text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50",
						children: [item.label, item.testNote && /* @__PURE__ */ jsxs("span", {
							className: "sr-only",
							children: [
								" (",
								item.testNote,
								")"
							]
						})]
					}, item.label))
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "mt-3 text-center text-[10.5px] leading-relaxed text-slate-400",
					children: [
						"Most demo accounts use ",
						/* @__PURE__ */ jsx("span", {
							className: "font-mono font-medium text-slate-600",
							children: "demo123456"
						}),
						" ; Coordinator, Care Physician and the admin consoles use ",
						/* @__PURE__ */ jsx("span", {
							className: "font-semibold text-slate-600",
							children: "CareDemo!2026"
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500",
					children: [/* @__PURE__ */ jsxs(Link, {
						to: "/",
						className: "inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition",
						children: [/* @__PURE__ */ jsx("span", { children: "←" }), /* @__PURE__ */ jsx("span", { children: "Continue browsing without an account" })]
					}), /* @__PURE__ */ jsx(Link, {
						to: "/auth",
						search: { admin: "1" },
						"aria-label": "Super admin login",
						title: "Super admin",
						className: "inline-flex items-center justify-center rounded-full border border-slate-200 p-1 text-slate-400 hover:text-slate-600 transition",
						children: /* @__PURE__ */ jsx(ShieldCheck, { size: 14 })
					})]
				})
			]
		})]
	});
}
//#endregion
export { AuthPage as component };
