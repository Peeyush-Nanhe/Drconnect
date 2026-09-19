import React, { useState } from "react";
import { Image as ImageIcon, FileText, Download, X, Eye } from "lucide-react";

export type StagedAttachment = {
  name: string;
  size: string;
  type: "image" | "pdf";
  dataUrl: string;
};

export type ChatAttachment = {
  _type: "attachment";
  fileType: "image" | "pdf";
  name: string;
  size: string;
  dataUrl: string;
  caption?: string;
};

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function parseChatAttachment(body: string | null | undefined): ChatAttachment | null {
  if (!body || typeof body !== "string") return null;
  if (!body.startsWith('{"_type":"attachment"') && !body.startsWith('{"type":"attachment"')) {
    return null;
  }
  try {
    const parsed = JSON.parse(body);
    if ((parsed._type === "attachment" || parsed.type === "attachment") && parsed.fileType && parsed.dataUrl) {
      return parsed as ChatAttachment;
    }
  } catch {
    return null;
  }
  return null;
}

export function formatMessageSnippet(body: string | null | undefined): string {
  if (!body) return "";
  const att = parseChatAttachment(body);
  if (att) {
    if (att.fileType === "image") {
      return att.caption ? `📷 Photo: ${att.caption}` : "📷 Photo";
    }
    if (att.fileType === "pdf") {
      const name = att.name ? ` · ${att.name}` : "";
      return att.caption ? `📄 PDF: ${att.caption}${name}` : `📄 PDF${name || " Document"}`;
    }
    return att.name ? `📎 Attachment: ${att.name}` : "📎 Attachment";
  }
  return body;
}

export function processImageFile(
  file: File,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.8
): Promise<{ name: string; size: string; type: "image"; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
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
        const approxBytes = Math.round((dataUrl.length * 3) / 4);
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

export function processPdfFile(
  file: File
): Promise<{ name: string; size: string; type: "pdf"; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error("PDF file size must be under 15MB"));
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

export function openPdfDataUrl(dataUrl: string, filename = "document.pdf"): void {
  try {
    const parts = dataUrl.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "application/pdf";
    const binary = atob(parts[1]);
    const len = binary.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
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
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (_e) {
    window.open(dataUrl, "_blank");
  }
}

export function downloadImageDataUrl(dataUrl: string, filename = "photo.jpg"): void {
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

/* ── UI Components ─────────────────────────────────────────────────── */

/**
 * Menu popup shown when user taps the '+' attachment button
 */
export function AttachmentMenu({
  onSelectPhoto,
  onSelectPdf,
  onClose
}: {
  onSelectPhoto: () => void;
  onSelectPdf: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1050,
          background: "transparent"
        }}
      />

      {/* Popover */}
      <div
        role="menu"
        aria-label="Attachment options"
        style={{
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
        }}
      >
        <button
          onClick={() => {
            onClose();
            onSelectPhoto();
          }}
          style={{
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
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#12382D")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(16, 185, 129, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <ImageIcon size={18} color="#10B981" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>Photo / Image</div>
            <div style={{ fontSize: 10.5, color: "#7B9E93" }}>Camera or Gallery</div>
          </div>
        </button>

        <button
          onClick={() => {
            onClose();
            onSelectPdf();
          }}
          style={{
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
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#12382D")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "rgba(239, 68, 68, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <FileText size={18} color="#EF4444" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>PDF Document</div>
            <div style={{ fontSize: 10.5, color: "#7B9E93" }}>Reports & Prescriptions</div>
          </div>
        </button>
      </div>
    </>
  );
}

/**
 * Preview bar shown right above the input row when a file is staged for sending
 */
export function AttachmentPreviewBar({
  attachment,
  onRemove
}: {
  attachment: { name: string; size: string; type: "image" | "pdf"; dataUrl: string };
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        padding: "8px 14px",
        background: "#081E17",
        borderTop: "1px solid #144436",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexShrink: 0
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        {attachment.type === "image" ? (
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              objectFit: "cover",
              border: "1px solid #1C4D3E"
            }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <FileText size={22} color="#EF4444" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 12.5,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 220
            }}
          >
            {attachment.name}
          </div>
          <div style={{ fontSize: 11, color: "#8EE0C4" }}>
            {attachment.size} · {attachment.type === "image" ? "Photo ready" : "PDF ready"}
          </div>
        </div>
      </div>

      <button
        onClick={onRemove}
        aria-label="Remove attachment"
        style={{
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
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/**
 * Renders attachment content inside a chat bubble
 */
export function ChatAttachmentBubbleContent({
  attachment,
  mine,
  onViewImage
}: {
  attachment: ChatAttachment;
  mine: boolean;
  onViewImage: (img: { name: string; dataUrl: string }) => void;
}) {
  if (attachment.fileType === "image") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          onClick={() => onViewImage({ name: attachment.name, dataUrl: attachment.dataUrl })}
          style={{
            position: "relative",
            borderRadius: 12,
            overflow: "hidden",
            cursor: "pointer",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "#000"
          }}
        >
          <img
            src={attachment.dataUrl}
            alt={attachment.name}
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: 240,
              width: "auto",
              objectFit: "cover",
              borderRadius: 12
            }}
          />
          <div
            style={{
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
            }}
          >
            <Eye size={12} /> View
          </div>
        </div>
        {attachment.caption ? (
          <p style={{ margin: "2px 0 0", fontSize: 13.5, lineHeight: 1.45, color: "#fff" }}>
            {attachment.caption}
          </p>
        ) : null}
      </div>
    );
  }

  // PDF Document Card
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          background: mine ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 200,
          maxWidth: 280
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <FileText size={22} color="#EF4444" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 13,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
            title={attachment.name}
          >
            {attachment.name}
          </div>
          <div style={{ fontSize: 11, color: "#A7F3D0", marginTop: 2 }}>
            {attachment.size} · PDF
          </div>
        </div>
        <button
          onClick={() => openPdfDataUrl(attachment.dataUrl, attachment.name)}
          title="Open / Download PDF"
          aria-label={`Open ${attachment.name}`}
          style={{
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
          }}
        >
          <Download size={16} />
        </button>
      </div>
      {attachment.caption ? (
        <p style={{ margin: "2px 0 0", fontSize: 13.5, lineHeight: 1.45, color: "#fff" }}>
          {attachment.caption}
        </p>
      ) : null}
    </div>
  );
}

/**
 * High-res Image Lightbox Modal
 */
export function ImageLightboxModal({
  image,
  onClose
}: {
  image: { name: string; dataUrl: string } | null;
  onClose: () => void;
}) {
  if (!image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2500,
        background: "rgba(0, 0, 0, 0.92)",
        backdropFilter: "blur(6px)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      {/* Lightbox Header */}
      <div
        style={{
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(0,0,0,0.6)"
        }}
      >
        <div
          style={{
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "60%"
          }}
        >
          {image.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => downloadImageDataUrl(image.dataUrl, image.name)}
            style={{
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
            }}
          >
            <Download size={15} /> Download
          </button>
          <button
            onClick={onClose}
            aria-label="Close image preview"
            style={{
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
            }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Lightbox Image Viewport */}
      <div
        onClick={onClose}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}
      >
        <img
          src={image.dataUrl}
          alt={image.name}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: "92vw",
            maxHeight: "84vh",
            objectFit: "contain",
            borderRadius: 8,
            boxShadow: "0 12px 40px rgba(0,0,0,0.8)"
          }}
        />
      </div>
    </div>
  );
}
