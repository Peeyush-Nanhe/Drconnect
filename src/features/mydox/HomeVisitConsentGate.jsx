import React, { useState } from "react";
import { HOME_VISIT_CONSENT } from "@/features/mydox/consent-texts";

/**
 * HomeVisitConsentGate — modal shown before a home-visit booking is broadcast.
 *
 * Props:
 *   open      : boolean — visible when true
 *   onCancel  : () => void
 *   onConfirm : () => void   // fires only after checkbox ticked + user confirms
 */
export default function HomeVisitConsentGate({ open, onCancel, onConfirm }) {
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hv-consent-title"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(15,23,42,.55)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          background: "#fff", borderRadius: "22px 22px 0 0",
          padding: "18px 18px 22px", boxShadow: "0 -10px 40px rgba(0,0,0,.28)",
          maxHeight: "88%", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 99, background: "#E2E8F0", margin: "0 auto 14px" }} />

        <p id="hv-consent-title" style={{ margin: 0, fontWeight: 900, fontSize: 17, color: "#0F172A" }}>
          Home-visit consent
        </p>
        <p style={{ margin: "4px 0 14px", fontSize: 12, color: "#64748B", lineHeight: 1.5 }}>
          Please confirm you consent to this home visit before we broadcast the request.
        </p>

        <div
          style={{
            background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 14,
            padding: "12px 13px", overflowY: "auto", flex: expanded ? 1 : "0 0 auto",
            maxHeight: expanded ? "100%" : 130, transition: "max-height .2s",
          }}
        >
          <p style={{ margin: 0, fontSize: 12.5, color: "#0F172A", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {expanded ? HOME_VISIT_CONSENT.text : HOME_VISIT_CONSENT.summary}
          </p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              marginTop: 8, background: "none", border: "none", padding: 0,
              color: "#2563EB", fontWeight: 700, fontSize: 11.5, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {expanded ? "Show less" : "Read full text"}
          </button>
          <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "#94A3B8" }}>
            Policy version: {HOME_VISIT_CONSENT.version}
          </p>
        </div>

        <label
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "12px 4px 4px", cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{ marginTop: 3, width: 18, height: 18, accentColor: "#16A34A", cursor: "pointer" }}
          />
          <span style={{ fontSize: 12.5, color: "#0F172A", lineHeight: 1.5, fontWeight: 600 }}>
            I have read and I consent to the home visit on the terms above.
          </span>
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px", borderRadius: 12,
              border: "1px solid #E2E8F0", background: "#fff",
              color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            disabled={!checked}
            onClick={onConfirm}
            style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: checked ? "linear-gradient(135deg,#16A34A,#15803D)" : "#CBD5E1",
              color: "#fff", fontWeight: 800, fontSize: 13,
              cursor: checked ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            Confirm & broadcast
          </button>
        </div>

        <p style={{ margin: "10px 0 0", fontSize: 10, color: "#94A3B8", textAlign: "center" }}>
          Your consent is timestamped server-side and stored securely for your booking record.
        </p>
      </div>
    </div>
  );
}
