import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" },
});

export const Route = createFileRoute("/api/internal/home-visits/jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.HOME_VISIT_JOB_SECRET;
        if (!expected || expected.length < 32) return response({ error: "Home-visit jobs are not configured" }, 503);
        const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
        const a = Buffer.from(supplied);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) return response({ error: "Unauthorized" }, 401);
        try {
          const { runHomeVisitJobs } = await import("@/lib/home-visits-jobs.server");
          return response(await runHomeVisitJobs());
        } catch {
          return response({ error: "Home-visit jobs failed; retry is safe" }, 503);
        }
      },
    },
  },
});
