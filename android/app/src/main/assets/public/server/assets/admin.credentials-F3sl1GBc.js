import { r as createServerFn } from "./server-DyT3b58-.js";
import { t as useServerFn } from "./useServerFn-BqzygRuj.js";
import { t as createSsrRpc } from "./createSsrRpc-BXIhdHyt.js";
import { t as requireSupabaseAuth } from "./auth-middleware-LORqvj7W.js";
import { Link } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
//#region src/lib/care-physician-admin.functions.ts
var getCarePhysicianVerificationQueue = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("fa2b391fc42b7b5290106b1318a3c447f33198f6b05798ac668344a3b1eb683d"));
var setCarePhysicianRegistrationVerification = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input) => {
	if (!input?.userId) throw new Error("userId is required");
	return {
		userId: input.userId,
		verified: Boolean(input.verified)
	};
}).handler(createSsrRpc("f6428e42314408ff7dd4cc4163b1582f3b1ff41d0352b938c80e077cfa0f03bb"));
//#endregion
//#region src/routes/admin.credentials.tsx?tsr-split=component
var gated = /* @__PURE__ */ new Set([
	"intubation",
	"centralline",
	"ventilator",
	"acls",
	"lp"
]);
var labels = {
	intubation: "Intubation",
	centralline: "Central line",
	ventilator: "Ventilator",
	acls: "ACLS",
	lp: "Lumbar puncture",
	iv: "IV cannulation",
	catheter: "Catheterisation",
	nasogastric: "Ryle's tube",
	suturing: "Suturing",
	abg: "ABG"
};
function CredentialVerification() {
	const fetchQueue = useServerFn(getCarePhysicianVerificationQueue);
	const setVerification = useServerFn(setCarePhysicianRegistrationVerification);
	const qc = useQueryClient();
	const query = useQuery({
		queryKey: ["care-physician-verification"],
		queryFn: () => fetchQueue({}),
		retry: false
	});
	const mutation = useMutation({
		mutationFn: (input) => setVerification({ data: input }),
		onSuccess: () => void qc.invalidateQueries({ queryKey: ["care-physician-verification"] })
	});
	return /* @__PURE__ */ jsx("div", {
		className: "min-h-screen bg-slate-100 px-4 py-8",
		style: { fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif" },
		children: /* @__PURE__ */ jsxs("div", {
			className: "mx-auto max-w-5xl",
			children: [
				/* @__PURE__ */ jsx(Link, {
					to: "/admin",
					className: "text-xs font-semibold text-teal-700 hover:underline",
					children: "← Admin console"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-1 mb-5 flex flex-wrap items-end justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
						className: "text-2xl font-extrabold text-slate-900",
						children: "Care Physician credential verification"
					}), /* @__PURE__ */ jsx("p", {
						className: "max-w-2xl text-sm text-slate-600",
						children: "Verify the medical council registration after checking the submitted credentials. Verification unlocks ICU and other gated clinical duties; it does not certify each self-declared procedure."
					})] }), /* @__PURE__ */ jsx("button", {
						onClick: () => query.refetch(),
						className: "rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700",
						children: "Refresh"
					})]
				}),
				query.isLoading ? /* @__PURE__ */ jsx("div", {
					className: "rounded-2xl bg-white p-6 text-sm text-slate-500",
					children: "Loading credential queue…"
				}) : null,
				query.error ? /* @__PURE__ */ jsx("div", {
					className: "rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700",
					children: query.error.message
				}) : null,
				mutation.error ? /* @__PURE__ */ jsx("div", {
					className: "mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700",
					children: mutation.error.message
				}) : null,
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-3",
					children: [(query.data ?? []).map((row) => /* @__PURE__ */ jsxs("article", {
						className: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-wrap items-start justify-between gap-3",
								children: [/* @__PURE__ */ jsxs("div", { children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex flex-wrap items-center gap-2",
										children: [/* @__PURE__ */ jsx("strong", {
											className: "text-base text-slate-900",
											children: row.full_name
										}), /* @__PURE__ */ jsx("span", {
											className: `rounded-full px-2 py-1 text-[10px] font-extrabold ${row.registration_verified ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`,
											children: row.registration_verified ? "VERIFIED" : "PENDING"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "mt-1 text-xs text-slate-500",
										children: [
											String(row.qualification || "").toUpperCase(),
											" · ",
											row.experience_years ?? 0,
											" years",
											row.primary_specialty ? ` · ${row.primary_specialty}` : ""
										]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "mt-2 text-sm font-semibold text-slate-800",
										children: [
											row.council_name || "Council not specified",
											" · ",
											row.council_registration_number || "Registration number missing"
										]
									})
								] }), /* @__PURE__ */ jsx("button", {
									disabled: mutation.isPending,
									onClick: () => mutation.mutate({
										userId: row.user_id,
										verified: !row.registration_verified
									}),
									className: `rounded-xl px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50 ${row.registration_verified ? "bg-slate-500" : "bg-emerald-600"}`,
									children: row.registration_verified ? "Revoke verification" : "Mark registration verified"
								})]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-3 flex flex-wrap gap-1.5",
								children: (row.procedures ?? []).map((id) => /* @__PURE__ */ jsxs("span", {
									className: `rounded-full px-2 py-1 text-[10px] font-bold ${gated.has(id) ? "bg-orange-50 text-orange-700 ring-1 ring-orange-200" : "bg-blue-50 text-blue-700"}`,
									children: [labels[id] || id, gated.has(id) ? " 🔒" : ""]
								}, id))
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-3",
								children: [
									/* @__PURE__ */ jsxs("div", { children: [
										/* @__PURE__ */ jsx("b", { children: "Duty preferences:" }),
										" ",
										(row.duty_types ?? []).join(", ") || "—"
									] }),
									/* @__PURE__ */ jsxs("div", { children: [
										/* @__PURE__ */ jsx("b", { children: "Preferred areas:" }),
										" ",
										(row.preferred_areas ?? []).join(", ") || "—"
									] }),
									/* @__PURE__ */ jsxs("div", { children: [
										/* @__PURE__ */ jsx("b", { children: "Profile created:" }),
										" ",
										new Date(row.created_at).toLocaleDateString("en-IN")
									] })
								]
							})
						]
					}, row.user_id)), query.data?.length === 0 ? /* @__PURE__ */ jsx("div", {
						className: "rounded-2xl bg-white p-6 text-sm text-slate-500",
						children: "No Care Physician profiles have been submitted yet."
					}) : null]
				})
			]
		})
	});
}
//#endregion
export { CredentialVerification as component };
