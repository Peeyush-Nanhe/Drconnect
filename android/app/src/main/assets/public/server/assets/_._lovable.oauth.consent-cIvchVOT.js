import { jsxs } from "react/jsx-runtime";
//#region src/routes/[.]lovable.oauth.consent.tsx?tsr-split=errorComponent
var SplitErrorComponent = ({ error }) => /* @__PURE__ */ jsxs("main", {
	className: "mx-auto max-w-md p-6 text-sm",
	children: [
		"Could not load this authorization request:",
		" ",
		String(error?.message ?? error)
	]
});
//#endregion
export { SplitErrorComponent as errorComponent };
