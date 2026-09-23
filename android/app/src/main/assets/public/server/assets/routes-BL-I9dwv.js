import { n as supabase } from "./client-BSmVQfT1.js";
import { B as useSession } from "./backend-eXdx240h.js";
import { Suspense, lazy, useEffect, useState } from "react";
import { Link, Navigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { ShieldCheck } from "lucide-react";
//#region src/routes/index.tsx?tsr-split=component
var MyDoxApp = lazy(() => import("./MyDoxFull-BK00nX-D.js"));
function Home() {
	const { user, role, loading } = useSession();
	const [profileView, setProfileView] = useState(null);
	const viewQuery = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("view") : null;
	useEffect(() => {
		let active = true;
		if (!user) {
			setProfileView(null);
			return;
		}
		(async () => {
			const { data } = await supabase.from("profiles").select("view, full_name").eq("id", user.id).maybeSingle();
			if (!active) return;
			const fallbackView = role === "provider" ? "medico" : role === "facility" ? "hub" : role === "admin" || role === "super_admin" ? "admin" : "patient";
			const nextView = viewQuery || data?.view || fallbackView;
			setProfileView(nextView);
			if (typeof window !== "undefined") {
				localStorage.setItem("mc_view", nextView);
				const existingName = localStorage.getItem("mc_user_name");
				const effectiveName = existingName && existingName !== "You" ? existingName : data?.full_name || "You";
				localStorage.setItem("mc_user_name", effectiveName);
				if (role) localStorage.setItem("mc_user_role", role);
				localStorage.setItem("mc_profile_id", user.id);
			}
		})();
		return () => {
			active = false;
		};
	}, [
		user,
		role,
		viewQuery
	]);
	if (!loading && !user) return /* @__PURE__ */ jsx(Navigate, {
		to: "/auth",
		search: {
			admin: void 0,
			next: void 0
		}
	});
	if (!viewQuery && profileView) {
		if (profileView === "nurse") return /* @__PURE__ */ jsx(Navigate, { to: "/nurse" });
		if (profileView === "technician") return /* @__PURE__ */ jsx(Navigate, { to: "/technician" });
		if (profileView === "physio_staff" || profileView === "therapist") return /* @__PURE__ */ jsx(Navigate, { to: "/physio/therapist" });
	}
	if (loading || user && !profileView) return /* @__PURE__ */ jsx("div", {
		style: {
			minHeight: "100vh",
			background: "#DCE6E1"
		},
		className: "flex items-center justify-center text-sm text-slate-600",
		children: "Loading MyDox…"
	});
	if (!viewQuery) {
		if (profileView === "nurse") return /* @__PURE__ */ jsx(Navigate, { to: "/nurse" });
		if (profileView === "technician") return /* @__PURE__ */ jsx(Navigate, { to: "/technician" });
		if (profileView === "physio_staff" || profileView === "therapist") return /* @__PURE__ */ jsx(Navigate, { to: "/physio/therapist" });
	}
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx(Suspense, {
		fallback: /* @__PURE__ */ jsx("div", {
			style: {
				minHeight: "80vh",
				background: "#DCE6E1"
			},
			className: "flex items-center justify-center text-sm text-slate-600",
			children: "Loading MyDox…"
		}),
		children: /* @__PURE__ */ jsx(MyDoxApp, { initialView: profileView ?? "patient" }, `${user?.id ?? "guest"}:${profileView ?? "patient"}`)
	}), profileView !== "patient" && /* @__PURE__ */ jsxs("footer", {
		style: {
			background: "#0B201C",
			color: "rgba(255,255,255,.6)",
			padding: "14px",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
			fontSize: 11,
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			borderTop: "1px solid rgba(255,255,255,.08)"
		},
		children: [/* @__PURE__ */ jsx("span", { children: "© MyDox" }), /* @__PURE__ */ jsx(Link, {
			to: "/auth",
			search: { admin: "1" },
			"aria-label": "Super admin login",
			title: "Super admin",
			style: {
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				width: 26,
				height: 26,
				borderRadius: 999,
				color: "rgba(255,255,255,.55)",
				border: "1px solid rgba(255,255,255,.15)",
				textDecoration: "none"
			},
			children: /* @__PURE__ */ jsx(ShieldCheck, { size: 14 })
		})]
	})] });
}
//#endregion
export { Home as component };
