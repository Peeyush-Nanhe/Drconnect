import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { getSharedAiHistory } from "@/lib/ai-history.functions";

export const Route = createFileRoute("/shared/ai/$token")({
  loader: async ({ params }) => {
    try {
      return await getSharedAiHistory({ data: { token: params.token } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Shared AI summary"} — MyDox` },
      { name: "description", content: "A shared AI summary from MyDox." },
    ],
  }),
  errorComponent: SharedAiError,
  notFoundComponent: () => (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Link not found</h1>
      <p style={{ color: "#64748b", marginTop: 8 }}>This shared summary is no longer available.</p>
    </div>
  ),
  component: SharedAiView,
});

function SharedAiError({ reset }: { reset: () => void }) {
  const router = useRouter();
  return (
    <div style={{ padding: 40, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>Couldn't load this shared summary</h1>
      <p style={{ color: "#64748b", marginTop: 8 }}>The link may have been revoked.</p>
      <button
        onClick={() => { router.invalidate(); reset(); }}
        style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, background: "#0ea5e9", color: "#fff", border: "none", cursor: "pointer" }}
      >
        Retry
      </button>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  triage: "AI Triage conversation",
  report: "AI Report analysis",
  voice: "Voice-assisted chat",
};

function SharedAiView() {
  const row = Route.useLoaderData() as any;
  const created = new Date(row.created_at).toLocaleString();
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", color: "#0f172a" }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: "#64748b", fontWeight: 800 }}>
        {KIND_LABEL[row.kind] || row.kind}
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 4px" }}>{row.title}</h1>
      <div style={{ color: "#64748b", fontSize: 12, marginBottom: 20 }}>Shared from MyDox · {created}</div>
      <RenderPayload kind={row.kind} payload={row.payload} />
      <p style={{ marginTop: 32, fontSize: 11, color: "#94a3b8" }}>
        This is a shared AI summary. It is informational only and not a substitute for professional medical advice.
      </p>
    </div>
  );
}

function RenderPayload({ kind, payload }: { kind: string; payload: any }) {
  if (!payload) return <div style={{ color: "#64748b" }}>No content.</div>;
  if (kind === "triage" || kind === "voice") {
    const messages: Array<{ role: string; content: string }> = payload.messages || [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ padding: "10px 14px", borderRadius: 12, background: m.role === "user" ? "#EFF6FF" : "#F1F5F9", border: `1px solid ${m.role === "user" ? "#BFDBFE" : "#E2E8F0"}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: 4 }}>{m.role === "user" ? "You" : "MedAI"}</div>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {payload.rec && (
          <div style={{ padding: 12, borderRadius: 12, background: "#ECFDF5", border: "1px solid #A7F3D0", fontSize: 13 }}>
            <b>Recommendation:</b> {payload.rec.name || payload.rec.id} — {payload.rec.reason}
          </div>
        )}
      </div>
    );
  }
  if (kind === "report") {
    const rows: any[] = payload.rows || [];
    const FLAG: Record<string, string> = { normal: "#16A34A", high: "#DC2626", low: "#2563EB", critical: "#7C3AED" };
    return (
      <div>
        {payload.narration && (
          <div style={{ padding: 12, borderRadius: 12, background: "#FFF7ED", border: "1px solid #FDBA74", marginBottom: 12, fontSize: 14 }}>
            {payload.narration}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: FLAG[r.flag] || "#ccc" }} />
              <span style={{ flex: 1, fontWeight: 700 }}>{r.analyte}</span>
              <span style={{ color: "#334155" }}>{r.value} {r.unit}</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>ref {r.refLow}–{r.refHigh}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(payload, null, 2)}</pre>;
}
