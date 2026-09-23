import { i as oauth, r as Route } from "./router-BtcF1NH_.js";
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/[.]lovable.oauth.consent.tsx?tsr-split=component
function Consent() {
	const details = Route.useLoaderData();
	const { authorization_id } = Route.useSearch();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(null);
	async function decide(approve) {
		setBusy(true);
		setError(null);
		const { data, error } = approve ? await oauth().approveAuthorization(authorization_id) : await oauth().denyAuthorization(authorization_id);
		if (error) {
			setBusy(false);
			setError(error.message);
			return;
		}
		const target = data?.redirect_url ?? data?.redirect_to;
		if (!target) {
			setBusy(false);
			setError("No redirect returned by the authorization server.");
			return;
		}
		window.location.href = target;
	}
	const clientName = details?.client?.name ?? "an app";
	return /* @__PURE__ */ jsxs("main", {
		className: "mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6",
		children: [
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("h1", {
				className: "text-xl font-semibold",
				children: [
					"Connect ",
					clientName,
					" to your MyDox account"
				]
			}), /* @__PURE__ */ jsxs("p", {
				className: "mt-2 text-sm text-muted-foreground",
				children: [
					"This will let ",
					clientName,
					" read your bookings and profile, and create new care requests on your behalf. You can disconnect it at any time."
				]
			})] }),
			error && /* @__PURE__ */ jsx("p", {
				role: "alert",
				className: "rounded-md bg-red-50 p-3 text-sm text-red-700",
				children: error
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex gap-2",
				children: [/* @__PURE__ */ jsx("button", {
					disabled: busy,
					onClick: () => decide(true),
					className: "flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50",
					children: busy ? "Working…" : "Approve"
				}), /* @__PURE__ */ jsx("button", {
					disabled: busy,
					onClick: () => decide(false),
					className: "flex-1 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50",
					children: "Deny"
				})]
			})
		]
	});
}
//#endregion
export { Consent as component };
