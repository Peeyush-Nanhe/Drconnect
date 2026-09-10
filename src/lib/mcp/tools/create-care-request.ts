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
  name: "create_care_request",
  title: "Create care request",
  description:
    "Create a new care request (doctor, nurse, lab, scan, physio, technician, home-care) for the signed-in patient.",
  inputSchema: {
    specialty: z.string().min(1).describe("Specialty or service kind (e.g. 'doctor', 'nurse', 'lab')."),
    notes: z.string().max(2000).optional().describe("Symptoms or notes for the provider."),
    address: z.string().max(500).optional().describe("Visit address, if home-visit."),
    scheduled_for: z
      .string()
      .datetime()
      .optional()
      .describe("ISO timestamp for a planned booking; omit for urgent."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ specialty, notes, address, scheduled_for }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const { data, error } = await sb(ctx)
      .from("care_requests")
      .insert({
        patient_id: ctx.getUserId(),
        specialty,
        notes: notes ?? null,
        address: address ?? null,
        scheduled_for: scheduled_for ?? null,
        status: "pending",
      })
      .select()
      .single();
    if (error)
      return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { booking: data },
    };
  },
});
