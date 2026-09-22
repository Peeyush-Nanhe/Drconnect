import { supabaseAdmin } from "./client.server-Bw6iWMJ-.js";
import { dispatchPush } from "./push.server-DUikjrTP.js";
//#region src/lib/home-visits-jobs.ts
async function processHomeVisitJobs(services) {
	await services.expire();
	const jobs = await services.claim();
	const totals = {
		claimed: jobs.length,
		sent: 0,
		failed: 0
	};
	for (const job of jobs) {
		let sent = false;
		let error = null;
		try {
			if (job.channel !== "push") error = "Notification channel is not enabled";
			else {
				const result = await services.send(job);
				sent = result.targeted > 0 && result.sent === result.targeted && result.failed === 0 && result.skipped === 0;
				if (!sent) error = result.targeted === 0 ? "No enabled device token" : "Push transport did not accept every delivery";
			}
		} catch {
			error = "Push transport failed; retry scheduled";
		}
		await services.finish(job, sent, error);
		if (sent) totals.sent++;
		else totals.failed++;
	}
	return totals;
}
//#endregion
//#region src/lib/home-visits-jobs.server.ts
async function jobRpc(name, args = {}) {
	const result = await supabaseAdmin.rpc(name, args);
	if (result.error) throw new Error("Home-visit job persistence failed");
	return result.data;
}
function runHomeVisitJobs() {
	return processHomeVisitJobs({
		expire: () => jobRpc("hv_expire_pending"),
		claim: () => jobRpc("hv_claim_notifications", { p_limit: 20 }),
		finish: (job, sent, error) => jobRpc("hv_finish_notification", {
			p_id: job.id,
			p_lease_token: job.lease_token,
			p_delivered: sent,
			p_error: error
		}),
		send: (job) => dispatchPush([job.recipient_id], {
			title: "MyDox visit update",
			body: "Open MyDox to review your visit update.",
			data: {
				booking_id: job.booking_id,
				event_id: job.id
			},
			topic: "home_visit"
		})
	});
}
//#endregion
export { runHomeVisitJobs };
