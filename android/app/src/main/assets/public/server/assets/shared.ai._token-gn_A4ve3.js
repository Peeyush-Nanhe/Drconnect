import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/shared.ai.$token.tsx?tsr-split=notFoundComponent
var SplitNotFoundComponent = () => /* @__PURE__ */ jsxs("div", {
	style: {
		padding: 40,
		fontFamily: "system-ui"
	},
	children: [/* @__PURE__ */ jsx("h1", {
		style: {
			fontSize: 20,
			fontWeight: 800
		},
		children: "Link not found"
	}), /* @__PURE__ */ jsx("p", {
		style: {
			color: "#64748b",
			marginTop: 8
		},
		children: "This shared summary is no longer available."
	})]
});
//#endregion
export { SplitNotFoundComponent as notFoundComponent };
