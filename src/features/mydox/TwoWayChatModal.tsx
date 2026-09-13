import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { usePostConsultationChat } from "./post-consultation-chat/usePostConsultationChat";
import type { ChatReference } from "./post-consultation-chat/types";
import { parseChatAttachment, ChatAttachmentBubbleContent, ImageLightboxModal } from "./chatAttachmentUtils";

export type TwoWayChatModalProps = {
  reference?: ChatReference;
  doctorName?: string;
  specialty?: string;
  onClose: () => void;
};

const buttonStyle: CSSProperties = {
  border: "1px solid #245140", borderRadius: 12, background: "#10352A",
  color: "#D1FAE5", padding: "8px 12px", cursor: "pointer", font: "inherit",
};

/** Clinical identity and permission always come from the authenticated chat API. */
export function TwoWayChatModal({ reference, doctorName, specialty, onClose }: TwoWayChatModalProps) {
  const chat = usePostConsultationChat(reference);
  const { details, messages, loading, error, connectionState, markRead } = chat;
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [prescriptionBusy, setPrescriptionBusy] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [decliningRequestId, setDecliningRequestId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const followBottom = useRef(true);
  const pendingDraft = useRef<{ key: string; body: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const lastReceivedRef = useRef<HTMLDivElement>(null);
  const lastReceived = messages.filter(message => !message.isOwn && message.status === "saved").at(-1);
  const lastReceivedId = lastReceived?.id;
  const conversationId = details?.conversationId;
  const pending = messages.find(message => message.isOwn && message.status !== "saved");
  const title = details?.counterpartName || doctorName || "Consultation chat";
  const canSend = Boolean(details?.canSend && !loading && !pending && connectionState !== "offline");

  useEffect(() => {
    setInput("");
    setSendError(null);
    setPrescriptionError(null);
    setDecliningRequestId(null);
    setDeclineReason("");
    pendingDraft.current = null;
  }, [details?.conversationId, details?.episodeId, details?.actorId, chat.identityKey]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    if (pending) pendingDraft.current = { key: pending.idempotencyKey, body: pending.body };
    const operation = pendingDraft.current;
    if (operation && messages.some(message => message.status === "saved" && message.idempotencyKey === operation.key)) {
      setInput(value => value.trim() === operation.body ? "" : value);
      pendingDraft.current = null;
    }
  }, [messages, pending]);

  const latestMessageId = messages.at(-1)?.id;
  useEffect(() => {
    if (followBottom.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [latestMessageId]);

  // A visible recipient message is a device acknowledgement. Database insertion alone is not one.
  useEffect(() => {
    const element = lastReceivedRef.current;
    if (!element || !lastReceivedId || !conversationId || typeof IntersectionObserver === "undefined") return;
    let visible = false;
    const acknowledge = () => {
      if (visible && document.visibilityState === "visible") void markRead(lastReceivedId);
    };
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.9);
      acknowledge();
    }, { root: historyRef.current, threshold: 0.9 });
    observer.observe(element);
    document.addEventListener("visibilitychange", acknowledge);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", acknowledge);
    };
  }, [conversationId, lastReceivedId, markRead]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = input.trim();
    if (!body || !canSend) return;
    setSendError(null);
    followBottom.current = true;
    try {
      if (await chat.send(body)) setInput(value => value.trim() === body ? "" : value);
    } catch {
      setSendError("The message could not be confirmed. Keep this window open and retry the pending message.");
    }
  };

  const retry = async (id: string, body: string) => {
    setSendError(null);
    try {
      if (await chat.retry(id)) setInput(value => value.trim() === body ? "" : value);
    } catch {
      setSendError("The message could not be confirmed. Retry when the connection is available.");
    }
  };

  const prescription = async (action: "request" | "review" | "decline", requestId?: string, reason?: string) => {
    if (prescriptionBusy) return;
    setPrescriptionBusy(true);
    setPrescriptionError(null);
    try {
      if (await chat.prescription(action, requestId, reason)) { setDecliningRequestId(null); setDeclineReason(""); }
      else setPrescriptionError("The request update could not be confirmed. Refresh to check its current status before retrying.");
    } catch {
      setPrescriptionError("Unable to update the request. Refresh to check its current status before retrying.");
    } finally { setPrescriptionBusy(false); }
  };
  const requests = details?.prescriptionRequests.filter(request => request.episodeId === details.episodeId) || [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="consultation-chat-title"
        onKeyDown={event => {
          if (event.key === "Escape") { event.stopPropagation(); onClose(); }
          if (event.key !== "Tab") return;
          const focusable = modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea:not(:disabled), a[href]');
          if (!focusable?.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
        style={{ width: "100%", maxWidth: 900, height: "min(820px, 92dvh)", display: "flex", flexDirection: "column", overflow: "hidden", background: "#071B15", border: "1px solid #184333", borderRadius: 20, boxShadow: "0 24px 90px rgba(0,0,0,.45)", color: "#F8FAFC", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13 }}>
        <header style={{ padding: "16px 18px", background: "#0B261D", borderBottom: "1px solid #123629", display: "flex", alignItems: "center", gap: 12 }}>
          <div aria-hidden="true" style={{ width: 42, height: 42, borderRadius: "50%", background: "#0E5E47", display: "grid", placeItems: "center", fontWeight: 800, flexShrink: 0 }}>
            {title.split(" ").filter(Boolean).slice(0, 2).map(part => part[0]).join("")}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 id="consultation-chat-title" style={{ margin: 0, fontSize: 16, overflowWrap: "anywhere" }}>{title}</h2>
            <p style={{ margin: "4px 0 0", color: "#A7C4B7", fontSize: 11 }}>
              {details ? `${details.consultationLabel} · ${new Date(details.completedAt).toLocaleDateString()}` : specialty || "Post-consultation follow-up"}
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close chat" style={buttonStyle}>✕</button>
        </header>

        <div aria-live="polite" style={{ padding: "10px 18px", background: "#081E17", borderBottom: "1px solid #123629", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, color: "#B6D3C6", fontSize: 11 }}>
            {error && !details ? "Chat unavailable. See the message below." : connectionState === "live" ? "Chat connected" : connectionState === "offline" ? "Connection lost. Reconnect to refresh and retry." : connectionState === "refreshing" ? "Refreshing chat…" : "Connecting…"}
            {details && " · Recipient availability unknown"}
          </span>
          <button type="button" onClick={() => void chat.refresh()} disabled={loading} style={{ ...buttonStyle, padding: "5px 10px", fontSize: 11 }}>Refresh</button>
        </div>

        <div ref={historyRef} role="log" aria-label="Consultation messages" aria-live="polite" aria-busy={loading}
          onScroll={event => { const node = event.currentTarget; followBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 60; }}
          style={{ flex: 1, minHeight: 80, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {details?.testOnly && <p role="status" style={{ color: "#FDE68A", margin: 0 }}>Synthetic test access only. This chat is not enabled for real patient care.</p>}
          {!reference && <p role="alert" style={{ color: "#FDE68A", lineHeight: 1.6 }}>Chat requires an authorised completed consultation. Open Chat from Previous consultations or your consultation inbox.</p>}
          {error && <div role="alert" style={{ color: "#FECACA", background: "#39231F", padding: 12, borderRadius: 10 }}><p style={{ margin: "0 0 8px" }}>{error}</p><button type="button" onClick={() => void chat.refresh()} style={buttonStyle}>Retry loading</button></div>}
          {loading && <p style={{ color: "#A7C4B7" }}>Loading authorised conversation…</p>}
          {!loading && details && !messages.length && <p style={{ textAlign: "center", color: "#A7C4B7", margin: "24px 0" }}>No messages in this consultation yet.</p>}
          {chat.hasOlder && <button type="button" onClick={() => void chat.loadOlder()} disabled={chat.loadingOlder} style={{ ...buttonStyle, alignSelf: "center" }}>{chat.loadingOlder ? "Loading…" : "Load older messages"}</button>}
          {messages.map(message => (
            <div key={message.id} ref={message.id === lastReceived?.id ? lastReceivedRef : undefined} style={{ display: "flex", flexDirection: "column", alignItems: message.isOwn ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "86%", minWidth: 100, padding: "10px 13px", borderRadius: message.isOwn ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: message.isOwn ? "#0E5E47" : "#13352A", border: "1px solid #245140", overflowWrap: "anywhere" }}>
                <p style={{ margin: "0 0 5px", fontSize: 10, color: "#ACD7C4", textTransform: "capitalize" }}>{message.isOwn ? "You" : details?.counterpartName} · {message.senderRole}</p>
                {details && details.episodes.length > 1 && <p style={{ margin: "0 0 5px", color: "#ACD7C4", fontSize: 10 }}>{details.episodes.find(episode => episode.episodeId === message.episodeId)?.consultationLabel || "Earlier consultation"}</p>}
                {(() => {
                  const att = parseChatAttachment(message.body);
                  if (att) {
                    return (
                      <ChatAttachmentBubbleContent
                        attachment={att}
                        mine={message.isOwn}
                        onViewImage={img => setSelectedImage(img)}
                      />
                    );
                  }
                  return <p style={{ margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{message.body}</p>;
                })()}
                <p style={{ margin: "5px 0 0", textAlign: "right", color: "#A7C4B7", fontSize: 10 }}>
                  {message.createdAt ? new Date(message.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  {message.isOwn && ` · ${message.status === "sending" ? "Sending…" : message.status === "failed" ? "Not confirmed" : "Saved"}`}
                </p>
                {message.status === "failed" && <div role="alert" style={{ marginTop: 8 }}><p style={{ color: "#FECACA", fontSize: 11 }}>{message.error || "Send failed. Retry to confirm this message."}</p><button type="button" onClick={() => void retry(message.id, message.body)} style={buttonStyle}>Retry message</button></div>}
              </div>
            </div>
          ))}
          {details && <section aria-label="Prescription requests" style={{ border: "1px solid #245140", borderRadius: 12, padding: 12 }}>
            <h3 style={{ fontSize: 12, margin: "0 0 6px" }}>Prescription requests</h3>
            <p style={{ fontSize: 11, color: "#A7C4B7", lineHeight: 1.5 }}>A request is subject to clinician review. No payment is taken. Issuing a signed prescription is unavailable in this chat.</p>
            {prescriptionError && <p role="alert" style={{ color: "#FECACA", fontSize: 11 }}>{prescriptionError}</p>}
            {requests.map(request => <div key={request.id} style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid #245140" }}>
              <p style={{ margin: "0 0 5px", fontSize: 11, textTransform: "capitalize" }}>{request.status} · {new Date(request.requestedAt).toLocaleString()}</p>
              {request.declineReason && <p style={{ fontSize: 11, whiteSpace: "pre-wrap" }}>Clinician's reason: {request.declineReason}</p>}
              {details.memberRole === "doctor" && request.status !== "declined" && <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {request.status === "requested" && <button type="button" disabled={prescriptionBusy} onClick={() => void prescription("review", request.id)} style={buttonStyle}>Start review</button>}
                <button type="button" disabled={prescriptionBusy} onClick={() => setDecliningRequestId(request.id)} style={buttonStyle}>Decline request</button>
              </div>}
              {decliningRequestId === request.id && <form onSubmit={event => { event.preventDefault(); if (declineReason.trim()) void prescription("decline", request.id, declineReason.trim()); }} style={{ marginTop: 8 }}>
                <label style={{ display: "block", fontSize: 11 }}>Reason for declining<textarea required value={declineReason} maxLength={500} onChange={event => setDeclineReason(event.target.value)} style={{ width: "100%", boxSizing: "border-box", margin: "6px 0", padding: 8, color: "#F8FAFC", background: "#0B261D", border: "1px solid #245140", borderRadius: 8 }} /></label>
                <button type="submit" disabled={prescriptionBusy || !declineReason.trim()} style={buttonStyle}>Confirm decline</button>
                <button type="button" onClick={() => setDecliningRequestId(null)} style={{ ...buttonStyle, marginLeft: 6 }}>Cancel</button>
              </form>}
            </div>)}
            {details.memberRole === "patient" && !requests.some(request => request.status !== "declined") && <button type="button" disabled={prescriptionBusy} onClick={() => void prescription("request")} style={buttonStyle}>{prescriptionBusy ? "Saving request…" : "Request clinician review"}</button>}
          </section>}
        </div>

        <div style={{ padding: "10px 18px", background: "#081E17", borderTop: "1px solid #123629" }}>
          {details && <p style={{ color: "#A7C4B7", fontSize: 11, margin: "0 0 8px" }}>
            {details.memberRole === "doctor" ? "Doctor replies do not use the patient's outgoing message allowance." : details.patientMessagesRemaining != null ? `${details.patientMessagesRemaining} patient messages remaining${details.patientMessagesLimit != null ? ` of ${details.patientMessagesLimit}` : ""}.` : "Patient allowance is determined by the approved server policy."}
            {details.patientSendUntil && ` Patient allowance expires ${new Date(details.patientSendUntil).toLocaleString()}.`}
          </p>}
          {details && !details.canSend && <p role="status" style={{ color: "#FDE68A", fontSize: 12 }}>{details.sendDisabledReason || "Sending is currently unavailable for this consultation."}</p>}
          {pending && <p role="status" style={{ color: "#FDE68A", fontSize: 11 }}>Confirm the pending message before sending another. Your draft stays in this window.</p>}
          {sendError && <p role="alert" style={{ color: "#FECACA", fontSize: 12 }}>{sendError}</p>}
          <form onSubmit={submit} style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
            <textarea aria-label={details?.memberRole === "doctor" ? "Write a reply" : "Write a message"} value={input} onChange={event => setInput(event.target.value)}
              disabled={!details || Boolean(pending)} maxLength={4000} rows={2} placeholder={details?.memberRole === "doctor" ? "Write your reply…" : "Write your follow-up message…"}
              style={{ flex: 1, minWidth: 0, resize: "vertical", maxHeight: 160, borderRadius: 14, background: "#0B261D", border: "1px solid #245140", padding: 12, color: "#F8FAFC", font: "inherit" }} />
            <button type="submit" disabled={!canSend || !input.trim()} style={{ ...buttonStyle, background: canSend && input.trim() ? "#0C9668" : "#10352A", opacity: canSend && input.trim() ? 1 : 0.6, padding: "12px 16px" }}>Send</button>
          </form>
        </div>

        <footer style={{ padding: "11px 18px", background: "#051410", borderTop: "1px solid #123629", color: "#A7C4B7", fontSize: 10, lineHeight: 1.6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
            {["Attachments", "Audio / video calls", "Recharge", "Prescription issuing"].map(label => <button key={label} type="button" disabled title={`${label} unavailable pending approved integration`} style={{ ...buttonStyle, padding: "5px 8px", color: "#829B8F", cursor: "not-allowed", fontSize: 10 }}>{label} · unavailable</button>)}
          </div>
          Documents, calls, purchases and prescription issuing are not enabled for this chat. Use the existing booking and clinical-record workflows for separately confirmed follow-up care.
        </footer>
      </div>
      <ImageLightboxModal image={selectedImage} onClose={() => setSelectedImage(null)} />
    </div>
  );
}
