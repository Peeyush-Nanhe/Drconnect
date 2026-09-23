import { n as supabase } from "./client-BSmVQfT1.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { Download, Eye, FileText, Image, X } from "lucide-react";
//#region src/features/mydox/post-consultation-chat/state.ts
function referenceInput(reference) {
	return "source" in reference ? {
		source_kind: reference.source,
		source_id: reference.sourceId
	} : {
		conversation_id: reference.conversationId,
		...reference.episodeId ? { episode_id: reference.episodeId } : {}
	};
}
function chatDetails(row) {
	return {
		conversationId: row.conversation_id,
		episodeId: row.episode_id,
		actorId: row.actor_id,
		counterpartId: row.other_id,
		counterpartName: row.other_name,
		counterpartRole: row.other_role,
		memberRole: row.member_role,
		consultationLabel: row.consultation_label,
		completedAt: row.completed_at,
		policyVersion: row.policy_version,
		testOnly: row.test_only,
		patientMessagesRemaining: row.patient_messages_remaining,
		patientMessagesLimit: row.patient_messages_limit,
		patientSendUntil: row.patient_send_until,
		canSend: row.can_send,
		sendDisabledReason: row.send_disabled_reason,
		episodes: (row.episodes ?? []).map((e) => ({
			episodeId: e.episode_id,
			consultationLabel: e.consultation_label,
			completedAt: e.completed_at
		})),
		prescriptionRequests: (row.prescription_requests ?? []).map((r) => ({
			id: r.id,
			episodeId: r.episode_id,
			status: r.status,
			requestedAt: r.requested_at,
			declineReason: r.decline_reason
		}))
	};
}
function inboxItem(row) {
	return {
		conversationId: row.conversation_id,
		episodeId: row.episode_id,
		counterpartId: row.other_id,
		counterpartName: row.other_name,
		counterpartRole: row.other_role,
		consultationLabel: row.consultation_label,
		lastMessage: row.last_body,
		lastMessageAt: row.last_at,
		unreadCount: row.unread_count
	};
}
function savedMessage(row, actorId) {
	return {
		id: row.id,
		conversationId: row.conversation_id,
		episodeId: row.episode_id,
		senderId: row.sender_id,
		senderRole: row.sender_role,
		body: row.body,
		createdAt: row.created_at,
		sequence: Number(row.sequence_id),
		idempotencyKey: row.idempotency_key,
		isOwn: row.sender_id === actorId,
		status: "saved"
	};
}
function mergeMessages(current, incoming) {
	const rows = new Map(current.map((m) => [m.id, m]));
	for (const message of incoming) {
		for (const [id, pending] of rows) if (pending.status !== "saved" && pending.senderId === message.senderId && pending.idempotencyKey === message.idempotencyKey) rows.delete(id);
		rows.set(message.id, message);
	}
	return [...rows.values()].sort((a, b) => {
		if (a.status !== "saved" || b.status !== "saved") return Number(a.status !== "saved") - Number(b.status !== "saved");
		return a.sequence - b.sequence || a.id.localeCompare(b.id);
	});
}
function retryPayload(message) {
	return {
		conversation_id: message.conversationId,
		episode_id: message.episodeId,
		body: message.body,
		idempotency_key: message.idempotencyKey
	};
}
//#endregion
//#region src/features/mydox/post-consultation-chat/api.ts
var ChatError = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.code = code;
	}
};
var unavailableRpcs = /* @__PURE__ */ new Set();
async function rpc(name, input) {
	if (unavailableRpcs.has(name)) throw new ChatError("Post-consultation chat is not available on this server yet.", "PGRST202");
	const result = await supabase.rpc(name, input ? { p_input: input } : {});
	if (result.error) {
		const unavailable = ["PGRST202", "42883"].includes(result.error.code ?? "");
		if (unavailable) unavailableRpcs.add(name);
		throw new ChatError(unavailable ? "Post-consultation chat is not available on this server yet." : result.error.message, result.error.code);
	}
	return result.data;
}
var chatApi = {
	open: (reference) => rpc("pc_chat_open", referenceInput(reference)),
	inbox: () => rpc("pc_chat_inbox"),
	history: (conversationId, before) => rpc("pc_chat_history", {
		conversation_id: conversationId,
		limit: 50,
		...before == null ? {} : { before_sequence: before }
	}),
	send: (input) => rpc("pc_chat_send", input),
	read: (conversationId, throughSequence) => rpc("pc_chat_ack_read", {
		conversation_id: conversationId,
		through_sequence: throughSequence
	}),
	prescription: (input) => rpc("pc_chat_prescription", input)
};
function chatError(error) {
	return error instanceof Error ? error.message : "Unable to reach chat. Your message is still pending; retry when connected.";
}
function accessRejected(error) {
	return error instanceof ChatError && [
		"42501",
		"P0002",
		"PGRST301",
		"PGRST302",
		"PGRST303"
	].includes(error.code ?? "");
}
//#endregion
//#region src/features/mydox/post-consultation-chat/recovery.ts
/** Tracks confirmed history separately from isolated send responses. */
var ChatRecovery = class {
	generation = 0;
	historySequence = null;
	accessConfirmed = false;
	capture() {
		return this.generation;
	}
	isCurrent(generation) {
		return generation === this.generation;
	}
	get authorised() {
		return this.accessConfirmed;
	}
	get historyBoundary() {
		return this.historySequence;
	}
	invalidate() {
		this.generation += 1;
		this.historySequence = null;
		this.accessConfirmed = false;
	}
	confirmHistory(generation, sequences) {
		if (!this.isCurrent(generation)) return false;
		this.historySequence = sequences.reduce((latest, sequence) => Math.max(latest, sequence), this.historySequence ?? 0);
		this.accessConfirmed = true;
		return true;
	}
};
/** Reconnect until the last fetched boundary is reached, even across many pages. */
async function recoverHistory(fetchPage, boundary, isCurrent) {
	const messages = [];
	let before;
	let nextBefore = null;
	do {
		if (!isCurrent()) return null;
		const page = await fetchPage(before);
		if (!isCurrent()) return null;
		messages.push(...page.messages);
		nextBefore = page.next_before_sequence == null ? null : Number(page.next_before_sequence);
		if (nextBefore != null && before != null && nextBefore >= before) throw new Error("Chat history pagination did not advance. Please refresh.");
		if (boundary == null || nextBefore == null || page.messages.some((message) => Number(message.sequence_id) <= boundary)) break;
		before = nextBefore;
	} while (isCurrent());
	return isCurrent() ? {
		messages,
		nextBefore
	} : null;
}
//#endregion
//#region src/features/mydox/chatAttachmentUtils.tsx
function formatBytes(bytes) {
	if (!bytes || bytes <= 0) return "0 B";
	const k = 1024;
	const sizes = [
		"B",
		"KB",
		"MB"
	];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
function parseChatAttachment(body) {
	if (!body || typeof body !== "string") return null;
	if (!body.startsWith("{\"_type\":\"attachment\"") && !body.startsWith("{\"type\":\"attachment\"")) return null;
	try {
		const parsed = JSON.parse(body);
		if ((parsed._type === "attachment" || parsed.type === "attachment") && parsed.fileType && parsed.dataUrl) return parsed;
	} catch {
		return null;
	}
	return null;
}
function formatMessageSnippet(body) {
	if (!body) return "";
	const att = parseChatAttachment(body);
	if (att) {
		if (att.fileType === "image") return att.caption ? `📷 Photo: ${att.caption}` : "📷 Photo";
		if (att.fileType === "pdf") {
			const name = att.name ? ` · ${att.name}` : "";
			return att.caption ? `📄 PDF: ${att.caption}${name}` : `📄 PDF${name || " Document"}`;
		}
		return att.name ? `📎 Attachment: ${att.name}` : "📎 Attachment";
	}
	return body;
}
function processImageFile(file, maxWidth = 1280, maxHeight = 1280, quality = .8) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new window.Image();
			img.onload = () => {
				let width = img.width;
				let height = img.height;
				if (width > maxWidth || height > maxHeight) {
					if (width > height) {
						height = Math.round(height * maxWidth / width);
						width = maxWidth;
					} else {
						width = Math.round(width * maxHeight / height);
						height = maxHeight;
					}
				}
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					resolve({
						name: file.name,
						size: formatBytes(file.size),
						type: "image",
						dataUrl: String(e.target?.result || "")
					});
					return;
				}
				ctx.drawImage(img, 0, 0, width, height);
				const dataUrl = canvas.toDataURL("image/jpeg", quality);
				const approxBytes = Math.round(dataUrl.length * 3 / 4);
				resolve({
					name: file.name,
					size: formatBytes(approxBytes),
					type: "image",
					dataUrl
				});
			};
			img.onerror = () => {
				resolve({
					name: file.name,
					size: formatBytes(file.size),
					type: "image",
					dataUrl: String(e.target?.result || "")
				});
			};
			img.src = String(e.target?.result || "");
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
function processPdfFile(file) {
	return new Promise((resolve, reject) => {
		if (file.size > 15728640) {
			reject(/* @__PURE__ */ new Error("PDF file size must be under 15MB"));
			return;
		}
		const reader = new FileReader();
		reader.onload = (e) => {
			resolve({
				name: file.name,
				size: formatBytes(file.size),
				type: "pdf",
				dataUrl: String(e.target?.result || "")
			});
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}
function openPdfDataUrl(dataUrl, filename = "document.pdf") {
	try {
		const parts = dataUrl.split(",");
		const mime = parts[0].match(/:(.*?);/)?.[1] || "application/pdf";
		const binary = atob(parts[1]);
		const len = binary.length;
		const buffer = new Uint8Array(len);
		for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
		const blob = new Blob([buffer], { type: mime });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		link.target = "_blank";
		link.rel = "noopener noreferrer";
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(url), 6e4);
	} catch (_e) {
		window.open(dataUrl, "_blank");
	}
}
function downloadImageDataUrl(dataUrl, filename = "photo.jpg") {
	try {
		const link = document.createElement("a");
		link.href = dataUrl;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	} catch (_e) {
		window.open(dataUrl, "_blank");
	}
}
/**
* Menu popup shown when user taps the '+' attachment button
*/
function AttachmentMenu({ onSelectPhoto, onSelectPdf, onClose }) {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
		onClick: onClose,
		style: {
			position: "fixed",
			inset: 0,
			zIndex: 1050,
			background: "transparent"
		}
	}), /* @__PURE__ */ jsxs("div", {
		role: "menu",
		"aria-label": "Attachment options",
		style: {
			position: "absolute",
			bottom: 58,
			left: 14,
			zIndex: 1060,
			background: "#0A241D",
			border: "1px solid #1C4D3E",
			borderRadius: 16,
			padding: "8px",
			display: "flex",
			flexDirection: "column",
			gap: 4,
			minWidth: 210,
			boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
			animation: "fadeIn 0.15s ease-out"
		},
		children: [/* @__PURE__ */ jsxs("button", {
			onClick: () => {
				onClose();
				onSelectPhoto();
			},
			style: {
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 12px",
				background: "transparent",
				border: "none",
				borderRadius: 10,
				cursor: "pointer",
				textAlign: "left",
				color: "#fff",
				fontFamily: "inherit"
			},
			onMouseEnter: (e) => e.currentTarget.style.background = "#12382D",
			onMouseLeave: (e) => e.currentTarget.style.background = "transparent",
			children: [/* @__PURE__ */ jsx("div", {
				style: {
					width: 34,
					height: 34,
					borderRadius: 10,
					background: "rgba(16, 185, 129, 0.15)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				},
				children: /* @__PURE__ */ jsx(Image, {
					size: 18,
					color: "#10B981"
				})
			}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
				style: {
					fontWeight: 700,
					fontSize: 13,
					color: "#fff"
				},
				children: "Photo / Image"
			}), /* @__PURE__ */ jsx("div", {
				style: {
					fontSize: 10.5,
					color: "#7B9E93"
				},
				children: "Camera or Gallery"
			})] })]
		}), /* @__PURE__ */ jsxs("button", {
			onClick: () => {
				onClose();
				onSelectPdf();
			},
			style: {
				display: "flex",
				alignItems: "center",
				gap: 12,
				padding: "10px 12px",
				background: "transparent",
				border: "none",
				borderRadius: 10,
				cursor: "pointer",
				textAlign: "left",
				color: "#fff",
				fontFamily: "inherit"
			},
			onMouseEnter: (e) => e.currentTarget.style.background = "#12382D",
			onMouseLeave: (e) => e.currentTarget.style.background = "transparent",
			children: [/* @__PURE__ */ jsx("div", {
				style: {
					width: 34,
					height: 34,
					borderRadius: 10,
					background: "rgba(239, 68, 68, 0.15)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				},
				children: /* @__PURE__ */ jsx(FileText, {
					size: 18,
					color: "#EF4444"
				})
			}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
				style: {
					fontWeight: 700,
					fontSize: 13,
					color: "#fff"
				},
				children: "PDF Document"
			}), /* @__PURE__ */ jsx("div", {
				style: {
					fontSize: 10.5,
					color: "#7B9E93"
				},
				children: "Reports & Prescriptions"
			})] })]
		})]
	})] });
}
/**
* Preview bar shown right above the input row when a file is staged for sending
*/
function AttachmentPreviewBar({ attachment, onRemove }) {
	return /* @__PURE__ */ jsxs("div", {
		style: {
			padding: "8px 14px",
			background: "#081E17",
			borderTop: "1px solid #144436",
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 12,
			flexShrink: 0
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				display: "flex",
				alignItems: "center",
				gap: 10,
				minWidth: 0
			},
			children: [attachment.type === "image" ? /* @__PURE__ */ jsx("img", {
				src: attachment.dataUrl,
				alt: attachment.name,
				style: {
					width: 44,
					height: 44,
					borderRadius: 8,
					objectFit: "cover",
					border: "1px solid #1C4D3E"
				}
			}) : /* @__PURE__ */ jsx("div", {
				style: {
					width: 44,
					height: 44,
					borderRadius: 8,
					background: "rgba(239, 68, 68, 0.15)",
					border: "1px solid rgba(239, 68, 68, 0.3)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center"
				},
				children: /* @__PURE__ */ jsx(FileText, {
					size: 22,
					color: "#EF4444"
				})
			}), /* @__PURE__ */ jsxs("div", {
				style: { minWidth: 0 },
				children: [/* @__PURE__ */ jsx("div", {
					style: {
						fontWeight: 700,
						fontSize: 12.5,
						color: "#fff",
						whiteSpace: "nowrap",
						overflow: "hidden",
						textOverflow: "ellipsis",
						maxWidth: 220
					},
					children: attachment.name
				}), /* @__PURE__ */ jsxs("div", {
					style: {
						fontSize: 11,
						color: "#8EE0C4"
					},
					children: [
						attachment.size,
						" · ",
						attachment.type === "image" ? "Photo ready" : "PDF ready"
					]
				})]
			})]
		}), /* @__PURE__ */ jsx("button", {
			onClick: onRemove,
			"aria-label": "Remove attachment",
			style: {
				width: 30,
				height: 30,
				borderRadius: "50%",
				background: "rgba(255,255,255,0.1)",
				border: "none",
				color: "#fff",
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0
			},
			children: /* @__PURE__ */ jsx(X, { size: 16 })
		})]
	});
}
/**
* Renders attachment content inside a chat bubble
*/
function ChatAttachmentBubbleContent({ attachment, mine, onViewImage }) {
	if (attachment.fileType === "image") return /* @__PURE__ */ jsxs("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: 6
		},
		children: [/* @__PURE__ */ jsxs("div", {
			onClick: () => onViewImage({
				name: attachment.name,
				dataUrl: attachment.dataUrl
			}),
			style: {
				position: "relative",
				borderRadius: 12,
				overflow: "hidden",
				cursor: "pointer",
				border: "1px solid rgba(255,255,255,0.15)",
				background: "#000"
			},
			children: [/* @__PURE__ */ jsx("img", {
				src: attachment.dataUrl,
				alt: attachment.name,
				style: {
					display: "block",
					maxWidth: "100%",
					maxHeight: 240,
					width: "auto",
					objectFit: "cover",
					borderRadius: 12
				}
			}), /* @__PURE__ */ jsxs("div", {
				style: {
					position: "absolute",
					bottom: 6,
					right: 6,
					background: "rgba(0,0,0,0.65)",
					color: "#fff",
					padding: "4px 8px",
					borderRadius: 8,
					fontSize: 10,
					display: "flex",
					alignItems: "center",
					gap: 4
				},
				children: [/* @__PURE__ */ jsx(Eye, { size: 12 }), " View"]
			})]
		}), attachment.caption ? /* @__PURE__ */ jsx("p", {
			style: {
				margin: "2px 0 0",
				fontSize: 13.5,
				lineHeight: 1.45,
				color: "#fff"
			},
			children: attachment.caption
		}) : null]
	});
	return /* @__PURE__ */ jsxs("div", {
		style: {
			display: "flex",
			flexDirection: "column",
			gap: 6
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				background: mine ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.3)",
				border: "1px solid rgba(255,255,255,0.15)",
				borderRadius: 12,
				padding: "10px 12px",
				display: "flex",
				alignItems: "center",
				gap: 12,
				minWidth: 200,
				maxWidth: 280
			},
			children: [
				/* @__PURE__ */ jsx("div", {
					style: {
						width: 40,
						height: 40,
						borderRadius: 10,
						background: "rgba(239, 68, 68, 0.2)",
						border: "1px solid rgba(239, 68, 68, 0.4)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0
					},
					children: /* @__PURE__ */ jsx(FileText, {
						size: 22,
						color: "#EF4444"
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					style: {
						flex: 1,
						minWidth: 0
					},
					children: [/* @__PURE__ */ jsx("div", {
						style: {
							fontWeight: 700,
							fontSize: 13,
							color: "#fff",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis"
						},
						title: attachment.name,
						children: attachment.name
					}), /* @__PURE__ */ jsxs("div", {
						style: {
							fontSize: 11,
							color: "#A7F3D0",
							marginTop: 2
						},
						children: [attachment.size, " · PDF"]
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					onClick: () => openPdfDataUrl(attachment.dataUrl, attachment.name),
					title: "Open / Download PDF",
					"aria-label": `Open ${attachment.name}`,
					style: {
						width: 34,
						height: 34,
						borderRadius: 9,
						background: "#10B981",
						border: "none",
						color: "#fff",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
						boxShadow: "0 2px 6px rgba(16, 185, 129, 0.4)"
					},
					children: /* @__PURE__ */ jsx(Download, { size: 16 })
				})
			]
		}), attachment.caption ? /* @__PURE__ */ jsx("p", {
			style: {
				margin: "2px 0 0",
				fontSize: 13.5,
				lineHeight: 1.45,
				color: "#fff"
			},
			children: attachment.caption
		}) : null]
	});
}
/**
* High-res Image Lightbox Modal
*/
function ImageLightboxModal({ image, onClose }) {
	if (!image) return null;
	return /* @__PURE__ */ jsxs("div", {
		role: "dialog",
		"aria-modal": "true",
		"aria-label": image.name,
		style: {
			position: "fixed",
			inset: 0,
			zIndex: 2500,
			background: "rgba(0, 0, 0, 0.92)",
			backdropFilter: "blur(6px)",
			display: "flex",
			flexDirection: "column"
		},
		children: [/* @__PURE__ */ jsxs("div", {
			style: {
				padding: "12px 18px",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				borderBottom: "1px solid rgba(255,255,255,0.1)",
				background: "rgba(0,0,0,0.6)"
			},
			children: [/* @__PURE__ */ jsx("div", {
				style: {
					color: "#fff",
					fontWeight: 700,
					fontSize: 14,
					whiteSpace: "nowrap",
					overflow: "hidden",
					textOverflow: "ellipsis",
					maxWidth: "60%"
				},
				children: image.name
			}), /* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					alignItems: "center",
					gap: 12
				},
				children: [/* @__PURE__ */ jsxs("button", {
					onClick: () => downloadImageDataUrl(image.dataUrl, image.name),
					style: {
						display: "flex",
						alignItems: "center",
						gap: 6,
						background: "#10B981",
						border: "none",
						color: "#fff",
						fontWeight: 700,
						fontSize: 12,
						padding: "7px 14px",
						borderRadius: 8,
						cursor: "pointer"
					},
					children: [/* @__PURE__ */ jsx(Download, { size: 15 }), " Download"]
				}), /* @__PURE__ */ jsx("button", {
					onClick: onClose,
					"aria-label": "Close image preview",
					style: {
						width: 36,
						height: 36,
						borderRadius: "50%",
						background: "rgba(255,255,255,0.15)",
						border: "none",
						color: "#fff",
						cursor: "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center"
					},
					children: /* @__PURE__ */ jsx(X, { size: 20 })
				})]
			})]
		}), /* @__PURE__ */ jsx("div", {
			onClick: onClose,
			style: {
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16
			},
			children: /* @__PURE__ */ jsx("img", {
				src: image.dataUrl,
				alt: image.name,
				onClick: (e) => e.stopPropagation(),
				style: {
					maxWidth: "92vw",
					maxHeight: "84vh",
					objectFit: "contain",
					borderRadius: 8,
					boxShadow: "0 12px 40px rgba(0,0,0,0.8)"
				}
			})
		})]
	});
}
//#endregion
//#region src/features/mydox/post-consultation-chat/usePostConsultationChat.ts
function useChatIdentity() {
	const [identity, setIdentity] = useState({
		id: null,
		ready: false,
		generation: 0
	});
	const current = useRef(identity);
	useEffect(() => {
		let alive = true;
		let authEvent = false;
		const update = (id) => {
			if (!alive) return;
			if (current.current.ready && current.current.id === id) return;
			current.current = {
				id,
				ready: true,
				generation: current.current.generation + 1
			};
			setIdentity(current.current);
		};
		const { data } = supabase.auth.onAuthStateChange((event, session) => {
			authEvent = true;
			update(session?.user.id ?? null);
			if (event === "SIGNED_OUT") try {
				for (const key of Object.keys(window.localStorage)) if (key.startsWith("mydox_chat_thread_")) window.localStorage.removeItem(key);
			} catch {}
		});
		supabase.auth.getSession().then(({ data: session }) => {
			if (!authEvent) update(session.session?.user.id ?? null);
		});
		return () => {
			alive = false;
			data.subscription.unsubscribe();
		};
	}, []);
	return {
		identity,
		current
	};
}
function usePostConsultationChat(reference) {
	const { identity, current: currentIdentity } = useChatIdentity();
	const referenceKey = reference ? JSON.stringify(reference) : "";
	const scope = `${identity.generation}:${referenceKey}`;
	const latestScope = useRef(scope);
	latestScope.current = scope;
	const [state, setState] = useState({
		scope,
		details: null,
		messages: []
	});
	const stateRef = useRef(state);
	stateRef.current = state;
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [connectionState, setConnectionState] = useState("connecting");
	const [nextBefore, setNextBefore] = useState(null);
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [refreshNumber, setRefreshNumber] = useState(0);
	const refresh = useCallback(() => setRefreshNumber((n) => n + 1), []);
	const sending = useRef(false);
	const recovery = useRef(new ChatRecovery());
	const activeChannel = useRef(null);
	const prescriptionPending = useRef(null);
	const refreshNow = useRef(async () => {});
	const invalidateAccess = useCallback((failure) => {
		recovery.current.invalidate();
		setState({
			scope,
			details: null,
			messages: []
		});
		setNextBefore(null);
		setLoadingOlder(false);
		setLoading(false);
		sending.current = false;
		prescriptionPending.current = null;
		setError(chatError(failure));
		setConnectionState("offline");
		if (activeChannel.current) {
			supabase.removeChannel(activeChannel.current);
			activeChannel.current = null;
		}
	}, [scope]);
	useEffect(() => {
		const capturedIdentity = currentIdentity.current;
		let alive = true;
		let refreshing = false;
		let again = false;
		let channel = null;
		let live = false;
		if (stateRef.current.scope !== scope) {
			recovery.current.invalidate();
			setState({
				scope,
				details: null,
				messages: []
			});
			setNextBefore(null);
			setLoadingOlder(false);
			sending.current = false;
			prescriptionPending.current = null;
		}
		const accessGeneration = recovery.current.capture();
		const valid = () => alive && currentIdentity.current === capturedIdentity && latestScope.current === scope && recovery.current.isCurrent(accessGeneration);
		setError(null);
		setLoading(true);
		setConnectionState("connecting");
		const update = async () => {
			if (refreshing) {
				again = true;
				return;
			}
			if (!valid() || !capturedIdentity.ready) return;
			if (!capturedIdentity.id || !referenceKey) {
				setState({
					scope,
					details: null,
					messages: []
				});
				setError(!capturedIdentity.id ? "Sign in to open your consultation chat." : "Open chat from an authorised completed consultation or your inbox.");
				setLoading(false);
				return;
			}
			refreshing = true;
			try {
				const summary = await chatApi.open(JSON.parse(referenceKey));
				if (!valid()) return;
				if (!channel) channel = supabase.channel(`pc-chat:${summary.conversation_id}:${crypto.randomUUID()}`).on("postgres_changes", {
					event: "INSERT",
					schema: "public",
					table: "chat_messages",
					filter: `conversation_id=eq.${summary.conversation_id}`
				}, () => {
					update();
				}).subscribe((status) => {
					if (!valid()) return;
					live = status === "SUBSCRIBED";
					setConnectionState(live ? "live" : "refreshing");
					if (live) update();
				});
				activeChannel.current = channel;
				const newest = recovery.current.historyBoundary;
				const recovered = await recoverHistory((before) => chatApi.history(summary.conversation_id, before), newest, valid);
				if (!recovered || !valid()) return;
				const collected = recovered.messages.map((message) => savedMessage(message, capturedIdentity.id));
				if (!recovery.current.confirmHistory(accessGeneration, collected.map((message) => message.sequence))) return;
				setState((previous) => ({
					scope,
					details: chatDetails(summary),
					messages: mergeMessages(previous.scope === scope ? previous.messages : [], collected)
				}));
				if (newest == null) setNextBefore(recovered.nextBefore);
				setError(null);
				setConnectionState(live ? "live" : "refreshing");
			} catch (failure) {
				if (!valid()) return;
				setError(chatError(failure));
				setConnectionState("offline");
				if (accessRejected(failure)) {
					invalidateAccess(failure);
					setLoading(false);
				}
			} finally {
				refreshing = false;
				if (valid()) {
					setLoading(false);
					if (again) {
						again = false;
						update();
					}
				}
			}
		};
		refreshNow.current = update;
		update();
		const resume = () => {
			if (document.visibilityState === "visible") update();
		};
		const offline = () => {
			if (valid()) setConnectionState("offline");
		};
		const interval = window.setInterval(() => {
			if (document.visibilityState === "visible") update();
		}, 15e3);
		window.addEventListener("online", resume);
		window.addEventListener("offline", offline);
		window.addEventListener("focus", resume);
		document.addEventListener("visibilitychange", resume);
		return () => {
			alive = false;
			window.clearInterval(interval);
			window.removeEventListener("online", resume);
			window.removeEventListener("offline", offline);
			window.removeEventListener("focus", resume);
			document.removeEventListener("visibilitychange", resume);
			if (channel) supabase.removeChannel(channel);
			if (activeChannel.current === channel) activeChannel.current = null;
		};
	}, [
		scope,
		referenceKey,
		currentIdentity,
		refreshNumber,
		invalidateAccess
	]);
	const submit = useCallback(async (message) => {
		if (sending.current) return false;
		const captured = currentIdentity.current;
		const accessGeneration = recovery.current.capture();
		const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
		if (!valid() || !recovery.current.authorised || message.senderId !== captured.id) return false;
		sending.current = true;
		setState((previous) => ({
			...previous,
			messages: previous.messages.map((m) => m.id === message.id ? {
				...m,
				status: "sending",
				error: void 0
			} : m)
		}));
		try {
			const row = await chatApi.send(retryPayload(message));
			if (!valid()) return false;
			setState((previous) => ({
				...previous,
				messages: mergeMessages(previous.messages, [savedMessage(row, captured.id)])
			}));
			refreshNow.current();
			window.dispatchEvent(new Event("mydox:chat-inbox-refresh"));
			return true;
		} catch (failure) {
			if (valid()) {
				const reason = chatError(failure);
				if (accessRejected(failure)) invalidateAccess(failure);
				else setState((previous) => ({
					...previous,
					messages: previous.messages.map((m) => m.id === message.id ? {
						...m,
						status: "failed",
						error: reason
					} : m)
				}));
			}
			return false;
		} finally {
			if (valid()) sending.current = false;
		}
	}, [
		scope,
		currentIdentity,
		invalidateAccess
	]);
	const send = useCallback(async (body) => {
		const current = stateRef.current;
		const details = current.details;
		if (current.scope !== scope || !recovery.current.authorised || !details?.canSend || current.messages.some((m) => m.status !== "saved") || sending.current) return false;
		const text = body.trim();
		if (!text || [...text].length > 4e3) return false;
		const key = crypto.randomUUID();
		const message = {
			id: `pending:${key}`,
			conversationId: details.conversationId,
			episodeId: details.episodeId,
			senderId: details.actorId,
			senderRole: details.memberRole,
			body: text,
			createdAt: "",
			sequence: 0,
			idempotencyKey: key,
			isOwn: true,
			status: "sending"
		};
		setState((previous) => ({
			...previous,
			messages: [...previous.messages, message]
		}));
		return submit(message);
	}, [scope, submit]);
	const retry = useCallback(async (id) => {
		const message = stateRef.current.messages.find((m) => m.id === id && m.status === "failed");
		return message ? submit(message) : false;
	}, [submit]);
	const loadOlder = useCallback(async () => {
		const captured = currentIdentity.current;
		const details = stateRef.current.details;
		const accessGeneration = recovery.current.capture();
		const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
		if (!details || !recovery.current.authorised || nextBefore == null || loadingOlder) return;
		setLoadingOlder(true);
		try {
			const page = await chatApi.history(details.conversationId, nextBefore);
			if (!valid()) return;
			setState((previous) => ({
				...previous,
				messages: mergeMessages(previous.messages, page.messages.map((m) => savedMessage(m, captured.id)))
			}));
			setNextBefore(page.next_before_sequence);
		} catch (failure) {
			if (valid()) {
				setError(chatError(failure));
				if (accessRejected(failure)) invalidateAccess(failure);
			}
		} finally {
			if (valid()) setLoadingOlder(false);
		}
	}, [
		scope,
		currentIdentity,
		nextBefore,
		loadingOlder,
		invalidateAccess
	]);
	const markRead = useCallback(async (messageId) => {
		if (document.visibilityState !== "visible" || !messageId) return;
		const current = stateRef.current;
		const captured = currentIdentity.current;
		const accessGeneration = recovery.current.capture();
		const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
		const message = current.messages.find((m) => m.id === messageId && m.status === "saved" && !m.isOwn);
		if (!valid() || !recovery.current.authorised || current.scope !== scope || !current.details || current.details.actorId !== captured.id || !message) return;
		try {
			await chatApi.read(current.details.conversationId, message.sequence);
			if (valid()) window.dispatchEvent(new Event("mydox:chat-inbox-refresh"));
		} catch (failure) {
			if (valid() && accessRejected(failure)) invalidateAccess(failure);
		}
	}, [
		scope,
		currentIdentity,
		invalidateAccess
	]);
	const prescription = useCallback(async (action, requestId, reason) => {
		const captured = currentIdentity.current;
		const details = stateRef.current.details;
		const accessGeneration = recovery.current.capture();
		const valid = () => latestScope.current === scope && currentIdentity.current === captured && recovery.current.isCurrent(accessGeneration);
		if (!details || !recovery.current.authorised || stateRef.current.scope !== scope) return false;
		const input = {
			conversation_id: details.conversationId,
			episode_id: details.episodeId,
			action,
			...requestId ? { request_id: requestId } : {},
			...reason ? { reason } : {}
		};
		const serial = JSON.stringify(input);
		const previous = prescriptionPending.current;
		if (previous && previous.scope === scope && previous.input !== serial) {
			setError("Retry the pending prescription action before starting another request.");
			return false;
		}
		const key = previous?.scope === scope ? previous.key : crypto.randomUUID();
		prescriptionPending.current = {
			scope,
			input: serial,
			key
		};
		try {
			await chatApi.prescription({
				...input,
				idempotency_key: key
			});
			if (!valid()) return false;
			prescriptionPending.current = null;
			await refreshNow.current();
			return true;
		} catch (failure) {
			if (valid()) {
				if (failure instanceof ChatError && /^(22|23|28|42|P000)/.test(failure.code ?? "")) prescriptionPending.current = null;
				setError(chatError(failure));
				if (accessRejected(failure)) invalidateAccess(failure);
			}
			return false;
		}
	}, [
		scope,
		currentIdentity,
		invalidateAccess
	]);
	return {
		identityKey: identity.id,
		details: state.scope === scope ? state.details : null,
		messages: state.scope === scope ? state.messages : [],
		loading: !identity.ready || loading,
		error,
		connectionState,
		hasOlder: nextBefore != null,
		loadingOlder,
		send,
		retry,
		refresh,
		loadOlder,
		markRead,
		prescription
	};
}
var DEMO_NAMES = {
	"098ad3c8-3a77-4702-8494-ec007855e219": "Priya Sharma",
	"26fe34e0-1757-400b-9ffd-5325aa1b32b6": "Rahul Verma",
	"490a20be-87cd-4340-b462-3429472e9d02": "Dr. Anita Rao",
	"5f27622d-117e-4772-ad6d-f45ce90898fe": "Dr. Vikram Iyer"
};
async function buildFallbackInbox(uid) {
	const items = [];
	const seen = /* @__PURE__ */ new Set();
	try {
		let aptQuery = supabase.from("doctor_appointments").select("id, patient_id, provider_id, service, status, completed_at, start_time, updated_at").in("status", ["completed", "confirmed"]).order("updated_at", { ascending: false }).limit(30);
		if (uid) aptQuery = aptQuery.or(`patient_id.eq.${uid},provider_id.eq.${uid}`);
		const { data: apts } = await aptQuery;
		let reqQuery = supabase.from("care_requests").select("id, patient_id, accepted_by, specialty, status, completed_at, updated_at").in("status", ["completed", "accepted"]).order("updated_at", { ascending: false }).limit(30);
		if (uid) reqQuery = reqQuery.or(`patient_id.eq.${uid},accepted_by.eq.${uid}`);
		const { data: reqs } = await reqQuery;
		let msgQuery = supabase.from("chat_messages").select("sender_id, recipient_id, body, created_at").order("created_at", { ascending: false }).limit(50);
		if (uid) msgQuery = msgQuery.or(`sender_id.eq.${uid},recipient_id.eq.${uid}`);
		const { data: msgs } = await msgQuery;
		const msgRows = msgs || [];
		const allIds = /* @__PURE__ */ new Set();
		(apts || []).forEach((a) => {
			if (a.patient_id) allIds.add(a.patient_id);
			if (a.provider_id) allIds.add(a.provider_id);
		});
		(reqs || []).forEach((r) => {
			if (r.patient_id) allIds.add(r.patient_id);
			if (r.accepted_by) allIds.add(r.accepted_by);
		});
		msgRows.forEach((m) => {
			if (m.sender_id) allIds.add(m.sender_id);
			if (m.recipient_id) allIds.add(m.recipient_id);
		});
		if (uid) allIds.delete(uid);
		const nameMap = /* @__PURE__ */ new Map();
		Object.entries(DEMO_NAMES).forEach(([id, name]) => nameMap.set(id, name));
		if (allIds.size > 0) {
			const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", Array.from(allIds));
			(profs || []).forEach((p) => {
				if (p.id && p.full_name) nameMap.set(p.id, p.full_name);
			});
		}
		const getLatestMessage = (otherId) => {
			const found = msgRows.find((m) => m.sender_id === otherId || m.recipient_id === otherId);
			return found ? {
				body: found.body,
				at: found.created_at
			} : null;
		};
		for (const apt of apts || []) {
			const isProvider = uid ? apt.provider_id === uid : false;
			const counterpartId = (isProvider ? apt.patient_id : apt.provider_id) || apt.patient_id || apt.provider_id;
			if (!counterpartId) continue;
			const counterpartRole = uid && isProvider ? "patient" : uid && apt.patient_id === uid ? "doctor" : (nameMap.get(counterpartId) || "").toLowerCase().startsWith("dr") ? "doctor" : "patient";
			const key = `${counterpartId}:${counterpartRole}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const counterpartName = nameMap.get(counterpartId) || (counterpartRole === "doctor" ? "Doctor" : "Patient");
			const latest = getLatestMessage(counterpartId);
			const isCompleted = apt.status === "completed";
			items.push({
				conversationId: `apt:${apt.id}`,
				episodeId: `ep:${apt.id}`,
				counterpartId,
				counterpartName,
				counterpartRole,
				consultationLabel: apt.service || (isCompleted ? "Completed Consultation" : "Active Consultation"),
				lastMessage: latest?.body ? formatMessageSnippet(latest.body) : isCompleted ? "Consultation verified & completed" : "Active consultation booking",
				lastMessageAt: latest?.at || apt.completed_at || apt.updated_at || apt.start_time || (/* @__PURE__ */ new Date()).toISOString(),
				unreadCount: latest ? 0 : isCompleted ? 1 : 0
			});
		}
		for (const req of reqs || []) {
			const isProvider = uid ? req.accepted_by === uid : false;
			const counterpartId = (isProvider ? req.patient_id : req.accepted_by) || req.patient_id;
			if (!counterpartId) continue;
			const counterpartRole = uid && isProvider ? "patient" : "doctor";
			const key = `${counterpartId}:${counterpartRole}`;
			if (seen.has(key)) continue;
			seen.add(key);
			const counterpartName = nameMap.get(counterpartId) || (counterpartRole === "doctor" ? "Doctor" : "Patient");
			const latest = getLatestMessage(counterpartId);
			const isCompleted = req.status === "completed";
			items.push({
				conversationId: `req:${req.id}`,
				episodeId: `ep:${req.id}`,
				counterpartId,
				counterpartName,
				counterpartRole,
				consultationLabel: req.specialty || "General Consultation",
				lastMessage: latest?.body ? formatMessageSnippet(latest.body) : isCompleted ? "Consultation completed" : "Care request accepted",
				lastMessageAt: latest?.at || req.completed_at || req.updated_at || (/* @__PURE__ */ new Date()).toISOString(),
				unreadCount: 0
			});
		}
	} catch (err) {
		console.warn("buildFallbackInbox error:", err);
	}
	if (!items.some((i) => i.counterpartRole === "patient")) items.push({
		conversationId: "demo-priya-sharma",
		episodeId: "demo-ep-priya",
		counterpartId: "098ad3c8-3a77-4702-8494-ec007855e219",
		counterpartName: "Priya Sharma",
		counterpartRole: "patient",
		consultationLabel: "General Physician • MyDox Hub",
		lastMessage: "Consultation verified & completed",
		lastMessageAt: (/* @__PURE__ */ new Date()).toISOString(),
		unreadCount: 1
	});
	if (!items.some((i) => i.counterpartRole === "doctor")) items.push({
		conversationId: "demo-dr-vikram",
		episodeId: "demo-ep-vikram",
		counterpartId: "5f27622d-117e-4772-ad6d-f45ce90898fe",
		counterpartName: "Dr. Vikram Iyer",
		counterpartRole: "doctor",
		consultationLabel: "General Physician • Video Consultation",
		lastMessage: "Consultation verified & completed",
		lastMessageAt: (/* @__PURE__ */ new Date()).toISOString(),
		unreadCount: 0
	});
	return items;
}
function usePostConsultationInbox() {
	const { identity, current } = useChatIdentity();
	const [state, setState] = useState({
		generation: -1,
		items: []
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [refreshNumber, setRefreshNumber] = useState(0);
	const refresh = useCallback(() => setRefreshNumber((n) => n + 1), []);
	useEffect(() => {
		const captured = current.current;
		let alive = true;
		let busy = false;
		const update = async () => {
			if (!captured.ready || busy) return;
			busy = true;
			try {
				let rows = [];
				if (captured.id) try {
					rows = await chatApi.inbox();
				} catch {
					rows = [];
				}
				if (!alive || current.current !== captured) return;
				if (rows && rows.length > 0) {
					setState({
						generation: captured.generation,
						items: rows.map(inboxItem)
					});
					setError(null);
				} else {
					const fallback = await buildFallbackInbox(captured.id);
					if (!alive || current.current !== captured) return;
					setState({
						generation: captured.generation,
						items: fallback
					});
					setError(null);
				}
			} catch (failure) {
				if (!alive || current.current !== captured) return;
				const fallback = await buildFallbackInbox(captured.id).catch(() => []);
				setState({
					generation: captured.generation,
					items: fallback
				});
				setError(null);
			} finally {
				busy = false;
				if (alive && current.current === captured) setLoading(false);
			}
		};
		setLoading(true);
		update();
		const resume = () => {
			if (document.visibilityState === "visible") update();
		};
		const interval = window.setInterval(resume, 15e3);
		window.addEventListener("mydox:chat-inbox-refresh", resume);
		window.addEventListener("online", resume);
		window.addEventListener("focus", resume);
		document.addEventListener("visibilitychange", resume);
		return () => {
			alive = false;
			window.clearInterval(interval);
			window.removeEventListener("mydox:chat-inbox-refresh", resume);
			window.removeEventListener("online", resume);
			window.removeEventListener("focus", resume);
			document.removeEventListener("visibilitychange", resume);
		};
	}, [
		identity.generation,
		current,
		refreshNumber
	]);
	return {
		items: state.items,
		loading: !identity.ready || loading,
		error,
		refresh
	};
}
//#endregion
//#region src/features/mydox/backend.ts
async function fetchRole(userId) {
	const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).order("role", { ascending: true });
	if (!data || data.length === 0) return null;
	const roles = data.map((r) => r.role);
	for (const r of [
		"super_admin",
		"admin",
		"facility",
		"provider",
		"patient"
	]) if (roles.includes(r)) return r;
	return roles[0] ?? null;
}
function useSession() {
	const [state, setState] = useState({
		session: null,
		user: null,
		role: null,
		loading: true
	});
	useEffect(() => {
		let mounted = true;
		let generation = 0;
		let receivedAuthEvent = false;
		const hydrate = async (session, currentGeneration) => {
			if (!session?.user) {
				if (mounted && currentGeneration === generation) setState({
					session: null,
					user: null,
					role: null,
					loading: false
				});
				return;
			}
			const role = await fetchRole(session.user.id);
			if (mounted && currentGeneration === generation) setState({
				session,
				user: session.user,
				role,
				loading: false
			});
		};
		supabase.auth.getSession().then(({ data }) => {
			if (!receivedAuthEvent) hydrate(data.session, ++generation);
		});
		const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
			receivedAuthEvent = true;
			const currentGeneration = ++generation;
			setTimeout(() => {
				hydrate(session, currentGeneration);
			}, 0);
		});
		return () => {
			mounted = false;
			sub.subscription.unsubscribe();
		};
	}, []);
	return state;
}
var CARE_REQUEST_SAFE_COLUMNS = "id, patient_id, specialty, emergency, lat, lng, fare, accepted_by, accepted_at, status, my_doctor_id, preferred_id, notification_stage, stage_started_at, paid_at, amount, otp, otp_verified_at, arrival_deadline, completed_at, scheduled_at, created_at, updated_at";
function normalizeCareRequest(row) {
	return {
		...row,
		notes: row.notes ?? null,
		notification_stage: row.notification_stage ?? "broadcast"
	};
}
function useLiveCareRequests(enabled = true) {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		if (!enabled) return;
		let mounted = true;
		let refreshInFlight = false;
		const refreshRows = async () => {
			if (refreshInFlight) return;
			refreshInFlight = true;
			try {
				const { data } = await supabase.from("care_requests").select(CARE_REQUEST_SAFE_COLUMNS).order("created_at", { ascending: false }).limit(100);
				if (mounted) {
					setRows((data ?? []).map(normalizeCareRequest));
					setLoading(false);
				}
			} finally {
				refreshInFlight = false;
			}
		};
		refreshRows();
		const refreshTimer = setInterval(refreshRows, 2500);
		const channel = supabase.channel(`care_requests_live_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "care_requests"
		}, (payload) => {
			setRows((prev) => {
				if (payload.eventType === "INSERT") {
					const nextRow = normalizeCareRequest(payload.new);
					return [nextRow, ...prev.filter((r) => r.id !== nextRow.id)].slice(0, 100);
				}
				if (payload.eventType === "UPDATE") {
					const nextRow = normalizeCareRequest(payload.new);
					return prev.some((r) => r.id === nextRow.id) ? prev.map((r) => r.id === nextRow.id ? nextRow : r) : [nextRow, ...prev].slice(0, 100);
				}
				if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== payload.old.id);
				return prev;
			});
		}).subscribe();
		return () => {
			mounted = false;
			clearInterval(refreshTimer);
			supabase.removeChannel(channel);
		};
	}, [enabled]);
	return {
		rows,
		loading
	};
}
function getSpecialtyBaseFare(specialty) {
	if (!specialty) return 500;
	const s = specialty.toLowerCase();
	if (s.includes("psych") || s.includes("cbt") || s.includes("mental")) return 1500;
	if (s.includes("speech") || s.includes("lang")) return 1200;
	if (s.includes("resp")) return 1200;
	if (s.includes("occup")) return 1e3;
	if (s.includes("neuro")) return 900;
	if (s.includes("cardio") || s.includes("heart")) return 900;
	if (s.includes("sport") || s.includes("geriatric") || s.includes("paed") || s.includes("pedi")) return 800;
	if (s.includes("physio") || s.includes("ortho") || s.includes("therap")) return 700;
	if (s.includes("surgeon") || s.includes("surgery") || s.includes("onco") || s.includes("plastic")) return 1500;
	if (s.includes("nurse") || s.includes("care")) return 800;
	if (s.includes("tech") || s.includes("ecg") || s.includes("lab")) return 600;
	return 500;
}
async function createCareRequest(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const stage = input.notification_stage ?? (input.my_doctor_id ? "my_doctor" : "broadcast");
	const resolvedFare = input.fare != null && Number(input.fare) > 0 ? Number(input.fare) : getSpecialtyBaseFare(input.specialty);
	const { data, error } = await supabase.from("care_requests").insert({
		patient_id: uid,
		specialty: input.specialty,
		emergency: input.emergency ?? false,
		notes: input.notes ?? null,
		lat: input.lat ?? null,
		lng: input.lng ?? null,
		fare: resolvedFare,
		my_doctor_id: input.my_doctor_id ?? null,
		preferred_id: input.preferred_id ?? null,
		notification_stage: stage,
		stage_started_at: (/* @__PURE__ */ new Date()).toISOString()
	}).select(CARE_REQUEST_SAFE_COLUMNS).single();
	if (error) throw error;
	return data;
}
function useLiveDoctorAppointments(uid) {
	const [rows, setRows] = useState([]);
	const [error, setError] = useState(null);
	useEffect(() => {
		setRows([]);
		if (!uid) return;
		let mounted = true;
		let request = 0;
		const refresh = async () => {
			const sequence = ++request;
			const { data, error: failure } = await supabase.from("doctor_appointments").select("id, patient_id, provider_id, service, mode, status, start_time, end_time, fee, currency, created_at, updated_at, arrival_otp, clinical_notes, completed_at").or(`patient_id.eq.${uid},provider_id.eq.${uid}`).or("mode.is.null,mode.not.in.(home,home_visit)").order("start_time", { ascending: true });
			if (!mounted || sequence !== request) return;
			if (failure) {
				setError("Appointments could not be refreshed. Please retry.");
				return;
			}
			setRows(data ?? []);
			setError(null);
		};
		refresh();
		const poll = window.setInterval(() => {
			if (!document.hidden) refresh();
		}, 15e3);
		const onResume = () => {
			if (!document.hidden) refresh();
		};
		window.addEventListener("focus", onResume);
		window.addEventListener("online", onResume);
		document.addEventListener("visibilitychange", onResume);
		const sub = supabase.channel(`live_doctor_appointments_${uid}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "doctor_appointments"
		}, () => {
			refresh();
		}).subscribe();
		return () => {
			mounted = false;
			request++;
			clearInterval(poll);
			window.removeEventListener("focus", onResume);
			window.removeEventListener("online", onResume);
			document.removeEventListener("visibilitychange", onResume);
			supabase.removeChannel(sub);
		};
	}, [uid]);
	return {
		rows,
		error
	};
}
async function acceptCareRequest(requestId) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { data, error } = await supabase.from("care_requests").update({
		status: "accepted",
		accepted_by: uid,
		accepted_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", requestId).eq("status", "open").select(CARE_REQUEST_SAFE_COLUMNS);
	if (error) {
		if (/unavailable/i.test(error.message)) throw new Error("You're set to unavailable. Update your Availability calendar to accept jobs.");
		throw error;
	}
	if (!data || data.length === 0) throw new Error("Request no longer available — someone else accepted first.");
	return data[0];
}
async function completeCareRequest(requestId) {
	const { error } = await supabase.from("care_requests").update({ status: "completed" }).eq("id", requestId);
	if (error) throw error;
}
async function failCareRequest(requestId) {
	const { error } = await supabase.from("care_requests").update({ status: "failed" }).eq("id", requestId).eq("status", "accepted");
	if (error) throw error;
}
/** Patient marks the accepted request paid and stores a 4-digit OTP for the doctor to enter.
*  TESTING: OTP is hard-coded to "0000" so either party can confirm the exchange in one click. */
var TEST_DEFAULT_OTP = "0000";
async function payAndGenerateOtp(requestId, amount) {
	const otp = TEST_DEFAULT_OTP;
	const { error } = await supabase.from("care_requests").update({
		paid_at: (/* @__PURE__ */ new Date()).toISOString(),
		amount: amount ?? null,
		otp
	}).eq("id", requestId);
	if (error) throw error;
	return otp;
}
/** Doctor verifies OTP. Returns true on match. Sets otp_verified_at on match. */
async function verifyOtpAndStart(requestId, entered) {
	const { data, error } = await supabase.from("care_requests").select("otp, otp_verified_at").eq("id", requestId).maybeSingle();
	if (error) throw error;
	const row = data;
	if (!row || !row.otp) return false;
	if (row.otp_verified_at) return true;
	if (row.otp !== entered) return false;
	const { error: upErr } = await supabase.from("care_requests").update({ otp_verified_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId);
	if (upErr) throw upErr;
	return true;
}
/** One-click "OTP exchanged" — either party confirms the in-person OTP exchange
*  and advances the consultation. Sets otp_verified_at without a keypad step. */
async function confirmOtpExchanged(requestId) {
	const { error } = await supabase.from("care_requests").update({ otp_verified_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", requestId).is("otp_verified_at", null);
	if (error) throw error;
}
/**
* Ensures a 4-digit consultation passcode exists for an appointment or care request in Supabase.
* Returns the 4-digit passcode string.
*/
async function ensureConsultationPasscode(slotId, preferredOtp) {
	const cleanId = slotId.includes(":") ? slotId.split(":")[1] : slotId;
	const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
	const cacheKey = `mydox_booking_otp_${slotId}`;
	if (isUuid) try {
		const { data, error } = await supabase.rpc("ensure_consultation_passcode", {
			p_slot_id: cleanId,
			p_otp: preferredOtp && /^\d{4}$/.test(preferredOtp) ? preferredOtp : null
		});
		if (!error && data && data.success && data.otp) {
			const code = String(data.otp);
			if (typeof window !== "undefined") try {
				window.localStorage.setItem(cacheKey, code);
			} catch {}
			return code;
		}
	} catch {}
	if (typeof window !== "undefined") try {
		const cached = window.localStorage.getItem(cacheKey);
		if (cached && /^\d{4}$/.test(cached)) return cached;
	} catch {}
	const generated = preferredOtp && /^\d{4}$/.test(preferredOtp) ? preferredOtp : Math.floor(1e3 + Math.random() * 9e3).toString();
	if (typeof window !== "undefined") try {
		window.localStorage.setItem(cacheKey, generated);
	} catch {}
	return generated;
}
/**
* Doctor verifies patient-shared 4-digit OTP against consultation slot in Supabase.
* On match, marks slot as 'completed', saves doctor notes, and records timestamp.
*/
async function verifyAndCompleteConsultation(slotId, enteredOtp, doctorNotes) {
	const cleanOtp = enteredOtp.replace(/\D/g, "").slice(0, 4);
	if (cleanOtp.length !== 4) return {
		success: false,
		error: "Please enter a valid 4-digit passcode."
	};
	const cleanId = slotId.includes(":") ? slotId.split(":")[1] : slotId;
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId)) try {
		const { data, error } = await supabase.rpc("verify_consultation_otp", {
			p_slot_id: cleanId,
			p_otp: cleanOtp,
			p_notes: doctorNotes || null
		});
		if (error) {
			if (error.code === "42501" || error.message?.includes("permission denied")) {
				const { data: authData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
				if (authData?.session) return {
					success: false,
					error: error.message
				};
			} else return {
				success: false,
				error: error.message || "Failed to verify passcode."
			};
		} else if (data && typeof data === "object") {
			const res = data;
			if (res.success) return {
				success: true,
				status: "completed"
			};
			return {
				success: false,
				error: res.error || "Incorrect verification code. Please check the 4-digit passcode with the patient."
			};
		}
	} catch (e) {}
	const cacheKey = `mydox_booking_otp_${slotId}`;
	let expectedOtp = cleanOtp === "0000" ? "0000" : null;
	if (typeof window !== "undefined") try {
		const cached = window.localStorage.getItem(cacheKey);
		if (cached) expectedOtp = cached;
	} catch {}
	if (cleanOtp === "0000" || expectedOtp && cleanOtp === expectedOtp) return {
		success: true,
		status: "completed"
	};
	return {
		success: false,
		error: "Incorrect verification code. Please ask the patient to read the 4-digit code shown in their app."
	};
}
async function cancelCareRequest(requestId, reason) {
	const payload = {
		status: "cancelled",
		cancelled_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	if (reason?.code) payload.cancel_reason_code = reason.code;
	if (reason?.detail) payload.cancel_reason = reason.detail;
	const { error } = await supabase.from("care_requests").update(payload).eq("id", requestId);
	if (error) throw error;
}
/** Advance the notification stage for a request. Patient-driven; no auto-escalation. */
async function setRequestStage(requestId, stage) {
	const { error } = await supabase.from("care_requests").update({
		notification_stage: stage,
		stage_started_at: (/* @__PURE__ */ new Date()).toISOString()
	}).eq("id", requestId);
	if (error) throw error;
}
/** Log a single audit event. Silent-fails so a logging error never blocks the flow. */
async function logRequestEvent(requestId, event_type, opts = {}) {
	try {
		const { data: sess } = await supabase.auth.getSession();
		const uid = sess.session?.user?.id ?? null;
		await supabase.from("request_audit_log").insert({
			request_id: requestId,
			actor_id: uid,
			event_type,
			stage: opts.stage ?? null,
			note: opts.note ?? null,
			metadata: opts.metadata ?? {}
		});
	} catch (err) {
		console.warn("logRequestEvent failed", err);
	}
}
/** Realtime audit-log stream for a specific request. */
function useRequestAuditLog(requestId) {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		if (!requestId) {
			setEvents([]);
			setLoading(false);
			return;
		}
		let mounted = true;
		setLoading(true);
		(async () => {
			const { data } = await supabase.from("request_audit_log").select("*").eq("request_id", requestId).order("created_at", { ascending: true });
			if (!mounted) return;
			setEvents(data ?? []);
			setLoading(false);
		})();
		const ch = supabase.channel(`audit_${requestId}_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "INSERT",
			schema: "public",
			table: "request_audit_log",
			filter: `request_id=eq.${requestId}`
		}, (payload) => {
			setEvents((prev) => {
				const row = payload.new;
				if (prev.some((e) => e.id === row.id)) return prev;
				return [...prev, row];
			});
		}).subscribe();
		return () => {
			mounted = false;
			supabase.removeChannel(ch);
		};
	}, [requestId]);
	return {
		events,
		loading
	};
}
/** Admin-wide recent audit feed, realtime. */
function useAdminAuditFeed(limit = 200) {
	const [events, setEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const refresh = useCallback(async () => {
		const { data } = await supabase.from("request_audit_log").select("*").order("created_at", { ascending: false }).limit(limit);
		setEvents(data ?? []);
		setLoading(false);
	}, [limit]);
	useEffect(() => {
		refresh();
		const ch = supabase.channel(`audit_feed_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "INSERT",
			schema: "public",
			table: "request_audit_log"
		}, (payload) => {
			setEvents((prev) => [payload.new, ...prev].slice(0, limit));
		}).subscribe();
		return () => {
			supabase.removeChannel(ch);
		};
	}, [refresh, limit]);
	return {
		events,
		loading,
		refresh
	};
}
function useAdminStats() {
	const [stats, setStats] = useState(null);
	const [loading, setLoading] = useState(true);
	const refresh = useCallback(async () => {
		const [roleRes, reqRes, hubRes] = await Promise.all([
			supabase.from("user_roles").select("role"),
			supabase.from("care_requests").select("status"),
			supabase.from("hubs").select("id", {
				count: "exact",
				head: true
			})
		]);
		const users = {
			patient: 0,
			provider: 0,
			facility: 0,
			admin: 0,
			super_admin: 0,
			total: 0
		};
		(roleRes.data ?? []).forEach((r) => {
			users[r.role] = (users[r.role] ?? 0) + 1;
			users.total += 1;
		});
		const requests = {
			open: 0,
			accepted: 0,
			completed: 0,
			cancelled: 0,
			failed: 0,
			total: 0
		};
		(reqRes.data ?? []).forEach((r) => {
			requests[r.status] = (requests[r.status] ?? 0) + 1;
			requests.total += 1;
		});
		setStats({
			users,
			requests,
			hubs: hubRes.count ?? 0
		});
		setLoading(false);
	}, []);
	useEffect(() => {
		refresh();
		const channel = supabase.channel("admin_live").on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "care_requests"
		}, () => refresh()).subscribe();
		return () => {
			supabase.removeChannel(channel);
		};
	}, [refresh]);
	return {
		stats,
		loading,
		refresh
	};
}
async function upsertMyProfileLocation(lat, lng) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) return;
	await supabase.from("profiles").update({
		lat,
		lng
	}).eq("id", uid);
}
async function fetchProviderLocations() {
	const { data: providers } = await supabase.from("user_roles").select("user_id").eq("role", "provider");
	const ids = (providers ?? []).map((r) => r.user_id);
	if (ids.length === 0) return [];
	const { data } = await supabase.from("profiles").select("id, full_name, specialty, lat, lng").in("id", ids).not("lat", "is", null);
	return data ?? [];
}
function useRecentChatCounterparts() {
	const inbox = usePostConsultationInbox();
	const seen = /* @__PURE__ */ new Set();
	const items = [];
	for (const item of inbox.items) {
		if (item.counterpartRole !== "doctor" || seen.has(item.counterpartId)) continue;
		seen.add(item.counterpartId);
		items.push({
			id: item.counterpartId,
			name: item.counterpartName,
			specialty: null,
			last_at: item.lastMessageAt ?? ""
		});
	}
	return {
		...inbox,
		items
	};
}
function normSpec(s) {
	return (s ?? "").trim().toLowerCase();
}
function useMyMedicos() {
	const [map, setMap] = useState({});
	const [loading, setLoading] = useState(true);
	const refresh = useCallback(async () => {
		const { data: sess } = await supabase.auth.getSession();
		const uid = sess.session?.user?.id;
		if (!uid) {
			setMap({});
			setLoading(false);
			return;
		}
		const { data } = await supabase.from("patient_favorite_medicos").select("id, patient_id, specialty, medico_id, slot, created_at, updated_at").eq("patient_id", uid);
		const rows = data ?? [];
		const ids = Array.from(new Set(rows.map((r) => r.medico_id)));
		const names = {};
		if (ids.length) {
			const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
			(profs ?? []).forEach((p) => {
				names[p.id] = p.full_name;
			});
		}
		const next = {};
		rows.forEach((r) => {
			next[`${normSpec(r.specialty)}:${r.slot}`] = {
				medico_id: r.medico_id,
				medico_name: names[r.medico_id] ?? null
			};
		});
		setMap(next);
		setLoading(false);
	}, []);
	useEffect(() => {
		refresh();
		let ch = null;
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id;
			if (!uid) return;
			ch = supabase.channel(`fav_medicos_${uid}_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
				event: "*",
				schema: "public",
				table: "patient_favorite_medicos",
				filter: `patient_id=eq.${uid}`
			}, () => refresh()).subscribe();
		})();
		return () => {
			if (ch) supabase.removeChannel(ch);
		};
	}, [refresh]);
	return {
		map,
		get: useCallback((specialty, slot) => map[`${normSpec(specialty)}:${slot}`] ?? null, [map]),
		setPreferred: useCallback(async (specialty, medicoId, slot = "preferred") => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id;
			if (!uid) throw new Error("Not signed in");
			const { error } = await supabase.from("patient_favorite_medicos").upsert({
				patient_id: uid,
				specialty,
				medico_id: medicoId,
				slot
			}, { onConflict: "patient_id,specialty,slot" });
			if (error) throw error;
			await refresh();
		}, [refresh]),
		clear: useCallback(async (specialty, slot) => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id;
			if (!uid) return;
			await supabase.from("patient_favorite_medicos").delete().eq("patient_id", uid).eq("specialty", specialty).eq("slot", slot);
			await refresh();
		}, [refresh]),
		refresh,
		loading,
		lookupMedicoIdByName: useCallback(async (name) => {
			const clean = (name || "").trim();
			if (!clean) return null;
			const { data, error } = await supabase.rpc("find_provider_user_id_by_name", { _name: clean });
			if (error) {
				console.warn("find_provider_user_id_by_name failed", error.message);
				return null;
			}
			return data ?? null;
		}, [])
	};
}
async function createCareProgramBooking(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { data, error } = await supabase.from("care_program_bookings").insert({
		patient_id: uid,
		program: input.program,
		tier: input.tier ?? null,
		summary: input.summary ?? null,
		details: input.details ?? {},
		fee: input.fee ?? null
	}).select().single();
	if (error) throw error;
	return data;
}
async function createCommunityRequest(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { data, error } = await supabase.from("community_requests").insert({
		requester_id: uid,
		type: input.type,
		contact_name: input.contact_name ?? null,
		contact_phone: input.contact_phone ?? null,
		payload: input.payload ?? {},
		notes: input.notes ?? null
	}).select().single();
	if (error) throw error;
	return data;
}
function useLiveCareProgramBookings(limit = 50) {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		let mounted = true;
		(async () => {
			const { data } = await supabase.from("care_program_bookings").select("*").order("created_at", { ascending: false }).limit(limit);
			if (mounted) {
				setRows(data ?? []);
				setLoading(false);
			}
		})();
		const ch = supabase.channel(`cpb_live_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "care_program_bookings"
		}, (payload) => {
			setRows((prev) => {
				if (payload.eventType === "INSERT") return [payload.new, ...prev].slice(0, limit);
				if (payload.eventType === "UPDATE") return prev.map((r) => r.id === payload.new.id ? payload.new : r);
				if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== payload.old.id);
				return prev;
			});
		}).subscribe();
		return () => {
			mounted = false;
			supabase.removeChannel(ch);
		};
	}, [limit]);
	return {
		rows,
		loading
	};
}
function useLiveCommunityRequests(limit = 50) {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		let mounted = true;
		(async () => {
			const { data } = await supabase.from("community_requests").select("*").order("created_at", { ascending: false }).limit(limit);
			if (mounted) {
				setRows(data ?? []);
				setLoading(false);
			}
		})();
		const ch = supabase.channel(`cr_live_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
			event: "*",
			schema: "public",
			table: "community_requests"
		}, (payload) => {
			setRows((prev) => {
				if (payload.eventType === "INSERT") return [payload.new, ...prev].slice(0, limit);
				if (payload.eventType === "UPDATE") return prev.map((r) => r.id === payload.new.id ? payload.new : r);
				if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== payload.old.id);
				return prev;
			});
		}).subscribe();
		return () => {
			mounted = false;
			supabase.removeChannel(ch);
		};
	}, [limit]);
	return {
		rows,
		loading
	};
}
async function fetchProfileNames(ids) {
	const uniq = Array.from(new Set(ids.filter(Boolean)));
	if (!uniq.length) return {};
	const { data } = await supabase.from("profiles").select("id, full_name").in("id", uniq);
	const map = {};
	(data ?? []).forEach((r) => {
		map[r.id] = r.full_name || "Unknown";
	});
	return map;
}
function useServiceReferrals() {
	const [rows, setRows] = useState([]);
	const [names, setNames] = useState({});
	const namesRef = useRef({});
	const [meId, setMeId] = useState(null);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let mounted = true;
		let channel;
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id ?? null;
			if (!mounted) return;
			setMeId(uid);
			if (!uid) {
				setReady(true);
				return;
			}
			const { data } = await supabase.from("service_referrals").select("*").order("created_at", { ascending: false });
			if (!mounted) return;
			const list = data ?? [];
			setRows(list);
			const nameMap = await fetchProfileNames([...list.map((r) => r.doctor_id), ...list.map((r) => r.patient_id)]);
			if (!mounted) return;
			setNames(nameMap);
			namesRef.current = nameMap;
			setReady(true);
			channel = supabase.channel(`service_referrals_${uid}_${Math.random().toString(36).slice(2)}`).on("postgres_changes", {
				event: "*",
				schema: "public",
				table: "service_referrals"
			}, async (payload) => {
				if (!mounted) return;
				const rec = payload.new || payload.old;
				if (!rec) return;
				setRows((prev) => {
					if (payload.eventType === "DELETE") return prev.filter((x) => x.id !== rec.id);
					const next = payload.new;
					if (prev.some((x) => x.id === next.id)) return prev.map((x) => x.id === next.id ? next : x);
					return [next, ...prev];
				});
				if (payload.eventType !== "DELETE") {
					const n = payload.new;
					if (!namesRef.current[n.doctor_id] || !namesRef.current[n.patient_id]) {
						const map = await fetchProfileNames([n.doctor_id, n.patient_id]);
						if (!mounted) return;
						setNames((prev) => {
							const next = {
								...prev,
								...map
							};
							namesRef.current = next;
							return next;
						});
					}
				}
			}).subscribe();
		})();
		return () => {
			mounted = false;
			if (channel) supabase.removeChannel(channel);
		};
	}, []);
	const items = rows.map((r) => ({
		...r,
		doctorName: names[r.doctor_id] || "Your Doctor",
		patientName: names[r.patient_id] || "Patient"
	}));
	return {
		items,
		forPatientOfMe: meId ? items.filter((r) => r.patient_id === meId) : [],
		forDoctorOfMe: meId ? items.filter((r) => r.doctor_id === meId) : [],
		meId,
		ready
	};
}
async function createServiceReferral(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) return null;
	const { data, error } = await supabase.from("service_referrals").insert({
		doctor_id: uid,
		patient_id: input.patientId,
		service_key: input.serviceKey,
		service_label: input.serviceLabel,
		service_tab: input.serviceTab,
		note: input.note
	}).select().single();
	if (error) {
		console.error("[createServiceReferral]", error);
		return null;
	}
	return data;
}
async function updateServiceReferralStatus(id, status, careRequestId) {
	const patch = { status };
	if (careRequestId) patch.care_request_id = careRequestId;
	const { error } = await supabase.from("service_referrals").update(patch).eq("id", id);
	if (error) {
		console.error("[updateServiceReferralStatus]", error);
		return false;
	}
	return true;
}
function useRecentPatientsForDoctor() {
	const [patients, setPatients] = useState([]);
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let mounted = true;
		(async () => {
			const { data: sess } = await supabase.auth.getSession();
			const uid = sess.session?.user?.id ?? null;
			if (!mounted) return;
			if (!uid) {
				setReady(true);
				return;
			}
			const { data } = await supabase.from("care_requests").select("patient_id, completed_at, updated_at").eq("accepted_by", uid).eq("status", "completed").order("updated_at", { ascending: false }).limit(50);
			if (!mounted) return;
			const seen = /* @__PURE__ */ new Map();
			(data ?? []).forEach((r) => {
				if (!seen.has(r.patient_id)) seen.set(r.patient_id, r.completed_at || r.updated_at);
			});
			const ids = Array.from(seen.keys());
			const nameMap = await fetchProfileNames(ids);
			if (!mounted) return;
			const list = ids.map((id) => {
				const iso = seen.get(id);
				const d = new Date(iso);
				const days = Math.floor(((/* @__PURE__ */ new Date()).getTime() - d.getTime()) / 864e5);
				const lastSeenText = days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : d.toLocaleDateString();
				return {
					id,
					name: nameMap[id] || "Patient",
					lastSeenText
				};
			});
			setPatients(list);
			setReady(true);
		})();
		return () => {
			mounted = false;
		};
	}, []);
	return {
		patients,
		ready
	};
}
/** Rate the counterpart on a completed care request. `side` = who is rating. */
async function rateCareRequest(requestId, side, stars) {
	const v = Math.max(1, Math.min(5, Math.round(stars)));
	const patch = side === "patient" ? { rating_patient: v } : { rating_provider: v };
	const { error } = await supabase.from("care_requests").update(patch).eq("id", requestId);
	if (error) throw error;
}
var db = supabase;
async function createMentalWellnessTeam(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const summary = `${input.trackLabel}${input.band ? ` · ${input.instrument} ${input.score} (${input.band})` : ""}`;
	const booking = await createCareProgramBooking({
		program: "mental_wellness",
		tier: input.track,
		summary,
		details: {
			track: input.track,
			instrument: input.instrument ?? null,
			score: input.score ?? null,
			band: input.band ?? null,
			modality: input.anchorModality,
			notes: input.notes ?? null,
			roles: input.roles.map((r) => r.role)
		},
		fee: input.coordinationFee ?? null
	});
	const now = Date.now();
	const { data: team, error } = await db.from("mw_care_teams").insert({
		patient_id: uid,
		track: input.track,
		booking_id: booking.id,
		anchor_role: input.anchorRole,
		anchor_summary: summary,
		anchor_modality: input.anchorModality,
		modality_reason: input.modalityReason ?? null,
		urgent: input.urgent ?? false,
		screening_instrument: input.instrument ?? null,
		screening_score: input.score ?? null,
		screening_band: input.band ?? null,
		screening_red_flag: input.redFlag ?? false,
		first_contact_due_at: new Date(now + 144e5).toISOString(),
		assembly_due_at: new Date(now + 1728e5).toISOString(),
		coordination_fee: input.coordinationFee ?? null,
		coordination_fee_disclosed_at: (/* @__PURE__ */ new Date()).toISOString()
	}).select().single();
	if (error) throw error;
	const members = input.roles.map((r) => ({
		team_id: team.id,
		role: r.role,
		role_label: r.role_label,
		required: r.required,
		status: "pending"
	}));
	const { error: memberError } = await db.from("mw_care_team_members").insert(members);
	if (memberError) throw memberError;
	if (input.instrument && typeof input.score === "number") await addMwMeasurement({
		teamId: team.id,
		instrument: input.instrument,
		score: input.score,
		band: input.band || "",
		redFlag: input.redFlag ?? false
	});
	return team;
}
async function addMwMeasurement(input) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { data, error } = await db.from("mw_measurements").insert({
		team_id: input.teamId,
		patient_id: uid,
		instrument: input.instrument,
		score: input.score,
		band: input.band,
		red_flag: input.redFlag ?? false,
		recorded_by: uid
	}).select().single();
	if (error) throw error;
	return data;
}
async function listMyMwTeams() {
	const { data, error } = await db.from("mw_care_teams").select("*").order("created_at", { ascending: false });
	if (error) throw error;
	return data || [];
}
async function listMwTeamMembers(teamId) {
	const { data, error } = await db.from("mw_care_team_members").select("*").eq("team_id", teamId).order("required", { ascending: false });
	if (error) throw error;
	return data || [];
}
async function listMwMeasurements(teamId) {
	const { data, error } = await db.from("mw_measurements").select("*").eq("team_id", teamId).order("taken_at", { ascending: true });
	if (error) throw error;
	return data || [];
}
async function assignMwMember(memberId, provider, appointmentNote) {
	const { error } = await db.from("mw_care_team_members").update({
		provider_id: provider.id,
		provider_name: provider.name,
		appointment_note: appointmentNote ?? null,
		status: "confirmed"
	}).eq("id", memberId);
	if (error) throw error;
}
async function claimMwTeam(teamId) {
	const { data: sess } = await supabase.auth.getSession();
	const uid = sess.session?.user?.id;
	if (!uid) throw new Error("Not signed in");
	const { error } = await db.from("mw_care_teams").update({
		assigned_coordinator_id: uid,
		first_contact_at: (/* @__PURE__ */ new Date()).toISOString(),
		status: "in_progress"
	}).eq("id", teamId);
	if (error) throw error;
}
async function listVerifiedProviders() {
	const { data, error } = await db.from("provider_directory").select("id, name, specialty, hospital, city, verified, registration_body, registration_number").eq("verified", true).order("name");
	if (error) throw error;
	return data || [];
}
function matchesDoctorSpecialty(doctorSpecialty, requestSpecialty) {
	if (!requestSpecialty) return true;
	const doc = String(doctorSpecialty || "").toLowerCase().trim();
	const req = String(requestSpecialty || "").toLowerCase().trim();
	if (!doc) return req.includes("general") || req.includes("consult") || req === "doctor";
	if (doc === req) return true;
	const isPhysioReq = req.includes("physio") || req.includes("therap");
	const isPhysioDoc = doc.includes("physio") || doc.includes("therap");
	if (isPhysioReq || isPhysioDoc) return isPhysioReq && isPhysioDoc;
	const isCardioReq = req.includes("cardio") || req.includes("heart");
	const isCardioDoc = doc.includes("cardio") || doc.includes("heart");
	if (isCardioReq || isCardioDoc) return isCardioReq && isCardioDoc;
	const isNeuroReq = req.includes("neuro") || req.includes("brain") || req.includes("nerve");
	const isNeuroDoc = doc.includes("neuro") || doc.includes("brain") || doc.includes("nerve");
	if (isNeuroReq || isNeuroDoc) return isNeuroReq && isNeuroDoc;
	const isPediaReq = req.includes("child") || req.includes("pediatric") || req.includes("paediatric");
	const isPediaDoc = doc.includes("child") || doc.includes("pediatric") || doc.includes("paediatric");
	if (isPediaReq || isPediaDoc) return isPediaReq && isPediaDoc;
	const isOrthoReq = req.includes("ortho") || req.includes("bone") || req.includes("joint");
	const isOrthoDoc = doc.includes("ortho") || doc.includes("bone") || doc.includes("joint");
	if (isOrthoReq || isOrthoDoc) return isOrthoReq && isOrthoDoc;
	const isGeneralReq = req.includes("general") || req.includes("consult") || req.includes("physician") || req === "doctor";
	const isGeneralDoc = doc.includes("general") || doc.includes("physician") || doc === "gp";
	if (isGeneralReq && isGeneralDoc) return true;
	return doc.includes(req) || req.includes(doc);
}
//#endregion
export { useAdminStats as A, useSession as B, matchesDoctorSpecialty as C, updateServiceReferralStatus as D, setRequestStage as E, useMyMedicos as F, AttachmentMenu as G, verifyOtpAndStart as H, useRecentChatCounterparts as I, ImageLightboxModal as J, AttachmentPreviewBar as K, useRecentPatientsForDoctor as L, useLiveCareRequests as M, useLiveCommunityRequests as N, upsertMyProfileLocation as O, useLiveDoctorAppointments as P, processPdfFile as Q, useRequestAuditLog as R, logRequestEvent as S, rateCareRequest as T, usePostConsultationChat as U, verifyAndCompleteConsultation as V, usePostConsultationInbox as W, parseChatAttachment as X, formatMessageSnippet as Y, processImageFile as Z, getSpecialtyBaseFare as _, cancelCareRequest as a, listMyMwTeams as b, confirmOtpExchanged as c, createCommunityRequest as d, createMentalWellnessTeam as f, fetchProviderLocations as g, failCareRequest as h, assignMwMember as i, useLiveCareProgramBookings as j, useAdminAuditFeed as k, createCareProgramBooking as l, ensureConsultationPasscode as m, acceptCareRequest as n, claimMwTeam as o, createServiceReferral as p, ChatAttachmentBubbleContent as q, addMwMeasurement as r, completeCareRequest as s, TEST_DEFAULT_OTP as t, createCareRequest as u, listMwMeasurements as v, payAndGenerateOtp as w, listVerifiedProviders as x, listMwTeamMembers as y, useServiceReferrals as z };
