import React from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle, Clock, UserCheck, HeartPulse, Wallet, MessageSquare } from "lucide-react";

/**
 * Cancellation flow with reasons + refund policy per service kind.
 *
 * Props:
 *   open        boolean
 *   onClose()   dismiss without cancelling
 *   onConfirm({ code, detail })  user confirms cancellation
 *   kind        "doctor" | "therapist" | "nurse" | "care" | "technician" | "scan" | "diet"
 *               | "surgery" | "care_program" | "prosthetic" | "special_needs" | "urgent" | string
 *   stage       optional stage/status of the booking ("open","accepted","otp_sent","live","paid",…)
 *               — used to nuance the refund policy screen.
 *   paid        whether payment already went through (affects refund text)
 *   fare        optional total (number, INR) to show a specific refund amount
 *   serviceName optional label for the header ("Dr. Sharma consult", "CT Scan…")
 */

const REASONS = [
  { code: "running_late",   Icon: Clock,       title: "Running late",           desc: "Traffic / schedule change on my side" },
  { code: "found_another",  Icon: UserCheck,   title: "Found another provider", desc: "Booked elsewhere or already treated" },
  { code: "feeling_better", Icon: HeartPulse,  title: "Feeling better",         desc: "Symptoms improved, no visit needed" },
  { code: "price",          Icon: Wallet,      title: "Price too high",         desc: "Cost didn't match what I expected" },
  { code: "other",          Icon: MessageSquare, title: "Other reason",         desc: "Tell us what happened" },
];

// Refund policy per service family — plain-language, no legalese.
// Each entry: { title, tiers: [{ when, refund, note }], fine? }
const POLICIES = {
  doctor: {
    title: "Doctor consultation",
    tiers: [
      { when: "Before doctor accepts",              refund: "100% refund",              note: "Full amount — no fee." },
      { when: "After accept · before OTP exchange", refund: "80% refund",               note: "20% goes to the doctor for reserved time." },
      { when: "After OTP / consultation started",   refund: "No refund",                note: "Service has begun." },
    ],
  },
  therapist: {
    title: "Therapy session",
    tiers: [
      { when: "> 4 hours before slot",              refund: "100% refund",              note: "Full amount refunded." },
      { when: "Within 4 hours of slot",             refund: "50% refund",               note: "Slot is hard to re-fill." },
      { when: "After therapist arrived / joined",   refund: "No refund",                note: "" },
    ],
  },
  nurse: {
    title: "Nurse visit",
    tiers: [
      { when: "Before nurse is en route",           refund: "100% refund",              note: "" },
      { when: "Nurse en route to your address",     refund: "80% refund",               note: "Covers travel time." },
      { when: "After OTP / visit started",          refund: "No refund",                note: "" },
    ],
  },
  care: {
    title: "Care physician",
    tiers: [
      { when: "Before dispatch",                    refund: "100% refund",              note: "" },
      { when: "Physician on the way",               refund: "70% refund",               note: "Covers dispatch & travel." },
      { when: "After OTP / procedure started",      refund: "No refund",                note: "" },
    ],
  },
  technician: {
    title: "Technician / equipment",
    tiers: [
      { when: "> 2 hours before slot",              refund: "100% refund",              note: "" },
      { when: "Within 2 hours of slot",             refund: "50% refund",               note: "Kit already loaded." },
      { when: "After technician arrived",           refund: "No refund",                note: "" },
    ],
  },
  scan: {
    title: "Lab / scan booking",
    tiers: [
      { when: "> 12 hours before slot",             refund: "100% refund",              note: "" },
      { when: "Within 12 hours",                    refund: "80% refund",               note: "Slot held for you." },
      { when: "After scan started / sample given",  refund: "No refund",                note: "" },
    ],
  },
  diet: {
    title: "Dietitian consultation",
    tiers: [
      { when: "> 2 hours before slot",              refund: "100% refund",              note: "" },
      { when: "Within 2 hours",                     refund: "50% refund",               note: "" },
      { when: "After session started",              refund: "No refund",                note: "" },
    ],
  },
  urgent: {
    title: "Urgent / on-demand booking",
    tiers: [
      { when: "Before a provider accepts",          refund: "100% refund",              note: "No fee — provider never dispatched." },
      { when: "After accept · before OTP",          refund: "70% refund",               note: "20% surge fee is non-refundable." },
      { when: "After OTP exchange",                 refund: "No refund",                note: "Service in progress." },
    ],
    fine: "Urgent bookings carry a +20% surge that is non-refundable once accepted.",
  },
  surgery: {
    title: "Surgery / OT booking",
    tiers: [
      { when: "> 24 hours before scheduled OT",     refund: "100% refund",              note: "" },
      { when: "12–24 hours before",                 refund: "50% refund",               note: "OT + team blocked." },
      { when: "< 12 hours or team dispatched",      refund: "No refund",                note: "OT team reserved / on standby." },
    ],
    fine: "Refunds do not include separately-purchased implants or blood units.",
  },
  care_program: {
    title: "Care program subscription",
    tiers: [
      { when: "Within 24 hours of purchase, no visit yet", refund: "100% refund",       note: "" },
      { when: "First visit completed",              refund: "Pro-rated refund",         note: "Remaining sessions refunded." },
      { when: "> 50% of sessions used",             refund: "No refund",                note: "" },
    ],
  },
  prosthetic: {
    title: "Prosthetics booking",
    tiers: [
      { when: "Before fitting appointment",         refund: "100% refund",              note: "" },
      { when: "After measurement / fitting",        refund: "Deposit non-refundable",   note: "Device is custom-made." },
      { when: "After device dispatched",            refund: "No refund",                note: "" },
    ],
  },
  special_needs: {
    title: "Special-needs service",
    tiers: [
      { when: "Before coordinator call",            refund: "100% refund",              note: "" },
      { when: "After assessment visit",             refund: "80% refund",               note: "Assessment fee deducted." },
      { when: "After placement / service started",  refund: "No refund",                note: "" },
    ],
  },
};

