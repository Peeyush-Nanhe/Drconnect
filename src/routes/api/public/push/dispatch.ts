import { createFileRoute } from "@tanstack/react-router";

type Payload = {
  user_ids?: unknown;
  title?: unknown;
  body?: unknown;
  data?: unknown;
  topic?: unknown;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const Route = createFileRoute("/api/public/push/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PUSH_DISPATCH_SECRET"];
        if (!secret) return json({ error: "dispatch not configured" }, 503);

        const provided = request.headers.get("x-push-secret") ?? "";
        if (!provided || !timingSafeEqual(provided, secret)) {
          return json({ error: "unauthorized" }, 401);
        }

        let payload: Payload;
        try {
          payload = (await request.json()) as Payload;
        } catch {
          return json({ error: "invalid JSON body" }, 400);
        }

        const userIds = Array.isArray(payload.user_ids)
          ? payload.user_ids.filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            )
          : [];
        const title = typeof payload.title === "string" ? payload.title.trim() : "";
        const body = typeof payload.body === "string" ? payload.body.trim() : "";

        if (userIds.length === 0 || userIds.length > 500)
          return json({ error: "user_ids must contain 1-500 ids" }, 400);
        if (!title || title.length > 200) return json({ error: "title required (<=200)" }, 400);
        if (!body || body.length > 1000) return json({ error: "body required (<=1000)" }, 400);

        const rawData =
          payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
            ? (payload.data as Record<string, unknown>)
            : {};
        const data: Record<string, string> = {};
        for (const [k, v] of Object.entries(rawData).slice(0, 20)) {
          data[k] = typeof v === "string" ? v.slice(0, 500) : String(v).slice(0, 500);
        }

        try {
          const { dispatchPush } = await import("@/lib/push.server");
          const result = await dispatchPush(userIds, {
            title,
            body,
            data,
            topic: typeof payload.topic === "string" ? payload.topic.slice(0, 100) : null,
          });
          return json({ ok: true, ...result });
        } catch (e) {
          console.error("[push/dispatch]", e);
          return json({ error: "dispatch failed" }, 500);
        }
      },
    },
  },
});
