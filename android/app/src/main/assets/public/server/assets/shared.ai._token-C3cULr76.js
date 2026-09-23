import { useRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/shared.ai.$token.tsx?tsr-split=errorComponent
function SharedAiError({ reset }) {
	const router = useRouter();
	return /* @__PURE__ */ jsxs("div", {
		style: {
			padding: 40,
			fontFamily: "system-ui"
		},
		children: [
			/* @__PURE__ */ jsx("h1", {
				style: {
					fontSize: 20,
					fontWeight: 800
				},
				children: "Couldn't load this shared summary"
			}),
			/* @__PURE__ */ jsx("p", {
				style: {
					color: "#64748b",
					marginTop: 8
				},
				children: "The link may have been revoked."
			}),
			/* @__PURE__ */ jsx("button", {
				onClick: () => {
					router.invalidate();
					reset();
				},
				style: {
					marginTop: 12,
					padding: "8px 14px",
					borderRadius: 8,
					background: "#0ea5e9",
					color: "#fff",
					border: "none",
					cursor: "pointer"
				},
				children: "Retry"
			})
		]
	});
}
//#endregion
export { SharedAiError as errorComponent };
