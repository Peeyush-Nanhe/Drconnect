import { B as useSession } from "./backend-eXdx240h.js";
import { n as HomeVisitPanel, t as HomeVisitOperations } from "./HomeVisitPanel-oPTBOTPN.js";
import { t as HomeVisitBooking } from "./HomeVisitBooking-DAtUNROc.js";
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/home-visits.tsx?tsr-split=component
function HomeVisitsPage() {
	const { session, role, loading } = useSession();
	const [booking, setBooking] = useState(null);
	if (loading) return /* @__PURE__ */ jsx("main", {
		className: "hv hv-body",
		role: "status",
		children: "Checking your account…"
	});
	if (!session) return /* @__PURE__ */ jsx("main", {
		className: "hv hv-body",
		children: /* @__PURE__ */ jsx("a", {
			href: "/auth?next=%2Fhome-visits",
			children: "Sign in to view home visits"
		})
	});
	return /* @__PURE__ */ jsxs("main", {
		className: "hv",
		style: {
			maxWidth: 850,
			margin: "0 auto",
			padding: 20
		},
		children: [
			/* @__PURE__ */ jsx(Link, {
				to: "/",
				children: "← MyDox"
			}),
			/* @__PURE__ */ jsx("h1", { children: "Doctor home visits" }),
			/* @__PURE__ */ jsx("p", { children: "Request a visit, follow its saved status and review your visit record." }),
			/* @__PURE__ */ jsxs("div", {
				className: "hv-actions",
				children: [/* @__PURE__ */ jsx("button", {
					onClick: () => setBooking("now"),
					children: "Visit Now"
				}), /* @__PURE__ */ jsx("button", {
					onClick: () => setBooking("later"),
					children: "Book for Later"
				})]
			}),
			/* @__PURE__ */ jsx(HomeVisitPanel, { audience: "patient" }, `patient-${session.user.id}`),
			role === "provider" && /* @__PURE__ */ jsx(HomeVisitPanel, { audience: "doctor" }, `doctor-${session.user.id}`),
			(role === "admin" || role === "super_admin") && /* @__PURE__ */ jsx(HomeVisitOperations, {}),
			booking && /* @__PURE__ */ jsx(HomeVisitBooking, {
				initialMode: booking,
				onClose: () => setBooking(null)
			}, session.user.id)
		]
	});
}
//#endregion
export { HomeVisitsPage as component };