function policyFor(kind) {
  return POLICIES[kind] || POLICIES.doctor;
}

// Naive stage → tier index mapping, used to highlight which tier applies now.
function currentTier(stage, paid) {
  const s = String(stage || "").toLowerCase();
  if (!s || s === "open" || s === "pending" || s === "searching") return 0;
  if (["accepted", "en_route", "enroute", "otp_sent", "converging"].some(k => s.includes(k)) && !s.includes("live")) return 1;
  if (["live", "in_progress", "started", "completed"].some(k => s.includes(k)) || paid) return 2;
  return 0;
}

const inr = (n) => (typeof n === "number" ? `₹${n.toLocaleString("en-IN")}` : "—");

function estimateRefund(fare, tier) {
  if (typeof fare !== "number") return null;
  const pct = tier === 0 ? 1 : tier === 1 ? 0.7 : 0;
  return Math.round(fare * pct);
}

export default function CancellationDialog({
  open,
  onClose,
  onConfirm,
  kind = "doctor",
  stage = null,
  paid = false,
  fare = null,
  serviceName = null,
}) {
  const [step, setStep] = React.useState(0); // 0 = reasons, 1 = policy + confirm
  const [code, setCode] = React.useState(null);
  const [detail, setDetail] = React.useState("");

  React.useEffect(() => {
    if (open) { setStep(0); setCode(null); setDetail(""); }
  }, [open]);

  if (!open) return null;

  const policy = policyFor(kind);
  const tier = currentTier(stage, paid);
  const refundEst = estimateRefund(fare, tier);
  const chosen = REASONS.find(r => r.code === code) || null;

  const onPickReason = (c) => {
    setCode(c);
    if (c !== "other") setStep(1);
  };

  const node = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cancel booking"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto",
          background: "#fff",
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          boxShadow: "0 -18px 40px rgba(0,0,0,.25)",
          animation: "slideUp .25s ease-out",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 18px 10px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={18} color="#DC2626" strokeWidth={2.2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Cancel booking</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748B" }}>
              {serviceName || policy.title}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#F1F5F9", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} color="#475569" />
          </button>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 6, padding: "10px 18px 0" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 3,
              background: i <= step ? "#DC2626" : "#E2E8F0",
              transition: "background .2s",
            }} />
          ))}
        </div>

        {step === 0 && (
          <div style={{ padding: "14px 18px 18px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 700, color: "#0F172A" }}>
              Why are you cancelling?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {REASONS.map((r) => {
                const on = code === r.code;
                return (
                  <button
                    key={r.code}
                    onClick={() => onPickReason(r.code)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 12px", borderRadius: 14,
                      border: `1.5px solid ${on ? "#DC2626" : "#E5E7EB"}`,
                      background: on ? "#FEF2F2" : "#fff",
                      cursor: "pointer", textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: on ? "#FEE2E2" : "#F8FAFC",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <r.Icon size={18} color={on ? "#DC2626" : "#475569"} strokeWidth={2} />
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, color: "#0F172A" }}>{r.title}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748B", lineHeight: 1.35 }}>{r.desc}</p>
                    </span>
                  </button>
                );
              })}
            </div>

            {code === "other" && (
              <div style={{ marginTop: 12 }}>
                <textarea
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  rows={3}
                  maxLength={240}
                  placeholder="Tell us briefly what happened…"
                  style={{
                    width: "100%", padding: 10, borderRadius: 12,
                    border: "1.5px solid #E5E7EB", fontFamily: "inherit",
                    fontSize: 13, color: "#0F172A", resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: "#94A3B8" }}>Helps us improve</span>
                  <span style={{ fontSize: 10.5, color: "#94A3B8" }}>{detail.length}/240</span>
                </div>
                <button
                  onClick={() => setStep(1)}
                  disabled={detail.trim().length < 3}
                  style={{
                    marginTop: 10, width: "100%", padding: "12px",
                    borderRadius: 12, border: "none",
                    background: detail.trim().length >= 3 ? "#0F172A" : "#E2E8F0",
                    color: detail.trim().length >= 3 ? "#fff" : "#94A3B8",
                    fontWeight: 800, fontSize: 13,
                    cursor: detail.trim().length >= 3 ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Continue
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              style={{
                marginTop: 12, width: "100%", padding: "12px",
                borderRadius: 12, border: "1.5px solid #E5E7EB",
                background: "#fff", color: "#0F172A",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Keep my booking
            </button>
          </div>
        )}

        {step === 1 && (
          <div style={{ padding: "14px 18px 18px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 800, color: "#94A3B8", textTransform: "uppercase", letterSpacing: .5 }}>
              Refund policy
            </p>
            <p style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
              {policy.title}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {policy.tiers.map((t, i) => {
                const on = i === tier;
                return (
                  <div key={i} style={{
                    padding: "11px 12px", borderRadius: 12,
                    border: `1.5px solid ${on ? "#DC2626" : "#E5E7EB"}`,
                    background: on ? "#FEF2F2" : "#F8FAFC",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: on ? "#B91C1C" : "#475569" }}>
                        {on && <span style={{ marginRight: 6, fontSize: 9, background: "#DC2626", color: "#fff", padding: "2px 6px", borderRadius: 99, fontWeight: 800 }}>YOU'RE HERE</span>}
                        {t.when}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: on ? "#DC2626" : "#0F172A", flexShrink: 0 }}>{t.refund}</span>
                    </div>
                    {t.note && <p style={{ margin: "3px 0 0", fontSize: 10.5, color: "#64748B", lineHeight: 1.35 }}>{t.note}</p>}
                  </div>
                );
              })}
            </div>

            {policy.fine && (
              <p style={{ margin: "0 0 10px", fontSize: 10.5, color: "#94A3B8", lineHeight: 1.45 }}>
                ⓘ {policy.fine}
              </p>
            )}

            {typeof fare === "number" && (
              <div style={{
                padding: "10px 12px", borderRadius: 12,
                background: "#F0FDF4", border: "1.5px solid #86EFAC",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 12,
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: 10.5, color: "#166534", fontWeight: 700, textTransform: "uppercase", letterSpacing: .4 }}>Estimated refund</p>
                  <p style={{ margin: "1px 0 0", fontSize: 15, fontWeight: 800, color: "#166534" }}>
                    {refundEst != null ? inr(refundEst) : "—"} <span style={{ fontSize: 10.5, color: "#16A34A", fontWeight: 700 }}>of {inr(fare)}</span>
                  </p>
                </div>
                <span style={{ fontSize: 10, color: "#166534", fontWeight: 700 }}>
                  {paid ? "Back to source · 3–5 days" : "No charge yet"}
                </span>
              </div>
            )}

            {chosen && (
              <div style={{
                padding: "8px 12px", borderRadius: 10, background: "#F8FAFC",
                marginBottom: 12, fontSize: 11.5, color: "#475569",
              }}>
                Reason: <span style={{ fontWeight: 800, color: "#0F172A" }}>{chosen.title}</span>
                {detail.trim() && <> · <span style={{ fontStyle: "italic" }}>"{detail.trim()}"</span></>}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep(0)}
                style={{
                  flex: "0 0 auto", padding: "13px 16px", borderRadius: 12,
                  border: "1.5px solid #E5E7EB", background: "#fff",
                  color: "#0F172A", fontWeight: 700, fontSize: 13,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Back
              </button>
              <button
                onClick={() => onConfirm && onConfirm({ code: code || "other", detail: detail.trim() || null })}
                style={{
                  flex: 1, padding: "13px", borderRadius: 12,
                  border: "none",
                  background: "linear-gradient(135deg,#DC2626,#B91C1C)",
                  color: "#fff", fontWeight: 800, fontSize: 13.5,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 4px 14px rgba(220,38,38,.35)",
                }}
              >
                Confirm cancellation
              </button>
            </div>
          </div>
        )}

        <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}
