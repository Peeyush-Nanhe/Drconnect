export type HomeVisitJob = {
  id: string;
  booking_id: string;
  recipient_id: string;
  channel: string;
  lease_token: string;
};

type JobServices = {
  expire: () => Promise<unknown>;
  claim: () => Promise<HomeVisitJob[]>;
  finish: (job: HomeVisitJob, sent: boolean, error: string | null) => Promise<void>;
  send: (job: HomeVisitJob) => Promise<{ targeted: number; sent: number; failed: number; skipped: number }>;
};

// The database owns leases, retries and backoff. FCM acceptance is reported as
// sent, never as proof of delivery to an app or a person.
export async function processHomeVisitJobs(services: JobServices) {
  await services.expire();
  const jobs = await services.claim();
  const totals = { claimed: jobs.length, sent: 0, failed: 0 };
  for (const job of jobs) {
    let sent = false;
    let error: string | null = null;
    try {
      if (job.channel !== "push") error = "Notification channel is not enabled";
      else {
        const result = await services.send(job);
        sent = result.targeted > 0 && result.sent === result.targeted && result.failed === 0 && result.skipped === 0;
        if (!sent) error = result.targeted === 0 ? "No enabled device token" : "Push transport did not accept every delivery";
      }
    } catch {
      // Transport error bodies can contain device tokens or provider metadata.
      error = "Push transport failed; retry scheduled";
    }
    // A failure here leaves the lease for guarded reclamation. Never silently
    // swallow a failed acknowledgement and claim a successful batch.
    await services.finish(job, sent, error);
    if (sent) totals.sent++;
    else totals.failed++;
  }
  return totals;
}
