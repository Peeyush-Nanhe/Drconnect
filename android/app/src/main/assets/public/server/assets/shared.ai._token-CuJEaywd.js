import { n as Route } from "./router-BtcF1NH_.js";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/shared.ai.$token.tsx?tsr-split=component
var KIND_LABEL = {
	triage: "AI Triage conversation",
	report: "AI Report analysis",
	voice: "Voice-assisted chat"
};
function SharedAiView() {
	const row = Route.useLoaderData();
	const created = new Date(row.created_at).toLocaleString();
	return /* @__PURE__ */ jsxs("div", {
		style: {
			maxWidth: 760,
			margin: "0 auto",
			padding: "32px 20px",
			fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
			color: "#0f172a"
		},
		children: [
			/* @__PURE__ */ jsx("div", {
				style: {
					fontSize: 11,
					letterSpacing: 1,
					textTransform: "uppercase",
					color: "#64748b",
					fontWeight: 800
				},
				children: KIND_LABEL[row.kind] || row.kind
			}),
			/* @__PURE__ */ jsx("h1", {
				style: {
					fontSize: 24,
					fontWeight: 800,
					margin: "6px 0 4px"
				},
				children: row.title
			}),
			/* @__PURE__ */ jsxs("div", {
				style: {
					color: "#64748b",
					fontSize: 12,
					marginBottom: 20
				},
				children: ["Shared from MyDox · ", created]
			}),
			/* @__PURE__ */ jsx(RenderPayload, {
				kind: row.kind,
				payload: row.payload
			}),
			/* @__PURE__ */ jsx("p", {
				style: {
					marginTop: 32,
					fontSize: 11,
					color: "#94a3b8"
				},
				children: "This is a shared AI summary. It is informational only and not a substitute for professional medical advice."
			})
		]
	});
}
function RenderPayload({ kind, payload }) {
	if (!payload) return /* @__PURE__ */ jsx("div", {
		style: { color: "#64748b" },
		children: "No content."
	});
	if (kind === "triage" || kind === "voice") {
		const messages = payload.messages || [];
		return /* @__PURE__ */ jsxs("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				gap: 10
			},
			children: [messages.map((m, i) => /* @__PURE__ */ jsxs("div", {
				style: {
					padding: "10px 14px",
					borderRadius: 12,
					background: m.role === "user" ? "#EFF6FF" : "#F1F5F9",
					border: `1px solid ${m.role === "user" ? "#BFDBFE" : "#E2E8F0"}`
				},
				children: [/* @__PURE__ */ jsx("div", {
					style: {
						fontSize: 10,
						fontWeight: 800,
						textTransform: "uppercase",
						color: "#64748b",
						marginBottom: 4
					},
					children: m.role === "user" ? "You" : "MedAI"
				}), /* @__PURE__ */ jsx("div", {
					style: {
						fontSize: 14,
						whiteSpace: "pre-wrap"
					},
					children: m.content
				})]
			}, i)), payload.rec && /* @__PURE__ */ jsxs("div", {
				style: {
					padding: 12,
					borderRadius: 12,
					background: "#ECFDF5",
					border: "1px solid #A7F3D0",
					fontSize: 13
				},
				children: [
					/* @__PURE__ */ jsx("b", { children: "Recommendation:" }),
					" ",
					payload.rec.name || payload.rec.id,
					" — ",
					payload.rec.reason
				]
			})]
		});
	}
	if (kind === "report") {
		const rows = payload.rows || [];
		const FLAG = {
			normal: "#16A34A",
			high: "#DC2626",
			low: "#2563EB",
			critical: "#7C3AED"
		};
		return /* @__PURE__ */ jsxs("div", { children: [payload.narration && /* @__PURE__ */ jsx("div", {
			style: {
				padding: 12,
				borderRadius: 12,
				background: "#FFF7ED",
				border: "1px solid #FDBA74",
				marginBottom: 12,
				fontSize: 14
			},
			children: payload.narration
		}), /* @__PURE__ */ jsx("div", {
			style: {
				display: "flex",
				flexDirection: "column",
				gap: 6
			},
			children: rows.map((r, i) => /* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 10,
					padding: "10px 12px",
					borderRadius: 10,
					background: "#F8FAFC",
					border: "1px solid #E2E8F0"
				},
				children: [
					/* @__PURE__ */ jsx("span", { style: {
						width: 8,
						height: 8,
						borderRadius: "50%",
						background: FLAG[r.flag] || "#ccc"
					} }),
					/* @__PURE__ */ jsx("span", {
						style: {
							flex: 1,
							fontWeight: 700
						},
						children: r.analyte
					}),
					/* @__PURE__ */ jsxs("span", {
						style: { color: "#334155" },
						children: [
							r.value,
							" ",
							r.unit
						]
					}),
					/* @__PURE__ */ jsxs("span", {
						style: {
							color: "#64748b",
							fontSize: 12
						},
						children: [
							"ref ",
							r.refLow,
							"–",
							r.refHigh
						]
					})
				]
			}, i))
		})] });
	}
	return /* @__PURE__ */ jsx("pre", {
		style: {
			whiteSpace: "pre-wrap",
			fontSize: 12
		},
		children: JSON.stringify(payload, null, 2)
	});
}
//#endregion
export { SharedAiView as component };
