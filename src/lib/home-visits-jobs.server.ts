import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchPush } from "@/lib/push.server";
import { processHomeVisitJobs, type HomeVisitJob } from "@/lib/home-visits-jobs";

type Result = { data: unknown; error: { message: string } | null };
async function jobRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result: Result = await (supabaseAdmin.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<Result>)(name, args);
  if (result.error) throw new Error("Home-visit job persistence failed");
  return result.data as T;
}

export function runHomeVisitJobs() {
  return processHomeVisitJobs({
    expire: () => jobRpc("hv_expire_pending"),
    claim: () => jobRpc<HomeVisitJob[]>("hv_claim_notifications", { p_limit: 20 }),
    finish: (job, sent, error) => jobRpc<void>("hv_finish_notification", {
      p_id: job.id, p_lease_token: job.lease_token, p_delivered: sent, p_error: error,
    }),
    send: (job) => dispatchPush([job.recipient_id], {
      title: "MyDox visit update",
      body: "Open MyDox to review your visit update.",
      data: { booking_id: job.booking_id, event_id: job.id },
      topic: "home_visit",
    }),
  });
}
