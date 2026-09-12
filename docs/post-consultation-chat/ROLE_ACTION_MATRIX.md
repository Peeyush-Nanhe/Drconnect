# Post-consultation role/action matrix

This is the required enforcement contract. Test results and any incomplete enforcement are recorded in `IMPLEMENTATION_STATUS.md`. All checks use authenticated UUIDs and current server records, never names, a client-selected role or editable Auth user metadata.

| Actor | Open/read history | Send text | File upload/download | Call | Prescription | Spend credits | Support access |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Authenticated patient, eligible completed episode, current membership | Own authorised relationship/episode; paid-plan expiry alone does not hide history | Current episode, approved server allowance; one atomic debit per successful idempotent send | Disabled pending secure pipeline; future access must recheck same scope | Disabled pending provider/policy; future patient consent and allowance required | Structured request only; no self-issuance or automatic fee | Own approved entitlement through guarded server operation only | No |
| Assigned doctor, trusted approved role and required verified credentials | Own authorised patient relationship/episode, subject to current access/safety policy | Correct clinician sender; free even if patient's outgoing allowance exhausted | Disabled; future participant scope required | Disabled; no free-media or patient-charge inference from free replies | Review/decline own request; issued only with linked real signed clinical record | No patient debit for text reply; other billing disabled | No automatic support role |
| Caregiver/dependent/delegate | Disabled until actual delegation and permitted history scope exist | Disabled; future sender must log caregiver UUID, not impersonate patient | Disabled | Disabled | Disabled | Disabled | No |
| Unrelated authenticated patient/provider or wrong organisation | No | No | No | No | No | No | No |
| Patient with expired/exhausted outgoing allowance, otherwise authorised | Yes, subject to independent access policy | Reject patient outgoing save/debit; retain unsent text for explicit retry | Disabled | Disabled | Follow approved request quota policy; no inferred charge | No negative balance | No |
| Suspended/revoked participant or clinician credentials | Apply current explicit access restriction; revoke subscriptions and clear exposed state on detection | Reject immediately on server recheck | No | No | No | No | No |
| Ordinary support/admin/facility label | No automatic clinical-chat access | No impersonation | No | No | No | No | Permission-scoped audited workflow must be separately implemented/approved |
| Service worker / operator | Only minimum necessary scoped work; possession of key is not product-level support authority | No fabricated clinician reply | Disabled pending configured scanner/finaliser | Disabled pending provider | Cannot fabricate signed issuance | Only verified future payment reconciliation | Retention/reconciliation operations require explicit approved scope and audit |
| Signed out / stale actor after account switch | No | No | No | No | No | No | No |

RLS, narrowly granted RPCs, storage policies and Realtime row visibility must enforce the same participant boundary. Knowing a conversation ID grants nothing. Restrict direct writes that could bypass membership, identity, quotas, idempotency or prescription transitions. Elevated functions need current `auth.uid()` identity checks, safe schema/search path and restricted execution grants.

Current clinician eligibility is independent of urgent-dispatch Online/Offline. Going offline must not remove the follow-up inbox. Presence is unavailable unless an authenticated, scoped and expiring presence mechanism exists; it never guarantees response.

Client lifecycle must remove subscriptions, clear message/draft caches on logout/account change and ignore stale responses from a prior actor. Failed writes and denied reads must not substitute sample data. Avoid persisting clinical drafts offline without an approved storage policy. Receipts require actual recipient page/device acknowledgement; a database insert is only saved.

The legacy `service_referrals` policies are broader than this matrix. They do not authorise broad access to the new chat tables or justify copying full patient records into a conversation.
