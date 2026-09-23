import { useEffect } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/routes/nurse.visits.tsx?tsr-split=component
function RedirectToCareBooking() {
	useEffect(() => {
		window.location.replace("/care-booking?role=nurse");
	}, []);
	return /* @__PURE__ */ jsx("p", {
		style: {
			padding: 24,
			textAlign: "center"
		},
		children: "Opening booking…"
	});
}
//#endregion
export { RedirectToCareBooking as component };
