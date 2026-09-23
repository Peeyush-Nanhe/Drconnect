import { n as supabase } from "./client-BSmVQfT1.js";
import { B as useSession, J as ImageLightboxModal, U as usePostConsultationChat, X as parseChatAttachment, q as ChatAttachmentBubbleContent } from "./backend-eXdx240h.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/features/mydox/home-visits/api.ts
var HomeVisitRpcError = class extends Error {
	code;
	transactionRejected;
	constructor(message, code) {
		super(message);
		this.code = code;
		this.transactionRejected = !!code && /^(?:[A-Z0-9]{5}|PGRST\d+)$/.test(code) && !code.startsWith("08");
	}
};
async function rpc(name, args = {}) {
	const result = await supabase.rpc(name, args);
	if (result.error) {
		if (["PGRST202", "42883"].includes(result.error.code || "")) throw new HomeVisitRpcError("Doctor home visits are not available on this server yet. Please try again later.", result.error.code);
		throw new HomeVisitRpcError(result.error.message, result.error.code);
	}
	const response = result.data;
	if (response?.ok === false) throw new Error(response.error || "The action was not accepted. Refresh and retry.");
	return result.data;
}
var homeVisits = {
	context: () => rpc("hv_context"),
	settings: () => rpc("hv_provider_settings"),
	saveSettings: (settings) => rpc("hv_save_provider_settings", { p_settings: settings }),
	discover: (query) => rpc("hv_discover", { p_query: query }),
	quote: (input) => rpc("hv_quote", { p_input: input }),
	create: (input) => rpc("hv_create", { p_input: input }),
	recover: (key) => rpc("hv_recover", { p_key: key }),
	list: () => rpc("hv_list"),
	action: (input) => rpc("hv_action", { p_input: input }),
	arrivalCode: (id) => rpc("hv_arrival_code", { p_booking_id: id }),
	verifyArrival: (input) => rpc("hv_verify_arrival", { p_input: input }),
	operations: () => rpc("hv_operations")
};
function homeVisitError(error) {
	return error instanceof Error ? error.message : "Unable to reach the home-visit service. Your form is still available; please retry.";
}
function readRecoveryReference(actorId) {
	return window.localStorage.getItem(`mydox:home-visit:recovery:${actorId}`);
}
function recoveryReference(actorId) {
	const existing = readRecoveryReference(actorId);
	if (existing) return existing;
	const key = crypto.randomUUID();
	window.localStorage.setItem(`mydox:home-visit:recovery:${actorId}`, key);
	return key;
}
function clearRecoveryReference(actorId) {
	window.localStorage.removeItem(`mydox:home-visit:recovery:${actorId}`);
}
//#endregion
//#region src/features/mydox/TwoWayChatModal.tsx
var buttonStyle = {
	border: "1px solid #245140",
	borderRadius: 12,
	background: "#10352A",
	color: "#D1FAE5",
	padding: "8px 12px",
	cursor: "pointer",
	font: "inherit"
};
/** Clinical identity and permission always come from the authenticated chat API. */
function TwoWayChatModal({ reference, doctorName, specialty, onClose }) {
	const chat = usePostConsultationChat(reference);
	const { details, messages, loading, error, connectionState, markRead } = chat;
	const [input, setInput] = useState("");
	const [sendError, setSendError] = useState(null);
	const [prescriptionBusy, setPrescriptionBusy] = useState(false);
	const [prescriptionError, setPrescriptionError] = useState(null);
	const [selectedImage, setSelectedImage] = useState(null);
	const [decliningRequestId, setDecliningRequestId] = useState(null);
	const [declineReason, setDeclineReason] = useState("");
	const followBottom = useRef(true);
	const pendingDraft = useRef(null);
	const modalRef = useRef(null);
	const closeRef = useRef(null);
	const historyRef = useRef(null);
	const lastReceivedRef = useRef(null);
	const lastReceived = messages.filter((message) => !message.isOwn && message.status === "saved").at(-1);
	const lastReceivedId = lastReceived?.id;
	const conversationId = details?.conversationId;
	const pending = messages.find((message) => message.isOwn && message.status !== "saved");
	const title = details?.counterpartName || doctorName || "Consultation chat";
	const canSend = Boolean(details?.canSend && !loading && !pending && connectionState !== "offline");
	useEffect(() => {
		setInput("");
		setSendError(null);
		setPrescriptionError(null);
		setDecliningRequestId(null);
		setDeclineReason("");
		pendingDraft.current = null;
	}, [
		details?.conversationId,
		details?.episodeId,
		details?.actorId,
		chat.identityKey
	]);
	useEffect(() => {
		const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		closeRef.current?.focus();
		return () => previousFocus?.focus();
	}, []);
	useEffect(() => {
		if (pending) pendingDraft.current = {
			key: pending.idempotencyKey,
			body: pending.body
		};
		const operation = pendingDraft.current;
		if (operation && messages.some((message) => message.status === "saved" && message.idempotencyKey === operation.key)) {
			setInput((value) => value.trim() === operation.body ? "" : value);
			pendingDraft.current = null;
		}
	}, [messages, pending]);
	const latestMessageId = messages.at(-1)?.id;
	useEffect(() => {
		if (followBottom.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
	}, [latestMessageId]);
	useEffect(() => {
		const element = lastReceivedRef.current;
		if (!element || !lastReceivedId || !conversationId || typeof IntersectionObserver === "undefined") return;
		let visible = false;
		const acknowledge = () => {
			if (visible && document.visibilityState === "visible") markRead(lastReceivedId);
		};
		const observer = new IntersectionObserver((entries) => {
			visible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= .9);
			acknowledge();
		}, {
			root: historyRef.current,
			threshold: .9
		});
		observer.observe(element);
		document.addEventListener("visibilitychange", acknowledge);
		return () => {
			observer.disconnect();
			document.removeEventListener("visibilitychange", acknowledge);
		};
	}, [
		conversationId,
		lastReceivedId,
		markRead
	]);
	const submit = async (event) => {
		event.preventDefault();
		const body = input.trim();
		if (!body || !canSend) return;
		setSendError(null);
		followBottom.current = true;
		try {
			if (await chat.send(body)) setInput((value) => value.trim() === body ? "" : value);
		} catch {
			setSendError("The message could not be confirmed. Keep this window open and retry the pending message.");
		}
	};
	const retry = async (id, body) => {
		setSendError(null);
		try {
			if (await chat.retry(id)) setInput((value) => value.trim() === body ? "" : value);
		} catch {
			setSendError("The message could not be confirmed. Retry when the connection is available.");
		}
	};
	const prescription = async (action, requestId, reason) => {
		if (prescriptionBusy) return;
		setPrescriptionBusy(true);
		setPrescriptionError(null);
		try {
			if (await chat.prescription(action, requestId, reason)) {
				setDecliningRequestId(null);
				setDeclineReason("");
			} else setPrescriptionError("The request update could not be confirmed. Refresh to check its current status before retrying.");
		} catch {
			setPrescriptionError("Unable to update the request. Refresh to check its current status before retrying.");
		} finally {
			setPrescriptionBusy(false);
		}
	};
	const requests = details?.prescriptionRequests.filter((request) => request.episodeId === details.episodeId) || [];
	return /* @__PURE__ */ jsxs("div", {
		style: {
			position: "fixed",
			inset: 0,
			zIndex: 250,
			background: "rgba(0,0,0,.65)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: 12
		},
		children: [/* @__PURE__ */ jsxs("div", {
			ref: modalRef,
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "consultation-chat-title",
			onKeyDown: (event) => {
				if (event.key === "Escape") {
					event.stopPropagation();
					onClose();
				}
				if (event.key !== "Tab") return;
				const focusable = modalRef.current?.querySelectorAll("button:not(:disabled), textarea:not(:disabled), a[href]");
				if (!focusable?.length) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			},
			style: {
				width: "100%",
				maxWidth: 900,
				height: "min(820px, 92dvh)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				background: "#071B15",
				border: "1px solid #184333",
				borderRadius: 20,
				boxShadow: "0 24px 90px rgba(0,0,0,.45)",
				color: "#F8FAFC",
				fontFamily: "'Plus Jakarta Sans', sans-serif",
				fontSize: 13
			},
			children: [
				/* @__PURE__ */ jsxs("header", {
					style: {
						padding: "16px 18px",
						background: "#0B261D",
						borderBottom: "1px solid #123629",
						display: "flex",
						alignItems: "center",
						gap: 12
					},
					children: [
						/* @__PURE__ */ jsx("div", {
							"aria-hidden": "true",
							style: {
								width: 42,
								height: 42,
								borderRadius: "50%",
								background: "#0E5E47",
								display: "grid",
								placeItems: "center",
								fontWeight: 800,
								flexShrink: 0
							},
							children: title.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("")
						}),
						/* @__PURE__ */ jsxs("div", {
							style: {
								minWidth: 0,
								flex: 1
							},
							children: [/* @__PURE__ */ jsx("h2", {
								id: "consultation-chat-title",
								style: {
									margin: 0,
									fontSize: 16,
									overflowWrap: "anywhere"
								},
								children: title
							}), /* @__PURE__ */ jsx("p", {
								style: {
									margin: "4px 0 0",
									color: "#A7C4B7",
									fontSize: 11
								},
								children: details ? `${details.consultationLabel} · ${new Date(details.completedAt).toLocaleDateString()}` : specialty || "Post-consultation follow-up"
							})]
						}),
						/* @__PURE__ */ jsx("button", {
							ref: closeRef,
							type: "button",
							onClick: onClose,
							"aria-label": "Close chat",
							style: buttonStyle,
							children: "✕"
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					"aria-live": "polite",
					style: {
						padding: "10px 18px",
						background: "#081E17",
						borderBottom: "1px solid #123629",
						display: "flex",
						flexWrap: "wrap",
						alignItems: "center",
						gap: 10
					},
					children: [/* @__PURE__ */ jsxs("span", {
						style: {
							flex: 1,
							color: "#B6D3C6",
							fontSize: 11
						},
						children: [error && !details ? "Chat unavailable. See the message below." : connectionState === "live" ? "Chat connected" : connectionState === "offline" ? "Connection lost. Reconnect to refresh and retry." : connectionState === "refreshing" ? "Refreshing chat…" : "Connecting…", details && " · Recipient availability unknown"]
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => void chat.refresh(),
						disabled: loading,
						style: {
							...buttonStyle,
							padding: "5px 10px",
							fontSize: 11
						},
						children: "Refresh"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					ref: historyRef,
					role: "log",
					"aria-label": "Consultation messages",
					"aria-live": "polite",
					"aria-busy": loading,
					onScroll: (event) => {
						const node = event.currentTarget;
						followBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60;
					},
					style: {
						flex: 1,
						minHeight: 80,
						overflowY: "auto",
						padding: "16px 18px",
						display: "flex",
						flexDirection: "column",
						gap: 14
					},
					children: [
						details?.testOnly && /* @__PURE__ */ jsx("p", {
							role: "status",
							style: {
								color: "#FDE68A",
								margin: 0
							},
							children: "Synthetic test access only. This chat is not enabled for real patient care."
						}),
						!reference && /* @__PURE__ */ jsx("p", {
							role: "alert",
							style: {
								color: "#FDE68A",
								lineHeight: 1.6
							},
							children: "Chat requires an authorised completed consultation. Open Chat from Previous consultations or your consultation inbox."
						}),
						error && /* @__PURE__ */ jsxs("div", {
							role: "alert",
							style: {
								color: "#FECACA",
								background: "#39231F",
								padding: 12,
								borderRadius: 10
							},
							children: [/* @__PURE__ */ jsx("p", {
								style: { margin: "0 0 8px" },
								children: error
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => void chat.refresh(),
								style: buttonStyle,
								children: "Retry loading"
							})]
						}),
						loading && /* @__PURE__ */ jsx("p", {
							style: { color: "#A7C4B7" },
							children: "Loading authorised conversation…"
						}),
						!loading && details && !messages.length && /* @__PURE__ */ jsx("p", {
							style: {
								textAlign: "center",
								color: "#A7C4B7",
								margin: "24px 0"
							},
							children: "No messages in this consultation yet."
						}),
						chat.hasOlder && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => void chat.loadOlder(),
							disabled: chat.loadingOlder,
							style: {
								...buttonStyle,
								alignSelf: "center"
							},
							children: chat.loadingOlder ? "Loading…" : "Load older messages"
						}),
						messages.map((message) => /* @__PURE__ */ jsx("div", {
							ref: message.id === lastReceived?.id ? lastReceivedRef : void 0,
							style: {
								display: "flex",
								flexDirection: "column",
								alignItems: message.isOwn ? "flex-end" : "flex-start"
							},
							children: /* @__PURE__ */ jsxs("div", {
								style: {
									maxWidth: "86%",
									minWidth: 100,
									padding: "10px 13px",
									borderRadius: message.isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
									background: message.isOwn ? "#0E5E47" : "#13352A",
									border: "1px solid #245140",
									overflowWrap: "anywhere"
								},
								children: [
									/* @__PURE__ */ jsxs("p", {
										style: {
											margin: "0 0 5px",
											fontSize: 10,
											color: "#ACD7C4",
											textTransform: "capitalize"
										},
										children: [
											message.isOwn ? "You" : details?.counterpartName,
											" · ",
											message.senderRole
										]
									}),
									details && details.episodes.length > 1 && /* @__PURE__ */ jsx("p", {
										style: {
											margin: "0 0 5px",
											color: "#ACD7C4",
											fontSize: 10
										},
										children: details.episodes.find((episode) => episode.episodeId === message.episodeId)?.consultationLabel || "Earlier consultation"
									}),
									(() => {
										const att = parseChatAttachment(message.body);
										if (att) return /* @__PURE__ */ jsx(ChatAttachmentBubbleContent, {
											attachment: att,
											mine: message.isOwn,
											onViewImage: (img) => setSelectedImage(img)
										});
										return /* @__PURE__ */ jsx("p", {
											style: {
												margin: 0,
												whiteSpace: "pre-wrap",
												lineHeight: 1.6
											},
											children: message.body
										});
									})(),
									/* @__PURE__ */ jsxs("p", {
										style: {
											margin: "5px 0 0",
											textAlign: "right",
											color: "#A7C4B7",
											fontSize: 10
										},
										children: [message.createdAt ? new Date(message.createdAt).toLocaleString([], {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit"
										}) : "", message.isOwn && ` · ${message.status === "sending" ? "Sending…" : message.status === "failed" ? "Not confirmed" : "Saved"}`]
									}),
									message.status === "failed" && /* @__PURE__ */ jsxs("div", {
										role: "alert",
										style: { marginTop: 8 },
										children: [/* @__PURE__ */ jsx("p", {
											style: {
												color: "#FECACA",
												fontSize: 11
											},
											children: message.error || "Send failed. Retry to confirm this message."
										}), /* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: () => void retry(message.id, message.body),
											style: buttonStyle,
											children: "Retry message"
										})]
									})
								]
							})
						}, message.id)),
						details && /* @__PURE__ */ jsxs("section", {
							"aria-label": "Prescription requests",
							style: {
								border: "1px solid #245140",
								borderRadius: 12,
								padding: 12
							},
							children: [
								/* @__PURE__ */ jsx("h3", {
									style: {
										fontSize: 12,
										margin: "0 0 6px"
									},
									children: "Prescription requests"
								}),
								/* @__PURE__ */ jsx("p", {
									style: {
										fontSize: 11,
										color: "#A7C4B7",
										lineHeight: 1.5
									},
									children: "A request is subject to clinician review. No payment is taken. Issuing a signed prescription is unavailable in this chat."
								}),
								prescriptionError && /* @__PURE__ */ jsx("p", {
									role: "alert",
									style: {
										color: "#FECACA",
										fontSize: 11
									},
									children: prescriptionError
								}),
								requests.map((request) => /* @__PURE__ */ jsxs("div", {
									style: {
										marginTop: 10,
										paddingTop: 8,
										borderTop: "1px solid #245140"
									},
									children: [
										/* @__PURE__ */ jsxs("p", {
											style: {
												margin: "0 0 5px",
												fontSize: 11,
												textTransform: "capitalize"
											},
											children: [
												request.status,
												" · ",
												new Date(request.requestedAt).toLocaleString()
											]
										}),
										request.declineReason && /* @__PURE__ */ jsxs("p", {
											style: {
												fontSize: 11,
												whiteSpace: "pre-wrap"
											},
											children: ["Clinician's reason: ", request.declineReason]
										}),
										details.memberRole === "doctor" && request.status !== "declined" && /* @__PURE__ */ jsxs("div", {
											style: {
												display: "flex",
												flexWrap: "wrap",
												gap: 6
											},
											children: [request.status === "requested" && /* @__PURE__ */ jsx("button", {
												type: "button",
												disabled: prescriptionBusy,
												onClick: () => void prescription("review", request.id),
												style: buttonStyle,
												children: "Start review"
											}), /* @__PURE__ */ jsx("button", {
												type: "button",
												disabled: prescriptionBusy,
												onClick: () => setDecliningRequestId(request.id),
												style: buttonStyle,
												children: "Decline request"
											})]
										}),
										decliningRequestId === request.id && /* @__PURE__ */ jsxs("form", {
											onSubmit: (event) => {
												event.preventDefault();
												if (declineReason.trim()) prescription("decline", request.id, declineReason.trim());
											},
											style: { marginTop: 8 },
											children: [
												/* @__PURE__ */ jsxs("label", {
													style: {
														display: "block",
														fontSize: 11
													},
													children: ["Reason for declining", /* @__PURE__ */ jsx("textarea", {
														required: true,
														value: declineReason,
														maxLength: 500,
														onChange: (event) => setDeclineReason(event.target.value),
														style: {
															width: "100%",
															boxSizing: "border-box",
															margin: "6px 0",
															padding: 8,
															color: "#F8FAFC",
															background: "#0B261D",
															border: "1px solid #245140",
															borderRadius: 8
														}
													})]
												}),
												/* @__PURE__ */ jsx("button", {
													type: "submit",
													disabled: prescriptionBusy || !declineReason.trim(),
													style: buttonStyle,
													children: "Confirm decline"
												}),
												/* @__PURE__ */ jsx("button", {
													type: "button",
													onClick: () => setDecliningRequestId(null),
													style: {
														...buttonStyle,
														marginLeft: 6
													},
													children: "Cancel"
												})
											]
										})
									]
								}, request.id)),
								details.memberRole === "patient" && !requests.some((request) => request.status !== "declined") && /* @__PURE__ */ jsx("button", {
									type: "button",
									disabled: prescriptionBusy,
									onClick: () => void prescription("request"),
									style: buttonStyle,
									children: prescriptionBusy ? "Saving request…" : "Request clinician review"
								})
							]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					style: {
						padding: "10px 18px",
						background: "#081E17",
						borderTop: "1px solid #123629"
					},
					children: [
						details && /* @__PURE__ */ jsxs("p", {
							style: {
								color: "#A7C4B7",
								fontSize: 11,
								margin: "0 0 8px"
							},
							children: [details.memberRole === "doctor" ? "Doctor replies do not use the patient's outgoing message allowance." : details.patientMessagesRemaining != null ? `${details.patientMessagesRemaining} patient messages remaining${details.patientMessagesLimit != null ? ` of ${details.patientMessagesLimit}` : ""}.` : "Patient allowance is determined by the approved server policy.", details.patientSendUntil && ` Patient allowance expires ${new Date(details.patientSendUntil).toLocaleString()}.`]
						}),
						details && !details.canSend && /* @__PURE__ */ jsx("p", {
							role: "status",
							style: {
								color: "#FDE68A",
								fontSize: 12
							},
							children: details.sendDisabledReason || "Sending is currently unavailable for this consultation."
						}),
						pending && /* @__PURE__ */ jsx("p", {
							role: "status",
							style: {
								color: "#FDE68A",
								fontSize: 11
							},
							children: "Confirm the pending message before sending another. Your draft stays in this window."
						}),
						sendError && /* @__PURE__ */ jsx("p", {
							role: "alert",
							style: {
								color: "#FECACA",
								fontSize: 12
							},
							children: sendError
						}),
						/* @__PURE__ */ jsxs("form", {
							onSubmit: submit,
							style: {
								display: "flex",
								alignItems: "flex-end",
								gap: 10
							},
							children: [/* @__PURE__ */ jsx("textarea", {
								"aria-label": details?.memberRole === "doctor" ? "Write a reply" : "Write a message",
								value: input,
								onChange: (event) => setInput(event.target.value),
								disabled: !details || Boolean(pending),
								maxLength: 4e3,
								rows: 2,
								placeholder: details?.memberRole === "doctor" ? "Write your reply…" : "Write your follow-up message…",
								style: {
									flex: 1,
									minWidth: 0,
									resize: "vertical",
									maxHeight: 160,
									borderRadius: 14,
									background: "#0B261D",
									border: "1px solid #245140",
									padding: 12,
									color: "#F8FAFC",
									font: "inherit"
								}
							}), /* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: !canSend || !input.trim(),
								style: {
									...buttonStyle,
									background: canSend && input.trim() ? "#0C9668" : "#10352A",
									opacity: canSend && input.trim() ? 1 : .6,
									padding: "12px 16px"
								},
								children: "Send"
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("footer", {
					style: {
						padding: "11px 18px",
						background: "#051410",
						borderTop: "1px solid #123629",
						color: "#A7C4B7",
						fontSize: 10,
						lineHeight: 1.6
					},
					children: [/* @__PURE__ */ jsx("div", {
						style: {
							display: "flex",
							flexWrap: "wrap",
							gap: 6,
							marginBottom: 6
						},
						children: [
							"Attachments",
							"Audio / video calls",
							"Recharge",
							"Prescription issuing"
						].map((label) => /* @__PURE__ */ jsxs("button", {
							type: "button",
							disabled: true,
							title: `${label} unavailable pending approved integration`,
							style: {
								...buttonStyle,
								padding: "5px 8px",
								color: "#829B8F",
								cursor: "not-allowed",
								fontSize: 10
							},
							children: [label, " · unavailable"]
						}, label))
					}), "Documents, calls, purchases and prescription issuing are not enabled for this chat. Use the existing booking and clinical-record workflows for separately confirmed follow-up care."]
				})
			]
		}), /* @__PURE__ */ jsx(ImageLightboxModal, {
			image: selectedImage,
			onClose: () => setSelectedImage(null)
		})]
	});
}
//#endregion
//#region src/features/mydox/home-visits/format.ts
function money(amount, currency = "INR") {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency
	}).format(Number(amount || 0));
}
function homeTime(instant, timezone) {
	return new Date(instant).toLocaleString(void 0, {
		dateStyle: "medium",
		timeStyle: "short",
		...timezone ? { timeZone: timezone } : {}
	}) + (timezone ? ` (${timezone})` : "");
}
//#endregion
//#region src/features/mydox/home-visits/HomeVisitPanel.tsx
function HomeVisitPanel({ audience, completedOnly = false }) {
	const { session } = useSession();
	const actorId = session?.user.id;
	return /* @__PURE__ */ jsx(VisitPanel, {
		audience,
		actorId,
		completedOnly
	}, actorId || "signed-out");
}
function VisitPanel({ audience, actorId, completedOnly }) {
	const [rows, setRows] = useState([]);
	const [context, setContext] = useState(null);
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [updated, setUpdated] = useState(null);
	const sequence = useRef(0);
	const active = useRef(true);
	const refresh = useCallback(async () => {
		if (!actorId) return;
		const current = ++sequence.current;
		const isCurrent = () => active.current && current === sequence.current;
		setLoading(true);
		try {
			const available = await homeVisits.context();
			if (!isCurrent()) return;
			setContext(available);
			if (!available.enabled) {
				setRows([]);
				setError("");
				setUpdated(null);
				return;
			}
			const result = await homeVisits.list();
			if (!isCurrent()) return;
			setRows(result || []);
			setError("");
			setUpdated((/* @__PURE__ */ new Date()).toLocaleTimeString());
		} catch (e) {
			if (isCurrent()) setError(homeVisitError(e));
		} finally {
			if (isCurrent()) setLoading(false);
		}
	}, [actorId]);
	useEffect(() => {
		active.current = true;
		setRows([]);
		setContext(null);
		setUpdated(null);
		refresh();
		const onResume = () => {
			if (!document.hidden) refresh();
		};
		const poll = window.setInterval(onResume, 12e3);
		window.addEventListener("focus", onResume);
		window.addEventListener("online", onResume);
		document.addEventListener("visibilitychange", onResume);
		return () => {
			active.current = false;
			sequence.current += 1;
			clearInterval(poll);
			window.removeEventListener("focus", onResume);
			window.removeEventListener("online", onResume);
			document.removeEventListener("visibilitychange", onResume);
		};
	}, [refresh]);
	const visible = rows.filter((row) => !completedOnly || (row.home_visit_status || row.status) === "completed").filter((row) => audience === "doctor" ? row.patient_id !== actorId : row.patient_id === actorId || row.booker_id === actorId || row.actor_id === actorId);
	return /* @__PURE__ */ jsxs("section", {
		className: "hv hv-card",
		"aria-label": "Saved doctor home visits",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "hv-header",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", { children: completedOnly ? "Completed home consultations" : "Doctor home visits" }), /* @__PURE__ */ jsx("small", { children: updated ? `Last refreshed ${updated}` : "Saved requests and visits" })] }), /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: !actorId,
					onClick: () => void refresh(),
					children: "Refresh"
				})]
			}),
			error && /* @__PURE__ */ jsx("p", {
				className: "hv-error",
				role: "alert",
				children: error
			}),
			loading && /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Loading saved home visits…"
			}),
			!actorId && /* @__PURE__ */ jsx("p", {
				role: "status",
				children: "Sign in to view saved home visits."
			}),
			context?.enabled === false && /* @__PURE__ */ jsx("p", {
				role: "status",
				children: context.reason || "Home visits are not available for this account yet."
			}),
			!loading && !error && context?.enabled && visible.length === 0 && /* @__PURE__ */ jsx("p", { children: completedOnly ? "No completed home consultations available." : "No saved home visits available." }),
			visible.map((row) => /* @__PURE__ */ jsx(VisitCard, {
				visit: row,
				actorId: actorId || "",
				refresh
			}, row.id || row.booking_id)),
			!completedOnly && context?.enabled && audience === "doctor" && /* @__PURE__ */ jsx(ProviderHomeSettings, {}),
			!completedOnly && audience === "operations" && /* @__PURE__ */ jsx(HomeVisitOperations, {}),
			/* @__PURE__ */ jsx("p", {
				className: "hv-help",
				children: "This view refreshes while the app is open. Notification delivery depends on the approved pilot channels."
			})
		]
	});
}
function VisitCard({ visit, actorId, refresh }) {
	const id = visit.id || visit.booking_id || "";
	const status = visit.home_visit_status || visit.status;
	const isPatient = visit.patient_id === actorId || visit.booker_id === actorId || visit.actor_id === actorId;
	const actions = visit.allowed_actions || [];
	const [busy, setBusy] = useState(false);
	const [chatOpen, setChatOpen] = useState(false);
	const [error, setError] = useState("");
	const [form, setForm] = useState("");
	const [reason, setReason] = useState("");
	const [summary, setSummary] = useState("");
	const [followUp, setFollowUp] = useState("");
	const [eta, setEta] = useState("");
	const [code, setCode] = useState("");
	const [patientCode, setPatientCode] = useState(null);
	const [amount, setAmount] = useState("");
	const [reference, setReference] = useState("");
	const [acknowledge, setAcknowledge] = useState(false);
	useEffect(() => {
		if (!["en_route", "arrived"].includes(status) || visit.arrived_at) {
			setPatientCode(null);
			setCode("");
		}
	}, [
		status,
		actorId,
		visit.arrived_at
	]);
	async function act(action, extra = {}) {
		setBusy(true);
		setError("");
		try {
			const input = {
				booking_id: id,
				action,
				expected_version: visit.version,
				...extra
			};
			if (action === "verify_arrival") await homeVisits.verifyArrival({
				booking_id: id,
				code,
				expected_version: visit.version
			});
			else await homeVisits.action(input);
			setForm("");
			setCode("");
			setPatientCode(null);
			setAcknowledge(false);
			await refresh();
		} catch (e) {
			setError(homeVisitError(e));
			await refresh();
		} finally {
			setBusy(false);
		}
	}
	const button = (action, label, needsForm = false) => actions.includes(action) && /* @__PURE__ */ jsx("button", {
		disabled: busy,
		type: "button",
		onClick: () => needsForm ? (setForm(action), setError("")) : void act(action),
		children: label
	}, action);
	const receipt = visit.payment_settlement;
	return /* @__PURE__ */ jsxs("article", {
		className: "hv-card",
		children: [
			/* @__PURE__ */ jsxs("h3", { children: [
				visit.provider_name || (visit.provider_id ? "Selected doctor" : "Eligible doctor pool"),
				" ",
				/* @__PURE__ */ jsx("span", {
					className: "hv-status",
					children: status.replaceAll("_", " ")
				})
			] }),
			/* @__PURE__ */ jsxs("small", { children: ["Booking ID: ", id] }),
			/* @__PURE__ */ jsxs("p", { children: [
				homeTime(visit.start_time, visit.provider_timezone),
				" · ",
				/* @__PURE__ */ jsx("data", {
					value: String(visit.fee),
					"data-currency": visit.currency,
					children: money(visit.fee, visit.currency)
				})
			] }),
			status === "pending" && /* @__PURE__ */ jsxs("p", {
				className: "hv-help",
				children: ["Waiting for explicit doctor acceptance.", visit.pending_deadline ? ` Acceptance deadline: ${homeTime(visit.pending_deadline)}.` : ""]
			}),
			visit.address_snapshot?.full_address && /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsxs("p", { children: [
					visit.address_snapshot.full_address,
					", ",
					visit.address_snapshot.locality,
					", ",
					visit.address_snapshot.pincode
				] }),
				/* @__PURE__ */ jsxs("p", { children: [
					"Contact: ",
					visit.address_snapshot.phone,
					visit.address_snapshot.landmark ? ` · Access: ${visit.address_snapshot.landmark}` : ""
				] }),
				/* @__PURE__ */ jsxs("p", { children: ["Reason: ", visit.address_snapshot.reason] })
			] }),
			visit.address_snapshot && !visit.address_snapshot.full_address && /* @__PURE__ */ jsxs("p", { children: [
				"Offer area: ",
				visit.address_snapshot.locality,
				" · ",
				visit.address_snapshot.pincode,
				". Full address is available only after acceptance."
			] }),
			["en_route", "arrived"].includes(status) && /* @__PURE__ */ jsxs("p", { children: [visit.eta_minutes != null ? `Doctor-reported ETA: ${visit.eta_minutes} minutes · updated ${homeTime(visit.en_route_at || visit.start_time)}` : "ETA unavailable", ". Arrival is acknowledged separately by the patient code."] }),
			visit.doctor_arrived_at && !visit.arrived_at && /* @__PURE__ */ jsx("p", { children: "Doctor reported arrival. Patient acknowledgement is still required." }),
			error && /* @__PURE__ */ jsx("p", {
				className: "hv-error",
				role: "alert",
				children: error
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "hv-actions",
				children: [
					status === "completed" && (isPatient || visit.provider_id === actorId) && /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setChatOpen(true),
						children: "Chat about this consultation"
					}),
					button("accept", "Accept visit"),
					button("decline", "Decline", true),
					button("cancel", "Cancel visit", true),
					button("start_travel", "Start travel", true),
					button("report_arrival", "Report my arrival"),
					button("start_consultation", "Start consultation"),
					button("save_encounter", "Save encounter", true),
					button("amend_encounter", "Amend signed encounter", true),
					button("complete", "Complete visit"),
					button("record_settlement", "Record collected payment", true),
					button("request_reschedule", "Request reschedule", true),
					button("dispute", "Raise a dispute", true),
					button("accept_reschedule", "Accept replacement slot"),
					button("decline_reschedule", "Decline replacement slot", true),
					isPatient && !visit.arrived_at && ["en_route", "arrived"].includes(status) && /* @__PURE__ */ jsx("button", {
						disabled: busy,
						onClick: async () => {
							setBusy(true);
							setError("");
							try {
								setPatientCode(await homeVisits.arrivalCode(id));
							} catch (e) {
								setError(homeVisitError(e));
							} finally {
								setBusy(false);
							}
						},
						children: "Get arrival code"
					}),
					!isPatient && (actions.includes("verify_arrival") || visit.provider_id === actorId && ["en_route", "arrived"].includes(status)) && /* @__PURE__ */ jsx("button", {
						disabled: busy,
						onClick: () => setForm("verify_arrival"),
						children: "Verify patient arrival code"
					})
				]
			}),
			patientCode && !visit.arrived_at && /* @__PURE__ */ jsxs("div", {
				className: "hv-note",
				children: [
					/* @__PURE__ */ jsx("p", { children: "Share this code only when the doctor is with you. A code acknowledges the visit; it does not independently prove physical attendance." }),
					/* @__PURE__ */ jsx("p", {
						className: "hv-code",
						children: patientCode.code
					}),
					/* @__PURE__ */ jsxs("p", { children: [
						"Expires ",
						homeTime(patientCode.expires_at),
						". One use only."
					] })
				]
			}),
			form && form !== "request_reschedule" && /* @__PURE__ */ jsx("form", {
				onSubmit: (e) => {
					e.preventDefault();
					const extra = {};
					if ([
						"cancel",
						"decline",
						"decline_reschedule",
						"amend_encounter",
						"dispute"
					].includes(form)) extra.reason = reason;
					if (form === "start_travel") extra.eta_minutes = eta ? Number(eta) : null;
					if (["save_encounter", "amend_encounter"].includes(form)) {
						extra.summary = summary;
						extra.follow_up = followUp;
					}
					if (form === "record_settlement") Object.assign(extra, {
						amount: Number(amount),
						currency: visit.currency,
						method: "cash",
						reference
					});
					act(form, extra);
				},
				children: /* @__PURE__ */ jsxs("fieldset", {
					disabled: busy,
					children: [
						[
							"cancel",
							"decline",
							"decline_reschedule",
							"amend_encounter",
							"dispute"
						].includes(form) && /* @__PURE__ */ jsxs("label", { children: ["Reason (saved in the audit history)", /* @__PURE__ */ jsx("textarea", {
							required: true,
							value: reason,
							onChange: (e) => setReason(e.target.value)
						})] }),
						form === "start_travel" && /* @__PURE__ */ jsxs("label", { children: [
							"Doctor-reported ETA in minutes (optional)",
							/* @__PURE__ */ jsx("input", {
								type: "number",
								min: "1",
								max: "600",
								value: eta,
								onChange: (e) => setEta(e.target.value)
							}),
							/* @__PURE__ */ jsx("span", {
								className: "hv-help",
								children: "Leave blank when unknown. The patient sees that this is your estimate."
							})
						] }),
						form === "verify_arrival" && /* @__PURE__ */ jsxs("label", { children: ["Patient's one-time arrival code", /* @__PURE__ */ jsx("input", {
							required: true,
							inputMode: "numeric",
							pattern: "[0-9]{6}",
							maxLength: 6,
							autoComplete: "off",
							value: code,
							onChange: (e) => setCode(e.target.value)
						})] }),
						["save_encounter", "amend_encounter"].includes(form) && /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("label", { children: ["Clinician-authored encounter summary", /* @__PURE__ */ jsx("textarea", {
								required: true,
								value: summary,
								onChange: (e) => setSummary(e.target.value)
							})] }),
							/* @__PURE__ */ jsxs("label", { children: ["Follow-up instructions (optional)", /* @__PURE__ */ jsx("textarea", {
								value: followUp,
								onChange: (e) => setFollowUp(e.target.value)
							})] }),
							/* @__PURE__ */ jsx("p", {
								className: "hv-help",
								children: "Saving signs this encounter. Further corrections require an audited amendment. A prescription is optional; this form does not generate one."
							})
						] }),
						form === "record_settlement" && /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsx("p", { children: "Record cash actually collected at this visit. Online payment is unavailable." }),
							/* @__PURE__ */ jsxs("label", { children: [
								"Amount collected (",
								visit.currency,
								")",
								/* @__PURE__ */ jsx("input", {
									required: true,
									type: "number",
									min: "0",
									step: "0.01",
									value: amount,
									onChange: (e) => setAmount(e.target.value)
								})
							] }),
							/* @__PURE__ */ jsxs("label", { children: ["Collection reference (optional)", /* @__PURE__ */ jsx("input", {
								value: reference,
								onChange: (e) => setReference(e.target.value)
							})] }),
							/* @__PURE__ */ jsxs("label", {
								className: "hv-check",
								children: [/* @__PURE__ */ jsx("input", {
									required: true,
									type: "checkbox",
									checked: acknowledge,
									onChange: (e) => setAcknowledge(e.target.checked)
								}), "I acknowledge receiving this amount. This is a recorded pay-at-visit settlement."]
							})
						] }),
						/* @__PURE__ */ jsxs("div", {
							className: "hv-actions",
							children: [/* @__PURE__ */ jsxs("button", {
								type: "submit",
								children: ["Save ", form.replaceAll("_", " ")]
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setForm(""),
								children: "Close"
							})]
						})
					]
				})
			}),
			form === "request_reschedule" && /* @__PURE__ */ jsx(RescheduleForm, {
				visit,
				busy,
				onSubmit: (replacement, rescheduleReason) => act("request_reschedule", {
					quote_id: replacement.quote_id,
					reason: rescheduleReason
				}),
				onClose: () => setForm("")
			}),
			visit.reschedule && /* @__PURE__ */ jsxs("div", {
				className: "hv-note",
				children: [
					/* @__PURE__ */ jsxs("p", { children: ["Reschedule: ", visit.reschedule.status || "Awaiting doctor decision"] }),
					(visit.reschedule.start_time || visit.reschedule.new_start_time) && /* @__PURE__ */ jsxs("p", { children: ["Replacement: ", homeTime(visit.reschedule.start_time || visit.reschedule.new_start_time || "", visit.provider_timezone)] }),
					/* @__PURE__ */ jsx("p", { children: "The original appointment remains reserved until the replacement is accepted." })
				]
			}),
			visit.clinical_notes?.summary && /* @__PURE__ */ jsxs("details", { children: [
				/* @__PURE__ */ jsx("summary", { children: "Saved clinical encounter" }),
				/* @__PURE__ */ jsx("p", {
					className: "hv-policy",
					children: visit.clinical_notes.summary
				}),
				visit.clinical_notes.follow_up && /* @__PURE__ */ jsxs("p", {
					className: "hv-policy",
					children: ["Follow-up: ", visit.clinical_notes.follow_up]
				}),
				visit.clinical_notes.amendments?.map((amendment, index) => /* @__PURE__ */ jsxs("div", {
					className: "hv-note",
					children: [
						/* @__PURE__ */ jsxs("strong", { children: ["Amendment ", index + 1] }),
						/* @__PURE__ */ jsx("p", { children: amendment.summary }),
						/* @__PURE__ */ jsx("p", { children: amendment.follow_up }),
						/* @__PURE__ */ jsxs("small", { children: ["Reason: ", amendment.reason] })
					]
				}, index)),
				/* @__PURE__ */ jsx("p", {
					className: "hv-help",
					children: "Follow-up instructions do not create a new appointment."
				})
			] }),
			receipt?.status === "recorded_pay_at_visit" ? /* @__PURE__ */ jsxs("details", {
				open: true,
				children: [
					/* @__PURE__ */ jsx("summary", { children: "Recorded pay-at-visit receipt" }),
					/* @__PURE__ */ jsxs("p", { children: [
						money(receipt.amount, receipt.currency || visit.currency),
						" · ",
						receipt.method
					] }),
					receipt.recorded_at && /* @__PURE__ */ jsxs("p", { children: ["Recorded ", homeTime(receipt.recorded_at)] }),
					receipt.reference && /* @__PURE__ */ jsxs("p", { children: ["Reference: ", receipt.reference] }),
					/* @__PURE__ */ jsxs("small", { children: [
						"Booking ",
						id,
						". This is an authorised collection record, not gateway-verified payment."
					] })
				]
			}) : /* @__PURE__ */ jsxs("p", { children: [
				"Payment: ",
				receipt?.status || "Unpaid / no collection recorded",
				". Online payment is unavailable."
			] }),
			!!visit.disputes?.length && /* @__PURE__ */ jsxs("details", {
				open: true,
				children: [
					/* @__PURE__ */ jsx("summary", { children: "Disputes" }),
					visit.disputes.map((dispute) => /* @__PURE__ */ jsxs("p", { children: [
						dispute.status,
						" · ",
						homeTime(dispute.opened_at),
						" · ",
						dispute.reason
					] }, dispute.id)),
					/* @__PURE__ */ jsx("p", {
						className: "hv-help",
						children: "Opening a dispute does not erase the encounter or verify a refund."
					})
				]
			}),
			!!visit.events?.length && /* @__PURE__ */ jsxs("details", { children: [/* @__PURE__ */ jsx("summary", { children: "Visit history" }), /* @__PURE__ */ jsx("ul", { children: visit.events.map((event, index) => /* @__PURE__ */ jsxs("li", { children: [
				homeTime(event.created_at),
				" · ",
				event.kind.replaceAll("_", " "),
				event.reason ? ` · ${event.reason}` : ""
			] }, `${event.version}-${index}`)) })] }),
			chatOpen && /* @__PURE__ */ jsx(TwoWayChatModal, {
				reference: {
					source: "doctor_appointment",
					sourceId: id
				},
				onClose: () => setChatOpen(false)
			})
		]
	});
}
function RescheduleForm({ visit, busy, onSubmit, onClose }) {
	const [date, setDate] = useState("");
	const [slots, setSlots] = useState([]);
	const [start, setStart] = useState("");
	const [quote, setQuote] = useState(null);
	const [reason, setReason] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	async function discover() {
		setLoading(true);
		setError("");
		setQuote(null);
		try {
			const rows = await homeVisits.discover({
				pincode: visit.address_snapshot?.pincode || "",
				is_now: false,
				date
			});
			setSlots(rows.find((p) => p.provider_id === visit.provider_id)?.slots || []);
		} catch (e) {
			setError(homeVisitError(e));
		} finally {
			setLoading(false);
		}
	}
	return /* @__PURE__ */ jsxs("div", {
		className: "hv-note",
		children: [
			/* @__PURE__ */ jsx("p", { children: "The original visit stays booked while a replacement is reviewed. Changing the address requires a separate coverage and quote review; this reschedule keeps the saved address." }),
			error && /* @__PURE__ */ jsx("p", {
				className: "hv-error",
				role: "alert",
				children: error
			}),
			/* @__PURE__ */ jsxs("fieldset", {
				disabled: busy || loading,
				children: [
					/* @__PURE__ */ jsxs("label", { children: ["New date", /* @__PURE__ */ jsx("input", {
						type: "date",
						value: date,
						onChange: (e) => {
							setDate(e.target.value);
							setSlots([]);
							setStart("");
							setQuote(null);
						}
					})] }),
					/* @__PURE__ */ jsx("button", {
						disabled: !date,
						onClick: () => void discover(),
						children: "Find replacement slots"
					}),
					slots.length > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("label", { children: ["Replacement time", /* @__PURE__ */ jsxs("select", {
						value: start,
						onChange: (e) => {
							setStart(e.target.value);
							setQuote(null);
						},
						children: [/* @__PURE__ */ jsx("option", {
							value: "",
							children: "Select a slot"
						}), slots.map((s) => /* @__PURE__ */ jsx("option", {
							value: s.start_time,
							children: homeTime(s.start_time, visit.provider_timezone)
						}, s.start_time))]
					})] }), /* @__PURE__ */ jsx("button", {
						disabled: !start,
						onClick: async () => {
							setLoading(true);
							setError("");
							try {
								setQuote(await homeVisits.quote({
									booking_id: visit.id || visit.booking_id,
									provider_id: visit.provider_id,
									routing: "named",
									is_now: false,
									pincode: visit.address_snapshot?.pincode || "",
									start_time: start
								}));
							} catch (e) {
								setError(homeVisitError(e));
							} finally {
								setLoading(false);
							}
						},
						children: "Review replacement quote"
					})] }),
					quote && /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsxs("p", { children: [
							homeTime(quote.start_time, visit.provider_timezone),
							" · ",
							money(quote.total, quote.currency),
							" · ",
							quote.payment_method
						] }),
						/* @__PURE__ */ jsxs("label", { children: ["Reason", /* @__PURE__ */ jsx("input", {
							required: true,
							value: reason,
							onChange: (e) => setReason(e.target.value)
						})] }),
						/* @__PURE__ */ jsx("button", {
							disabled: !reason.trim(),
							onClick: () => void onSubmit(quote, reason),
							children: "Agree to quote and request replacement"
						})
					] }),
					/* @__PURE__ */ jsx("button", {
						onClick: onClose,
						children: "Close reschedule"
					})
				]
			})
		]
	});
}
function ProviderHomeSettings() {
	const { session } = useSession();
	return /* @__PURE__ */ jsx(ProviderSettingsForm, {}, session?.user.id || "signed-out");
}
function ProviderSettingsForm() {
	const [settings, setSettings] = useState(null);
	const [loaded, setLoaded] = useState(false);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState("");
	async function load() {
		if (loaded) return;
		setBusy(true);
		try {
			setSettings(await homeVisits.settings());
			setLoaded(true);
		} catch (e) {
			setMessage(homeVisitError(e));
		} finally {
			setBusy(false);
		}
	}
	function initialise() {
		setSettings({
			enabled: false,
			coverage_pincodes: [],
			fee: 0,
			currency: "INR",
			duration_minutes: 0,
			buffer_before_minutes: 0,
			buffer_after_minutes: 0,
			lead_minutes: 0,
			horizon_days: 0,
			acceptance_minutes: 0,
			timezone: ""
		});
	}
	return /* @__PURE__ */ jsxs("details", {
		className: "hv-card",
		onToggle: (e) => {
			if (e.currentTarget.open) load();
		},
		children: [
			/* @__PURE__ */ jsx("summary", { children: "Publish home-service settings" }),
			/* @__PURE__ */ jsx("p", { children: "Only authorised, registration-verified doctors may publish. Immediate Online/Offline is separate from future home appointments." }),
			/* @__PURE__ */ jsx("p", { children: /* @__PURE__ */ jsx("a", {
				href: "/provider/availability",
				children: "Set working hours, leave and DND"
			}) }),
			message && /* @__PURE__ */ jsx("p", {
				role: "status",
				children: message
			}),
			loaded && !settings && /* @__PURE__ */ jsx("button", {
				onClick: initialise,
				children: "Configure home visits"
			}),
			settings && /* @__PURE__ */ jsx("form", {
				onSubmit: async (e) => {
					e.preventDefault();
					setBusy(true);
					setMessage("");
					try {
						setSettings(await homeVisits.saveSettings(settings));
						setMessage("Home-service settings saved. Pilot access remains controlled by the approved policy.");
					} catch (err) {
						setMessage(homeVisitError(err));
					} finally {
						setBusy(false);
					}
				},
				children: /* @__PURE__ */ jsxs("fieldset", {
					disabled: busy,
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "hv-check",
							children: [/* @__PURE__ */ jsx("input", {
								type: "checkbox",
								checked: settings.enabled,
								onChange: (e) => setSettings({
									...settings,
									enabled: e.target.checked
								})
							}), "Offer home visits during my published hours"]
						}),
						/* @__PURE__ */ jsxs("label", { children: ["Coverage pincodes (comma separated)", /* @__PURE__ */ jsx("input", {
							required: true,
							value: settings.coverage_pincodes.join(","),
							onChange: (e) => setSettings({
								...settings,
								coverage_pincodes: e.target.value.split(",").map((x) => x.trim())
							})
						})] }),
						/* @__PURE__ */ jsxs("label", { children: ["Provider IANA timezone", /* @__PURE__ */ jsx("input", {
							required: true,
							placeholder: "e.g. Asia/Kolkata",
							value: settings.timezone,
							onChange: (e) => setSettings({
								...settings,
								timezone: e.target.value
							})
						})] }),
						/* @__PURE__ */ jsx("div", {
							className: "hv-grid",
							children: [
								["fee", "Consultation fee (INR)"],
								["duration_minutes", "Consultation duration (minutes)"],
								["buffer_before_minutes", "Travel before (minutes)"],
								["buffer_after_minutes", "Travel after (minutes)"],
								["lead_minutes", "Advance lead time (minutes)"],
								["horizon_days", "Booking horizon (days)"],
								["acceptance_minutes", "Pending acceptance deadline (minutes)"]
							].map(([key, label]) => /* @__PURE__ */ jsxs("label", { children: [label, /* @__PURE__ */ jsx("input", {
								required: true,
								type: "number",
								min: "0",
								step: key === "fee" ? "0.01" : "1",
								value: settings[key],
								onChange: (e) => setSettings({
									...settings,
									[key]: Number(e.target.value)
								})
							})] }, key))
						}),
						/* @__PURE__ */ jsx("p", {
							className: "hv-help",
							children: "Use approved fees and explicit conservative travel buffers. These are reserved capacity, not route estimates. Real-patient activation requires the owner-approved service policy."
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							children: "Save home-service settings"
						})
					]
				})
			})
		]
	});
}
function HomeVisitOperations() {
	const { session } = useSession();
	return /* @__PURE__ */ jsx(OperationsView, {}, session?.user.id || "signed-out");
}
function OperationsView() {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState("");
	const [busy, setBusy] = useState(false);
	return /* @__PURE__ */ jsxs("section", {
		className: "hv hv-card",
		children: [
			/* @__PURE__ */ jsx("h3", { children: "Home-visit operations" }),
			/* @__PURE__ */ jsx("p", { children: "Permission-scoped unaccepted requests, delays and notification failures." }),
			/* @__PURE__ */ jsx("button", {
				disabled: busy,
				onClick: async () => {
					setBusy(true);
					setError("");
					try {
						setRows(await homeVisits.operations());
					} catch (e) {
						setError(homeVisitError(e));
					} finally {
						setBusy(false);
					}
				},
				children: "Refresh operations"
			}),
			error && /* @__PURE__ */ jsx("p", {
				className: "hv-error",
				role: "alert",
				children: error
			}),
			rows.map((row, i) => /* @__PURE__ */ jsx("article", {
				className: "hv-card",
				children: Object.entries(row).map(([key, value]) => /* @__PURE__ */ jsxs("p", { children: [
					/* @__PURE__ */ jsxs("strong", { children: [key.replaceAll("_", " "), ":"] }),
					" ",
					typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")
				] }, key))
			}, String(row.id || i)))
		]
	});
}
//#endregion
export { money as a, clearRecoveryReference as c, readRecoveryReference as d, recoveryReference as f, homeTime as i, homeVisitError as l, HomeVisitPanel as n, TwoWayChatModal as o, ProviderHomeSettings as r, HomeVisitRpcError as s, HomeVisitOperations as t, homeVisits as u };
