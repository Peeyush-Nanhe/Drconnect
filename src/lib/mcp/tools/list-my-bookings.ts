import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_my_bookings",
  title: "List my bookings",
  description:
    "List the signed-in user's care requests (doctor/nurse/lab/scan/etc.), newest first.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max rows to return. Default 20."),
    status: z
      .string()
      .optional()
      .describe("Optional status filter (e.g. 'pending', 'accepted', 'completed', 'cancelled')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const client = sb(ctx);
    let q = client
      .from("care_requests")
      .select("id, specialty, status, created_at, scheduled_for, address, notes")
      .eq("patient_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
